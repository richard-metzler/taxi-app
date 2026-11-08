/** Общие требования к паролю. Проверка повторяется сервером; хеширование — только на сервере. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Сообщение об ошибке пароля или null, если требования соблюдены. */
export function passwordPolicyError(password: unknown): string | null {
  if (typeof password !== "string" || !password.trim()) return "Введите пароль";
  const length = Array.from(password).length;
  if (length < PASSWORD_MIN_LENGTH) return "Пароль должен содержать не менее 8 символов";
  if (length > PASSWORD_MAX_LENGTH) return "Пароль должен содержать не более 128 символов";
  return null;
}
