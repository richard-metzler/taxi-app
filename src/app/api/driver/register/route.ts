import { NextResponse } from "next/server";
import { db } from "@/db";
import { drivers, vehicles, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    // Если роль еще пассажир, принудительно меняем на водителя
    if (user.role !== "driver") {
      await db.update(users).set({ role: "driver" }).where(eq(users.id, user.id));
    }

    const { name, carModel, plate, color } = await req.json();

    if (!name || !carModel || !plate) {
      return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
    }

    let [driver] = await db.select().from(drivers).where(eq(drivers.userId, user.id));

    if (!driver) {
      [driver] = await db.insert(drivers).values({
        userId: user.id,
        name: name,
        isOnline: false,
        isBusy: false,
        isSimulated: false,
        rating: 5.0,
      }).returning();
    } else {
      await db.update(drivers).set({ name: name }).where(eq(drivers.id, driver.id));
    }

    let [vehicle] = await db.select().from(vehicles).where(eq(vehicles.driverId, driver.id));

    if (!vehicle) {
      await db.insert(vehicles).values({
        driverId: driver.id,
        brand: "Авто",
        model: carModel,
        color: color || "Не указан",
        plate: plate.toUpperCase(),
        tariffId: "standard",
      });
    } else {
      await db.update(vehicles).set({
        model: carModel,
        color: color || "Не указан",
        plate: plate.toUpperCase(),
      }).where(eq(vehicles.id, vehicle.id));
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[driver/register] Ошибка:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
