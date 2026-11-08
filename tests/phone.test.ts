import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, formatPhone } from "../src/core/phone.ts";

test("нормализация номеров в формат +7XXXXXXXXXX", () => {
  assert.equal(normalizePhone("8 (913) 000-11-22"), "+79130001122");
  assert.equal(normalizePhone("+7 913 000 11 22"), "+79130001122");
  assert.equal(normalizePhone("9130001122"), "+79130001122");
});

test("некорректные номера отклоняются", () => {
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizePhone("+1 202 555 0100"), null);
  assert.equal(normalizePhone(""), null);
});

test("форматирование для отображения", () => {
  assert.equal(formatPhone("+79130001122"), "+7 (913) 000-11-22");
});
