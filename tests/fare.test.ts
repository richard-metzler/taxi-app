import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateFare } from "../src/server/fare-calculator.ts";

const econom = { baseFare: 8900, perKm: 1400, perMinute: 500, minimumFare: 14900 };

test("стоимость считается по базе, километрам и минутам с округлением до рубля", () => {
  // 8900 + 1400*4.168 + 500*6.583 = 8900 + 5835 + 3292 = 18027 → 18000
  assert.equal(calculateFare(econom, 4168, 395), 18000);
});

test("применяется минимальная стоимость", () => {
  assert.equal(calculateFare(econom, 300, 60), 14900);
});

test("суммы — целые копейки, кратные рублю", () => {
  const price = calculateFare(econom, 12345, 1234);
  assert.equal(price % 100, 0);
  assert.ok(Number.isInteger(price));
});
