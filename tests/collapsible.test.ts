import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildHomeCollapsedSummary,
  buildOrderCollapsedSummary,
  resolveSheetSwipe,
  shouldAutoExpandOrderSheet,
} from "../src/core/collapsible.ts";

test("свайп панели: короткое касание игнорируется, длинный свайп сворачивает или разворачивает", () => {
  assert.equal(resolveSheetSwipe(0), null);
  assert.equal(resolveSheetSwipe(20), null);
  assert.equal(resolveSheetSwipe(-20), null);
  assert.equal(resolveSheetSwipe(60), "collapse");
  assert.equal(resolveSheetSwipe(-60), "expand");
});

test("свёрнутая сводка главного экрана отражает состояние адресов и расчёта", () => {
  const empty = buildHomeCollapsedSummary({ pickup: null, destination: null, estimate: null, unpaidOrderId: null });
  assert.equal(empty.title, "Куда поедем?");
  assert.equal(empty.badge, null);

  const estimated = buildHomeCollapsedSummary({
    pickup: { address: "Площадь Ленина", latitude: 56.4886, longitude: 84.9521 },
    destination: { address: "Вокзал", latitude: 56.461, longitude: 84.968 },
    unpaidOrderId: null,
    estimate: {
      estimateId: "est-1",
      distanceMeters: 4200,
      durationSeconds: 420,
      routeGeometry: [],
      expiresAt: new Date().toISOString(),
      routeSource: "osrm",
      zone: { id: "tomsk", name: "Томск", suburban: false },
      tariffs: [{ id: "econom", version: 1, name: "Эконом", description: "", icon: "🚗", price: 18500, pickupEtaSeconds: 240 }],
    },
  });
  assert.match(estimated.title.replace(/\u00a0/g, " "), /185 ₽/);
  assert.match(estimated.subtitle, /4,2 км/);
  assert.equal(estimated.badge?.replace(/\u00a0/g, " "), "185 ₽");
});

test("свёрнутая сводка заказа показывает статус, автомобиль, время подачи и цену", () => {
  const summary = buildOrderCollapsedSummary({
    id: "ord-1",
    status: "driver_arriving",
    pickup: { address: "Площадь Ленина", latitude: 56.4886, longitude: 84.9521 },
    destination: { address: "Вокзал", latitude: 56.461, longitude: 84.968 },
    tariffId: "econom",
    tariffName: "Эконом",
    tariffVersion: 1,
    estimatedPrice: 21000,
    finalPrice: null,
    currency: "RUB",
    distanceMeters: 3500,
    durationSeconds: 360,
    routeGeometry: [],
    cancelReason: null,
    canCancel: true,
    createdAt: new Date().toISOString(),
    completedAt: null,
    paidAt: null,
    payment: null,
    driver: {
      id: "drv-1",
      name: "Алексей",
      photoUrl: null,
      rating: 4.9,
      isSimulated: true,
      vehicle: { brand: "Lada", model: "Vesta", color: "Белый", plate: "А123ВС70", tariffName: "Эконом" },
      location: { latitude: 56.48, longitude: 84.95, heading: 0 },
      distanceToPassengerMeters: 800,
      etaSeconds: 180,
    },
  });
  assert.equal(summary.title, "Водитель направляется к вам");
  assert.equal(summary.subtitle, "Lada Vesta · А123ВС70 · ~3 мин");
  assert.equal(summary.badge.replace(/\u00a0/g, " "), "210 ₽");
});

test("автораскрытие карточки заказа срабатывает только на статусах, требующих внимания", () => {
  assert.equal(shouldAutoExpandOrderSheet(null, "payment_pending"), false);
  assert.equal(shouldAutoExpandOrderSheet("searching", "driver_assigned"), false);
  assert.equal(shouldAutoExpandOrderSheet("driver_arriving", "driver_waiting"), true);
  assert.equal(shouldAutoExpandOrderSheet("in_progress", "payment_pending"), true);
  assert.equal(shouldAutoExpandOrderSheet("payment_pending", "payment_pending"), false);
});
