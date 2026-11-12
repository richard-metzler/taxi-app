import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Проверяет, находится ли пользователь в сети.
 * Считаем, что он онлайн, если последний heartbeat был менее 45 секунд назад.
 */
export async function isUserOnline(userId: string): Promise<boolean> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { isOnline: true, lastSeenAt: true },
    });

    if (!user || !user.isOnline || !user.lastSeenAt) return false;

    // Разница в миллисекундах
    const diffMs = new Date().getTime() - new Date(user.lastSeenAt).getTime();
    return diffMs < 45000; // 45 секунд
  } catch (error) {
    console.error("Ошибка проверки онлайна:", error);
    return false; // В случае ошибки лучше считать офлайн (отправим пуш)
  }
}
