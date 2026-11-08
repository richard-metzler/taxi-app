import "server-only";
import { cookies, headers } from "next/headers";
import { getRpcContext } from "./session-context";

/** Имя cookie сессии. */
export const SESSION_COOKIE = "taxi_session";
/** Дублирующий заголовок с токеном: некоторые прокси удаляют или перезаписывают Authorization. */
export const SESSION_HEADER = "x-session-token";
/** Маркер собственного клиента. Без него cookie не принимается — защита от CSRF. */
export const CLIENT_HEADER = "x-taxi-client";

const TOKEN_RE = /^[a-f0-9]{64}$/;

/** Похоже ли значение на токен сессии (64 hex-символа). */
export function isTokenFormat(value: unknown): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}

export type TokenSource = "body" | "authorization" | "header" | "cookie";
export type TokenCandidate = { token: string; source: TokenSource };

/**
 * Все токены сессии из текущего запроса в порядке приоритета:
 * тело RPC-запроса → Authorization: Bearer → X-Session-Token → cookie.
 * Тело — основной способ для веб-клиента: его не удаляют прокси.
 * Непригодное значение одного способа не мешает проверить остальные.
 * Cookie учитывается только вместе с заголовком X-Taxi-Client: межсайтовая форма или <img>
 * не могут добавить заголовок, поэтому cookie с SameSite=None не открывает CSRF.
 * Токен в теле CSRF не подвержен: чужой сайт его не знает.
 */
export async function readTokenCandidates(): Promise<TokenCandidate[]> {
  const h = await headers();
  const c = await cookies();
  const result: TokenCandidate[] = [];
  const push = (token: unknown, source: TokenSource) => {
    if (isTokenFormat(token) && !result.some((r) => r.token === token)) result.push({ token, source });
  };
  push(getRpcContext()?.token, "body");
  push(h.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1], "authorization");
  push(h.get(SESSION_HEADER)?.trim(), "header");
  if (h.get(CLIENT_HEADER)) push(c.get(SESSION_COOKIE)?.value, "cookie");
  return result;
}

/**
 * Cookie сессии (запасной способ для прямого доступа без прокси).
 * По HTTPS: SameSite=None; Secure; Partitioned (CHIPS) — браузер сохраняет её даже во встроенном
 * окне с другого сайта при блокировке сторонних cookie. По HTTP: SameSite=Lax.
 */
export function serializeSessionCookie(token: string, expiresAt: Date, secure: boolean): string {
  const attrs = [`${SESSION_COOKIE}=${token}`, "Path=/", `Expires=${expiresAt.toUTCString()}`, "HttpOnly"];
  attrs.push(...(secure ? ["Secure", "SameSite=None", "Partitioned"] : ["SameSite=Lax"]));
  return attrs.join("; ");
}

/** Удаление cookie сессии. Секционированную cookie браузер удаляет, только если удаление тоже Partitioned. */
export function serializeClearSessionCookies(secure: boolean): string[] {
  const base = [`${SESSION_COOKIE}=`, "Path=/", "Expires=Thu, 01 Jan 1970 00:00:00 GMT", "Max-Age=0", "HttpOnly"];
  const list = [[...base, "SameSite=Lax"].join("; ")];
  if (secure) list.push([...base, "Secure", "SameSite=None", "Partitioned"].join("; "));
  return list;
}

export type TransportInfo = {
  authorization: "absent" | "bearer" | "other";
  sessionHeader: boolean;
  cookie: boolean;
  clientHeader: boolean;
  /** Токен пришёл в теле RPC-запроса. */
  bodySession: boolean;
  /** Запрос пришёл через /api/rpc. */
  viaRpc: boolean;
  /** Имена заголовков, дошедших до сервера (без значений) — показывают, что удаляет прокси. */
  headerNames: string;
  forwardedHost: string | null;
  forwardedProto: string | null;
  secFetchSite: string | null;
  origin: string | null;
  userAgent: string | null;
};

/** Какие способы передачи сессии дошли до сервера (значения токенов не раскрываются). */
export async function describeTransport(): Promise<TransportInfo> {
  const h = await headers();
  const c = await cookies();
  const auth = h.get("authorization");
  const rpc = getRpcContext();
  const names: string[] = [];
  h.forEach((_value, name) => names.push(name));
  return {
    authorization: !auth ? "absent" : /^Bearer\s+[a-f0-9]{64}$/i.test(auth) ? "bearer" : "other",
    sessionHeader: isTokenFormat(h.get(SESSION_HEADER)?.trim()),
    cookie: isTokenFormat(c.get(SESSION_COOKIE)?.value),
    clientHeader: Boolean(h.get(CLIENT_HEADER)),
    bodySession: isTokenFormat(rpc?.token),
    viaRpc: Boolean(rpc),
    headerNames: names.sort().join(",").slice(0, 1000),
    forwardedHost: h.get("x-forwarded-host") ?? h.get("host"),
    forwardedProto: h.get("x-forwarded-proto"),
    secFetchSite: h.get("sec-fetch-site"),
    origin: h.get("origin"),
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  };
}
