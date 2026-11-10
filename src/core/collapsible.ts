import { formatDistance, formatDuration, formatMoney, ORDER_STATUS_TEXT, type EstimateView, type OrderStatus, type OrderView, type Place } from "../shared/types.ts";

export const SWIPE_COLLAPSE_PX = 44;

const ACTION_REQUIRED_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "driver_waiting",
  "completed",
  
  "cancelled",
]);

/** Вертикальный жест на шапке панели: "collapse", "expand" или null для короткого нажатия. */
export function resolveSheetSwipe(deltaY: number): "collapse" | "expand" | null {
  if (!Number.isFinite(deltaY) || Math.abs(deltaY) < SWIPE_COLLAPSE_PX) return null;
  return deltaY > 0 ? "collapse" : "expand";
}

/** При переходе к ожиданию водителя, оплате или отмене свёрнутая карточка должна раскрыться. */
export function shouldAutoExpandOrderSheet(previous: OrderStatus | null, next: OrderStatus): boolean {
  return previous !== null && previous !== next && ACTION_REQUIRED_STATUSES.has(next);
}

/** Краткая сводка главного экрана для свёрнутой панели. */
export function buildHomeCollapsedSummary(input: {
  pickup: Place | null;
  destination: Place | null;
  estimate: EstimateView | null;
  unpaidOrderId: string | null;
}): { title: string; subtitle: string; badge: string | null } {
  const { pickup, destination, estimate, unpaidOrderId } = input;
  const selected = estimate?.tariffs[0] ?? null;
  if (estimate && selected) {
    return {
      title: `Маршрут готов · ${formatMoney(selected.price)}`,
      subtitle: `${formatDistance(estimate.distanceMeters)} · в пути ${formatDuration(estimate.durationSeconds)} · подача ~${formatDuration(selected.pickupEtaSeconds)}`,
      badge: formatMoney(selected.price),
    };
  }
  if (pickup && destination) {
    return {
      title: `${pickup.address} → ${destination.address}`,
      subtitle: "Разверните панель, чтобы построить маршрут",
      badge: null,
    };
  }
  if (pickup) {
    return {
      title: `Откуда: ${pickup.address}`,
      subtitle: unpaidOrderId ? "Есть неоплаченная поездка · укажите адрес назначения" : "Разверните панель, чтобы указать адрес назначения",
      badge: unpaidOrderId ? "К оплате" : null,
    };
  }
  return {
    title: "Куда поедем?",
    subtitle: unpaidOrderId ? "Есть неоплаченная поездка · разверните панель" : "Карта открыта полностью · нажмите, чтобы выбрать адреса",
    badge: unpaidOrderId ? "К оплате" : null,
  };
}

/** Краткая сводка активного или завершённого заказа для свёрнутой панели. */
export function buildOrderCollapsedSummary(order: OrderView): { title: string; subtitle: string; badge: string } {
  const price = formatMoney(order.finalPrice ?? order.estimatedPrice);
  const vehicle = order.driver?.vehicle;
  const driverPart = vehicle
    ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}`
    : order.driver?.name ?? `${formatDistance(order.distanceMeters)} · ${formatDuration(order.durationSeconds)}`;
  const etaPart =
    ["driver_assigned", "driver_arriving"].includes(order.status) && order.driver?.etaSeconds !== null && order.driver?.etaSeconds !== undefined
      ? ` · ~${formatDuration(order.driver.etaSeconds)}`
      : "";
  return {
    title: ORDER_STATUS_TEXT[order.status],
    subtitle: `${driverPart}${etaPart}`,
    badge: price,
  };
}
