/**
 * Безопасный внутренний путь для возврата после входа.
 * Отсекает внешние адреса ("//evil.com", "/\\evil.com", "https://..."), а также сам /login.
 */
export function safeNextPath(next: unknown, fallback = "/home"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith("/") || /^\/[\\/]/.test(next)) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  if (next === "/login" || next.startsWith("/login?") || next.startsWith("/login/")) return fallback;
  return next;
}
