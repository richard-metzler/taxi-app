"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOrder } from "@/features/ride_order/useOrder";
import { BottomNav, Button, Spinner } from "@/core/widgets/ui";
import { api } from "@/shared/api";
import { CollapsibleSheet } from "@/core/widgets/CollapsibleSheet";
import { formatMoney, ORDER_STATUS_TEXT } from "@/shared/types";

// Leaflet обращается к window, поэтому карту грузим только на клиенте.
const RideMap = dynamic(() => import("@/features/map/RideMap"), { ssr: false });

const STEPS = [
  { key: "searching", label: "Ищем" },
  { key: "driver_assigned", label: "Найден" },
  { key: "driver_arriving", label: "Едет" },
  { key: "driver_waiting", label: "На месте" },
  { key: "in_progress", label: "Поездка" },
  { key: "completed", label: "Завершён" },
];

export default function OrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const { order, error, forbidden, reload } = useOrder(orderId);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  // Зависимость — примитив: состояние меняется вместе со статусом заказа.
  const orderStatus = order?.status;
  useEffect(() => {
    if (orderStatus === "completed") {
      void Promise.resolve().then(() => setShowReceipt(true));
    }
  }, [orderStatus]);

  if (!orderId || orderId === "undefined" || orderId === "null") {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-danger">Ошибка: некорректный ID заказа</p>
      </main>
    );
  }

  if (!order && !error && !forbidden) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  if (forbidden || error || !order) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-danger">{forbidden ? "У вас нет доступа к этому заказу" : (error || "Заказ не найден")}</p>
        <Button onClick={() => { window.location.href = "/home"; }}>На главную</Button>
      </main>
    );
  }

  const isFinal = ["completed", "cancelled"].includes(order.status);
  const canCancel = ["searching", "driver_assigned", "driver_arriving", "driver_waiting"].includes(order.status);

  const handleCancel = async () => {
    setShowCancelModal(false);
    setIsCancelling(true);
    try {
      await api.orders.cancel(order.id);
      await reload();
    } catch (e: any) {
      alert(e.message || 'Не удалось отменить заказ');
    } finally {
      setIsCancelling(false);
    }
  };

  const route = typeof order.routeGeometry === 'string' ? JSON.parse(order.routeGeometry) : order.routeGeometry;

  const driverRoute = (order.simulation as any)?.approachRoute || null;
  const showDriverRoute = ["driver_assigned", "driver_arriving"].includes(order.status);

  const statusText = ORDER_STATUS_TEXT[order.status];
  const shortId = order.id.slice(0, 6);
  const etaMinutes = order.driver?.etaSeconds != null ? Math.max(1, Math.round(order.driver.etaSeconds / 60)) : null;
  const currentStep = order.status === "cancelled" ? -1 : STEPS.findIndex((s) => s.key === order.status);
  const etaText =
    etaMinutes !== null
      ? `Прибудет через ${etaMinutes} мин`
      : order.status === "in_progress"
        ? "Поездка идёт"
        : order.status === "searching"
          ? "Ищем ближайшего водителя"
          : statusText;
  const driverVehicle = order.driver?.vehicle;

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-bg">
      {/* Карта занимает верхние ~55dvh */}
      <div className="relative h-[55dvh] w-full shrink-0">
        <RideMap
          center={order.pickup || { latitude: 56.4846, longitude: 84.9476 }}
          pickup={order.pickup}
          destination={order.destination}
          driver={order.driver?.location}
          route={route}
          fitKey={order.id}
          layoutKey={!sheetCollapsed}
          className="h-full w-full"
          showDriverRoute={showDriverRoute}
          driverRoute={driverRoute}
        />

        <button
          type="button"
          aria-label="Назад"
          onClick={() => router.push("/home")}
          className="neo-btn absolute left-4 top-4 z-[1000] flex h-11 w-11 items-center justify-center text-2xl text-ink"
        >
          ←
        </button>

        {/* Плашка статуса справа поверх карты */}
        <div className="absolute right-4 top-4 z-[1000] flex max-w-[calc(100%-6rem)] items-center gap-2 rounded-2xl border border-gray-200 bg-white/90 px-3 py-2 shadow-lg backdrop-blur-md">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isFinal ? "bg-muted" : "bg-accent pulse-dot"}`} />
          <span className="truncate text-xs font-bold text-ink">{statusText}</span>
        </div>

        {/* Бейдж ETA / времени прибытия */}
        <div className="absolute inset-x-4 bottom-4 z-[1000] flex justify-center">
          <span className="neo-sm rounded-full px-4 py-2 text-xs font-bold text-accent shadow-lg">{etaText}</span>
        </div>
      </div>

      <CollapsibleSheet
        id="order-sheet"
        collapsed={sheetCollapsed}
        onCollapsedChange={setSheetCollapsed}
        title={statusText}
        subtitle={`Заказ #${shortId}`}
        maxHeightClass="max-h-[45dvh]"
        headerExtra={
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-bold text-ink">{statusText}</span>
            <span className="truncate text-xs text-muted">Заказ #{shortId}</span>
          </div>
        }
        footer={
          <div className="mx-3 mb-2 flex flex-col gap-2">
            {canCancel ? (
              <Button variant="danger" onClick={() => setShowCancelModal(true)} loading={isCancelling} className="w-full">
                Отменить заказ
              </Button>
            ) : null}
            {isFinal ? (
              <>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => router.push("/home")}
                >
                  Новый заказ
                </Button>
                <BottomNav />
              </>
            ) : null}
            {!isFinal && !canCancel ? (
              <div className="neo-inset py-3 text-center text-sm font-semibold text-accent">{statusText}</div>
            ) : null}
          </div>
        }
      >
        <div className="flex flex-col gap-3 pb-1">
          {/* Карточка водителя: фото/первая буква, имя, авто, номер и телефон */}
          {order.driver ? (
            <div className="neo-sm flex items-center gap-3 p-3">
              <div className="neo-inset flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-bold text-accent">
                {order.driver.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={order.driver.photoUrl} alt={order.driver.name} className="h-full w-full object-cover" />
                ) : (
                  order.driver.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-bold text-ink">{order.driver.name}</div>
                {driverVehicle ? (
                  <div className="truncate text-xs text-muted">
                    {driverVehicle.brand} {driverVehicle.model} · {driverVehicle.color.toLowerCase()} · {driverVehicle.plate}
                  </div>
                ) : (
                  <div className="truncate text-xs text-muted">Автомобиль уточняется</div>
                )}
                {etaMinutes !== null ? (
                  <div className="mt-0.5 text-xs font-semibold text-accent">Прибудет через {etaMinutes} мин</div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Позвонить водителю"
                title="Позвонить водителю"
                className="neo-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-accent"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                  <path
                    d="M6.6 3h3l1.5 4-2 1.5a12 12 0 0 0 5.4 5.4L15.5 12l4 1.5v3c0 1-.8 1.8-1.8 1.8C10.5 18 3 10.5 3 4.8 3 3.8 3.8 3 4.8 3h1.8z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          ) : null}

          {/* Адреса поездки */}
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-success ring-4 ring-bg" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wide text-muted">Откуда</div>
                <div className="truncate text-sm font-semibold text-ink">{order.pickup.address}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm bg-ink ring-4 ring-bg" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wide text-muted">Куда</div>
                <div className="truncate text-sm font-semibold text-ink">{order.destination.address}</div>
              </div>
            </div>
          </div>

          {/* Стоимость */}
          <div className="flex items-center justify-between border-t border-muted/15 pt-3">
            <span className="text-sm text-muted">Стоимость</span>
            <span className="text-2xl font-bold text-ink">
              {formatMoney(order.finalPrice ?? order.estimatedPrice ?? 0)}
            </span>
          </div>

          {/* Горизонтальный прогресс шагов поездки */}
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Статус поездки</div>
            <div className="flex gap-1">
              {STEPS.map((step, i) => {
                const reached = i <= currentStep;
                return (
                  <div key={step.key} className="min-w-0 flex-1">
                    <div className={`h-1.5 rounded-full ${reached ? "bg-accent" : "bg-muted/25"}`} />
                    <div
                      className={`mt-1 truncate text-center text-[9px] leading-tight ${
                        i === currentStep ? "font-bold text-accent" : reached ? "text-ink" : "text-muted"
                      }`}
                    >
                      {step.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CollapsibleSheet>

      {showCancelModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-[#E9EDF2] rounded-3xl p-6 max-w-sm w-full shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
            <h3 className="text-xl font-bold text-ink mb-2 text-center">Отменить заказ?</h3>
            <p className="text-muted mb-6 text-center">Вы уверены, что хотите отменить поездку?</p>
            <div className="flex gap-3">
              <Button variant="default" className="flex-1" onClick={() => setShowCancelModal(false)}>
                Нет
              </Button>
              <Button variant="danger" className="flex-1" onClick={handleCancel} loading={isCancelling}>
                Да, отменить
              </Button>
            </div>
          </div>
        </div>
      )}

      {showReceipt && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-[#E9EDF2] rounded-3xl p-6 max-w-sm w-full shadow-[0_10px_40px_rgba(0,0,0,0.3)] text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              ✓
            </div>
            <h3 className="text-xl font-bold text-ink mb-2">Поездка завершена</h3>
            <p className="text-muted mb-6">Стоимость поездки <span className="text-xl font-bold text-ink">{formatMoney(order.finalPrice ?? order.estimatedPrice ?? 0)}</span></p>
            <Button variant="primary" className="w-full" onClick={() => router.push("/home")}>
              Новый заказ
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
