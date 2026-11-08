import "server-only";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { passwordPolicyError } from "@/core/password-policy";
import { Errors } from "@/core/errors";

function scrypt(password: string, salt: Buffer, keyLength: number, options: typeof OPTIONS): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}
// Параметры OWASP для scrypt: N=2^15, r=8, p=3; около 32 МиБ памяти на проверку.
const OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 } as const;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const PREFIX = "scrypt-v1$32768$8$3$";
const ENCODED = /^[A-Za-z0-9_-]+$/;

/** Создаёт хеш с новой случайной солью. Открытый пароль никогда не сохраняется. */
export async function hashPassword(password: string): Promise<string> {
  const error = passwordPolicyError(password);
  if (error) throw Errors.validation(error);
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(password, salt, KEY_BYTES, OPTIONS);
  return `${PREFIX}${salt.toString("base64url")}$${key.toString("base64url")}`;
}

/** Проверяет пароль за постоянное время относительно размера хеша, не раскрывая причину отказа. */
export async function verifyPassword(password: unknown, storedHash: string | null): Promise<boolean> {
  if (typeof password !== "string" || password.length === 0 || password.length > 512) return false;
  let salt = Buffer.alloc(SALT_BYTES);
  let expected = Buffer.alloc(KEY_BYTES);
  let valid = Boolean(storedHash);
  if (storedHash?.startsWith(PREFIX)) {
    const parts = storedHash.slice(PREFIX.length).split("$");
    if (parts.length === 2 && parts.every((part) => ENCODED.test(part))) {
      const decodedSalt = Buffer.from(parts[0], "base64url");
      const decodedKey = Buffer.from(parts[1], "base64url");
      if (decodedSalt.length === SALT_BYTES && decodedKey.length === KEY_BYTES) {
        salt = decodedSalt;
        expected = decodedKey;
      } else valid = false;
    } else valid = false;
  } else if (storedHash !== null) valid = false;

  // Для отсутствующего профиля выполняется такая же дорогая операция, как для существующего.
  const actual = await scrypt(password, salt, KEY_BYTES, OPTIONS);
  return valid && timingSafeEqual(actual, expected);
}
