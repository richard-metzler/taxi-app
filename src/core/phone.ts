/**
 * Нормализация российского номера телефона к формату +7XXXXXXXXXX.
 * Возвращает null, если номер некорректен.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let normalized = digits;
  if (digits.length === 11 && (digits.startsWith("8") || digits.startsWith("7"))) {
    normalized = "7" + digits.slice(1);
  } else if (digits.length === 10 && digits.startsWith("9")) {
    normalized = "7" + digits;
  }
  if (!/^7\d{10}$/.test(normalized)) return null;
  return "+" + normalized;
}

/** Формат для отображения: +7 (999) 123-45-67 */
export function formatPhone(phone: string): string {
  const m = phone.match(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/);
  if (!m) return phone;
  return `+7 (${m[1]}) ${m[2]}-${m[3]}-${m[4]}`;
}
