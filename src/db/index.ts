import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

type DB = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as typeof globalThis & {
  __ryadomPgPool?: Pool;
  __ryadomDb?: DB;
};

/** Признак那 DATABASE_URL задана — используется для диагностики без подключения к БД. */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function createPostgres(): DB {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL обязательна");

  // Кешируем пул и drizzle-инстанс в globalThis: в serverless это позволяет
  // переиспользовать соединения между инвокациями, а в dev — между HMR-перезагрузками.
  const pool = globalForDb.__ryadomPgPool ?? new Pool({ connectionString: databaseUrl });
  globalForDb.__ryadomPgPool = pool;
  const instance = globalForDb.__ryadomDb ?? drizzle(pool, { schema });
  globalForDb.__ryadomDb = instance;
  return instance;
}

function getDb(): DB {
  if (globalForDb.__ryadomDb) return globalForDb.__ryadomDb;
  return createPostgres();
}

/**
 * Ленивая инициализация БД.
 *
 *_IMPORTANT_: мы намеренно не создаём пул на этапе импорта модуля:
 * Next.js импортирует все route handlers во время `next build` (Collecting page data),
 * и жёсткий `throw` в теле модуля ломал сборку без `DATABASE_URL`. Теперь ошибка
 * возникает только при первом реальном обращении к базе (и перехватывается handleApiError
 * / health-чеком как 503/500).
 */
export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
