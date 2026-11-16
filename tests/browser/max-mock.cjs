/**
 * Тестовый мок MAX Bridge: строит подписанную строку window.WebApp.initData.
 *
 * Сервер проверяет подпись по документации MAX:
 * https://dev.max.ru/docs/webapps/validation
 *   secretKey = HMAC-SHA256(key="WebAppData", data=MAX_BOT_TOKEN)
 *   hash      = hex(HMAC-SHA256(key=secretKey, data=launchParams))
 *
 * Запуск браузерных тестов требует того же MAX_BOT_TOKEN, что и у сервера:
 *   MAX_BOT_TOKEN=test-bot-token npm run dev
 *   MAX_BOT_TOKEN=test-bot-token NODE_PATH=/tmp/pw/node_modules node tests/browser/*.cjs
 */
const { createHmac } = require("node:crypto");

function buildMaxMock(userId, firstName) {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) {
    throw new Error("Для браузерных тестов задайте MAX_BOT_TOKEN — тот же, что запущен у сервера");
  }

  const user = { id: userId };
  if (firstName) user.first_name = firstName;
  const params = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: `test-${Date.now()}-${userId}`,
    user: JSON.stringify(user),
  };
  const launchParams = Object.entries(params)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secretKey).update(launchParams).digest("hex");
  const initData = new URLSearchParams({ ...params, hash }).toString();

  return { initData, user };
}

/** Строка для context.addInitScript: подменяем WebApp до загрузки скриптов страницы. */
function maxMockInitScript(mock) {
  const payload = JSON.stringify({ initData: mock.initData, initDataUnsafe: { user: mock.user } });
  return `
    (() => {
      const payload = ${payload};
      let value = payload;
      Object.defineProperty(window, "WebApp", {
        configurable: true,
        get() { return value; },
        set() { /* MAX SDK не должен перезаписать тестовый мост */ },
      });
    })();
  `;
}

module.exports = { buildMaxMock, maxMockInitScript };
