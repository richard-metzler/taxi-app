import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidPlate, normalizePlate, validateVehicle } from "../src/core/vehicle.ts";
import { DRIVER_TRANSITIONS, canDeclineStatus, isDriverAction, nextDriverAction } from "../src/core/driver-flow.ts";
import { buildNavigatorUrl } from "../src/core/navigator-links.ts";

test("госномер: латиница и пробелы приводятся к кириллице, формат проверяется", () => {
  assert.equal(normalizePlate("a 123 bc-70"), "А123ВС70");
  assert.equal(normalizePlate("м789ор 170"), "М789ОР170");
  assert.ok(isValidPlate("А123ВС70"));
  assert.ok(isValidPlate("М789ОР170"));
  for (const bad of ["Д123ВС70", "А12ВС70", "А123ВС7", "123АВС70", "", "А123ВС7000"]) {
    assert.equal(isValidPlate(bad), false, bad);
  }
});

test("автомобиль: корректные данные нормализуются, ошибки названы по-русски", () => {
  const ok = validateVehicle({ brand: " Lada ", model: "Vesta", color: "Белый", plate: "a123bc70", tariffId: "comfort" });
  assert.deepEqual(ok, { ok: true, value: { brand: "Lada", model: "Vesta", color: "Белый", plate: "А123ВС70", tariffId: "comfort" } });

  const cases: [unknown, RegExp][] = [
    [null, /данные автомобиля/],
    [{ model: "Vesta", color: "Белый", plate: "А123ВС70", tariffId: "econom" }, /марку/],
    [{ brand: "Lada", color: "Белый", plate: "А123ВС70", tariffId: "econom" }, /модель/],
    [{ brand: "Lada", model: "Vesta", color: "Б", plate: "А123ВС70", tariffId: "econom" }, /цвет/],
    [{ brand: "Lada", model: "Vesta", color: "Белый", plate: "XYZ", tariffId: "econom" }, /госномер/],
    [{ brand: "Lada", model: "Vesta", color: "Белый", plate: "А123ВС70", tariffId: "vip" }, /класс/],
  ];
  for (const [input, message] of cases) {
    const result = validateVehicle(input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, message);
  }
});

test("поездка водителя: шаги идут строго по порядку, отказ — только до начала поездки", () => {
  assert.equal(nextDriverAction("driver_assigned")?.action, "depart");
  assert.equal(nextDriverAction("driver_arriving")?.action, "arrived");
  assert.equal(nextDriverAction("driver_waiting")?.action, "start");
  assert.equal(nextDriverAction("in_progress")?.action, "complete");
  for (const status of ["searching", "payment_pending", "paid", "cancelled"] as const) {
    assert.equal(nextDriverAction(status), null, status);
  }
  assert.equal(DRIVER_TRANSITIONS.complete.to, "payment_pending");
  assert.equal(canDeclineStatus("driver_arriving"), true);
  assert.equal(canDeclineStatus("in_progress"), false);
  assert.equal(isDriverAction("complete"), true);
  assert.equal(isDriverAction("paid"), false);
});

test("навигатор: ссылки для Яндекс Навигатора, 2ГИС и Google Карт", () => {
  const point = { latitude: 56.4886, longitude: 84.9521 };
  assert.equal(buildNavigatorUrl("yandex", point), "https://yandex.ru/maps/?rtext=~56.4886,84.9521&rtt=auto");
  assert.equal(buildNavigatorUrl("dgis", point), "https://2gis.ru/routeSearch/rsType/car/to/84.9521,56.4886");
  assert.equal(
    buildNavigatorUrl("google", point),
    "https://www.google.com/maps/dir/?api=1&destination=56.4886,84.9521&travelmode=driving",
  );
});
