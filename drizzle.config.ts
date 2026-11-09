import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.pg.ts",
  out: "./drizzle",
  dbCredentials: {
    url: "postgresql://neondb_owner:npg_XutJIcgnr4a3@ep-rapid-frost-b9ipbh2b-pooler.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  },
});
