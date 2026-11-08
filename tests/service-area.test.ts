import { test } from "node:test";
import assert from "node:assert/strict";
import { matchZone, outOfZoneMessage, roundKm, zoneDisplayName } from "../src/server/service-area.ts";

const ZONES = [
  { id: "moscow", name: "Москва", latitude: 55.7558, longitude: 37.6173, radiusKm: 60 },
  { id: "tomsk", name: "Томск", latitude: 56.4846, longitude: 84.9476, radiusKm: 60 },
  { id: "krasnoyarsk", name: "Красноярск", latitude: 56.0153, longitude: 92.8932, radiusKm: 40 },
];

test("точка в городе попадает в его зону", () => {
  const m = matchZone({ latitude: 55.75, longitude: 37.62 }, ZONES);
  assert.equal(m.kind, "inside");
  assert.equal(m.kind === "inside" && m.zone.id, "moscow");
  const k = matchZone({ latitude: 56.01, longitude: 92.85 }, ZONES);
  assert.equal(k.kind === "inside" && k.zone.id, "krasnoyarsk");
});

test("пригород в пределах радиуса обслуживается", () => {
  // Зеленоград, ~37 км от центра Москвы
  const m = matchZone({ latitude: 55.9825, longitude: 37.1814 }, ZONES);
  assert.equal(m.kind === "inside" && m.zone.id, "moscow");
});

test("при пересечении зон выбирается ближайший центр", () => {
  const overlapping = [
    { id: "a", name: "А", latitude: 0, longitude: 0, radiusKm: 100 },
    { id: "b", name: "Б", latitude: 0, longitude: 1, radiusKm: 100 },
  ];
  const m = matchZone({ latitude: 0, longitude: 0.8 }, overlapping);
  assert.equal(m.kind === "inside" && m.zone.id, "b");
});

test("пригород и область: ~100 км от Томска обслуживает Томск", () => {
  // Асино, ~95 км от центра Томска (≈ 35–40 км за границей городской зоны)
  const m = matchZone({ latitude: 56.9926, longitude: 86.1566 }, ZONES);
  assert.equal(m.kind, "suburban");
  if (m.kind !== "suburban") return;
  assert.equal(m.zone.id, "tomsk");
  assert.ok(m.toBorderKm > 20 && m.toBorderKm < 60, `получено ${m.toBorderKm}`);
  assert.equal(zoneDisplayName(m), "Томск (пригород и область)");
});

test("дальше пригородной зоны — ближайший город и расстояние до границы", () => {
  // Точка в тайге, ~500 км от Томска
  const m = matchZone({ latitude: 61.0, longitude: 89.0 }, ZONES);
  assert.equal(m.kind, "outside");
  if (m.kind !== "outside") return;
  assert.equal(m.nearest?.id, "tomsk");
  assert.ok(m.distanceKm! > 250, `получено ${m.distanceKm}`);
  const msg = outOfZoneMessage(m);
  assert.match(msg, /слишком далеко от городов обслуживания/);
  assert.match(msg, /Томск/);
});

test("радиус пригородной зоны настраивается", () => {
  const point = { latitude: 56.9926, longitude: 86.1566 };
  assert.equal(matchZone(point, ZONES, 10).kind, "outside");
  assert.equal(matchZone(point, ZONES, 100).kind, "suburban");
});

test("без зон — отдельное сообщение", () => {
  const m = matchZone({ latitude: 55, longitude: 37 }, []);
  assert.equal(m.kind, "outside");
  if (m.kind === "outside") assert.match(outOfZoneMessage(m), /не настроено ни одной зоны/);
});

test("округление расстояния для пользователя", () => {
  assert.equal(roundKm(0.3), 1);
  assert.equal(roundKm(7.4), 7);
  assert.equal(roundKm(43), 45);
  assert.equal(roundKm(412), 410);
});
