import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import { AppError, handleApiError } from "@/core/errors";
import { db } from "@/db";
import { drivers, tariffs, users, vehicles } from "@/db/schema";
import { validateVehicle } from "@/core/vehicle";
import { getCurrentUser, setUserRole } from "@/server/auth";
import { newId } from "@/server/ids";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** data URL или чистый base64 → Buffer для вложения в письмо модератору. */
function decodePhoto(value: unknown): Buffer | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const comma = value.indexOf(",");
  const raw = comma >= 0 && value.slice(0, comma).startsWith("data:") ? value.slice(comma + 1) : value;
  const base64 = raw.replace(/\s/g, "");
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new AppError("invalid_photo", "Не удалось прочитать фотографию", 400);
  }
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) {
    throw new AppError("invalid_photo", "Фотография слишком большая или повреждена", 400);
  }
  return buffer;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("unauthorized", "Не авторизован", 401);

    const contentType = req.headers.get("content-type") ?? "";
    let body: Record<string, unknown>;
    let selfieBuffer: Buffer | null = null;
    let licenseBuffer: Buffer | null = null;

    if (contentType.includes("multipart/form-data")) {
      // Обратная совместимость со старой формой: поля + File вместо base64.
      const form = await req.formData();
      body = {};
      for (const key of ["name", "phone", "password", "carModel", "plate", "color", "vehicle"]) {
        const value = form.get(key);
        if (typeof value === "string") body[key] = value;
      }
      const selfie = form.get("selfie");
      const license = form.get("licensePhoto") ?? form.get("license");
      if (selfie instanceof File) selfieBuffer = Buffer.from(await selfie.arrayBuffer());
      if (license instanceof File) licenseBuffer = Buffer.from(await license.arrayBuffer());
    } else {
      body = (await req.json()) as Record<string, unknown>;
      if (!body || typeof body !== "object") throw new AppError("bad_request", "Некорректный запрос", 400);
      selfieBuffer = decodePhoto(body.selfieBase64);
      licenseBuffer = decodePhoto(body.licenseBase64);
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new AppError("validation", "Укажите имя водителя", 422);
    if (!selfieBuffer || !licenseBuffer) throw new AppError("validation", "Прикрепите селфи и фото прав", 422);

    // Класс авто лежит в vehicle.class; normalizePlate/isValidPlate вызывает validateVehicle.
    const rawVehicle = body.vehicle && typeof body.vehicle === "object" && !Array.isArray(body.vehicle)
      ? { ...(body.vehicle as Record<string, unknown>), tariffId: (body.vehicle as Record<string, unknown>).class }
      : {
          brand: "Авто",
          model: typeof body.carModel === "string" ? body.carModel : "",
          color: typeof body.color === "string" ? body.color : "",
          plate: typeof body.plate === "string" ? body.plate : "",
          class: "econom",
        };
    const checked = validateVehicle(rawVehicle);
    if (!checked.ok) throw new AppError("validation", checked.error, 422);
    const vehicleData = checked.value;

    // Тариф берём по классу из анкеты; если его нет — первый активный тариф.
    const [matchedTariff] = await db.select().from(tariffs).where(eq(tariffs.id, vehicleData.tariffId)).limit(1);
    let tariffId = matchedTariff?.id;
    if (!tariffId) {
      const [firstActive] = await db
        .select()
        .from(tariffs)
        .where(eq(tariffs.isActive, true))
        .orderBy(tariffs.sortOrder)
        .limit(1);
      tariffId = firstActive?.id;
    }
    if (!tariffId) throw new AppError("tariffs_not_configured", "Не настроены тарифы", 503);

    await setUserRole(user.id, "driver");
    user.role = "driver";

    let [driver] = await db.select().from(drivers).where(eq(drivers.userId, user.id));
    if (!driver) {
      [driver] = await db
        .insert(drivers)
        .values({
          id: newId(),
          userId: user.id,
          name,
          photoUrl: null,
          isOnline: false,
          isBusy: false,
          isApproved: false,
          isSimulated: false,
          rating: 5,
          createdAt: new Date(),
        })
        .returning();
    } else {
      // Повторная подача анкеты снова уходит на модерацию.
      await db.update(drivers).set({ name, isApproved: false }).where(eq(drivers.id, driver.id));
    }

    let [vehicle] = await db.select().from(vehicles).where(eq(vehicles.driverId, driver.id));
    if (!vehicle) {
      await db.insert(vehicles).values({
        id: newId(),
        driverId: driver.id,
        brand: vehicleData.brand,
        model: vehicleData.model,
        color: vehicleData.color,
        plate: vehicleData.plate,
        tariffId,
      });
    } else {
      await db
        .update(vehicles)
        .set({
          brand: vehicleData.brand,
          model: vehicleData.model,
          color: vehicleData.color,
          plate: vehicleData.plate,
          tariffId,
        })
        .where(eq(vehicles.id, vehicle.id));
    }

    // Отправляем email в фоне, не блокируя ответ клиенту.
    const sendEmailAsync = async () => {
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn("[moderation] SMTP credentials not set. Email skipped.");
        return;
      }
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 465),
          secure: true,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          connectionTimeout: 10000,
        });
        const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : user.phone;
        await transporter.sendMail({
          from: `"Такси Рядом" <${process.env.SMTP_USER}>`,
          to: "taxi_r9dom@mail.ru",
          subject: `Новый водитель на модерацию: ${name}`,
          text: `Водитель: ${name}\nТелефон: ${phone}\nАвто: ${vehicleData.brand} ${vehicleData.model}, ${vehicleData.color}, ${vehicleData.plate}\nMAX ID: ${user.phone.replace("max_", "")}`,
          attachments: [
            { filename: `selfie_${name}.jpg`, content: selfieBuffer },
            { filename: `license_${name}.jpg`, content: licenseBuffer },
          ],
        });
        console.log(`[moderation] Email sent for driver ${name}`);
      } catch (err) {
        console.error("[moderation] Email failed:", err instanceof Error ? err.message : "unknown");
      }
    };
    void sendEmailAsync();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
