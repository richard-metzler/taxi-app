import { ORDER_STATUS_TEXT, type OrderStatus, type Place } from "./types";
import type { DriverAction } from "../core/driver-flow";

export type DriverVehicleView = {
  brand: string;
  model: string;
  color: string;
  plate: string;
  tariffId: string;
  tariffName: string;
};

export type DriverProfileView = {
  id: string;
  name: string;
  rating: number;
  isOnline: boolean;
  vehicle: DriverVehicleView | null;
};

/** Текущий заказ водителя. Телефон пассажира виден только назначенному водителю. */
export type DriverOrderView = {
  id: string;
  status: OrderStatus;
  pickup: Place;
  destination: Place;
  tariffName: string;
  price: number;
  distanceMeters: number;
  durationSeconds: number;
  routeGeometry: [number, number][];
  passenger: { name: string; phone: string };
  createdAt: string;
  nextAction: { action: Exclude<DriverAction, "decline">; label: string } | null;
  canDecline: boolean;
};

export type DriverStateView = {
  driver: DriverProfileView;
  currentOrder: DriverOrderView | null;
};

/** Заказ, доступный для принятия. */
export type AvailableOrderView = {
  id: string;
  pickup: Place;
  destination: Place;
  distanceToPickupMeters: number;
  tripDistanceMeters: number;
  tripDurationSeconds: number;
  price: number;
  tariffName: string;
  createdAt: string;
};

export type DriverTripView = {
  id: string;
  status: OrderStatus;
  createdAt: string;
  pickupAddress: string;
  destinationAddress: string;
  price: number;
  passengerName: string;
  tariffName: string;
};

const DRIVER_STATUS_TEXT: Partial<Record<OrderStatus, string>> = {
  driver_assigned: "Заказ принят",
  driver_arriving: "Едем к пассажиру",
  driver_waiting: "Ожидаем пассажира",
  in_progress: "Поездка идёт",
  
  
  cancelled: "Заказ отменён",
};

/** Статус заказа в формулировке для водителя. */
export function driverStatusText(status: OrderStatus): string {
  return DRIVER_STATUS_TEXT[status] ?? ORDER_STATUS_TEXT[status];
}
