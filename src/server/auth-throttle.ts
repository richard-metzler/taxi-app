import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
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
 * Атомарный счётчик попыток с фиксированным окном.
 * Один SQL-запрос INSERT ... ON CONFLICT DO UPDATE RETURNING устраняет гонки
 * между параллельными запросами — crystallization счётчика теперь консистентен.
 */
async function consume(scope: "login" | "register", phone: string): Promise<void> {
  const now = new Date();
  const key = keyFor(scope, phone);
  const limit = scope === "login" ? MAX_LOGIN_ATTEMPTS : MAX_REGISTRATION_ATTEMPTS;

  const rows = await db
    .insert(authAttempts)
    .values({ key, attempts: 1, windowStartedAt: now })
    .onConflictDoUpdate({
      target: authAttempts.key,
      set: {
        attempts: sql`
          CASE
            WHEN ${authAttempts.windowStartedAt} + (${WINDOW_MS} * interval '1 millisecond') <= ${now}
            THEN 1
            ELSE ${authAttempts.attempts} + 1
          END
        `,
        windowStartedAt: sql`
          CASE
            WHEN ${authAttempts.windowStartedAt} + (${WINDOW_MS} * interval '1 millisecond') <= ${now}
            THEN ${now}
            ELSE ${authAttempts.windowStartedAt}
          END
        `,
      },
      where: sql`true`,
    })
    .returning({ attempts: authAttempts.attempts, windowStartedAt: authAttempts.windowStartedAt });

  const row = rows[0];
  if (row && row.attempts > limit) {
    const minutes = Math.max(
      1,
      Math.ceil((new Date(row.windowStartedAt).getTime() + WINDOW_MS - now.getTime()) / 60000),
    );
    throw new AppError("too_many_attempts", `Слишком много попыток. Попробуйте снова через ${minutes} мин.`, 429);
  }

  // Периодическая очистка устаревших записей (大概 2% запросов)
  if (Math.random() < 0.02) {
    await db.delete(authAttempts).where(sql`${authAttempts.windowStartedAt} < ${new Date(now.getTime() - 2 * WINDOW_MS)}`);
  }
}

export const consumeLoginAttempt = (phone: string) => consume("login", phone);
export const consumeRegistrationAttempt = (phone: string) => consume("register", phone);

export async function resetAuthAttempts(scope: "login" | "register", phone: string): Promise<void> {
  await db.delete(authAttempts).where(sql`${authAttempts.key} = ${keyFor(scope, phone)}`);
}
