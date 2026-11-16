import { test } from "node:test";
import assert from "node:assert/strict";
import { ORDER_STATUS_TEXT, formatMoney } from "../src/shared/types.ts";

test("все статусы заказа имеют русский текст", () => {
  const statuses = [
    "draft",
    "searching",
    "driver_assigned",
    "driver_arriving",
    "driver_waiting",
    "in_progress",
    "completed",
    "cancelled",
  ];
  for (const s of statuses) assert.ok(ORDER_STATUS_TEXT[s as keyof typeof ORDER_STATUS_TEXT], s);
});

test("форматирование копеек в рубли", () => {
  assert.equal(formatMoney(25400).replace(/\u00a0/g, " "), "254 ₽");
});
