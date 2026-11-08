import "server-only";
import { lt } from "drizzle-orm";
import { db } from "@/db";
import { authDiagnostics } from "@/db/schema";
import { describeTransport } from "./session-transport";
import { newId } from "./ids";

const RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Запись диагностики доставки сессии (без токенов). Никогда не бросает исключений:
 * сбой диагностики не должен ломать вход.
 */
export async function recordAuthDiagnostic(event: string, userId: string | null): Promise<void> {
  try {
    const t = await describeTransport();
    await db.insert(authDiagnostics).values({
    id: crypto.randomUUID(), id: newId(), event, userId, ...t });
    if (Math.random() < 0.05) {
      await db.delete(authDiagnostics).where(lt(authDiagnostics.createdAt, new Date(Date.now() - RETENTION_MS)));
    }
  } catch (error) {
    console.warn("[diagnostics] Не удалось записать диагностику:", (error as Error).message);
  }
}
