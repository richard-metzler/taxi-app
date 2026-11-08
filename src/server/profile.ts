import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { drivers, users, type User } from "@/db/schema";
import { Errors } from "@/core/errors";
import type { UserProfile } from "@/shared/types";

const NAVIGATORS = ["yandex", "dgis", "google"] as const;

/** Публичное представление профиля (без служебных полей). */
export function toProfile(user: User): UserProfile {
  return { id: user.id, phone: user.phone, name: user.name, role: user.role, navigator: user.navigator };
}

/** Обновление имени и навигатора. Поле role намеренно недоступно. */
export async function updateProfile(user: User, patch: { name?: string; navigator?: string }): Promise<User> {
  const values: Partial<User> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length > 60) throw Errors.validation("Имя слишком длинное");
    values.name = name;
  }
  if (patch.navigator !== undefined) {
    if (!NAVIGATORS.includes(patch.navigator as (typeof NAVIGATORS)[number])) {
      throw Errors.validation("Неизвестный навигатор");
    }
    values.navigator = patch.navigator as User["navigator"];
  }
  const [updated] = await db
    .update(users)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();
  // Имя водителя в карточке для пассажира должно совпадать с профилем.
  if (values.name !== undefined && user.role === "driver") {
    await db.update(drivers).set({ name: values.name }).where(eq(drivers.userId, user.id));
  }
  return updated;
}
