"use client";

import type { EstimateView, OrderSummary, OrderView, Place, UserProfile } from "./types";
import type { AvailableOrderView, DriverStateView, DriverTripView } from "./driver-types";
import type { AppRole } from "./role";
import type { DriverAction } from "../core/driver-flow";
import type { VehicleInput } from "../core/vehicle";

/** Ошибка API с кодом и сообщением для пользователя. */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/* ---------- Хранение токена сессии ---------- */

const TOKEN_KEY = "taxi_passenger_session";
const WINDOW_NAME_PREFIX = "taxi_passenger_session:";
const TOKEN_RE = /^[a-f0-9]{64}$/;

let memoryToken: string | null = null;
let tokenLoaded = false;
/** Счётчик входов: ответы на запросы, начатые до нового входа, не могут сбросить новую сессию. */
let loginEpoch = 0;

/** localStorage, если браузер разрешает им пользоваться (во встроенном окне может быть заблокирован). */
function availableStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    const probe = "__taxi_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

function readWindowName(): string | null {
  try {
    const value = window.name;
    if (!value.startsWith(WINDOW_NAME_PREFIX)) return null;
    const token = value.slice(WINDOW_NAME_PREFIX.length);
    return TOKEN_RE.test(token) ? token : null;
  } catch {
    return null;
  }
}

function writeWindowName(token: string | null): void {
  try {
    if (token) window.name = WINDOW_NAME_PREFIX + token;
    else if (window.name.startsWith(WINDOW_NAME_PREFIX)) window.name = "";
  } catch {
    // Недоступно — токен останется только в памяти.
  }
}

/**
 * Загрузка токена: localStorage, а если он заблокирован — window.name.
 * window.name переживает перезагрузку окна и не зависит от cookie и заголовков, которые удаляет прокси.
 * Используется только при недоступном хранилище; при уходе на сторонние сайты очищается.
 */
function loadToken(): string | null {
  const storage = availableStorage();
  if (!storage) return readWindowName();
  const fromName = readWindowName();
  writeWindowName(null);
  try {
    const stored = storage.getItem(TOKEN_KEY);
    if (stored && TOKEN_RE.test(stored)) return stored;
    if (fromName) storage.setItem(TOKEN_KEY, fromName);
  } catch {
    // Хранилище стало недоступно — используем значение из window.name.
  }
  return fromName;
}

function persistToken(token: string | null): void {
  const storage = availableStorage();
  if (storage) {
    try {
      if (token) storage.setItem(TOKEN_KEY, token);
      else storage.removeItem(TOKEN_KEY);
      writeWindowName(null);
      return;
    } catch {
      // Переходим к window.name.
    }
  }
  writeWindowName(token);
}

function getSessionToken(): string | null {
  if (!tokenLoaded && typeof window !== "undefined") {
    tokenLoaded = true;
    memoryToken = loadToken();
  }
  return memoryToken;
}

function setSessionToken(token: string | null): void {
  memoryToken = token;
  tokenLoaded = true;
  if (token) loginEpoch++;
  if (typeof window !== "undefined") persistToken(token);
}

/** Номер текущего входа (для защиты от гонок при восстановлении сессии). */
export function getLoginEpoch(): number {
  return loginEpoch;
}

/** Событие потери сессии — экран входа появляется на текущей странице. */
export const UNAUTHORIZED_EVENT = "taxi:unauthorized";

/* ---------- Транспорт ---------- */

type Method = "GET" | "POST" | "PATCH";
type RequestOptions = { method?: Method; body?: unknown };

/** Единый адрес API веб-клиента: путь, метод, данные и сессия передаются в теле запроса. */
const RPC_ENDPOINT = "/api/rpc";

/**
 * Запрос к API. Прокси окна превью удаляет заголовки и cookie, поэтому токен сессии
 * передаётся в теле запроса — оно доходит до сервера без изменений.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new ApiError("offline", "Нет подключения к интернету", 0);
  }
  const epoch = loginEpoch;
  const session = getSessionToken();

  let res: Response;
  try {
    res = await fetch(RPC_ENDPOINT, {
      method: "POST",
      // X-Taxi-Client — маркер собственного клиента для запасного входа по cookie (если прокси его пропускает).
      headers: { "Content-Type": "application/json", "X-Taxi-Client": "web" },
      body: JSON.stringify({ path, method: options.method ?? "GET", body: options.body, session: session ?? undefined }),
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("network", "Не удалось связаться с сервером. Проверьте подключение.", 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: { code: string; message: string } } & T;

  // Сессия недействительна. Сбрасываем, только если за время запроса не было нового входа.
  if (res.status === 401 && !path.startsWith("/api/auth/") && epoch === loginEpoch) {
    setSessionToken(null);
    if (typeof window !== "undefined") window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  if (!res.ok) {
    throw new ApiError(data.error?.code ?? "unknown", data.error?.message ?? "Произошла ошибка", res.status);
  }
  return data;
}

export type AddressSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type PaymentCreated = { id: string; status: string; amount: number; confirmationUrl: string | null };

export type TransportDiagnostics = {
  bodySession: boolean;
  viaRpc: boolean;
  authorization: "absent" | "bearer" | "other";
  sessionHeader: boolean;
  cookie: boolean;
  clientHeader: boolean;
  forwardedProto: string | null;
  secFetchSite: string | null;
  headerNames: string;
};

async function authenticate(
  path: "/api/auth/register" | "/api/auth/login",
  body: { phone: string; password: string; name?: string; role?: AppRole; vehicle?: VehicleInput },
): Promise<{ user: UserProfile }> {
  const result = await request<{ user: UserProfile; token: string }>(path, { method: "POST", body });
  if (!TOKEN_RE.test(result.token ?? "")) {
    throw new ApiError("no_session", "Сервер не выдал сессию. Попробуйте войти ещё раз.", 500);
  }
  setSessionToken(result.token);
  return { user: result.user };
}

/** Клиентский API. Единственная точка обращений к серверу из интерфейса. */
export const api = {
  auth: {
    /** Регистрация: имя, телефон и пароль. Пароль не сохраняется в браузере. */
    register: (input: { phone: string; name: string; password: string; role: AppRole; vehicle?: VehicleInput }) =>
      authenticate("/api/auth/register", input),
    /** Вход по номеру и паролю в выбранной роли. Токен сохраняется внутри API-слоя. */
    login: (input: { phone: string; password: string; role: AppRole }) =>
      authenticate("/api/auth/login", input),
    /** Восстановление сессии. Недействительный токен удаляется (если не было нового входа). */
    me: async (): Promise<{ user: UserProfile | null }> => {
      const epoch = loginEpoch;
      const res = await request<{ user: UserProfile | null }>("/api/auth/me");
      if (!res.user && epoch === loginEpoch) setSessionToken(null);
      return { user: res.user ?? null };
    },
    logout: async (): Promise<void> => {
      try {
        await request<{ ok: true }>("/api/auth/logout", { method: "POST" });
      } finally {
        setSessionToken(null);
      }
    },
    /** Перед уходом на сторонний сайт (страница оплаты): токен не должен оставаться в window.name. */
    prepareExternalNavigation: (): void => {
      if (typeof window !== "undefined") writeWindowName(null);
    },
  },
  diagnostics: {
    transport: () => request<TransportDiagnostics>("/api/diagnostics/transport"),
  },
  /** Интерфейс водителя. Все изменения статусов заказа выполняет сервер. */
  driver: {
    register: (data: { name: string; carModel: string; plate: string; color: string }) =>
      request<{ ok: true }>("/api/driver/register", { method: "POST", body: data }),
    state: () => request<DriverStateView>("/api/driver"),
    setStatus: (online: boolean, position?: { latitude: number; longitude: number }) =>
      request<{ isOnline: boolean }>("/api/driver/status", { method: "POST", body: { online, ...position } }),
    sendLocation: (position: { latitude: number; longitude: number; heading?: number }) =>
      request<{ ok: true }>("/api/driver/location", { method: "POST", body: position }),
    availableOrders: () => request<{ items: AvailableOrderView[] }>("/api/driver/orders/available"),
    accept: (orderId: string) =>
      request<{ ok: true }>(`/api/driver/orders/${encodeURIComponent(orderId)}/accept`, { method: "POST" }),
    action: (orderId: string, action: DriverAction) =>
      request<{ status: string }>(`/api/driver/orders/${encodeURIComponent(orderId)}/action`, {
        method: "POST",
        body: { action },
      }),
    history: () => request<{ items: DriverTripView[] }>("/api/driver/orders/history"),
  },
  profile: {
    update: (patch: { name?: string; navigator?: string }) =>
      request<{ user: UserProfile }>("/api/profile", { method: "PATCH", body: patch }),
  },
  geocode: {
    search: (q: string, near?: { latitude: number; longitude: number } | null) => {
      const p = new URLSearchParams({ q });
      if (near) {
        p.set("lat", String(near.latitude));
        p.set("lng", String(near.longitude));
      }
      return request<{ items: AddressSuggestion[] }>(`/api/geocode/search?${p}`);
    },
    reverse: (lat: number, lng: number) =>
      request<{ item: AddressSuggestion | null }>(`/api/geocode/reverse?lat=${lat}&lng=${lng}`),
  },
  fare: {
    estimate: (pickup: Place, destination: Place) =>
      request<EstimateView>("/api/fare/estimate", { method: "POST", body: { pickup, destination } }),
  },
  orders: {
    create: (estimateId: string, tariffId: string) =>
      request<{ orderId: string; status: string }>("/api/orders", { method: "POST", body: { estimateId, tariffId } }),
    get: (id: string) => request<{ order: OrderView }>(`/api/orders/${encodeURIComponent(id)}`),
    cancel: (id: string) => request<{ status: string }>(`/api/orders/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
    active: () => request<{ orderId: string | null }>("/api/orders/active"),
    list: () => request<{ items: OrderSummary[] }>("/api/orders"),
    events: (since: string | null) =>
      request<{ items: { id: string; orderId: string; type: string; title: string; body: string; createdAt: string }[]; now: string }>(
        `/api/orders/events${since ? `?since=${encodeURIComponent(since)}` : ""}`,
      ),
  },

};
