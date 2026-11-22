import "server-only";
import { createHash } from "node:crypto";

/**
 * Проверка пароля по сервису Have I Been Pwned с k-анонимностью.
 * На сервер уходят только первые 5 символов SHA-1 хеша; полный пароль никогда не передаётся.
 * При недоступности сервиса проверка считается пройденной (fail-open), чтобы не блокировать регистрацию.
 */

const HIBP_URL = "https://api.pwnedpasswords.com/range/";
const TIMEOUT_MS = 3000;

export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${HIBP_URL}${prefix}`, {
        headers: { "User-Agent": "TaxiPassengerMVP/1.0" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) return false;
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [hash, count] = line.trim().split(":");
      if (hash === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch {
    // Сервис недоступен — fail-open
    return false;
  }
}
