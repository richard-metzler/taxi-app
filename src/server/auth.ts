import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { drivers, sessions, users, vehicles, userRoles, type User } from "@/db/schema";
import { AppError, Errors } from "@/core/errors";
import { normalizePhone } from "@/core/phone";
import { validateVehicle, type VehicleInput } from "@/core/vehicle";
import { readTokenCandidates, type TokenSource } from "./session-transport";
import { recordAuthDiagnostic } from "./diagnostics";
import { hashPassword, verifyPassword } from "./password";
import { consumeLoginAttempt, consumeRegistrationAttempt, resetAuthAttempts } from "./auth-throttle";
import { newId } from "./ids";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export type AccountRole = "passenger" | "driver";

const ROLE_TEXT: Record<AccountRole, string> = { passenger: "пассажир", driver: "водитель" };

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validatedPhone(rawPhone: unknown): string {
  const phone = typeof rawPhone === "string" ? normalizePhone(rawPhone) : null;
  if (!phone) throw Errors.validation("Введите корректный номер телефона в формате +7 XXX XXX-XX-XX");
  return phone;
}

function validatedName(rawName: unknown): string {
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name || Array.from(name).length > 60) throw Errors.validation("Укажите имя длиной от 1 до 60 символов");
  return name;
}

function requestedRole(value: unknown): AccountRole {
  return value === "driver" ? "driver" : "passenger";
}

function phoneTakenError(existingRole: User["role"] | null, wanted: AccountRole): AppError {
  if (existingRole && existingRole !== wanted && (existingRole === "passenger" || existingRole === "driver")) {
    return new AppError(
      "phone_registered",
      `Этот номер уже зарегистрирован как ${ROLE_TEXT[existingRole]}. Выберите другую роль или используйте другой номер.`,
      409,
    );
  }
  return new AppError("phone_registered", "Этот номер уже зарегистрирован. Войдите с паролем.", 409);
}

export type SignInResult = { user: User; token: string; expiresAt: Date };

async function issueSession(user: User): Promise<SignInResult> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    id: newId(),
    userId: user.id,
    tokenHash: sha256(token),
    expiresAt: expiresAt,
    createdAt: new Date(),
  });
  return { user, token, expiresAt };
}

async function findByPhone(phone: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.phone, phone));
  return rows[0] ?? null;
}

export async function registerWithPassword(input: {
  phone: unknown;
  name: unknown;
  password: unknown;
  role?: unknown;
  vehicle?: unknown;
}): Promise<SignInResult> {
  const role = requestedRole(input.role);
  const phone = validatedPhone(input.phone);
  const name = validatedName(input.name);
  if (typeof input.password !== "string") throw Errors.validation("Введите пароль");
  const password = input.password;

  let vehicle: VehicleInput | null = null;
  if (role === "driver") {
    const checked = validateVehicle(input.vehicle);
    if (!checked.ok) throw Errors.validation(checked.error);
    vehicle = checked.value;
  }
  await consumeRegistrationAttempt(phone);

  const existing = await findByPhone(phone);
  if (existing && (existing.passwordHash || role !== "passenger")) throw phoneTakenError(existing.role, role);
  if (existing && existing.role !== "passenger") throw Errors.forbidden();

  const passwordHash = await hashPassword(password);
  let user: User;

  if (existing) {
    const now = new Date();
    await db.update(users).set({ name, passwordHash, updatedAt: now }).where(and(eq(users.id, existing.id), isNull(users.passwordHash)));
    const refreshed = await db.select().from(users).where(eq(users.id, existing.id));
    if (!refreshed[0]) throw phoneTakenError(existing.role, role);
    user = refreshed[0];
  } else {
    const userId = newId();
    const now = new Date();
    await db.insert(users).values({
      id: userId,
      phone,
      name,
      passwordHash,
      role,
      navigator: "yandex",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const created = await db.select().from(users).where(eq(users.id, userId));
    if (!created[0]) throw phoneTakenError(null, role);
    user = created[0];

    if (role === "driver" && vehicle) {
      const driverId = newId();
      await db.insert(drivers).values({
        id: driverId,
        userId: user.id,
        name,
        photoUrl: null,
        isOnline: false,
        isBusy: false,
        isSimulated: false,
        rating: 5,
        createdAt: new Date(),
      });
      await db.insert(vehicles).values({
        id: newId(),
        driverId,
        brand: vehicle.brand,
        model: vehicle.model,
        color: vehicle.color,
        plate: vehicle.plate,
        tariffId: vehicle.tariffId,
      });
    }
  }

  await resetAuthAttempts("register", phone);
  await resetAuthAttempts("login", phone);
  return issueSession(user);
}

export async function signInWithPassword(input: { phone: unknown; password: unknown; role?: unknown }): Promise<SignInResult> {
  const phone = validatedPhone(input.phone);
  if (typeof input.password !== "string" || !input.password || input.password.length > 512) {
    throw Errors.validation("Введите пароль");
  }
  await consumeLoginAttempt(phone);
  const user = await findByPhone(phone);
  const valid = await verifyPassword(input.password, user?.passwordHash ?? null);
  if (!user || !valid) {
    await recordAuthDiagnostic("login_failed", null);
    throw new AppError("invalid_credentials", "Неверный номер телефона или пароль", 401);
  }
  if (user.role !== "passenger" && user.role !== "driver") throw Errors.forbidden();
  if (input.role !== undefined) {
    const targetRole = requestedRole(input.role);
    if (targetRole !== user.role) {
      // Обновляем роль в базе данных
      await db.update(users).set({ role: targetRole, updatedAt: new Date() }).where(eq(users.id, user.id));
      user.role = targetRole;
      
      // Если стали водителем — создаем профиль водителя
      if (targetRole === "driver") {
        const [driver] = await db.select().from(drivers).where(eq(drivers.userId, user.id));
        if (!driver) {
          await db.insert(drivers).values({
            userId: user.id,
            name: user.name || "Водитель",
            isOnline: false,
            isBusy: false,
            isSimulated: false,
            rating: 5,
          });
        }
      }
    }
  }
  await resetAuthAttempts("login", phone);
  return issueSession(user);
}

export async function signInWithMax(maxUserId: string, role: AccountRole, name?: string): Promise<SignInResult> {
  const phone = `max_${maxUserId}`;
  const [existing] = await db.select().from(users).where(eq(users.phone, phone));

  let user: User;
  if (existing) {
    const updates: any = { role, updatedAt: new Date() };
    if (name) updates.name = name; // Сохраняем имя, если пришло из онбординга
    
    await db.update(users).set(updates).where(eq(users.id, existing.id));
    existing.role = role;
    if (name) existing.name = name;
    user = existing;
  } else {
    const userName = name?.trim() || "Пользователь MAX";
    const [created] = await db.insert(users).values({
      phone,
      name: userName,
      passwordHash: null,
      role,
    }).returning();
    user = created;
  }

  // Сохраняем роль в user_roles (если еще не сохранена)
  await db.insert(userRoles).values({ userId: user.id, role }).onConflictDoNothing();

  // Создаем профиль водителя, если его нет
  if (role === "driver") {
    const [driver] = await db.select().from(drivers).where(eq(drivers.userId, user.id));
    if (!driver) {
      await db.insert(drivers).values({
        userId: user.id,
        name: user.name || "Водитель",
        isOnline: false,
        isBusy: false,
        isSimulated: false,
        rating: 5,
      });
    }
  }

  return issueSession(user);
}

export async function resolveSession(): Promise<{ user: User; source: TokenSource } | null> {
  const candidates = await readTokenCandidates();
  if (candidates.length === 0) return null;
  const hashes = candidates.map((candidate) => sha256(candidate.token));
  const sessionRows = await db.select().from(sessions).where(inArray(sessions.tokenHash, hashes));
  const now = new Date();
  const validSessions = (sessionRows as any[]).filter((s) => new Date(s.expiresAt) > now);
  if (validSessions.length === 0) return null;
  const userIds = validSessions.map((s) => s.userId);
  const userRows = (await db.select().from(users).where(inArray(users.id, userIds))) as User[];
  for (const candidate of candidates) {
    const hash = sha256(candidate.token);
    const session = validSessions.find((s) => s.tokenHash === hash);
    if (!session) continue;
    const user = userRows.find((u) => u.id === session.userId);
    if (user) return { user, source: candidate.source };
  }
  return null;
}

export async function getCurrentUser(): Promise<User | null> {
  return (await resolveSession())?.user ?? null;
}

export async function requirePassenger(): Promise<User> {
  const session = await resolveSession();
  if (!session) {
    await recordAuthDiagnostic("unauthorized", null);
    throw Errors.unauthorized();
  }
  if (session.user.role !== "passenger") {
    throw new AppError("forbidden", "Этот раздел предназначен для пассажиров", 403);
  }
  return session.user;
}

export async function requireAccount(): Promise<User> {
  const session = await resolveSession();
  if (!session) {
    await recordAuthDiagnostic("unauthorized", null);
    throw Errors.unauthorized();
  }
  if (session.user.role !== "passenger" && session.user.role !== "driver") throw Errors.forbidden();
  return session.user;
}

export async function signOut(): Promise<void> {
  const candidates = await readTokenCandidates();
  if (candidates.length > 0) {
    await db.delete(sessions).where(inArray(sessions.tokenHash, candidates.map((candidate) => sha256(candidate.token))));
  }
}
