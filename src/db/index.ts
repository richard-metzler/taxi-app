import { Pool } from "pg";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { createYdb, isYdbConfigured } from "./ydb";

export { isYdbConfigured };

function createPostgres() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL обязательна, пока Yandex YDB не настроена");
  const globalForDb = globalThis as typeof globalThis & { __ryadomPgPool?: Pool };
  const pool = globalForDb.__ryadomPgPool ?? new Pool({ connectionString: databaseUrl });
  if (process.env.NODE_ENV !== "production") globalForDb.__ryadomPgPool = pool;
  return drizzlePostgres(pool);
}

/**
 * Без ключей Yandex YDB используется PostgreSQL.
 * Иначе вход пытался открыть несуществующий адрес YDB и показывал общую ошибку.
 */
export const db = (isYdbConfigured() ? createYdb() : createPostgres()) as any;
