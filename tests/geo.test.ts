import { test } from "node:test";
import assert from "node:assert/strict";
import { haversineMeters, isValidLatLng, pointAlongPolyline, lerpLatLng } from "../src/core/geo.ts";

test("валидация координат адресов", () => {
  assert.equal(isValidLatLng({ latitude: 56.5, longitude: 84.9 }), true);
  assert.equal(isValidLatLng({ latitude: 95, longitude: 84.9 }), false);
  assert.equal(isValidLatLng({ latitude: NaN, longitude: 1 }), false);
  assert.equal(isValidLatLng(null), false);
});

test("расстояние между точками", () => {
  const d = haversineMeters({ latitude: 56.4886, longitude: 84.9521 }, { latitude: 56.4610, longitude: 84.9680 });
  assert.ok(d > 3000 && d < 3500, `ожидалось ~3.2 км, получено ${d}`);
});

test("интерполяция координат водителя вдоль маршрута", () => {
  const line: [number, number][] = [
    [56.0, 84.0],
    [56.0, 84.1],
    [56.0, 84.2],
  ];
  const start = pointAlongPolyline(line, 0);
  const mid = pointAlongPolyline(line, 0.5);
  const end = pointAlongPolyline(line, 1);
  assert.deepEqual(start, { latitude: 56.0, longitude: 84.0 });
  assert.ok(Math.abs(mid.longitude - 84.1) < 1e-6);
  assert.deepEqual(end, { latitude: 56.0, longitude: 84.2 });
  const half = lerpLatLng({ latitude: 0, longitude: 0 }, { latitude: 2, longitude: 4 }, 0.5);
  assert.deepEqual(half, { latitude: 1, longitude: 2 });
});
