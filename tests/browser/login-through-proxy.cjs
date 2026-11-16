/**
 * Браузерная проверка MAX-входа через прокси, который (как прокси окна превью) пересылает
 * только тело запроса и базовые заголовки, удаляя Authorization, X-*, Cookie, Origin, Sec-Fetch-*,
 * заголовки навигации Next.js (RSC) и Set-Cookie в ответах.
 *
 * Запуск (Chromium и playwright-core установлены в /tmp/pw):
 *   MAX_BOT_TOKEN=test-bot-token NODE_PATH=/tmp/pw/node_modules node tests/browser/login-through-proxy.cjs
 * Переменные: TARGET (адрес приложения, по умолчанию http://localhost:3000),
 *             PUBLIC_URL (публичный адрес превью для сценария без прокси),
 *             SCENARIOS (список через запятую).
 */
const { chromium } = require("playwright-core");
const http = require("http");
const { buildMaxMock, maxMockInitScript } = require("./max-mock.cjs");

const TARGET = new URL(process.env.TARGET || "http://localhost:3000");
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/+$/, "");
const ONLY = (process.env.SCENARIOS || "").split(",").filter(Boolean);
const EXE =
  process.env.CHROME || `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell`;
const LIBS = "/tmp/libs/root/usr/lib/x86_64-linux-gnu:/tmp/libs/root/lib/x86_64-linux-gnu";
const PROXY_PORT = 4200;
const HOST_PORT = 4100;
const PROXY = `http://localhost:${PROXY_PORT}`;
const TEST_NAME = "Тестовый Пассажир";

/* ---------- Прокси, удаляющий заголовки ---------- */
const FORWARD = new Set(["user-agent", "accept", "accept-language", "content-type"]);
const stripped = new Set();
const proxy = http
  .createServer((req, res) => {
    const headers = {};
    for (const [name, value] of Object.entries(req.headers)) {
      if (FORWARD.has(name)) headers[name] = value;
      else if (!["host", "connection", "content-length", "transfer-encoding"].includes(name)) stripped.add(name);
    }
    const upstream = http.request(
      { hostname: TARGET.hostname, port: TARGET.port || 80, method: req.method, path: req.url, headers },
      (r) => {
        const out = { ...r.headers };
        delete out["set-cookie"];
        res.writeHead(r.statusCode || 502, out);
        r.pipe(res);
      },
    );
    upstream.on("error", (e) => {
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(String(e));
    });
    req.pipe(upstream);
  })
  .listen(PROXY_PORT);

/* ---------- Страница другого сайта со встроенным окном (как окно превью) ---------- */
const host = http
  .createServer((req, res) => {
    const src = new URL(req.url, "http://host").searchParams.get("src") || "";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      `<!doctype html><body style="margin:0"><iframe id="f" src="${src.replace(/"/g, "")}" style="width:420px;height:900px;border:0"></iframe></body>`,
    );
  })
  .listen(HOST_PORT, "127.0.0.1");

const BLOCK_STORAGE = `for (const n of ["localStorage", "sessionStorage"]) Object.defineProperty(window, n, { configurable: true, get() { throw new DOMException("Access is denied for this document.", "SecurityError"); } });`;

async function bodyText(f) {
  return (await f.textContent("body").catch(() => "")) || "";
}

/** MAX-онбординг: имя → /api/auth/max → /home. */
async function onboard(f, mock) {
  await f.waitForSelector('input[placeholder="Ваше имя"]', { timeout: 40_000 });
  await f.fill('input[placeholder="Ваше имя"]', TEST_NAME);
  await f.click('button:has-text("Продолжить")');
  await f.waitForSelector("text=Построить маршрут", { timeout: 25_000 });

  const leaked = await f.evaluate((initData) => {
    let values = window.name;
    try { values += Object.values(localStorage).join(""); } catch {}
    try { values += Object.values(sessionStorage).join(""); } catch {}
    return values.includes(initData);
  }, mock.initData);
  if (leaked) throw new Error("Подписанный initData попал в хранилище браузера");
  if (/Код из SMS|Получить код|Тестовый режим/.test(await bodyText(f))) {
    throw new Error("На экране остался вход по SMS");
  }
}

async function reload(f) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await f.evaluate(() => location.reload());
      break;
    } catch (e) {
      if (!/Execution context was destroyed|navigat/i.test(e.message) || attempt === 2) throw e;
      await f.waitForLoadState("load").catch(() => undefined);
    }
  }
  await f.waitForLoadState("load").catch(() => undefined);
  await f.waitForTimeout(3000);
}

const SCENARIOS = {
  proxy_top: { title: "прокси без заголовков, обычная вкладка", url: `${PROXY}/` },
  proxy_iframe: { title: "прокси без заголовков, окно на чужом сайте", url: `${PROXY}/`, embed: true },
  proxy_iframe_blocked: {
    title: "прокси без заголовков, окно на чужом сайте, хранилище заблокировано",
    url: `${PROXY}/`,
    embed: true,
    blockStorage: true,
  },
  public_iframe_blocked: {
    title: "публичный адрес без прокси, окно на чужом сайте, хранилище заблокировано",
    url: `${PUBLIC_URL}/`,
    embed: true,
    blockStorage: true,
    requires: PUBLIC_URL,
  },
};

async function run(browser, key, s) {
  const ctx = await browser.newContext();
  const mock = buildMaxMock(77_000_000 + Object.keys(SCENARIOS).indexOf(key) + 1);
  await ctx.addInitScript(maxMockInitScript(mock));
  if (s.blockStorage) await ctx.addInitScript(BLOCK_STORAGE);
  const page = await ctx.newPage();
  const apiErrors = new Set();
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 400) apiErrors.add(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  const steps = [];
  let ok = true;
  try {
    if (s.embed) {
      await page.goto(`http://127.0.0.1:${HOST_PORT}/?src=${encodeURIComponent(s.url)}`);
    } else {
      await page.goto(s.url);
    }
    const f = s.embed ? await (await page.waitForSelector("#f")).contentFrame() : page.mainFrame();

    await onboard(f, mock);
    steps.push("MAX-онбординг — успешно, сессия живёт без cookie и заголовков");

    await f.fill('input[placeholder="Адрес назначения"]', "Красноармейская 120");
    await f.click("#home-order-sheet-toggle");
    if ((await f.getAttribute("#home-order-sheet-toggle", "aria-expanded")) !== "false") {
      throw new Error("Нижняя панель заказа не свернулась");
    }
    if (await f.isVisible('input[placeholder="Адрес назначения"]')) {
      throw new Error("Поля адреса остались видимыми после сворачивания панели");
    }
    await f.click("#home-order-sheet-toggle");
    if ((await f.inputValue('input[placeholder="Адрес назначения"]')) !== "Красноармейская 120") {
      throw new Error("После разворачивания панели потерялся введённый адрес");
    }
    steps.push("сворачивание и разворачивание панели — состояние сохранено");

    await f.goto(s.url.replace(/\/$/, "") + "/history");
    await f.waitForSelector("text=История поездок", { timeout: 25_000 });
    steps.push("переход в «Историю» — сессия на месте");
    await reload(f);
    if (!(await bodyText(f)).includes("История поездок")) throw new Error("после перезагрузки сессия потеряна");
    steps.push("после перезагрузки — сессия на месте");

    await f.goto(s.url.replace(/\/$/, "") + "/settings");
    await f.click('button:text-is("Выйти из аккаунта")');
    await f.waitForSelector('input[placeholder="Ваше имя"]', { timeout: 20_000 });
    await reload(f);
    await f.waitForSelector('input[placeholder="Ваше имя"]', { timeout: 20_000 });
    steps.push("выход — сессия завершена и не восстанавливается после перезагрузки");

    await onboard(f, mock);
    steps.push("повторный вход через MAX — успешно");
  } catch (e) {
    ok = false;
    steps.push(`ОШИБКА: ${e.message.split("\n")[0]}`);
  }
  console.log(`${ok ? "УСПЕХ " : "ПРОВАЛ"} | ${s.title}\n         ${steps.join(" → ")}`);
  if (apiErrors.size) console.log(`         ответы API с ошибкой: ${[...apiErrors].join(", ")}`);
  await ctx.close();
  return ok;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: EXE,
    args: ["--no-sandbox"],
    env: { ...process.env, LD_LIBRARY_PATH: LIBS },
  });
  const results = [];
  try {
    for (const [key, s] of Object.entries(SCENARIOS)) {
      if (ONLY.length && !ONLY.includes(key)) continue;
      if ("requires" in s && !s.requires) continue;
      results.push(await run(browser, key, s));
    }
  } finally {
    await browser.close();
    proxy.close();
    host.close();
  }
  console.log(`Прокси удалил заголовки: ${[...stripped].sort().join(", ")}`);
  process.exit(results.length > 0 && results.every(Boolean) ? 0 : 1);
})().catch((e) => {
  console.error("Сбой теста:", e);
  process.exit(2);
});
