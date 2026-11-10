import { AppError, handleApiError } from "@/core/errors";
import { runWithRpcContext } from "@/server/session-context";
import { isTokenFormat } from "@/server/session-transport";
import * as driverRegister from "@/app/api/driver/register/route";
import * as authLogout from "../auth/logout/route";
import * as authMe from "../auth/me/route";
import * as authRegister from "../auth/register/route";
import * as authLogin from "../auth/login/route";
import * as diagnosticsTransport from "../diagnostics/transport/route";
import * as fareEstimate from "../fare/estimate/route";
import * as geocodeReverse from "../geocode/reverse/route";
import * as geocodeSearch from "../geocode/search/route";
import * as orderCancel from "../orders/[id]/cancel/route";
import * as orderById from "../orders/[id]/route";
import * as ordersActive from "../orders/active/route";
import * as ordersEvents from "../orders/events/route";
import * as ordersRoot from "../orders/route";
import * as paymentById from "../payments/[id]/route";
import * as paymentsRoot from "../payments/route";
import * as profile from "../profile/route";
import * as driverRoot from "../driver/route";
import * as driverStatus from "../driver/status/route";
import * as driverLocation from "../driver/location/route";
import * as driverAvailable from "../driver/orders/available/route";
import * as driverHistory from "../driver/orders/history/route";
import * as driverAccept from "../driver/orders/[id]/accept/route";
import * as driverAction from "../driver/orders/[id]/action/route";

/**
 * POST /api/rpc — транспорт веб-клиента.
 *
 * Тело: { path: "/api/orders/…?…", method: "GET" | "POST" | "PATCH", body?: {...}, session?: "<токен>" }.
 * Прокси окна превью удаляет заголовки (Authorization, X-*, Origin, Sec-Fetch-*) и cookie,
 * поэтому токен сессии передаётся в теле. Запрос передаётся тем же обработчикам, что и REST-маршруты,
 * — бизнес-логика не дублируется. Доступны только API пассажира из явного списка
 * (webhook ЮKassa и служебные маршруты через этот адрес недоступны).
 */

type Method = "GET" | "POST" | "PATCH";
type RouteDef = {
  method: Method;
  pattern: RegExp;
  run: (req: Request, match: RegExpExecArray) => Promise<Response>;
};

const ID = "([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})";
const withParams = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });

const ROUTES: RouteDef[] = [
  { method: "POST", pattern: /^\/api\/driver\/register$/, run: (req) => driverRegister.POST(req) },
  { method: "POST", pattern: /^\/api\/auth\/register$/, run: (req) => authRegister.POST(req) },
  { method: "POST", pattern: /^\/api\/auth\/login$/, run: (req) => authLogin.POST(req) },
  { method: "POST", pattern: /^\/api\/auth\/logout$/, run: (req) => authLogout.POST(req) },
  { method: "GET", pattern: /^\/api\/auth\/me$/, run: () => authMe.GET() },
  { method: "PATCH", pattern: /^\/api\/profile$/, run: (req) => profile.PATCH(req) },
  { method: "GET", pattern: /^\/api\/geocode\/search$/, run: (req) => geocodeSearch.GET(req) },
  { method: "GET", pattern: /^\/api\/geocode\/reverse$/, run: (req) => geocodeReverse.GET(req) },
  { method: "POST", pattern: /^\/api\/fare\/estimate$/, run: (req) => fareEstimate.POST(req) },
  { method: "GET", pattern: /^\/api\/orders$/, run: () => ordersRoot.GET() },
  { method: "POST", pattern: /^\/api\/orders$/, run: (req) => ordersRoot.POST(req) },
  { method: "GET", pattern: /^\/api\/orders\/active$/, run: () => ordersActive.GET() },
  { method: "GET", pattern: /^\/api\/orders\/events$/, run: (req) => ordersEvents.GET(req) },
  {
    method: "GET",
    pattern: new RegExp(`^/api/orders/${ID}$`),
    run: (req, m) => orderById.GET(req, withParams({ id: m[1] })),
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/orders/${ID}/cancel$`),
    run: (req, m) => orderCancel.POST(req, withParams({ id: m[1] })),
  },
  { method: "GET", pattern: /^\/api\/payments$/, run: () => paymentsRoot.GET() },
  { method: "POST", pattern: /^\/api\/payments$/, run: (req) => paymentsRoot.POST(req) },
  {
    method: "GET",
    pattern: new RegExp(`^/api/payments/${ID}$`),
    run: (req, m) => paymentById.GET(req, withParams({ id: m[1] })),
  },
  { method: "GET", pattern: /^\/api\/diagnostics\/transport$/, run: () => diagnosticsTransport.GET() },
  // Интерфейс водителя
  { method: "GET", pattern: /^\/api\/driver$/, run: () => driverRoot.GET() },
  { method: "POST", pattern: /^\/api\/driver\/status$/, run: (req) => driverStatus.POST(req) },
  { method: "POST", pattern: /^\/api\/driver\/location$/, run: (req) => driverLocation.POST(req) },
  { method: "GET", pattern: /^\/api\/driver\/orders\/available$/, run: () => driverAvailable.GET() },
  { method: "GET", pattern: /^\/api\/driver\/orders\/history$/, run: () => driverHistory.GET() },
  {
    method: "POST",
    pattern: new RegExp(`^/api/driver/orders/${ID}/accept$`),
    run: (req, m) => driverAccept.POST(req, withParams({ id: m[1] })),
  },
  {
    method: "POST",
    pattern: new RegExp(`^/api/driver/orders/${ID}/action$`),
    run: (req, m) => driverAction.POST(req, withParams({ id: m[1] })),
  },
];

const MAX_ENVELOPE_BYTES = 64 * 1024;
const INTERNAL_BASE = "http://rpc.internal";
/** Заголовки соединения не переносятся во внутренний запрос. */
const HOP_BY_HOP = new Set([
  "connection",
  "content-length",
  "content-type",
  "expect",
  "keep-alive",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

type Envelope = { path: string; method: Method; body: unknown; session: unknown };

function badRequest(): AppError {
  return new AppError("bad_request", "Некорректный запрос к серверу", 400);
}

/** Проверка конверта. Content-Type не требуется: прокси может его удалить. */
function parseEnvelope(raw: string): Envelope {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw badRequest();
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw badRequest();
  const o = value as Record<string, unknown>;
  if (typeof o.path !== "string" || !o.path.startsWith("/api/") || o.path.length > 2048) throw badRequest();
  if (o.method !== "GET" && o.method !== "POST" && o.method !== "PATCH") throw badRequest();
  return { path: o.path, method: o.method, body: o.body, session: o.session };
}

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (raw.length > MAX_ENVELOPE_BYTES) throw new AppError("payload_too_large", "Слишком большой запрос", 413);
    const envelope = parseEnvelope(raw);

    // Путь разбирается относительно служебного адреса: «//чужой.сайт» или «http://…» отклоняются.
    const target = new URL(envelope.path, INTERNAL_BASE);
    if (target.origin !== INTERNAL_BASE) throw badRequest();

    const route = ROUTES.find((r) => r.method === envelope.method && r.pattern.test(target.pathname));
    if (!route) throw new AppError("not_found", "Метод API не найден", 404);
    const match = route.pattern.exec(target.pathname);
    if (!match) throw new AppError("not_found", "Метод API не найден", 404);

    // Внутренний запрос: тот же адрес сервера, исходные заголовки (без заголовков соединения).
    const headers = new Headers();
    req.headers.forEach((value, name) => {
      if (!HOP_BY_HOP.has(name)) headers.set(name, value);
    });
    headers.set("content-type", "application/json");
    const inner = new Request(new URL(target.pathname + target.search, req.url), {
      method: envelope.method,
      headers,
      body: envelope.method === "GET" ? undefined : JSON.stringify(envelope.body ?? {}),
    });

    const token = isTokenFormat(envelope.session) ? envelope.session : null;
    return await runWithRpcContext({ token }, () => route.run(inner, match));
  } catch (e) {
    return handleApiError(e);
  }
}
