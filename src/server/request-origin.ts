import "server-only";

/**
 * Публичный адрес приложения для текущего запроса (например, для return_url платежа).
 * За обратным прокси req.url указывает на внутренний адрес, а прокси превью может передавать
 * x-forwarded-proto: http даже при HTTPS. Поэтому приоритет такой:
 * APP_BASE_URL → заголовок Origin (реальный адрес страницы в браузере) → X-Forwarded-*.
 */
export function publicOrigin(req: Request): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.headers.get("host") || url.host;

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      // Origin принимается, только если это адрес самого приложения.
      if (parsed.host === host || req.headers.get("sec-fetch-site") === "same-origin") return parsed.origin;
    } catch {
      // Некорректный Origin — используем заголовки прокси.
    }
  }

  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/** Пришёл ли запрос по HTTPS (с учётом прокси и заголовка Origin). */
export function isHttpsRequest(req: Request): boolean {
  if (req.headers.get("origin")?.startsWith("https://")) return true;
  return publicOrigin(req).startsWith("https://");
}
