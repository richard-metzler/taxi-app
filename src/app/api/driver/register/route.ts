import { NextResponse } from "next/server";
import { db } from "@/db";
import { drivers, vehicles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "driver") {
      return NextResponse.json({ error: "Доступно только водителям" }, { status: 403 });
    }

    const { name, carModel, plate } = await req.json();

    if (!name || !carModel || !plate) {
      return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
    }

    // 1. Ищем водителя по ID пользователя
    let [driver] = await db.select().from(drivers).where(eq(drivers.userId, user.id));

    if (!driver) {
      // Если профиля нет — создаем
      [driver] = await db.insert(drivers).values({
        userId: user.id,
        name: name,
        isOnline: false,
        isBusy: false,
        isSimulated: false,
        rating: 5.0,
      }).returning();
    } else {
      // Если профиль есть — обновляем имя
      await db.update(drivers).set({ name: name }).where(eq(drivers.id, driver.id));
    }

    // 2. Ищем машину
    let [vehicle] = await db.select().from(vehicles).where(eq(vehicles.driverId, driver.id));

    if (!vehicle) {
      // Если машины нет — создаем
      await db.insert(vehicles).values({
        driverId: driver.id,
        brand: "Авто",
        model: carModel,
        color: "Любой",
        plate: plate.toUpperCase(),
        tariffId: "standard",
      });
    } else {
      // Если машина есть — обновляем
      await db.update(vehicles).set({
        model: carModel,
        plate: plate.toUpperCase(),
      }).where(eq(vehicles.id, vehicle.id));
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[driver/register] Ошибка:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
