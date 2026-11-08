import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  authDiagnostics,
  driverLocations,
  drivers,
  fareEstimates,
  orderEvents,
  orders,
  payments,
  sessions,
  users,
  vehicles,
} from "@/db/schema";

/**
 * Удаляет пользователя и связанные данные. У YDB нет внешних ключей и каскадов,
 * поэтому порядок удаления задаётся здесь.
 */
export async function deleteUserData(userId: string): Promise<void> {
  const ownOrders = await db.select({ id: orders.id }).from(orders).where(eq(orders.passengerId, userId));
  const orderIds = ownOrders.map((order: { id: string }) => order.id);
  if (orderIds.length > 0) {
    await db.delete(payments).where(inArray(payments.orderId, orderIds));
    await db.delete(orderEvents).where(inArray(orderEvents.orderId, orderIds));
    await db.delete(orders).where(inArray(orders.id, orderIds));
  }
  await db.delete(payments).where(eq(payments.userId, userId));
  await db.delete(orderEvents).where(eq(orderEvents.passengerId, userId));
  await db.delete(fareEstimates).where(eq(fareEstimates.userId, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(authDiagnostics).where(eq(authDiagnostics.userId, userId));

  const [driver] = await db.select().from(drivers).where(eq(drivers.userId, userId));
  if (driver) {
    await db.delete(driverLocations).where(eq(driverLocations.driverId, driver.id));
    await db.delete(vehicles).where(eq(vehicles.driverId, driver.id));
    await db.delete(drivers).where(eq(drivers.id, driver.id));
  }
  await db.delete(users).where(eq(users.id, userId));
}
