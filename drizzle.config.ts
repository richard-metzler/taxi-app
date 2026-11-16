import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Не задана переменная окружения DATABASE_URL — укажите строку подключения к PostgreSQL");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.pg.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
});
