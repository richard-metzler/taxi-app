import { sql } from "drizzle-orm";
import { db, isYdbConfigured } from "@/db";

export const dynamic = "force-dynamic";

/** Проверяет доступность выбранной базы: YDB, если она настроена, иначе PostgreSQL. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, database: isYdbConfigured() ? "ydb" : "postgres" });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
