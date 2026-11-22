import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  driverLocations,
  drivers,
  users,
  fareEstimates,
  orderEvents,
  orders,
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
import { sendMaxNotification } from "@/shared/max-notify";
import { haversineMeters } from "@/core/geo";
import { ACTIVE_STATUSES, CANCELLABLE_STATUSES, addOrderEvent, advanceSimulation, releaseDriver } from "./dispatch";

import type { OrderView, OrderSummary } from "@/shared/types";

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

  const [order] = await db.insert(orders).values({
    id: newId(),
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
  // Отправляем уведомления свободным водителям этого тарифа ПОЛНОСТЬЮ В ФОНЕ,
  // чтобы время отклика пассажира не зависело от числа онлайн-водителей.
  void (async () => {
    try {
      const availableDrivers = await db
        .select({ phone: users.phone, driverId: drivers.id, name: drivers.name })
        .from(drivers)
        .innerJoin(vehicles, eq(vehicles.driverId, drivers.id))
        .innerJoin(users, eq(users.id, drivers.userId))
        // Уведомления получают только водители с текущей ролью driver:
        // бывший пассажир, сменивший роль, не должен видеть чужие заказы.
        .where(and(eq(users.role, "driver"), eq(drivers.isOnline, true), eq(drivers.isBusy, false), eq(vehicles.tariffId, tariffId)));

      for (const d of availableDrivers) {
        if (d.phone && d.phone.startsWith("max_")) {
          const maxId = d.phone.replace("max_", "");
          const text = `🔔 Новый заказ!\nОткуда: ${order.pickupAddress}\nКуда: ${order.destinationAddress}\nЦена: ${(quote.price / 100).toFixed(0)} ₽\n\nДля принятия заказа нажми Открыть 👇🏻`;

          const keyboard = {
            buttons: [
              [
                { type: "callback", text: "✅ Принять", payload: `accept_order:${order.id}` },
                { type: "callback", text: "❌ Отказаться", payload: `decline_order:${order.id}` }
              ]
            ]
          };

          try {
            await sendMaxNotification(maxId, text, keyboard);
          } catch (err) {
            console.error("Ошибка отправки MAX-уведомления:", err);
          }
          // Задержка, чтобы не превысить лимит 2 сообщения в секунду
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    } catch (e) {
      console.error("Ошибка оповещения водителей:", e);
    }
  })();

  return order;
}

/** Заказ пассажира по id с проверкой владения. */
async function loadOwnOrder(user: User, orderId: string): Promise<Order> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw Errors.notFound("Заказ");
  if (order.passengerId !== user.id) throw Errors.forbidden();
  return order;
}

/** Полное представление заказа для пассажира: водитель, автомобиль, позиция. */
export async function getOrderView(user: User, orderId: string): Promise<OrderView> {
  const order = await advanceSimulation(await loadOwnOrder(user, orderId));

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
    driver,
    simulation: order.simulation, // <--- Добавили маршрут водителя
  };
}

/** Отмена заказа пассажиром (только на ранних стадиях). */
export async function cancelOrder(user: User, orderId: string): Promise<Order> {
  const order = await advanceSimulation(await loadOwnOrder(user, orderId));
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw new AppError("cannot_cancel", "Заказ уже нельзя отменить", 409);
  }
  const [updated] = await db
    .update(orders)
    .set({ status: "cancelled", cancelReason: "Заказ отменён пассажиром", cancelledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(orders.id, order.id), inArray(orders.status, CANCELLABLE_STATUSES)))
    .returning();
  if (!updated) throw new AppError("cannot_cancel", "Заказ уже нельзя отменить", 409);
  await releaseDriver(updated.driverId);
  // Событие попадает в ленту уведомлений пассажира: «Заказ отменён».
  await addOrderEvent(updated, "passenger_cancelled");

  return updated;
}

/** Активный заказ пассажира (для восстановления состояния после перезапуска). */
export async function getActiveOrderIds(user: User): Promise<{ orderId: string | null }> {
  const [active] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.passengerId, user.id), inArray(orders.status, ACTIVE_STATUSES)))
    .orderBy(desc(orders.createdAt))
    .limit(1);
  return { orderId: active?.id ?? null };
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
