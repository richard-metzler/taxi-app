import "server-only";
import { createHash } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { authAttempts } from "@/db/schema";
import { AppError } from "@/core/errors";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;
const MAX_REGISTRATION_ATTEMPTS = 5;

function keyFor(scope: "login" | "register", phone: string): string {
  return createHash("sha256").update(`${scope}:${phone}`).digest("hex");
}

/**
 * Счётчик попыток. YDB не поддерживает атомарный UPSERT со сложным SQL,
 * поэтому читаем запись и затем вставляем или обновляем её в коде.
 * Для ограничения частоты кратковременная гонка допустима.
 */
async function consume(scope: "login" | "register", phone: string): Promise<void> {
  const now = new Date();
  const key = keyFor(scope, phone);
  const limit = scope === "login" ? MAX_LOGIN_ATTEMPTS : MAX_REGISTRATION_ATTEMPTS;
  try {
    const [current] = await db.select().from(authAttempts).where(eq(authAttempts.key, key)).limit(1);
    const expired = !current || current.windowStartedAt.getTime() + WINDOW_MS <= now.getTime();
    const attempts = expired ? 1 : current.attempts + 1;
    const windowStartedAt = expired || !current ? now : current.windowStartedAt;
    if (!current) {
      await db.insert(authAttempts).values({ key, attempts: 1, windowStartedAt: now });
    } else {
      await db.update(authAttempts).set({ attempts, windowStartedAt }).where(eq(authAttempts.key, key));
    }
    if (attempts > limit) {
      const minutes = Math.max(1, Math.ceil((windowStartedAt.getTime() + WINDOW_MS - now.getTime()) / 60000));
      throw new AppError("too_many_attempts", `Слишком много попыток. Попробуйте снова через ${minutes} мин.`, 429);
    }
    if (Math.random() < 0.02) {
      await db.delete(authAttempts).where(lt(authAttempts.windowStartedAt, new Date(now.getTime() - 2 * WINDOW_MS)));
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    // Повторная вставка при гонке: перечитываем и обновляем существующую запись.
    const [current] = await db.select().from(authAttempts).where(eq(authAttempts.key, key)).limit(1);
    if (!current) throw error;
    const attempts = current.attempts + 1;
    await db.update(authAttempts).set({ attempts }).where(eq(authAttempts.key, key));
    if (attempts > limit) {
      throw new AppError("too_many_attempts", "Слишком много попыток. Попробуйте снова через 15 мин.", 429);
    }
  }
}

export const consumeLoginAttempt = (phone: string) => consume("login", phone);
export const consumeRegistrationAttempt = (phone: string) => consume("register", phone);

export async function resetAuthAttempts(scope: "login" | "register", phone: string): Promise<void> {
  await db.delete(authAttempts).where(eq(authAttempts.key, keyFor(scope, phone)));
}
