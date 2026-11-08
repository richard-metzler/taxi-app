import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "../src/core/navigation.ts";

test("возврат после входа: внутренние пути сохраняются", () => {
  assert.equal(safeNextPath("/history"), "/history");
  assert.equal(safeNextPath("/orders/123?payment=return"), "/orders/123?payment=return");
});

test("возврат после входа: внешние адреса и /login отсекаются", () => {
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil", "", "/login", "/login?next=/x", undefined, 42]) {
    assert.equal(safeNextPath(bad), "/home", String(bad));
  }
});
