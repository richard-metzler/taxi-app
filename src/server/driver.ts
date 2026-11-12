import "server-only";
import { and, asc, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { driverLocations, drivers, orders, tariffs, users, vehicles, type Driver, type Order } from "@/db/schema";
import { AppError, Errors } from "@/core/errors";
import { DRIVER_TRANSITIONS, canDeclineStatus, isDriverAction, nextDriverAction } from "@/core/driver-flow";
import { haversineMeters, isValidLatLng, type LatLng } from "@/core/geo";
import type {
  AvailableOrderView,
  DriverOrderView,
  DriverStateView,
  DriverTripView,
  DriverVehicleView,
} from "@/shared/driver-types";
import { resolveSession } from "./auth";
import { addOrderEvent, SEARCH_TIMEOUT_MS } from "./dispatch";
import { recordAuthDiagnostic } from "./diagnostics";

/** Заказы дальше этого расстояния от водителя ему не предлагаются. */
export const MAX_PICKUP_DISTANCE_KM = 120;

const ACTIVE_DRIVER_STATUSES: Order["status"][] = ["driver_assigned", "driver_arriving", "driver_waiting", "in_progress"];

/** Требует авторизованного водителя и возвращает его профиль. Роль проверяется сервером. */
export async function requireDriver(): Promise<{ driver: Driver }> {
  const session = await resolveSession();
  if (!session) {
    await recordAuthDiagnostic("unauthorized", null);
    throw Errors.unauthorized();
  }
  if (session.user.role !== "driver") {
    throw new AppError("forbidden", "Этот раздел предназначен для водителей", 403);
  }
  const [driver] = await db.select().from(drivers).where(eq(drivers.userId, session.user.id));
  if (!driver) throw new AppError("driver_profile_missing", "Профиль водителя не найден", 404);
  return { driver };
}

async function loadVehicle(driverId: string): Promise<DriverVehicleView & { id: string }> {
  const [row] = await db
    .select({ vehicle: vehicles, tariffName: tariffs.name })
    .from(vehicles)
    .leftJoin(tariffs, eq(tariffs.id, vehicles.tariffId))
    .where(eq(vehicles.driverId, driverId))
    .limit(1);
  if (!row) throw new AppError("vehicle_missing", "Не указан автомобиль водителя", 409);
  const { vehicle } = row;
  return {
    id: vehicle.id,
    brand: vehicle.brand,
    model: vehicle.model,
    color: vehicle.color,
    plate: vehicle.plate,
    tariffId: vehicle.tariffId,
    tariffName: row.tariffName ?? vehicle.tariffId,
  };
}

async function loadLocation(driverId: string): Promise<LatLng | null> {
  const [row] = await db.select().from(driverLocations).where(eq(driverLocations.driverId, driverId));
  return row ? { latitude: row.latitude, longitude: row.longitude } : null;
}

/** SELECT + INSERT/UPDATE: UPSERT адаптера YDB для этой таблицы не используется. */
async function upsertLocation(driverId: string, point: LatLng, heading: number): Promise<void> {
  const values = { latitude: point.latitude, longitude: point.longitude, heading, updatedAt: new Date() };
  const [existing] = await db.select({ driverId: driverLocations.driverId }).from(driverLocations).where(eq(driverLocations.driverId, driverId));
  if (existing) {
    await db.update(driverLocations).set(values).where(eq(driverLocations.driverId, driverId));
    return;
  }
  try {
    await db.insert(driverLocations).values({ driverId, ...values });
  } catch {
    await db.update(driverLocations).set(values).where(eq(driverLocations.driverId, driverId));
  }
}

/** Состояние водителя: профиль, автомобиль и текущий заказ. */
export async function getDriverState(driver: Driver): Promise<DriverStateView> {
  const vehicle = await loadVehicle(driver.id).catch(() => null);
  const [row] = await db
    .select({ order: orders, passenger: users, tariffName: tariffs.name })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.passengerId))
    .leftJoin(tariffs, eq(tariffs.id, orders.tariffId))
    .where(and(eq(orders.driverId, driver.id), inArray(orders.status, ACTIVE_DRIVER_STATUSES)))
    .orderBy(desc(orders.createdAt))
    .limit(1);

  const currentOrder: DriverOrderView | null = row
    ? {
        id: row.order.id,
        status: row.order.status,
        pickup: { address: row.order.pickupAddress, latitude: row.order.pickupLat, longitude: row.order.pickupLng },
        destination: {
          address: row.order.destinationAddress,
          latitude: row.order.destinationLat,
          longitude: row.order.destinationLng,
        },
        tariffName: row.tariffName ?? row.order.tariffId,
        price: row.order.finalPrice ?? row.order.estimatedPrice,
        distanceMeters: row.order.distanceMeters,
        durationSeconds: row.order.durationSeconds,
        routeGeometry: row.order.routeGeometry,
        passenger: { name: row.passenger.name || "Пассажир", phone: row.passenger.phone },
        createdAt: new Date(row.order.createdAt).toISOString(),
        nextAction: nextDriverAction(row.order.status),
        canDecline: canDeclineStatus(row.order.status),
      }
    : null;

  return {
    driver: {
      id: driver.id,
      name: driver.name,
      rating: driver.rating,
      isOnline: driver.isOnline,
      isApproved: driver.isApproved,
      vehicle: vehicle
        ? {
            brand: vehicle.brand,
            model: vehicle.model,
            color: vehicle.color,
            plate: vehicle.plate,
            tariffId: vehicle.tariffId,
            tariffName: vehicle.tariffName,
          }
        : null,
    },
    currentOrder,
  };
}

/** Выход на линию (нужна текущая позиция) и уход с линии (нельзя во время заказа). */
export async function setDriverOnline(driver: Driver, online: boolean, position: unknown): Promise<{ isOnline: boolean }> {
  if (online) {
    if (!driver.isApproved) {
      throw new AppError("not_approved", "Ваша анкета еще на модерации. Дождитесь одобрения.", 403);
    }
    await loadVehicle(driver.id);
    if (!isValidLatLng(position as Partial<LatLng>)) {
      throw Errors.validation("Не удалось определить местоположение. Разрешите доступ к геолокации.");
    }
    await upsertLocation(driver.id, position as LatLng, 0);
  } else if (driver.isBusy) {
    throw new AppError("driver_busy", "Завершите текущий заказ, прежде чем уйти с линии", 409);
  }
  await db.update(drivers).set({ isOnline: online }).where(eq(drivers.id, driver.id));
  return { isOnline: online };
}

/** Текущая позиция водителя. Пассажир видит её в реальном времени. */
export async function updateDriverLocation(driver: Driver, body: Record<string, unknown>): Promise<void> {
  const point = { latitude: body.latitude, longitude: body.longitude } as Partial<LatLng>;
  if (!isValidLatLng(point)) throw Errors.validation("Некорректные координаты");
  const rawHeading = typeof body.heading === "number" && Number.isFinite(body.heading) ? body.heading : 0;
  const heading = ((rawHeading % 360) + 360) % 360;
  await upsertLocation(driver.id, point, heading);
}

/** Заказы в поиске рядом с водителем, подходящие по классу автомобиля. */
export async function listAvailableOrders(driver: Driver): Promise<AvailableOrderView[]> {
  if (!driver.isOnline || driver.isBusy) return [];
  const vehicle = await loadVehicle(driver.id);
  const location = await loadLocation(driver.id);
  if (!location) return [];

  const rows = await db
    .select({ order: orders, tariffName: tariffs.name })
    .from(orders)
    .leftJoin(tariffs, eq(tariffs.id, orders.tariffId))
    .where(
      and(
        eq(orders.status, "searching"),
        isNull(orders.driverId),
        eq(orders.tariffId, vehicle.tariffId),
        gt(orders.updatedAt, new Date(Date.now() - SEARCH_TIMEOUT_MS)),
      ),
    )
    .orderBy(asc(orders.createdAt))
    .limit(50);

  return rows
    .map((row: { order: Order; tariffName: string | null }) => {
      const { order, tariffName } = row;
      return {
      id: order.id,
      pickup: { address: order.pickupAddress, latitude: order.pickupLat, longitude: order.pickupLng },
      destination: {
        address: order.destinationAddress,
        latitude: order.destinationLat,
        longitude: order.destinationLng,
      },
      distanceToPickupMeters: Math.round(haversineMeters(location, { latitude: order.pickupLat, longitude: order.pickupLng })),
      tripDistanceMeters: order.distanceMeters,
      tripDurationSeconds: order.durationSeconds,
      price: order.estimatedPrice,
      tariffName: tariffName ?? order.tariffId,
      createdAt: new Date(order.createdAt).toISOString(),
    };
    })
    .filter((item: AvailableOrderView) => item.distanceToPickupMeters <= MAX_PICKUP_DISTANCE_KM * 1000)
    .sort((a: AvailableOrderView, b: AvailableOrderView) => a.distanceToPickupMeters - b.distanceToPickupMeters)
    .slice(0, 10);
}

/** Принятие заказа. Занять заказ может только один водитель — проверка атомарная. */
export async function acceptOrder(driver: Driver, orderId: string): Promise<void> {
  if (!driver.isApproved) throw new AppError("not_approved", "Ваша анкета еще на модерации.", 403);
  if (!driver.isOnline) throw new AppError("driver_offline", "Выйдите на линию, чтобы принимать заказы", 409);
  const vehicle = await loadVehicle(driver.id);
  const location = await loadLocation(driver.id);
  if (!location) throw Errors.validation("Не удалось определить местоположение");

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw Errors.notFound("Заказ");
  if (order.status !== "searching" || order.driverId) {
    throw new AppError("order_unavailable", "Заказ уже принят другим водителем или отменён", 409);
  }
  if (order.tariffId !== vehicle.tariffId) {
    throw new AppError("wrong_class", "Этот заказ предназначен для другого класса автомобиля", 403);
  }
  const distance = haversineMeters(location, { latitude: order.pickupLat, longitude: order.pickupLng });
  if (distance > MAX_PICKUP_DISTANCE_KM * 1000) {
    throw new AppError("too_far", "Пассажир слишком далеко от вас", 409);
  }

  // YDB не поддерживает SELECT FOR UPDATE. Захват проверяется числом обновлённых строк.
  const busyClaim = await db
    .update(drivers)
    .set({ isBusy: true })
    .where(and(eq(drivers.id, driver.id), eq(drivers.isBusy, false), eq(drivers.isOnline, true)))
    .returning({ id: drivers.id });
  if (busyClaim.length === 0) throw new AppError("driver_busy", "У вас уже есть активный заказ", 409);

  const now = new Date();
  const claimed = await db
    .update(orders)
    .set({
      status: "driver_assigned",
      driverId: driver.id,
      vehicleId: vehicle.id,
      assignedAt: now,
      updatedAt: now,
      simulation: null,
    })
    .where(and(eq(orders.id, order.id), eq(orders.status, "searching"), isNull(orders.driverId)))
    .returning();
  if (claimed.length === 0) {
    await db.update(drivers).set({ isBusy: false }).where(eq(drivers.id, driver.id));
    throw new AppError("order_unavailable", "Заказ уже принят другим водителем или отменён", 409);
  }
  await addOrderEvent(claimed[0], "driver_assigned");
}

const ACTION_EVENT: Record<string, string> = {
  depart: "driver_arriving",
  arrived: "driver_waiting",
  start: "in_progress",
  complete: "payment_pending",
};

/**
 * Действие водителя над заказом. Сервер проверяет, что заказ принадлежит этому водителю
 * и что переход допустим из текущего статуса. Итоговую стоимость фиксирует сервер.
 */
export async function performDriverAction(driver: Driver, orderId: string, rawAction: unknown): Promise<{ status: Order["status"] }> {
  if (!isDriverAction(rawAction)) throw Errors.validation("Неизвестное действие");
  const action = rawAction;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw Errors.notFound("Заказ");
  if (order.driverId !== driver.id) throw Errors.forbidden();
  const now = new Date();

  if (action === "decline") {
    if (!canDeclineStatus(order.status)) throw new AppError("cannot_decline", "От заказа уже нельзя отказаться", 409);
    const [returned] = await db
      .update(orders)
      .set({
        status: "searching",
        driverId: null,
        vehicleId: null,
        assignedAt: null,
        arrivedAt: null,
        simulation: null,
        updatedAt: now,
      })
      .where(and(eq(orders.id, order.id), eq(orders.driverId, driver.id), inArray(orders.status, ["driver_assigned", "driver_arriving", "driver_waiting"])))
      .returning();
    if (!returned) throw new AppError("cannot_decline", "От заказа уже нельзя отказаться", 409);
    await db.update(drivers).set({ isBusy: false }).where(eq(drivers.id, driver.id));
    await addOrderEvent(returned, "driver_declined");
    return { status: returned.status };
  }

  const step = DRIVER_TRANSITIONS[action];
  const patch: Partial<Order> = { status: step.to, updatedAt: now };
  if (action === "arrived") patch.arrivedAt = now;
  if (action === "start") patch.startedAt = now;
  if (action === "complete") {
    patch.completedAt = now;
    patch.finalPrice = order.estimatedPrice;
  }
  const [updated] = await db
    .update(orders)
    .set(patch)
    .where(and(eq(orders.id, order.id), eq(orders.driverId, driver.id), eq(orders.status, step.from)))
    .returning();
  if (!updated) throw new AppError("invalid_transition", "Действие недоступно в текущем статусе заказа", 409);
  if (action === "complete") await db.update(drivers).set({ isBusy: false }).where(eq(drivers.id, driver.id));
  await addOrderEvent(updated, ACTION_EVENT[action]);
  return { status: updated.status };
}

/** Поездки водителя: завершённые, оплаченные и отменённые после принятия. */
export async function listDriverTrips(driver: Driver): Promise<DriverTripView[]> {
  const rows = await db
    .select({ order: orders, passenger: users, tariffName: tariffs.name })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.passengerId))
    .leftJoin(tariffs, eq(tariffs.id, orders.tariffId))
    .where(and(eq(orders.driverId, driver.id), inArray(orders.status, ["completed", "cancelled"])))
    .orderBy(desc(orders.createdAt))
    .limit(100);
  return rows.map((row: { order: Order; passenger: { name: string }; tariffName: string | null }) => {
    const { order, passenger, tariffName } = row;
    return {
    id: order.id,
    status: order.status,
    createdAt: new Date(order.createdAt).toISOString(),
    pickupAddress: order.pickupAddress,
    destinationAddress: order.destinationAddress,
    price: order.finalPrice ?? order.estimatedPrice,
    passengerName: passenger.name || "Пассажир",
    tariffName: tariffName ?? order.tariffId,
    };
  });
}
