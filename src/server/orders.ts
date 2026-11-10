import crypto from "node:crypto";
import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  driverLocations,
  drivers,
  fareEstimates,
  orderEvents,
  orders,
  payments,
  tariffs,
  vehicles,
  type Driver,
  type FareQuote,
  type Order,
  type Tariff,
  type User,
  type Vehicle,
} from "@/db/schema";
import { AppError, Errors } from "@/core/errors";
import { newId } from "./ids";
import { haversineMeters } from "@/core/geo";
import { ACTIVE_STATUSES, CANCELLABLE_STATUSES, UNPAID_STATUSES, advanceSimulation, releaseDriver } from "./dispatch";
import { isYooKassaConfigured, syncPayment } from "./yookassa";
import type { OrderView, OrderSummary } from "@/shared/types";

const PAYMENT_SYNC_INTERVAL_MS = 5_000;

/** Создание заказа на основе серверной оценки. Статус выставляет сервер. */
export async function createOrder(user: User, estimateId: string, tariffId: string): Promise<Order> {
  const [rawEstimate] = await db.select().from(fareEstimates).where(eq(fareEstimates.id, estimateId));
  if (!rawEstimate || rawEstimate.userId !== user.id) throw Errors.notFound("Расчёт стоимости");

  const estimate = {
    ...rawEstimate,
    quotes: rawEstimate.quotes as FareQuote[],
    routeGeometry: rawEstimate.routeGeometry as [number, number][]
  };

  if (new Date(estimate.expiresAt).getTime() < Date.now()) {
    throw new AppError("estimate_expired", "Расчёт стоимости устарел.", 409);
  }

  const quote = (estimate.quotes as FareQuote[]).find((q: FareQuote) => q.tariffId === tariffId);
  if (!quote) throw Errors.validation("Выбранный тариф недоступен для этого маршрута");

  const [tariff] = await db.select().from(tariffs).where(eq(tariffs.id, tariffId));
  if (!tariff || !tariff.isActive) throw Errors.validation("Тариф недоступен");

  const active = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.passengerId, user.id), inArray(orders.status, ACTIVE_STATUSES)))
    .limit(1);
  if (active.length > 0) throw new AppError("active_order_exists", "У вас уже есть активный заказ", 409);

  const orderId = crypto.randomUUID();



  const [order] = await db.insert(orders).values({
    id: crypto.randomUUID(),
    passengerId: user.id,
    status: "searching",
    pickupAddress: estimate.pickupAddress,
    pickupLat: Number(estimate.pickupLat),
    pickupLng: Number(estimate.pickupLng),
    destinationAddress: estimate.destinationAddress,
    destinationLat: Number(estimate.destinationLat),
    destinationLng: Number(estimate.destinationLng),
    tariffId,
    tariffVersion: quote.tariffVersion,
    estimateId: estimate.id,
    estimatedPrice: quote.price,
    currency: "RUB",
    distanceMeters: estimate.distanceMeters,
    durationSeconds: estimate.durationSeconds,
    routeGeometry: typeof estimate.routeGeometry === 'string' ? JSON.parse(estimate.routeGeometry) : estimate.routeGeometry,
  }).returning();
  return order;
}

/** Заказ пассажира по id с проверкой владения. */
async function loadOwnOrder(user: User, orderId: string): Promise<Order> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw Errors.notFound("Заказ");
  if (order.passengerId !== user.id) throw Errors.forbidden();
  return order;
}

/** Полное представление заказа для пассажира: водитель, автомобиль, позиция, платёж. */
export async function getOrderView(user: User, orderId: string): Promise<OrderView> {
  let order = await loadOwnOrder(user, orderId);
  order = await advanceSimulation(order);

  const [tariff] = await db.select().from(tariffs).where(eq(tariffs.id, order.tariffId));

  let driver: OrderView["driver"] = null;
  if (order.driverId) {
    const rows = await db
      .select({ driver: drivers, vehicle: vehicles, location: driverLocations })
      .from(drivers)
      .leftJoin(vehicles, eq(vehicles.id, order.vehicleId ?? ""))
      .leftJoin(driverLocations, eq(driverLocations.driverId, drivers.id))
      .where(eq(drivers.id, order.driverId));
    const row = rows[0];
    if (row) {
      const location = row.location
        ? { latitude: row.location.latitude, longitude: row.location.longitude, heading: row.location.heading }
        : null;
      const pickup = { latitude: order.pickupLat, longitude: order.pickupLng };
      const distanceToPassenger = location ? Math.round(haversineMeters(location, pickup)) : null;
      // Оценка прибытия: ~25 км/ч по городу
      const etaSeconds = distanceToPassenger !== null ? Math.round(distanceToPassenger / (25 / 3.6)) : null;
      driver = {
        id: row.driver.id,
        name: row.driver.name,
        photoUrl: row.driver.photoUrl,
        rating: row.driver.rating,
        isSimulated: row.driver.isSimulated,
        vehicle: row.vehicle
          ? {
              brand: row.vehicle.brand,
              model: row.vehicle.model,
              color: row.vehicle.color,
              plate: row.vehicle.plate,
              tariffName: tariff?.name ?? order.tariffId,
            }
          : null,
        location,
        distanceToPassengerMeters: distanceToPassenger,
        etaSeconds,
      };
    }
  }

  let [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, order.id))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  // Незавершённый платёж сверяем с ЮKassa (не чаще раза в 5 секунд), чтобы статус обновлялся
  // даже без webhook и без возврата пользователя из платёжного окна.
  if (
    payment &&
    (payment.status === "pending" || payment.status === "waiting_for_capture") &&
    Date.now() - new Date(payment.updatedAt).getTime() > PAYMENT_SYNC_INTERVAL_MS
  ) {
    try {
      const synced = await syncPayment(payment);
      if (synced.status !== payment.status) {
        [order] = await db.select().from(orders).where(eq(orders.id, order.id));
      }
      payment = synced;
    } catch (error) {
      console.warn("[orders] Не удалось сверить платёж с ЮKassa:", (error as Error).message);
    }
  }

  return {
    id: order.id,
    status: order.status,
    pickup: { address: order.pickupAddress, latitude: order.pickupLat, longitude: order.pickupLng },
    destination: {
      address: order.destinationAddress,
      latitude: order.destinationLat,
      longitude: order.destinationLng,
    },
    tariffId: order.tariffId,
    tariffName: tariff?.name ?? order.tariffId,
    tariffVersion: order.tariffVersion,
    estimatedPrice: order.estimatedPrice,
    finalPrice: order.finalPrice,
    currency: order.currency,
    distanceMeters: order.distanceMeters,
    durationSeconds: order.durationSeconds,
    routeGeometry: typeof order.routeGeometry === 'string' ? JSON.parse(order.routeGeometry) : order.routeGeometry,
    cancelReason: order.cancelReason,
    canCancel: CANCELLABLE_STATUSES.includes(order.status),
    createdAt: new Date(order.createdAt).toISOString(),
    completedAt: order.completedAt ? new Date(order.completedAt).toISOString() : null,
    paidAt: order.paidAt ? new Date(order.paidAt).toISOString() : null,
    driver,
    payment: payment
      ? {
          id: payment.id,
          status: payment.status,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          confirmationUrl: payment.confirmationUrl,
          failureReason: payment.failureReason,
        }
      : null,
  };
}

/** Отмена заказа пассажиром (только на ранних стадиях). */
export async function cancelOrder(user: User, orderId: string): Promise<Order> {
  let order = await loadOwnOrder(user, orderId);
  order = await advanceSimulation(order);
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw new AppError("cannot_cancel", "Заказ уже нельзя отменить", 409);
  }
  const [updated] = await db
    .update(orders)
    .set({ status: "cancelled", cancelReason: "Отменён пассажиром", cancelledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(orders.id, order.id), inArray(orders.status, CANCELLABLE_STATUSES)))
    .returning();
  if (!updated) throw new AppError("cannot_cancel", "Заказ уже нельзя отменить", 409);
  await releaseDriver(updated.driverId);
  return updated;
}

/** Активный и неоплаченный заказы пассажира (для восстановления состояния после перезапуска). */
export async function getActiveOrderIds(user: User): Promise<{ orderId: string | null; unpaidOrderId: string | null }> {
  const [active] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.passengerId, user.id), inArray(orders.status, ACTIVE_STATUSES)))
    .orderBy(desc(orders.createdAt))
    .limit(1);
  const [unpaid] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.passengerId, user.id), inArray(orders.status, UNPAID_STATUSES)))
    .orderBy(desc(orders.createdAt))
    .limit(1);
  return { orderId: active?.id ?? null, unpaidOrderId: unpaid?.id ?? null };
}

/** История заказов пассажира — только собственные. */
export async function listOrders(user: User): Promise<OrderSummary[]> {
  const rows = await db
    .select({ order: orders, tariff: tariffs, driver: drivers, vehicle: vehicles })
    .from(orders)
    .leftJoin(tariffs, eq(tariffs.id, orders.tariffId))
    .leftJoin(drivers, eq(drivers.id, orders.driverId))
    .leftJoin(vehicles, eq(vehicles.id, orders.vehicleId))
    .where(eq(orders.passengerId, user.id))
    .orderBy(desc(orders.createdAt))
    .limit(100);

  return rows.map((row: { order: Order; tariff: Tariff | null; driver: Driver | null; vehicle: Vehicle | null }) => {
    const { order, tariff, driver, vehicle } = row;
    return {
    id: order.id,
    status: order.status,
    createdAt: new Date(order.createdAt).toISOString(),
    pickupAddress: order.pickupAddress,
    destinationAddress: order.destinationAddress,
    tariffName: tariff?.name ?? order.tariffId,
    price: order.finalPrice ?? order.estimatedPrice,
    currency: order.currency,
    driverName: driver?.name ?? null,
    vehicle: vehicle ? `${vehicle.brand} ${vehicle.model}, ${vehicle.color.toLowerCase()}, ${vehicle.plate}` : null,
    };
  });
}

/** Последние события по заказам пассажира (in-app уведомления). */
export async function listRecentEvents(user: User, sinceIso: string | null) {
  const since = sinceIso ? new Date(sinceIso) : new Date(Date.now() - 60_000);
  const rows = await db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.passengerId, user.id))
    .orderBy(desc(orderEvents.createdAt))
    .limit(20);
  return rows
    .filter((e: { createdAt: Date }) => e.createdAt.getTime() > since.getTime())
    .reverse()
    .map((e: { id: string; orderId: string; type: string; title: string; body: string; createdAt: Date }) => ({
      id: e.id,
      orderId: e.orderId,
      type: e.type,
      title: e.title,
      body: e.body,
      createdAt: e.createdAt.toISOString(),
    }));
}
