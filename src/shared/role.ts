/**
 * Выбранная роль приложения. Сохраняется на устройстве, чтобы при следующем запуске
 * не выбирать её заново. После входа главной считается роль учётной записи на сервере.
 */
export type AppRole = "passenger" | "driver";

const ROLE_KEY = "taxi_app_role";
let memoryRole: AppRole | null = null;

export function isAppRole(value: unknown): value is AppRole {
  return value === "passenger" || value === "driver";
}

/** Сохранённая роль или null, если выбор ещё не сделан. */
export function getStoredRole(): AppRole | null {
  if (memoryRole) return memoryRole;
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(ROLE_KEY);
    if (isAppRole(value)) {
      memoryRole = value;
      return value;
    }
  } catch {
    // Хранилище недоступно (встроенное окно с блокировкой) — работаем без сохранения.
  }
  return null;
}

export function setStoredRole(role: AppRole): void {
  memoryRole = role;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROLE_KEY, role);
  } catch {
    // Только в памяти.
  }
}

export function clearStoredRole(): void {
  memoryRole = null;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ROLE_KEY);
  } catch {
    // Только в памяти.
  }
}

/** Главный экран роли. */
export function homePathForRole(role: AppRole): string {
  return role === "driver" ? "/driver" : "/home";
}
