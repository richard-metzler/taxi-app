/**
 * Браузерная проверка ролей и интерфейса водителя в Chromium.
 *
 * Запуск (Chromium и playwright-core установлены в /tmp/pw):
 *   NODE_PATH=/tmp/pw/node_modules node tests/browser/roles-flow.cjs
 * Переменные: APP (адрес приложения, по умолчанию http://localhost:3000).
 */
const { chromium } = require("playwright-core");

const APP = (process.env.APP || "http://localhost:3000").replace(/\/+$/, "");
const EXE =
  process.env.CHROME || `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell`;
const LIBS = "/tmp/libs/root/usr/lib/x86_64-linux-gnu:/tmp/libs/root/lib/x86_64-linux-gnu";

const PASSWORD = "Водитель-Пароль-2026!";
const randomPhone = () => "+7913" + String(Math.floor(1_000_000 + Math.random() * 8_999_999));
const GEO = { latitude: 56.4895, longitude: 84.9535, accuracy: 10 };
const PICKUP = { address: `Площадь Ленина, тест ${Date.now() % 100000}`, latitude: 56.4886, longitude: 84.9521 };
const DESTINATION = { address: "Красноармейская, 120", latitude: 56.461, longitude: 84.968 };

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

(async () => {
  const browser = await chromium.launch({
    executablePath: EXE,
    args: ["--no-sandbox"],
    env: { ...process.env, LD_LIBRARY_PATH: LIBS },
  });
  const context = await browser.newContext({
    viewport: { width: 414, height: 860 },
    geolocation: GEO,
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  page.on("dialog", (dialog) => void dialog.accept());
  const apiErrors = new Set();
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 500) apiErrors.add(`${r.status()} ${new URL(r.url()).pathname}`);
  });

  let ok = false;
  try {
    // 1. Первый запуск: выбор роли
    await page.goto(`${APP}/`);
    await page.waitForSelector("#role-driver", { timeout: 40_000 });
    if (!(await text(page)).includes("Кто вы?")) throw new Error("нет экрана выбора роли");
    if (!(await page.isVisible("#role-passenger"))) throw new Error("нет кнопки роли «Пассажир»");
    step("первый запуск показывает выбор роли: пассажир или водитель");

    // 2. Выбор роли «Водитель» → вход для водителей
    await page.click("#role-driver");
    await page.waitForSelector("#auth-role-badge", { timeout: 20_000 });
    if (!(await page.textContent("#auth-role-badge")).includes("Водитель")) throw new Error("не открылся вход водителя");
    if (!new URL(page.url()).pathname.startsWith("/driver")) throw new Error(`адрес ${page.url()}`);
    step("после выбора роли открывается вход водителя (/driver)");

    // 3. Регистрация водителя с автомобилем
    const phone = randomPhone();
    await page.click("#auth-tab-register");
    await page.fill("#auth-name", "Алексей");
    await page.fill("#login-phone", phone);
    await page.fill("#auth-password", PASSWORD);
    await page.fill("#auth-password-confirm", PASSWORD);
    await page.fill("#vehicle-brand", "Lada");
    await page.fill("#vehicle-model", "Vesta");
    await page.fill("#vehicle-color", "Белый");
    await page.fill("#vehicle-plate", "XYZ");
    await page.click('button[type="submit"]:has-text("Зарегистрироваться")');
    await page.waitForSelector('[role="alert"]:has-text("госномер")', { timeout: 10_000 });
    await page.fill("#vehicle-plate", "a123bc70");
    await page.click("#vehicle-class-econom");
    await page.click('button[type="submit"]:has-text("Зарегистрироваться")');
    await page.waitForSelector("#driver-go-online", { timeout: 30_000 });
    if (!(await text(page)).includes("Lada Vesta")) throw new Error("не показан автомобиль водителя");
    step("регистрация водителя с автомобилем — открылся экран водителя");

    // 4. Перезагрузка и «следующий запуск» в новой вкладке: ни выбора роли, ни входа
    await page.reload();
    await page.waitForSelector("#driver-go-online", { timeout: 30_000 });
    if ((await text(page)).includes("Кто вы?")) throw new Error("после перезагрузки снова выбор роли");
    const second = await context.newPage();
    await second.goto(`${APP}/`);
    await second.waitForSelector("#driver-go-online", { timeout: 30_000 });
    const secondText = await text(second);
    if (secondText.includes("Кто вы?") || secondText.includes("Номер телефона")) throw new Error("при новом запуске требуется вход");
    if (!new URL(second.url()).pathname.startsWith("/driver")) throw new Error(`новый запуск открыл ${second.url()}`);
    await second.close();
    step("при следующем запуске приложение сразу открывает экран водителя без выбора роли и входа");

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
    await card.waitFor({ timeout: 10_000 });
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
    if (done.data.order.status !== "payment_pending" || !done.data.order.finalPrice) throw new Error("поездка не завершена на сервере");
    step("поездка завершена: заказ переведён сервером в ожидание оплаты");

    // 6. Профиль и история
    await page.click('a:has-text("Поездки")');
    await page.waitForSelector("text=Анна", { timeout: 15_000 });
    step("в истории водителя появилась завершённая поездка");
    await page.click('a:has-text("Профиль")');
    await page.waitForSelector("text=Сменить роль (выйти из аккаунта)", { timeout: 15_000 });
    await page.click('button:has-text("Уйти с линии")').catch(() => undefined);

    // 7. Выход: вход той же роли без выбора, затем смена роли
    await page.click('button:has-text("Выйти из аккаунта"):not(:has-text("Сменить"))');
    await page.waitForSelector("#auth-role-badge", { timeout: 20_000 });
    if (!(await page.textContent("#auth-role-badge")).includes("Водитель")) throw new Error("после выхода открылась не та роль");
    if ((await text(page)).includes("Кто вы?")) throw new Error("после выхода показан выбор роли");
    step("после выхода открывается вход водителя — выбирать роль повторно не нужно");

    await page.click("#auth-change-role");
    await page.waitForSelector("#role-passenger", { timeout: 15_000 });
    await page.click("#role-passenger");
    await page.waitForSelector("#auth-role-badge", { timeout: 15_000 });
    if (!(await page.textContent("#auth-role-badge")).includes("Пассажир")) throw new Error("не открылся вход пассажира");
    if (!new URL(page.url()).pathname.startsWith("/home")) throw new Error(`адрес ${page.url()}`);
    step("«Сменить роль» возвращает к выбору; выбран пассажир (/home)");

    await page.fill("#login-phone", phone);
    await page.fill("#auth-password", PASSWORD);
    await page.click('button[type="submit"]:has-text("Войти")');
    await page.waitForSelector('[role="alert"]:has-text("зарегистрирован как водитель")', { timeout: 15_000 });
    step("водительский номер не входит как пассажир: понятная ошибка о роли");

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
