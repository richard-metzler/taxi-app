import { NextResponse } from "next/server";
import { db } from "@/db";
import { drivers, vehicles, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    if (user.role !== "driver") {
      await db.update(users).set({ role: "driver" }).where(eq(users.id, user.id));
    }

    // Парсим FormData (текст + файлы)
    const formData = await req.formData();
    const name = formData.get("name") as string;
    const carModel = formData.get("carModel") as string;
    const plate = formData.get("plate") as string;
    const color = formData.get("color") as string;
    
    const selfie = formData.get("selfie") as File | null;
    const licensePhoto = formData.get("licensePhoto") as File | null;

    if (!name || !carModel || !plate || !color || !selfie || !licensePhoto) {
      return NextResponse.json({ error: "Заполните все поля и прикрепите фото" }, { status: 400 });
    }

    // 1. Сохраняем в базу данных
    let [driver] = await db.select().from(drivers).where(eq(drivers.userId, user.id));

    if (!driver) {
      [driver] = await db.insert(drivers).values({
        userId: user.id, name, isOnline: false, isBusy: false, isSimulated: false, rating: 5.0,
      }).returning();
    } else {
      await db.update(drivers).set({ name }).where(eq(drivers.id, driver.id));
    }

    let [vehicle] = await db.select().from(vehicles).where(eq(vehicles.driverId, driver.id));
    if (!vehicle) {
      await db.insert(vehicles).values({ driverId: driver.id, brand: "Авто", model: carModel, color: color || "Не указан", plate: plate.toUpperCase(), tariffId: "standard" });
    } else {
      await db.update(vehicles).set({ model: carModel, color: color || "Не указан", plate: plate.toUpperCase() }).where(eq(vehicles.id, vehicle.id));
    }

    // 2. Отправляем email (Nodemailer)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 465),
        secure: true,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });

      const selfieBuffer = Buffer.from(await selfie.arrayBuffer());
      const licenseBuffer = Buffer.from(await licensePhoto.arrayBuffer());

      await transporter.sendMail({
        from: `"Такси Рядом" <${process.env.SMTP_USER}>`,
        to: "taxi_r9dom@mail.ru",
        subject: `Новый водитель на модерацию: ${name}`,
        text: `Водитель: ${name}\nТелефон: ${user.phone}\nАвто: ${carModel}, ${color}, ${plate}\nMAX ID: ${user.phone.replace('max_', '')}`,
        attachments: [
          { filename: `selfie_${name}.jpg`, content: selfieBuffer },
          { filename: `license_${name}.jpg`, content: licenseBuffer },
        ],
      });
      console.log(`[moderation] Email sent for driver ${name}`);
    } else {
      console.warn("[moderation] SMTP credentials not set. Email skipped.");
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[driver/register] Ошибка:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
