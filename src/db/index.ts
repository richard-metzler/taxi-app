import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

function createPostgres() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL обязательна");
  
  const globalForDb = globalThis as typeof globalThis & { __ryadomPgPool?: Pool };
  const pool = globalForDb.__ryadomPgPool ?? new Pool({ connectionString: databaseUrl });
  
  if (process.env.NODE_ENV !== "production") globalForDb.__ryadomPgPool = pool;
  return drizzle(pool, { schema });
}

export const db = createPostgres();
