import type { OrderStatus } from "../shared/types.ts";

/** Действия водителя над заказом. Допустимость каждого перехода проверяет сервер. */
export type DriverAction = "depart" | "arrived" | "start" | "complete" | "decline";

type Step = { from: OrderStatus; to: OrderStatus; label: string };

/** Переходы статусов, которые выполняет водитель (в порядке поездки). */
export const DRIVER_TRANSITIONS: Record<Exclude<DriverAction, "decline">, Step> = {
  depart: { from: "driver_assigned", to: "driver_arriving", label: "Выехал к пассажиру" },
  arrived: { from: "driver_arriving", to: "driver_waiting", label: "Я на месте" },
  start: { from: "driver_waiting", to: "in_progress", label: "Начать поездку" },
  complete: { from: "in_progress", to: "payment_pending", label: "Завершить поездку" },
};

/** Следующее основное действие водителя для текущего статуса заказа. */
export function nextDriverAction(status: OrderStatus): { action: Exclude<DriverAction, "decline">; label: string } | null {
  for (const [action, step] of Object.entries(DRIVER_TRANSITIONS) as [Exclude<DriverAction, "decline">, Step][]) {
    if (step.from === status) return { action, label: step.label };
  }
  return null;
}

/** Отказаться от заказа можно до начала поездки. */
export function canDeclineStatus(status: OrderStatus): boolean {
  return status === "driver_assigned" || status === "driver_arriving" || status === "driver_waiting";
}

export function isDriverAction(value: unknown): value is DriverAction {
  return value === "depart" || value === "arrived" || value === "start" || value === "complete" || value === "decline";
}
