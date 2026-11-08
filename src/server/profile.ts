import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { drivers, users, type User } from "@/db/schema";
import { Errors } from "@/core/errors";
import type { UserProfile } from "@/shared/types";

const NAVIGATORS = ["yandex", "dgis", "google"] as const;

export function toProfile(user: User): UserProfile {
  return { id: user.id, phone: user.phone, name: user.name, role: user.role, navigator: user.navigator };
}

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
  
  values.updatedAt = new Date().toISOString() as any;

  await db.update(users).set(values).where(eq(users.id, user.id));
  
  const [updated] = await db.select().from(users).where(eq(users.id, user.id));
  if (!updated) throw Errors.notFound("Пользователь");

  if (values.name !== undefined && user.role === "driver") {
    await db.update(drivers).set({ name: values.name }).where(eq(drivers.userId, user.id));
  }
  
  return updated;
}
