import "server-only";
import { and, eq, gt, isNull, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { driverLocations, drivers, orderEvents, orders, vehicles, type Order } from "@/db/schema";
import { bearingDegrees, lerpLatLng, offsetLatLng, pointAlongPolyline, type LatLng } from "@/core/geo";
import { newId } from "./ids";

/**
 * ДЕМО-ДИСПЕТЧЕР.
 * Приложение водителя к системе не подключено, поэтому сервер имитирует назначение
 * водителя и его движение. Все переходы статусов выполняются только здесь, на сервере.
 * При подключении реального диспетчера этот модуль заменяется без изменения клиента.
 */

const SEARCH_DELAY_MS = 6_000;
export const SEARCH_TIMEOUT_MS = 120_000;
/** Позиция реального водителя считается актуальной, если обновлялась не позднее этого срока. */
export const LIVE_LOCATION_MAX_AGE_MS = 90_000;
const ASSIGNED_TO_ARRIVING_MS = 4_000;
const WAITING_MS = 8_000;
const APPROACH_SECONDS = 45;

const EVENT_TEXTS: Record<string, { title: string; body: string }> = {
  driver_assigned: { title: "Водитель найден", body: "Водитель принял ваш заказ" },
  driver_arriving: { title: "Водитель подъезжает", body: "Водитель направляется к вам" },
  driver_waiting: { title: "Водитель ожидает", body: "Автомобиль на месте подачи" },
  in_progress: { title: "Поездка началась", body: "Счастливого пути!" },
  payment_pending: { title: "Поездка завершена", body: "Требуется оплата поездки" },
  cancelled: { title: "Заказ отменён", body: "К сожалению, нет доступных водителей" },
  driver_declined: { title: "Водитель отказался", body: "Ищем другого водителя" },
};

async function addEvent(order: Order, type: string): Promise<void> {
  const text = EVENT_TEXTS[type];
  if (!text) return;
  await db.insert(orderEvents).values({
    id: crypto.randomUUID(),
    id: newId(),
    orderId: order.id,
    passengerId: order.passengerId,
    type,
    title: text.title,
    body: text.body,
  });
}

/** Запись события заказа для уведомлений пассажира (используется и интерфейсом водителя). */
export { addEvent as addOrderEvent };

/**
 * Есть ли реальные водители на линии, свободные и подходящие по классу.
 * Пока они есть, имитация не вмешивается: заказ ждёт принятия живым водителем.
 */
async function hasLiveDrivers(tariffId: string): Promise<boolean> {
  const freshAfter = new Date(Date.now() - LIVE_LOCATION_MAX_AGE_MS);
  const rows = await db
    .select({ id: drivers.id })
    .from(drivers)
    .innerJoin(vehicles, eq(vehicles.driverId, drivers.id))
    .innerJoin(driverLocations, eq(driverLocations.driverId, drivers.id))
    .where(
      and(
        eq(drivers.isSimulated, false),
        eq(drivers.isOnline, true),
        eq(drivers.isBusy, false),
        eq(vehicles.tariffId, tariffId),
        gt(driverLocations.updatedAt, freshAfter),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function cancelNoDrivers(order: Order, now: Date): Promise<Order> {
  const [updated] = await db
    .update(orders)
    .set({ status: "cancelled", cancelReason: "Нет доступных водителей", cancelledAt: now, updatedAt: now })
    .where(and(eq(orders.id, order.id), eq(orders.status, "searching")))
    .returning();
  if (updated) await addEvent(updated, "cancelled");
  return updated ?? order;
}

async function setDriverLocation(driverId: string, point: LatLng, heading: number): Promise<void> {
  await db
    .update(driverLocations)
    .set({ latitude: point.latitude, longitude: point.longitude, heading, updatedAt: new Date() })
    .where(eq(driverLocations.driverId, driverId));
}

async function tryAssignDriver(order: Order, now: Date): Promise<Order> {
  // Срок поиска считается от последнего возврата в поиск (после отказа водителя он обновляется).
  const searchingMs = now.getTime() - order.updatedAt.getTime();
  if (await hasLiveDrivers(order.tariffId)) {
    return searchingMs > SEARCH_TIMEOUT_MS ? cancelNoDrivers(order, now) : order;
  }

  const candidates = await db
    .select({ driver: drivers, vehicle: vehicles })
    .from(drivers)
    .innerJoin(vehicles, eq(vehicles.driverId, drivers.id))
    .where(and(eq(drivers.isSimulated, true), eq(drivers.isBusy, false), eq(vehicles.tariffId, order.tariffId)))
    .limit(1);

  const candidate = candidates[0];
  if (!candidate) {
    return searchingMs > SEARCH_TIMEOUT_MS ? cancelNoDrivers(order, now) : order;
  }

  const pickup = { latitude: order.pickupLat, longitude: order.pickupLng };
  const start = offsetLatLng(pickup, 1200 + Math.random() * 800, Math.random() * 360);
  const rideSeconds = Math.max(30, Math.min(90, Math.round(order.durationSeconds / 20)));

  const [updated] = await db
    .update(orders)
    .set({
      status: "driver_assigned",
      driverId: candidate.driver.id,
      vehicleId: candidate.vehicle.id,
      assignedAt: now,
      updatedAt: now,
      simulation: {
        driverStartLat: start.latitude,
        driverStartLng: start.longitude,
        approachSeconds: APPROACH_SECONDS,
        rideSeconds,
      },
    })
    .where(and(eq(orders.id, order.id), eq(orders.status, "searching"), isNull(orders.driverId)))
    .returning();
  if (!updated) return order;

  await db.update(drivers).set({ isBusy: true }).where(eq(drivers.id, candidate.driver.id));
  await setDriverLocation(candidate.driver.id, start, bearingDegrees(start, pickup));
  await addEvent(updated, "driver_assigned");
  return updated;
}

async function transition(order: Order, from: Order["status"], patch: Partial<Order>, eventType: string): Promise<Order> {
  const [updated] = await db
    .update(orders)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(orders.id, order.id), eq(orders.status, from)))
    .returning();
  if (!updated) return order;
  await addEvent(updated, eventType);
  return updated;
}

/** Продвигает имитацию заказа в соответствии с прошедшим временем. Возвращает актуальный заказ. */
export async function advanceSimulation(order: Order): Promise<Order> {
  const now = new Date();
  let current = order;

  if (current.status === "searching") {
    if (now.getTime() - current.createdAt.getTime() < SEARCH_DELAY_MS) return current;
    current = await tryAssignDriver(current, now);
  }

  const sim = current.simulation;
  if (!sim || !current.driverId || !current.assignedAt) return current;
  const driverId: string = current.driverId;
  const assignedAtMs = current.assignedAt.getTime();

  const pickup = { latitude: current.pickupLat, longitude: current.pickupLng };
  const start = { latitude: sim.driverStartLat, longitude: sim.driverStartLng };

  if (current.status === "driver_assigned") {
    if (now.getTime() - assignedAtMs >= ASSIGNED_TO_ARRIVING_MS) {
      current = await transition(current, "driver_assigned", { status: "driver_arriving" }, "driver_arriving");
    }
  }

  if (current.status === "driver_arriving") {
    const elapsed = (now.getTime() - assignedAtMs - ASSIGNED_TO_ARRIVING_MS) / 1000;
    const progress = elapsed / sim.approachSeconds;
    if (progress >= 1) {
      await setDriverLocation(driverId, pickup, bearingDegrees(start, pickup));
      current = await transition(current, "driver_arriving", { status: "driver_waiting", arrivedAt: now }, "driver_waiting");
    } else {
      await setDriverLocation(driverId, lerpLatLng(start, pickup, progress), bearingDegrees(start, pickup));
    }
  }

  if (current.status === "driver_waiting" && current.arrivedAt) {
    if (now.getTime() - current.arrivedAt.getTime() >= WAITING_MS) {
      current = await transition(current, "driver_waiting", { status: "in_progress", startedAt: now }, "in_progress");
    }
  }

  if (current.status === "in_progress" && current.startedAt) {
    const progress = (now.getTime() - current.startedAt.getTime()) / 1000 / sim.rideSeconds;
    const route = current.routeGeometry;
    if (progress >= 1) {
      const dest = { latitude: current.destinationLat, longitude: current.destinationLng };
      await setDriverLocation(driverId, dest, 0);
      // Завершение: сервер фиксирует итоговую стоимость и переводит заказ к оплате.
      current = await transition(
        current,
        "in_progress",
        { status: "payment_pending", completedAt: now, finalPrice: current.estimatedPrice },
        "payment_pending",
      );
      await db.update(drivers).set({ isBusy: false }).where(eq(drivers.id, driverId));
    } else {
      const p = pointAlongPolyline(route, progress);
      const pNext = pointAlongPolyline(route, Math.min(1, progress + 0.02));
      await setDriverLocation(driverId, p, bearingDegrees(p, pNext));
    }
  }

  return current;
}

/** Освобождает имитируемого водителя, если заказ отменён. */
export async function releaseDriver(driverId: string | null): Promise<void> {
  if (!driverId) return;
  await db.update(drivers).set({ isBusy: false }).where(eq(drivers.id, driverId));
}

/** Статусы, при которых поездка выполняется (новый заказ недоступен). */
export const ACTIVE_STATUSES: Order["status"][] = [
  "searching",
  "driver_assigned",
  "driver_arriving",
  "driver_waiting",
  "in_progress",
];

/** Статусы завершённой, но не оплаченной поездки. */
export const UNPAID_STATUSES: Order["status"][] = ["completed", "payment_pending", "payment_failed"];

/** Статусы, при которых пассажир может отменить заказ. */
export const CANCELLABLE_STATUSES: Order["status"][] = [
  "searching",
  "driver_assigned",
  "driver_arriving",
  "driver_waiting",
];

export { notInArray };
