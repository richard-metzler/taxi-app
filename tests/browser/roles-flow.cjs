/**
 * Браузерная проверка ролей и интерфейса водителя в Chromium.
 *
 * Запуск (Chromium и playwright-core установлены в /tmp/pw):
 *   MAX_BOT_TOKEN=test-bot-token DATABASE_URL=... NODE_PATH=/tmp/pw/node_modules node tests/browser/roles-flow.cjs
 * Переменные: APP (адрес приложения, по умолчанию http://localhost:3000).
 *
 * MAX_BOT_TOKEN должен совпадать с токеном сервера — мок initData подписывается им же.
 * DATABASE_URL нужен, чтобы одобрить анкету тестового водителя (модерация в приложении
 *Предусмотрена, но административного интерфейса пока нет).
 */
const { chromium } = require("playwright-core");
const { Client } = require("pg");
const { buildMaxMock, maxMockInitScript } = require("./max-mock.cjs");

const APP = (process.env.APP || "http://localhost:3000").replace(/\/+$/, "");
const EXE =
  process.env.CHROME || `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell`;
const LIBS = "/tmp/libs/root/usr/lib/x86_64-linux-gnu:/tmp/libs/root/lib/x86_64-linux-gnu";

const PASSWORD = "Водитель-Пароль-2026!";
const randomPhone = () => "+7913" + String(Math.floor(1_000_000 + Math.random() * 8_999_999));
const GEO = { latitude: 56.4895, longitude: 84.9535, accuracy: 10 };
const PICKUP = { address: `Площадь Ленина, тест ${Date.now() % 100000}`, latitude: 56.4886, longitude: 84.9521 };
const DESTINATION = { address: "Красноармейская, 120", latitude: 56.461, longitude: 84.968 };
const PHOTO = {
  name: "photo.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64",
  ),
};

const log = [];
const step = (text) => {
  log.push(text);
  console.log(`  ✓ ${text}`);
};

async function rpc(path, { method = "GET", body, session } = {}) {
  const res = await fetch(`${APP}/api/rpc`, { method: "POST", body: JSON.stringify({ path, method, body, session }) });
  return { status: res.status, data: await res.json() };
}

/** Пассажир через API создаёт заказ рядом с водителем. */
async function createPassengerOrder() {
  const phone = randomPhone();
  const registered = await rpc("/api/auth/register", { method: "POST", body: { phone, name: "Анна", password: PASSWORD, role: "passenger" } });
  const session = registered.data.token;
  const estimate = await rpc("/api/fare/estimate", { method: "POST", session, body: { pickup: PICKUP, destination: DESTINATION } });
  if (estimate.status !== 200) throw new Error(`оценка маршрута: ${JSON.stringify(estimate.data)}`);
  const order = await rpc("/api/orders", { method: "POST", session, body: { estimateId: estimate.data.estimateId, tariffId: "econom" } });
  if (order.status !== 201) throw new Error(`создание заказа: ${JSON.stringify(order.data)}`);
  return { session, orderId: order.data.orderId };
}

async function text(page) {
  return (await page.textContent("body").catch(() => "")) || "";
}

async function approveDriver(userId) {
  if (!process.env.DATABASE_URL) throw new Error("Для одобрения тестовой анкеты нужен DATABASE_URL");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const res = await client.query("update drivers set is_approved = true where user_id = $1 returning id", [userId]);
    if (!res.rowCount) throw new Error("профиль водителя не найден в БД");
  } finally {
    await client.end();
  }
}

async function roleFromDb(userId) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const user = await client.query("select role from users where id = $1", [userId]);
    const driver = await client.query("select is_online from drivers where user_id = $1", [userId]);
    return { role: user.rows[0]?.role, isOnline: driver.rows[0]?.is_online ?? null };
  } finally {
    await client.end();
  }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: EXE,
    args: ["--no-sandbox"],
    env: { ...process.env, LD_LIBRARY_PATH: LIBS },
  });
  const mock = buildMaxMock(88_000_001, "Алексей");
  const context = await browser.newContext({
    viewport: { width: 414, height: 860 },
    geolocation: GEO,
    permissions: ["geolocation"],
  });
  await context.addInitScript(maxMockInitScript(mock));
  const page = await context.newPage();
  page.on("dialog", (dialog) => void dialog.accept());
  const apiErrors = new Set();
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 500) apiErrors.add(`${r.status()} ${new URL(r.url()).pathname}`);
  });

  let ok = false;
  try {
    // 1. Первый запуск со сменой роли: выбор роли MAX
    await page.goto(`${APP}/?switch=true`);
    await page.waitForSelector("#role-driver", { timeout: 40_000 });
    if (!(await text(page)).includes("Кто вы?")) throw new Error("нет экрана выбора роли");
    if (!(await page.isVisible("#role-passenger"))) throw new Error("нет кнопки роли «Пассажир»");
    step("первый запуск показывает выбор роли: пассажир или водитель");

    // 2. Выбор роли «Водитель» → анкета водителя
    await page.click("#role-driver");
    await page.waitForSelector("text=Данные водителя", { timeout: 25_000 });
    if (!new URL(page.url()).pathname.startsWith("/driver")) throw new Error(`адрес ${page.url()}`);
    step("после выбора роли открывается анкета водителя (/driver)");

    // 3. Анкета: неверный номер отклоняется, затем корректная отправка на модерацию
    await page.fill('input[placeholder="Например: Сергей"]', "Алексей");
    await page.fill('input[placeholder="Например: Kia"]', "Lada");
    await page.fill('input[placeholder="Например: Rio"]', "Vesta");
    await page.fill('input[placeholder="Например: Белый"]', "Белый");
    await page.fill('input[placeholder="Например: А123ВС70"]', "XYZ");
    await page.setInputFiles('input[type="file"] >> nth=0', PHOTO);
    await page.setInputFiles('input[type="file"] >> nth=1', PHOTO);
    await page.click('button:has-text("Отправить на модерацию")');
    await page.waitForSelector('text=госномер', { timeout: 10_000 });
    await page.fill('input[placeholder="Например: А123ВС70"]', "a123bc70");
    await page.click('button:has-text("Отправить на модерацию")');
    await page.waitForSelector("text=модерации", { timeout: 30_000 });
    step("анкета водителя с неверным номером отклонена, корректная ушла на модерацию");

    const token = await page.evaluate(() => localStorage.getItem("taxi_passenger_session"));
    if (!token) throw new Error("сессия MAX не сохранена клиентом");
    const me = await rpc("/api/auth/me", { session: token });
    const userId = me.data.user?.id;
    if (!userId) throw new Error(`не удалось получить userId: ${JSON.stringify(me.data)}`);
    await approveDriver(userId);
    await page.reload();
    await page.waitForSelector("#driver-go-online", { timeout: 30_000 });
    if (!(await text(page)).includes("Lada Vesta")) throw new Error("не показан автомобиль водителя");
    step("после одобрения анкеты открывается экран водителя с автомобилем");

    // 4. Перезагрузка и новая вкладка: сразу экран водителя
    const second = await context.newPage();
    await second.goto(`${APP}/`);
    await second.waitForSelector("#driver-go-online", { timeout: 30_000 });
    if ((await text(second)).includes("Кто вы?")) throw new Error("при новом запуске снова выбор роли");
    await second.close();
    step("при следующем запуске приложение сразу открывает экран водителя");

    // 5. Выход на линию, заказ рядом, принятие и вся поездка
    await page.click("#driver-go-online");
    await page.waitForSelector("#driver-go-offline", { timeout: 30_000 });
    step("выход на линию с определением геопозиции");

    const passenger = await createPassengerOrder();
    const card = page.locator(`li[data-order-id="${passenger.orderId}"]`);
    await card.waitFor({ timeout: 25_000 });
    if (!(await card.textContent()).includes(PICKUP.address)) throw new Error("в карточке нет адреса подачи");
    step("заказ пассажира появился в списке заказов рядом");

    await page.click("#driver-sheet-toggle");
    if ((await page.getAttribute("#driver-sheet-toggle", "aria-expanded")) !== "false") throw new Error("панель не свернулась");
    await page.click("#driver-sheet-toggle");
    step("панель водителя сворачивается и разворачивается");

    await card.locator('button:has-text("Принять заказ")').click();
    await page.waitForSelector("#driver-next-action", { timeout: 20_000 });
    const afterAccept = await rpc(`/api/orders/${passenger.orderId}`, { session: passenger.session });
    if (afterAccept.data.order.status !== "driver_assigned" || afterAccept.data.order.driver.isSimulated !== false) {
      throw new Error(`пассажир видит ${JSON.stringify(afterAccept.data.order.status)}`);
    }
    if (afterAccept.data.order.driver.vehicle.plate !== "А123ВС70") throw new Error("у пассажира неверный госномер");
    step("заказ принят: пассажир видит реального водителя и его автомобиль");

    const expected = [
      ["Выехал к пассажиру", "Едем к пассажиру", "driver_arriving"],
      ["Я на месте", "Ожидаем пассажира", "driver_waiting"],
      ["Начать поездку", "Поездка идёт", "in_progress"],
    ];
    for (const [label, status, serverStatus] of expected) {
      const button = page.locator("#driver-next-action");
      if (!(await button.textContent()).includes(label)) throw new Error(`ожидалась кнопка «${label}»`);
      await button.click();
      await page.waitForFunction((value) => document.body.innerText.includes(value), status, { timeout: 15_000 });
      const view = await rpc(`/api/orders/${passenger.orderId}`, { session: passenger.session });
      if (view.data.order.status !== serverStatus) throw new Error(`у пассажира ${view.data.order.status}, ожидалось ${serverStatus}`);
    }
    step("шаги поездки: выехал → на месте → поездка идёт; пассажир видит каждый статус");

    if (!(await page.isVisible('a:has-text("Открыть в навигаторе")'))) throw new Error("нет кнопки навигатора");
    await page.click("#driver-next-action");
    await page.waitForFunction(() => document.body.innerText.includes("Заказ закрыт"), null, { timeout: 15_000 });
    const done = await rpc(`/api/orders/${passenger.orderId}`, { session: passenger.session });
    if (done.data.order.status !== "completed" || !done.data.order.finalPrice) throw new Error("поездка не завершена на сервере");
    step("поездка завершена: заказ переведён сервером в completed");

    // 6. Профиль и история
    await page.click('a:has-text("Поездки")');
    await page.waitForSelector("text=Анна", { timeout: 15_000 });
    step("в истории водителя появилась завершённая поездка");
    await page.click('a:has-text("Профиль")');
    await page.waitForSelector("text=Сменить роль (выйти из аккаунта)", { timeout: 15_000 });
    step("в профиле доступны выход и смена роли");

    // 7. Выход → смена роли на пассажира → проверка БД и уведомлений
    await page.click('button:text-is("Выйти из аккаунта")');
    await page.waitForSelector('input[placeholder="Ваше имя"]', { timeout: 20_000 });
    step("после выхода откры MAX-онбординг");

    await page.goto(`${APP}/?switch=true`);
    await page.waitForSelector("#role-passenger", { timeout: 15_000 });
    await page.click("#role-passenger");
    await page.waitForSelector("text=Построить маршрут", { timeout: 25_000 });
    const switched = await roleFromDb(userId);
    if (switched.role !== "passenger" || switched.isOnline !== false) {
      throw new Error(`роль в БД: ${JSON.stringify(switched)}`);
    }
    const asPassenger = await rpc("/api/driver", { session: token });
    if (asPassenger.status !== 403) throw new Error("бывший водитель всё ещё видит водительские API");
    if ((await rpc("/api/orders", { session: token })).status !== 200) throw new Error("пассажирские API недоступны");
    step("смена роли записана в БД: водитель снят с линии и не получает заказы");

    await page.goto(`${APP}/?switch=true`);
    await page.waitForSelector("#role-driver", { timeout: 15_000 });
    await page.click("#role-driver");
    await page.waitForSelector("#driver-go-online", { timeout: 25_000 });
    const backToDriver = await roleFromDb(userId);
    if (backToDriver.role !== "driver" || backToDriver.isOnline !== false) {
      throw new Error(`роль в БД после возврата: ${JSON.stringify(backToDriver)}`);
    }
    if ((await rpc("/api/orders", { session: token })).status !== 403) throw new Error("водитель видит пассажирские API");
    step("возврат роли водителя записан в БД: пассажирские уведомления недоступны");

    if (apiErrors.size) throw new Error(`ошибки сервера: ${[...apiErrors].join(", ")}`);
    ok = true;
  } catch (error) {
    console.log(`  ✗ ОШИБКА: ${error.message.split("\n")[0]}`);
    console.log(`    адрес: ${page.url()}`);
    console.log(`    текст: ${(await text(page)).replace(/\s+/g, " ").slice(0, 300)}`);
  } finally {
    await browser.close();
  }
  console.log(ok ? `УСПЕХ: ${log.length} проверок` : "ПРОВАЛ");
  process.exit(ok ? 0 : 1);
})();
