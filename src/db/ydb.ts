import { Driver } from "@ydbjs/core";
import { ServiceAccountCredentialsProvider, type ServiceAccountKey } from "@ydbjs/auth-yandex-cloud";
import { YdbDriver, createDrizzle } from "@ydbjs/drizzle-adapter";
import * as schema from "./schema.ydb";

/** YDB включается только при наличии обоих секретов. Иначе приложение не пытается к ней подключиться. */
export function isYdbConfigured(): boolean {
  return Boolean(process.env.YDB_CONNECTION_STRING && process.env.YANDEX_SA_KEY_JSON);
}

/** Клиент YDB. Вызывается только когда ключи действительно заданы. */
export function createYdb() {
  const key = JSON.parse(process.env.YANDEX_SA_KEY_JSON ?? "") as ServiceAccountKey;
  const driver = new Driver(process.env.YDB_CONNECTION_STRING ?? "", {
    credentialsProvider: new ServiceAccountCredentialsProvider(key),
  });
  return createDrizzle({ client: new YdbDriver(driver), schema });
}
