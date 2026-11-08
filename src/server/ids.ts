import { randomUUID } from "node:crypto";

/** YDB не генерирует UUID. Все первичные ключи создаются приложением. */
export function newId(): string {
  return randomUUID();
}
