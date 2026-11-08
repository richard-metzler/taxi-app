/**
 * Интеграционные тесты API пассажира. Запуск против работающего сервера:
 *   E2E_BASE_URL=http://localhost:3000 node --experimental-strip-types --test tests/*.test.ts
 * Без E2E_BASE_URL тесты пропускаются. Используются случайные тестовые номера и пароли.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.E2E_BASE_URL?.replace(/\/+$/, "");
const skip = BASE ? false : "E2E_BASE_URL не задан — интеграционные тесты пропущены";

type CallInit = {
  method?: string;
  body?: unknown;
  token?: string;
  /** Токен только в заголовке X-Session-Token. */
  sessionHeader?: string;
  /** Сырые заголовки (например, чужой Authorization от прокси). */
  headers?: Record<string, string>;
  cookie?: string;
  /** Маркер собственного клиента (обязателен для входа по cookie). */
  client?: boolean;
};

async function call(path: string, init: CallInit = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers ?? {}) };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.sessionHeader) headers["X-Session-Token"] = init.sessionHeader;
  if (init.cookie) headers.Cookie = init.cookie;
  if (init.client) headers["X-Taxi-Client"] = "web";
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, setCookies: res.headers.getSetCookie() };
}

const randomPhone = () => "+7913" + String(Math.floor(1_000_000 + Math.random() * 8_999_999));

const TEST_PASSWORD = "Тестовый-Пароль-2026!";
const registrationBody = (phone: string) => ({ phone, name: "Пассажир", password: TEST_PASSWORD });

/** Создаёт отдельный тестовый профиль и проверяет вход по паролю. */
async function login(phone = randomPhone()): Promise<string> {
  const registered = await call("/api/auth/register", { method: "POST", body: registrationBody(phone) });
  assert.equal(registered.status, 201, JSON.stringify(registered.data));
  const result = await call("/api/auth/login", { method: "POST", body: { phone, password: TEST_PASSWORD } });
  assert.equal(result.status, 200);
  assert.match(result.data.token, /^[a-f0-9]{64}$/);
  return result.data.token as string;
}

const ROUTE = {
  pickup: { address: "пл. Ленина, Томск", latitude: 56.4886, longitude: 84.9521 },
  destination: { address: "ул. Красноармейская, 120, Томск", latitude: 56.461, longitude: 84.968 },
};

test("авторизация: регистрация, вход по паролю и сессия Bearer без cookie", { skip }, async () => {
  const phone = randomPhone();
  const registered = await call("/api/auth/register", { method: "POST", body: { ...registrationBody(phone), role: "admin" } });
  assert.equal(registered.status, 201);
  assert.equal(registered.data.user.role, "passenger");
  assert.equal(registered.data.user.name, "Пассажир");
  assert.equal(registered.data.user.passwordHash, undefined);
  assert.equal(registered.data.user.password, undefined);
  assert.ok(!JSON.stringify(registered.data).includes(TEST_PASSWORD));

  const duplicate = await call("/api/auth/register", { method: "POST", body: registrationBody(phone) });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.data.error.code, "phone_registered");

  const wrong = await call("/api/auth/login", { method: "POST", body: { phone, password: "Неверный-Пароль-123" } });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.data.error.code, "invalid_credentials");
  const unknown = await call("/api/auth/login", { method: "POST", body: { phone: randomPhone(), password: TEST_PASSWORD } });
  assert.equal(unknown.status, 401);
  assert.equal(unknown.data.error.message, wrong.data.error.message);

  const result = await call("/api/auth/login", { method: "POST", body: { phone, password: TEST_PASSWORD } });
  assert.equal(result.status, 200);
  assert.ok(!JSON.stringify(result.data).includes(TEST_PASSWORD));
  const me = await call("/api/auth/me", { token: result.data.token });
  assert.equal(me.data.user.phone, phone);
  assert.equal(me.data.user.passwordHash, undefined);
  assert.equal((await call("/api/auth/me")).data.user, null);
});

test("профиль: имя сохраняется, роль изменить нельзя", { skip }, async () => {
  const token = await login();
  const res = await call("/api/profile", { method: "PATCH", token, body: { name: "Вася", role: "admin" } });
  assert.equal(res.status, 200);
  assert.equal(res.data.user.name, "Вася");
  assert.equal(res.data.user.role, "passenger");
});

test("тарифы: оценка выполняется сервером, суммы в копейках, версия тарифа указана", { skip }, async () => {
  const token = await login();
  const unauth = await call("/api/fare/estimate", { method: "POST", body: ROUTE });
  assert.equal(unauth.status, 401);
  const est = await call("/api/fare/estimate", { method: "POST", token, body: ROUTE });
  assert.equal(est.status, 200);
  assert.ok(est.data.estimateId);
  assert.ok(est.data.distanceMeters > 0 && est.data.durationSeconds > 0);
  assert.ok(est.data.tariffs.length > 0);
  for (const t of est.data.tariffs) {
    assert.ok(Number.isInteger(t.price) && t.price > 0, "цена — целые копейки");
    assert.ok(Number.isInteger(t.version), "указана версия тарифа");
    assert.equal(t.baseFare, undefined, "ставки тарифа не передаются клиенту");
  }
});

test("заказ: создание, права доступа, история, отмена, оплата только после завершения", { skip }, async () => {
  const owner = await login();
  const stranger = await login();

  const est = await call("/api/fare/estimate", { method: "POST", token: owner, body: ROUTE });
  const tariffId = est.data.tariffs[0].id as string;
  const created = await call("/api/orders", { method: "POST", token: owner, body: { estimateId: est.data.estimateId, tariffId } });
  assert.equal(created.status, 201);
  assert.equal(created.data.status, "searching");
  const orderId = created.data.orderId as string;

  // Чужая оценка не может быть использована
  const foreignEstimate = await call("/api/orders", { method: "POST", token: stranger, body: { estimateId: est.data.estimateId, tariffId } });
  assert.equal(foreignEstimate.status, 404);

  // Второй активный заказ запрещён
  const duplicate = await call("/api/orders", { method: "POST", token: owner, body: { estimateId: est.data.estimateId, tariffId } });
  assert.equal(duplicate.status, 409);

  const own = await call(`/api/orders/${orderId}`, { token: owner });
  assert.equal(own.status, 200);
  assert.equal(own.data.order.pickup.latitude, ROUTE.pickup.latitude);
  assert.equal(own.data.order.tariffVersion, est.data.tariffs[0].version);

  assert.equal((await call(`/api/orders/${orderId}`, { token: stranger })).status, 403);
  assert.equal((await call(`/api/orders/${orderId}`)).status, 401);
  assert.equal((await call(`/api/orders/${orderId}/cancel`, { method: "POST", token: stranger })).status, 403);

  const strangerHistory = await call("/api/orders", { token: stranger });
  assert.ok(!strangerHistory.data.items.some((o: { id: string }) => o.id === orderId), "чужой заказ не виден в истории");
  const ownerHistory = await call("/api/orders", { token: owner });
  assert.ok(ownerHistory.data.items.some((o: { id: string }) => o.id === orderId));

  // Оплата незавершённой поездки невозможна (409) либо провайдер не настроен (503)
  const pay = await call("/api/payments", { method: "POST", token: owner, body: { orderId } });
  assert.ok([409, 503].includes(pay.status), `ожидался отказ, получено ${pay.status}`);

  const cancelled = await call(`/api/orders/${orderId}/cancel`, { method: "POST", token: owner });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.data.status, "cancelled");
});

test("выход: токен перестаёт действовать", { skip }, async () => {
  const token = await login();
  assert.equal((await call("/api/auth/logout", { method: "POST", token })).status, 200);
  const me = await call("/api/auth/me", { token });
  assert.equal(me.data.user, null);
  assert.equal((await call("/api/orders", { token })).status, 401);
});

test("сессия: все способы передачи токена и защита cookie от CSRF", { skip }, async () => {
  const phone = randomPhone();
  assert.equal((await call("/api/auth/register", { method: "POST", body: registrationBody(phone) })).status, 201);
  const v = await call("/api/auth/login", { method: "POST", body: { phone, password: TEST_PASSWORD } });
  assert.equal(v.status, 200);
  const token = v.data.token as string;

  // Cookie выставлена, httpOnly; по HTTP — SameSite=Lax (по HTTPS — SameSite=None; Secure; Partitioned)
  const sessionCookie = v.setCookies.find((c: string) => c.startsWith("taxi_session="));
  assert.ok(sessionCookie, "ожидается cookie сессии");
  assert.match(sessionCookie!, /HttpOnly/);
  assert.match(sessionCookie!, /SameSite=(Lax|None)/);
  const cookie = sessionCookie!.split(";")[0];

  // Только X-Session-Token
  assert.equal((await call("/api/auth/me", { sessionHeader: token })).data.user?.phone, phone);
  // Прокси подставил свой Authorization — дублирующий заголовок всё равно работает
  const viaProxy = await call("/api/auth/me", { headers: { Authorization: "Basic cHJveHk6c2VjcmV0" }, sessionHeader: token });
  assert.equal(viaProxy.data.user?.phone, phone);
  // Только cookie + маркер клиента
  assert.equal((await call("/api/auth/me", { cookie, client: true })).data.user?.phone, phone);
  // Cookie без маркера клиента (межсайтовая форма/картинка) не принимается
  assert.equal((await call("/api/auth/me", { cookie })).data.user, null);
  const csrf = await call("/api/profile", { method: "PATCH", cookie, body: { name: "Взлом" } });
  assert.equal(csrf.status, 401);

  // Выход очищает cookie и делает токен недействительным для всех способов
  const out = await call("/api/auth/logout", { method: "POST", cookie, client: true });
  assert.equal(out.status, 200);
  assert.ok(out.setCookies.some((c: string) => c.startsWith("taxi_session=;") && /Max-Age=0/.test(c)));
  assert.equal((await call("/api/auth/me", { sessionHeader: token })).data.user, null);
  assert.equal((await call("/api/auth/me", { cookie, client: true })).data.user, null);
});

/* ---------- Транспорт веб-клиента: POST /api/rpc, сессия в теле запроса ---------- */

/**
 * Вызов через /api/rpc без заголовков сессии, cookie и даже Content-Type —
 * так запрос выглядит после прокси окна превью, который пересылает только тело.
 */
async function rpc(path: string, opts: { method?: string; body?: unknown; session?: unknown } = {}) {
  const res = await fetch(`${BASE}/api/rpc`, {
    method: "POST",
    body: JSON.stringify({ path, method: opts.method ?? "GET", body: opts.body, session: opts.session }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test("rpc: полный вход и работа с сессией только через тело запроса", { skip }, async () => {
  const phone = randomPhone();
  const registered = await rpc("/api/auth/register", { method: "POST", body: registrationBody(phone) });
  assert.equal(registered.status, 201);
  const v = await rpc("/api/auth/login", { method: "POST", body: { phone, password: TEST_PASSWORD } });
  assert.equal(v.status, 200);
  const session = v.data.token as string;
  assert.match(session, /^[a-f0-9]{64}$/);

  const me = await rpc("/api/auth/me", { session });
  assert.equal(me.data.user?.phone, phone);
  assert.equal((await rpc("/api/auth/me")).data.user, null);

  const named = await rpc("/api/profile", { method: "PATCH", session, body: { name: "Вася", role: "admin" } });
  assert.equal(named.status, 200);
  assert.equal(named.data.user.name, "Вася");
  assert.equal(named.data.user.role, "passenger");

  // Параметры строки запроса передаются обработчику
  const events = await rpc(`/api/orders/events?since=${encodeURIComponent(new Date().toISOString())}`, { session });
  assert.equal(events.status, 200);
  assert.ok(Array.isArray(events.data.items));

  const diag = await rpc("/api/diagnostics/transport", { session });
  assert.equal(diag.data.bodySession, true);
  assert.equal(diag.data.viaRpc, true);

  // Без сессии и с повреждённой сессией — 401
  assert.equal((await rpc("/api/orders")).status, 401);
  assert.equal((await rpc("/api/orders", { session: "x".repeat(64) })).status, 401);
  assert.equal((await rpc("/api/orders", { session: { $ne: null } })).status, 401);

  // Выход делает сессию недействительной
  assert.equal((await rpc("/api/auth/logout", { method: "POST", session })).status, 200);
  assert.equal((await rpc("/api/auth/me", { session })).data.user, null);
  assert.equal((await rpc("/api/orders", { session })).status, 401);
});

test("rpc: доступны только API пассажира, некорректные конверты отклоняются", { skip }, async () => {
  for (const path of ["/api/payments/webhook", "/api/health", "/api/rpc", "/api/orders/not-a-uuid", "/api/../health"]) {
    const r = await rpc(path, { method: path.endsWith("webhook") || path.endsWith("rpc") ? "POST" : "GET" });
    assert.ok([400, 404].includes(r.status), `${path}: ожидался отказ, получено ${r.status}`);
  }
  // Метод не совпадает с маршрутом
  assert.equal((await rpc("/api/auth/me", { method: "POST" })).status, 404);
  // Внешние адреса и мусор
  for (const path of ["//evil.com/api/auth/me", "http://evil.com/api/auth/me", "api/auth/me"]) {
    assert.equal((await rpc(path)).status, 400, path);
  }
  for (const raw of ["не json", "[]", "null", JSON.stringify({ path: "/api/auth/me", method: "DELETE" })]) {
    const res = await fetch(`${BASE}/api/rpc`, { method: "POST", body: raw });
    assert.equal(res.status, 400, raw);
  }
});

test("rpc: чужой заказ недоступен и через тело запроса", { skip }, async () => {
  const login = async () => {
    const phone = randomPhone();
    assert.equal((await rpc("/api/auth/register", { method: "POST", body: registrationBody(phone) })).status, 201);
    return (await rpc("/api/auth/login", { method: "POST", body: { phone, password: TEST_PASSWORD } })).data.token as string;
  };
  const owner = await login();
  const stranger = await login();
  const est = await rpc("/api/fare/estimate", { method: "POST", session: owner, body: ROUTE });
  assert.equal(est.status, 200);
  const created = await rpc("/api/orders", {
    method: "POST",
    session: owner,
    body: { estimateId: est.data.estimateId, tariffId: est.data.tariffs[0].id },
  });
  assert.equal(created.status, 201);
  const id = created.data.orderId as string;
  assert.equal((await rpc(`/api/orders/${id}`, { session: owner })).status, 200);
  assert.equal((await rpc(`/api/orders/${id}`, { session: stranger })).status, 403);
  assert.equal((await rpc(`/api/orders/${id}/cancel`, { method: "POST", session: stranger })).status, 403);
  assert.equal((await rpc(`/api/orders/${id}/cancel`, { method: "POST", session: owner })).data.status, "cancelled");
});

/* ---------- Зоны обслуживания ---------- */

test("зоны: тарифы есть в разных городах, «Бизнес» — только в крупных", { skip }, async () => {
  const token = await login();
  const estimate = (pickup: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) =>
    call("/api/fare/estimate", {
      method: "POST",
      token,
      body: { pickup: { address: "Подача", ...pickup }, destination: { address: "Назначение", ...destination } },
    });

  const moscow = await estimate({ latitude: 55.7539, longitude: 37.6208 }, { latitude: 55.7299, longitude: 37.6031 });
  assert.equal(moscow.status, 200, JSON.stringify(moscow.data));
  assert.equal(moscow.data.zone.name, "Москва");
  assert.deepEqual(moscow.data.tariffs.map((t: { id: string }) => t.id), ["econom", "comfort", "business"]);

  const krasnoyarsk = await estimate({ latitude: 56.0106, longitude: 92.8526 }, { latitude: 56.0334, longitude: 92.9101 });
  assert.equal(krasnoyarsk.status, 200);
  assert.equal(krasnoyarsk.data.zone.name, "Красноярск");

  const barnaul = await estimate({ latitude: 53.3481, longitude: 83.7798 }, { latitude: 53.3606, longitude: 83.7636 });
  assert.equal(barnaul.status, 200);
  assert.deepEqual(barnaul.data.tariffs.map((t: { id: string }) => t.id), ["econom", "comfort"], "в Барнауле без «Бизнеса»");
});

test("зоны: вне города — понятная причина, межгород — отдельная ошибка", { skip }, async () => {
  const token = await login();
  // Посёлок в тайге, далеко от городов обслуживания
  const outside = await call("/api/fare/estimate", {
    method: "POST",
    token,
    body: {
      pickup: { address: "Подача", latitude: 61.0, longitude: 89.0 },
      destination: { address: "Назначение", latitude: 61.02, longitude: 89.03 },
    },
  });
  assert.equal(outside.status, 422);
  assert.equal(outside.data.error.code, "out_of_service_area");
  assert.match(outside.data.error.message, /слишком далеко от городов обслуживания/);

  // Томск → Новосибирск (~210 км)
  const intercity = await call("/api/fare/estimate", {
    method: "POST",
    token,
    body: {
      pickup: { address: "Томск", latitude: 56.4886, longitude: 84.9521 },
      destination: { address: "Новосибирск", latitude: 55.0084, longitude: 82.9357 },
    },
  });
  assert.equal(intercity.status, 422);
  assert.equal(intercity.data.error.code, "trip_too_long");
});

test("зоны: пригород Томска (~100 км) обслуживается без «Бизнеса», подача дольше", { skip }, async () => {
  const token = await login();
  const res = await call("/api/fare/estimate", {
    method: "POST",
    token,
    body: {
      pickup: { address: "Асино", latitude: 56.9926, longitude: 86.1566 },
      destination: { address: "Асино, вокзал", latitude: 56.9811, longitude: 86.1803 },
    },
  });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.zone.id, "tomsk");
  assert.equal(res.data.zone.suburban, true);
  assert.match(res.data.zone.name, /пригород/);
  const ids = res.data.tariffs.map((t: { id: string }) => t.id);
  assert.deepEqual(ids, ["econom", "comfort"]);
  const econom = res.data.tariffs.find((t: { id: string }) => t.id === "econom");
  assert.ok(econom.pickupEtaSeconds > 20 * 60, `подача из города должна быть дольше, получено ${econom.pickupEtaSeconds} с`);
});


test("регистрация: сервер проверяет имя, пароль и телефон; пароль учитывает регистр", { skip }, async () => {
  const phone = randomPhone();
  for (const password of ["1234567", "        ", "я".repeat(129), 12345678]) {
    const result = await call("/api/auth/register", { method: "POST", body: { phone, name: "Пассажир", password } });
    assert.equal(result.status, 422);
  }
  assert.equal((await call("/api/auth/register", { method: "POST", body: { phone, name: " ", password: TEST_PASSWORD } })).status, 422);
  assert.equal((await call("/api/auth/register", { method: "POST", body: { phone: "123", name: "Пассажир", password: TEST_PASSWORD } })).status, 422);
  const password = "Пароль-Ёж-2026";
  const registered = await call("/api/auth/register", { method: "POST", body: { phone, name: "Вася", password } });
  assert.equal(registered.status, 201);
  assert.equal((await call("/api/auth/login", { method: "POST", body: { phone, password: password.toLowerCase() } })).status, 401);
  assert.equal((await call("/api/auth/login", { method: "POST", body: { phone, password } })).status, 200);
});

test("авторизация: перебор паролей ограничивается сервером", { skip }, async () => {
  const phone = randomPhone();
  assert.equal((await call("/api/auth/register", { method: "POST", body: registrationBody(phone) })).status, 201);
  for (let attempt = 0; attempt < 10; attempt++) {
    assert.equal((await call("/api/auth/login", { method: "POST", body: { phone, password: "Неверный-Пароль-123" } })).status, 401);
  }
  const blocked = await call("/api/auth/login", { method: "POST", body: { phone, password: TEST_PASSWORD } });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.data.error.code, "too_many_attempts");
  assert.match(blocked.data.error.message, /через .*мин/);
});

test("регистрация: одновременные запросы не перезаписывают пароль", { skip }, async () => {
  const phone = randomPhone();
  const results = await Promise.all([
    call("/api/auth/register", { method: "POST", body: { phone, name: "Первый", password: "Первый-Пароль-2026" } }),
    call("/api/auth/register", { method: "POST", body: { phone, name: "Второй", password: "Второй-Пароль-2026" } }),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  const winner = results.find((result) => result.status === 201)!;
  const password = winner.data.user.name === "Первый" ? "Первый-Пароль-2026" : "Второй-Пароль-2026";
  assert.equal((await call("/api/auth/login", { method: "POST", body: { phone, password } })).status, 200);
});

test("старые SMS-маршруты удалены, пароль обязателен", { skip }, async () => {
  for (const path of ["/api/auth/request-code", "/api/auth/verify"]) {
    assert.equal((await call(path, { method: "POST", body: { phone: randomPhone() } })).status, 404);
    assert.equal((await rpc(path, { method: "POST", body: { phone: randomPhone() } })).status, 404);
  }
  assert.equal((await call("/api/auth/login", { method: "POST", body: { phone: randomPhone() } })).status, 422);
  assert.equal((await rpc("/api/auth/register", { method: "POST", body: { phone: randomPhone(), password: TEST_PASSWORD } })).status, 422);
});

/* ---------- Роли: пассажир и водитель ---------- */

const VEHICLE = { brand: "Lada", model: "Vesta", color: "Белый", plate: "А123ВС70", tariffId: "econom" };
const NEAR_PICKUP = { latitude: 56.4895, longitude: 84.9535 };

async function registerDriver(phone = randomPhone(), vehicle: unknown = VEHICLE) {
  return call("/api/auth/register", { method: "POST", body: { ...registrationBody(phone), name: "Водитель", role: "driver", vehicle } });
}

async function driverToken(phone = randomPhone()): Promise<string> {
  const res = await registerDriver(phone);
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return res.data.token as string;
}

test("роли: регистрация водителя проверяет автомобиль и создаёт роль driver", { skip }, async () => {
  const bad = await registerDriver(randomPhone(), { ...VEHICLE, plate: "XYZ" });
  assert.equal(bad.status, 422);
  assert.match(bad.data.error.message, /госномер/i);
  assert.equal((await registerDriver(randomPhone(), null)).status, 422);
  assert.equal((await registerDriver(randomPhone(), { ...VEHICLE, tariffId: "vip" })).status, 422);

  const phone = randomPhone();
  const ok = await registerDriver(phone, { ...VEHICLE, plate: "a123bc70" });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.user.role, "driver");

  const state = await call("/api/driver", { token: ok.data.token });
  assert.equal(state.status, 200);
  assert.equal(state.data.driver.vehicle.plate, "А123ВС70");
  assert.equal(state.data.driver.vehicle.tariffName, "Эконом");
  assert.equal(state.data.driver.isOnline, false);
  assert.equal(state.data.currentOrder, null);
});

test("роли: вход только в своей роли, чужие разделы закрыты сервером", { skip }, async () => {
  const phone = randomPhone();
  assert.equal((await registerDriver(phone)).status, 201);

  const wrongRole = await call("/api/auth/login", { method: "POST", body: { phone, password: TEST_PASSWORD, role: "passenger" } });
  assert.equal(wrongRole.status, 403);
  assert.equal(wrongRole.data.error.code, "role_mismatch");
  const wrongPassword = await call("/api/auth/login", { method: "POST", body: { phone, password: "Неверный-Пароль-1", role: "passenger" } });
  assert.equal(wrongPassword.status, 401, "роль не раскрывается без верного пароля");
  const driverLogin = await call("/api/auth/login", { method: "POST", body: { phone, password: TEST_PASSWORD, role: "driver" } });
  assert.equal(driverLogin.status, 200);
  assert.equal(driverLogin.data.user.role, "driver");

  // Один номер — одна роль
  const taken = await call("/api/auth/register", { method: "POST", body: registrationBody(phone) });
  assert.equal(taken.status, 409);
  assert.match(taken.data.error.message, /водител/);
  const passengerPhone = randomPhone();
  await login_(passengerPhone);
  assert.equal((await registerDriver(passengerPhone)).status, 409);

  // Разделы ролей закрыты друг для друга
  const driver = driverLogin.data.token as string;
  const passenger = await login();
  assert.equal((await call("/api/orders", { token: driver })).status, 403);
  assert.equal((await call("/api/fare/estimate", { method: "POST", token: driver, body: ROUTE })).status, 403);
  assert.equal((await call("/api/driver", { token: passenger })).status, 403);
  assert.equal((await call("/api/driver/orders/available", { token: passenger })).status, 403);
  assert.equal((await call("/api/driver")).status, 401);
  // Имя меняется у обеих ролей
  assert.equal((await call("/api/profile", { method: "PATCH", token: driver, body: { name: "Пётр" } })).status, 200);
});

async function login_(phone: string) {
  assert.equal((await call("/api/auth/register", { method: "POST", body: registrationBody(phone) })).status, 201);
}

test("водитель: заказ проходит весь путь, статусы меняет сервер, пассажир видит реального водителя", { skip }, async () => {
  const passenger = await login();
  const driver = await driverToken();
  const other = await driverToken();
  try {
    // На линию нужна позиция
    assert.equal((await call("/api/driver/status", { method: "POST", token: driver, body: { online: true } })).status, 422);
    assert.equal((await call("/api/driver/status", { method: "POST", token: driver, body: { online: true, ...NEAR_PICKUP } })).status, 200);
    assert.equal((await call("/api/driver/status", { method: "POST", token: other, body: { online: true, ...NEAR_PICKUP } })).status, 200);

    const est = await call("/api/fare/estimate", { method: "POST", token: passenger, body: ROUTE });
    const created = await call("/api/orders", { method: "POST", token: passenger, body: { estimateId: est.data.estimateId, tariffId: "econom" } });
    assert.equal(created.status, 201);
    const orderId = created.data.orderId as string;

    const list = await call("/api/driver/orders/available", { token: driver });
    const item = list.data.items.find((o: { id: string }) => o.id === orderId);
    assert.ok(item, "заказ виден водителю на линии");
    assert.ok(item.distanceToPickupMeters < 1000);

    // Нельзя действовать над чужим / непринятым заказом
    const early = await call(`/api/driver/orders/${orderId}/action`, { method: "POST", token: driver, body: { action: "start" } });
    assert.equal(early.status, 403);

    assert.equal((await call(`/api/driver/orders/${orderId}/accept`, { method: "POST", token: driver })).status, 200);
    const second = await call(`/api/driver/orders/${orderId}/accept`, { method: "POST", token: other });
    assert.equal(second.status, 409, "заказ принимает только один водитель");

    const seen = await call(`/api/orders/${orderId}`, { token: passenger });
    assert.equal(seen.data.order.status, "driver_assigned");
    assert.equal(seen.data.order.driver.isSimulated, false);
    assert.equal(seen.data.order.driver.vehicle.plate, "А123ВС70");
    assert.equal(seen.data.order.driver.name, "Водитель");

    const act = (action: string, token = driver) =>
      call(`/api/driver/orders/${orderId}/action`, { method: "POST", token, body: { action } });
    assert.equal((await act("complete")).status, 409, "нельзя перескочить шаги");
    assert.equal((await act("arrived")).status, 409);
    assert.equal((await act("depart", other)).status, 403, "чужой водитель не управляет заказом");
    assert.equal((await act("hack")).status, 422);

    await call("/api/driver/location", { method: "POST", token: driver, body: { ...NEAR_PICKUP, heading: 90 } });
    const moved = await call(`/api/orders/${orderId}`, { token: passenger });
    assert.equal(moved.data.order.driver.location.latitude, NEAR_PICKUP.latitude, "пассажир видит позицию водителя");

    assert.equal((await act("depart")).data.status, "driver_arriving");
    assert.equal((await call(`/api/orders/${orderId}`, { token: passenger })).data.order.status, "driver_arriving");
    assert.equal((await act("arrived")).data.status, "driver_waiting");
    assert.equal((await act("start")).data.status, "in_progress");
    assert.equal((await act("decline")).status, 409, "после начала поездки отказаться нельзя");
    assert.equal((await call("/api/driver/status", { method: "POST", token: driver, body: { online: false } })).status, 409, "с заказом на линии нельзя уйти");

    const state = await call("/api/driver", { token: driver });
    assert.equal(state.data.currentOrder.status, "in_progress");
    assert.equal(state.data.currentOrder.nextAction.action, "complete");
    assert.equal(typeof state.data.currentOrder.passenger.phone, "string");

    const done = await act("complete");
    assert.equal(done.data.status, "payment_pending");
    const final = await call(`/api/orders/${orderId}`, { token: passenger });
    assert.equal(final.data.order.status, "payment_pending");
    assert.equal(final.data.order.finalPrice, est.data.tariffs.find((t: { id: string }) => t.id === "econom").price);

    const history = await call("/api/driver/orders/history", { token: driver });
    assert.ok(history.data.items.some((t: { id: string }) => t.id === orderId));
    assert.ok(!(await call("/api/driver/orders/history", { token: other })).data.items.some((t: { id: string }) => t.id === orderId));
    assert.equal((await call("/api/driver", { token: driver })).data.currentOrder, null);
  } finally {
    await call("/api/driver/status", { method: "POST", token: driver, body: { online: false } });
    await call("/api/driver/status", { method: "POST", token: other, body: { online: false } });
  }
});

test("водитель: отказ возвращает заказ в поиск, класс и расстояние учитываются", { skip }, async () => {
  const passenger = await login();
  const driver = await driverToken();
  const comfortPhone = randomPhone();
  const comfort = (await registerDriver(comfortPhone, { ...VEHICLE, plate: "М789ОР70", tariffId: "comfort" })).data.token as string;
  const far = await driverToken();
  try {
    await call("/api/driver/status", { method: "POST", token: driver, body: { online: true, ...NEAR_PICKUP } });
    await call("/api/driver/status", { method: "POST", token: comfort, body: { online: true, ...NEAR_PICKUP } });
    // Водитель в другом городе не получает заказ
    await call("/api/driver/status", { method: "POST", token: far, body: { online: true, latitude: 55.7558, longitude: 37.6173 } });

    const est = await call("/api/fare/estimate", { method: "POST", token: passenger, body: ROUTE });
    const created = await call("/api/orders", { method: "POST", token: passenger, body: { estimateId: est.data.estimateId, tariffId: "econom" } });
    const orderId = created.data.orderId as string;

    const has = async (token: string) =>
      (await call("/api/driver/orders/available", { token })).data.items.some((o: { id: string }) => o.id === orderId);
    assert.equal(await has(driver), true);
    assert.equal(await has(comfort), false, "другой класс автомобиля заказ не видит");
    assert.equal(await has(far), false, "слишком далеко");
    assert.equal((await call(`/api/driver/orders/${orderId}/accept`, { method: "POST", token: comfort })).status, 403);
    assert.equal((await call(`/api/driver/orders/${orderId}/accept`, { method: "POST", token: far })).status, 409);

    assert.equal((await call(`/api/driver/orders/${orderId}/accept`, { method: "POST", token: driver })).status, 200);
    assert.equal(await has(driver), false, "занятый водитель новых заказов не видит");
    const declined = await call(`/api/driver/orders/${orderId}/action`, { method: "POST", token: driver, body: { action: "decline" } });
    assert.equal(declined.data.status, "searching");
    const back = await call(`/api/orders/${orderId}`, { token: passenger });
    assert.equal(back.data.order.status, "searching");
    assert.equal(back.data.order.driver, null);
    assert.equal(await has(driver), true, "после отказа заказ снова доступен");

    // Пассажир отменяет заказ — водитель освобождается
    assert.equal((await call(`/api/driver/orders/${orderId}/accept`, { method: "POST", token: driver })).status, 200);
    assert.equal((await call(`/api/orders/${orderId}/cancel`, { method: "POST", token: passenger })).status, 200);
    assert.equal((await call("/api/driver", { token: driver })).data.currentOrder, null);
    assert.equal((await call("/api/driver/status", { method: "POST", token: driver, body: { online: false } })).status, 200);
  } finally {
    for (const token of [driver, comfort, far]) {
      await call("/api/driver/status", { method: "POST", token, body: { online: false } });
    }
  }
});

test("rpc: интерфейс водителя доступен через тело запроса", { skip }, async () => {
  const phone = randomPhone();
  const registered = await rpc("/api/auth/register", {
    method: "POST",
    body: { ...registrationBody(phone), name: "Водитель", role: "driver", vehicle: VEHICLE },
  });
  assert.equal(registered.status, 201);
  const session = registered.data.token as string;
  const state = await rpc("/api/driver", { session });
  assert.equal(state.status, 200);
  assert.equal(state.data.driver.vehicle.brand, "Lada");
  assert.equal((await rpc("/api/driver")).status, 401);
  assert.equal((await rpc("/api/driver/orders/available", { session })).data.items.length, 0, "вне линии заказов нет");
  assert.equal((await rpc("/api/driver/orders/history", { session })).status, 200);
});
