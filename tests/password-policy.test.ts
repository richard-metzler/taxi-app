import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordPolicyError } from "../src/core/password-policy.ts";

test("пароль: принимаются пароли от 8 до 128 символов, включая кириллицу", () => {
  assert.equal(passwordPolicyError("12345678"), null);
  assert.equal(passwordPolicyError("Надёжный пароль-2026"), null);
  assert.equal(passwordPolicyError("я".repeat(128)), null);
});

test("пароль: короткие, пустые и слишком длинные значения отклоняются", () => {
  for (const value of ["1234567", "", "        ", "я".repeat(129), null, undefined, 12345678]) {
    assert.ok(passwordPolicyError(value), "Ожидалась ошибка проверки пароля");
  }
});

test("пароль: пробелы внутри не меняют требования", () => {
  assert.equal(passwordPolicyError("  пароль с пробелами  "), null);
  assert.equal(passwordPolicyError("пароль-2026"), null);
  assert.equal(passwordPolicyError("Пароль-2026"), null);
});
