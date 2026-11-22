import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL?.trim();
// Для `generate` БД не нужна — ошибку выбрасываем только при реальном подключении (push/migrate).
const command = process.argv[2] ?? "";
if (!databaseUrl && (command === "push" || command === "migrate")) {
  throw new Error("Не задана переменная окружения DATABASE_URL — укажите строку подключения к PostgreSQL");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.pg.ts",
  out: "./drizzle",
  dbCredentials: {
    // Пустая строка для `generate` — drizzle-kit не обращается к БД в этом режиме.
    url: databaseUrl ?? "",
  },
});
