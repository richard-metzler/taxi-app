import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "@/core/errors";

/** Максимальный возраст подписи MAX и допустимый сдвиг времени вперёд. */
const AUTH_TTL_SECONDS = 3600;
const FUTURE_SKEW_SECONDS = 300;
const HEX_64 = /^[a-f0-9]{64}$/i;

function invalidInitData(): AppError {
  return new AppError("invalid_init_data", "Не удалось подтвердить данные MAX", 401);
}

/**
 * Проверяет подпись initData мини-приложения MAX по документации
 * https://dev.max.ru/docs/webapps/validation.
 *
 * Вход — сырая строка `window.WebApp.initData` в URL-encoded виде. Доверять можно только
 * проверенным значениям: `initDataUnsafe` используется клиентом исключительно для подсказок.
 */
export function validateMaxInitData(initData: string, botToken: string): { userId: string; name?: string } {
  if (typeof initData !== "string" || !initData) throw invalidInitData();

  let params: URLSearchParams;
  try {
    // URLSearchParams выполняет ровно одно URL-декодирование ключей и значений.
    params = new URLSearchParams(initData);
  } catch {
    throw invalidInitData();
  }

  // URLSearchParams скрывает повторы, поэтому считаем ключи при переборе всех пар.
  const counts = new Map<string, number>();
  for (const [key] of params) counts.set(key, (counts.get(key) ?? 0) + 1);
  for (const count of counts.values()) if (count !== 1) throw invalidInitData();

  const entries = Array.from(params.entries());
  const hashEntries = entries.filter(([key]) => key === "hash");
  if (hashEntries.length !== 1) throw invalidInitData();
  const originalHash = hashEntries[0][1];
  if (!HEX_64.test(originalHash)) throw invalidInitData();

  const authDateRaw = params.get("auth_date");
  if (!authDateRaw || !/^\d+$/.test(authDateRaw)) throw invalidInitData();
  const authDate = Number(authDateRaw);
  if (!Number.isSafeInteger(authDate)) throw invalidInitData();
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds - authDate > AUTH_TTL_SECONDS) throw invalidInitData();
  if (authDate - nowSeconds > FUTURE_SKEW_SECONDS) throw invalidInitData();

  // Сортируем пары key=value (без hash) лексикографически и склеиваем через \n.
  const launchParams = entries
    .filter(([key]) => key !== "hash")
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  if (typeof botToken !== "string" || !botToken.trim()) {
    throw new AppError("max_not_configured", "Вход через MAX не настроен на сервере", 503);
  }

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = createHmac("sha256", secretKey).update(launchParams).digest();
  const provided = Buffer.from(originalHash, "hex");
  if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) throw invalidInitData();

  const userRaw = params.get("user");
  if (!userRaw) throw invalidInitData();
  let user: { id?: unknown; first_name?: unknown; last_name?: unknown };
  try {
    user = JSON.parse(userRaw);
  } catch {
    throw invalidInitData();
  }
  if (!user || typeof user !== "object") throw invalidInitData();
  const userId = typeof user.id === "number" || typeof user.id === "string" ? String(user.id) : "";
  if (!userId) throw invalidInitData();

  const name = [user.first_name, user.last_name]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim())
    .join(" ")
    .slice(0, 60);

  return { userId, name: name || undefined };
}
