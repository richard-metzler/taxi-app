import type { OrderStatus, PaymentStatus } from "@/db/schema";

export type { OrderStatus, PaymentStatus };

export type Place = { address: string; latitude: number; longitude: number };

export type DriverView = {
  id: string;
  name: string;
  photoUrl: string | null;
  rating: number;
  isSimulated: boolean;
  vehicle: { brand: string; model: string; color: string; plate: string; tariffName: string } | null;
  location: { latitude: number; longitude: number; heading: number } | null;
  distanceToPassengerMeters: number | null;
  etaSeconds: number | null;
};

export type PaymentView = {
  id: string;
  status: PaymentStatus;
  amount: number;
  paymentMethod: string | null;
  confirmationUrl: string | null;
  failureReason: string | null;
};

export type OrderView = {
  id: string;
  status: OrderStatus;
  pickup: Place;
  destination: Place;
  tariffId: string;
  tariffName: string;
  tariffVersion: number;
  estimatedPrice: number;
  finalPrice: number | null;
  currency: string;
  distanceMeters: number;
  durationSeconds: number;
  routeGeometry: [number, number][];
  cancelReason: string | null;
  canCancel: boolean;
  createdAt: string;
  completedAt: string | null;
  paidAt: string | null;
  driver: DriverView | null;
  payment: PaymentView | null;
  simulation?: any;
};

export type OrderSummary = {
  id: string;
  status: OrderStatus;
  createdAt: string;
  pickupAddress: string;
  destinationAddress: string;
  tariffName: string;
  price: number;
  currency: string;
  driverName: string | null;
  vehicle: string | null;
};

export type TariffQuoteView = {
  id: string;
  version: number;
  name: string;
  description: string;
  icon: string;
  price: number;
  pickupEtaSeconds: number;
};

export type EstimateView = {
  estimateId: string;
  distanceMeters: number;
  durationSeconds: number;
  routeGeometry: [number, number][];
  expiresAt: string;
  routeSource: "osrm" | "fallback";
  /** Город (зона обслуживания) точки подачи. */
  zone: { id: string; name: string; suburban: boolean };
  tariffs: TariffQuoteView[];
};

export type UserProfile = {
  id: string;
  phone: string;
  name: string;
  role: string;
  navigator: "yandex" | "dgis" | "google";
};

/** Тексты статусов заказа для пассажира. */
export const ORDER_STATUS_TEXT: Record<OrderStatus, string> = {
  draft: "Черновик",
  searching: "Ищем водителя",
  driver_assigned: "Водитель найден",
  driver_arriving: "Водитель направляется к вам",
  driver_waiting: "Водитель ожидает",
  in_progress: "Поездка началась",
  completed: "Поездка завершена",
  
  paid: "Оплачено",
  cancelled: "Заказ отменён",
  payment_failed: "Оплата не прошла",
};

export const PAYMENT_STATUS_TEXT: Record<PaymentStatus, string> = {
  pending: "Ожидает оплаты",
  waiting_for_capture: "Ожидает подтверждения",
  succeeded: "Оплачено",
  canceled: "Платёж отменён",
  failed: "Ошибка оплаты",
};

export const NAVIGATOR_TEXT: Record<UserProfile["navigator"], string> = {
  yandex: "Яндекс Навигатор",
  dgis: "2ГИС",
  google: "Google Карты",
};

/** Форматирование суммы в копейках → «1 234 ₽». */
export function formatMoney(kopecks: number): string {
  const rub = Math.round(kopecks / 100);
  return `${rub.toLocaleString("ru-RU")} ₽`;
}

export function formatDuration(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60));
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} км`;
}
