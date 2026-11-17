"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOrder } from "@/features/ride_order/useOrder";
import { BottomNav, Button, Spinner } from "@/core/widgets/ui";
import { api } from "@/shared/api";
import { CollapsibleSheet } from "@/core/widgets/CollapsibleSheet";
import { buildNavigatorUrl, type NavigatorId } from "@/core/navigator-links";
import { formatDuration, formatMoney, ORDER_STATUS_TEXT } from "@/shared/types";
import { useSession } from "@/shared/session";

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

const MAP_PROVIDERS: NavigatorId[] = ["yandex", "dgis", "google"];

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} км` : `${Math.round(meters)} м`;
}

export default function OrderPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useSession();
  const orderId = params.id as string;

  const { order, error, forbidden, reload } = useOrder(orderId);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [providerIndex, setProviderIndex] = useState(0);
  const [flyTo, setFlyTo] = useState<{ point: { latitude: number; longitude: number }; nonce: number } | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Зависимость — примитив: состояние меняется вместе со статусом заказа.
  const orderStatus = order?.status;
  useEffect(() => {
    if (orderStatus === "completed") {
      void Promise.resolve().then(() => setShowReceipt(true));
    }
  }, [orderStatus]);

  if (!orderId || orderId === "undefined" || orderId === "null") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg">
        <p className="text-danger">Ошибка: некорректный ID заказа</p>
      </main>
    );
  }

  if (!order && !error && !forbidden) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  if (forbidden || error || !order) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
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

  // Реальные действия для круглых кнопок поверх карты: геолокация, смена подложки, навигация.
  const locateMe = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNotice("Геолокация недоступна в этом браузере");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFlyTo({
          point: { latitude: position.coords.latitude, longitude: position.coords.longitude },
          nonce: Date.now(),
        });
      },
      () => setNotice("Не удалось определить местоположение"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const cycleLayer = () => setProviderIndex((index) => (index + 1) % MAP_PROVIDERS.length);
  const navigatorId: NavigatorId = user?.navigator ?? "yandex";
  const navigatorUrl = buildNavigatorUrl(navigatorId, order.destination);

  const showUnavailable = (title: string) => setNotice(`«${title}» пока недоступно в этой версии`);

  // Поделиться поездкой: Web Share API, иначе копирование ссылки в буфер с фолбэком.
  const shareRide = async () => {
    const url = typeof window === "undefined" ? "" : window.location.href;
    const title = "Поездка в Рядом";
    const text = `Поездка #${order.id.slice(0, 6)}: ${order.pickup.address} → ${order.destination.address}`;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else if (typeof document !== "undefined") {
        const area = document.createElement("textarea");
        area.value = url;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      setNotice("Ссылка на поездку скопирована");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setNotice("Не удалось поделиться поездкой");
    }
  };

  const route = typeof order.routeGeometry === 'string' ? JSON.parse(order.routeGeometry) : order.routeGeometry;

  const driverRoute = (order.simulation as any)?.approachRoute || null;
  const showDriverRoute = ["driver_assigned", "driver_arriving"].includes(order.status);

  const statusText = ORDER_STATUS_TEXT[order.status];
  const shortId = order.id.slice(0, 6);
  const etaMinutes = order.driver?.etaSeconds != null ? Math.max(1, Math.round(order.driver.etaSeconds / 60)) : null;
  const currentStep = order.status === "cancelled" ? -1 : STEPS.findIndex((s) => s.key === order.status);
  const driverVehicle = order.driver?.vehicle;
  const distanceAway = order.driver?.distanceToPassengerMeters;
  const distanceAwayText =
    distanceAway != null
      ? distanceAway >= 1000
        ? `${(distanceAway / 1000).toFixed(1)} km away`
        : `${Math.round(distanceAway)} m away`
      : null;

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
          provider={MAP_PROVIDERS[providerIndex]}
          flyTo={flyTo}
        />

        {/* Назад */}
        <button
          type="button"
          aria-label="Назад"
          onClick={() => router.push("/home")}
          className="neo-btn absolute left-4 top-4 z-[1000] flex h-11 w-11 items-center justify-center text-2xl text-ink"
        >
          ←
        </button>

        {/* Плашка текущего местоположения поверх карты */}
        <div className="neo absolute left-16 top-4 z-[1000] flex max-w-[calc(100%-11rem)] items-center gap-2 px-3 py-2 shadow-lg backdrop-blur-md">
          <span className="neo-inset flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base">📍</span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Текущее местоположение</div>
            <div className="truncate text-xs font-bold text-ink">{order.pickup.address}</div>
          </div>
          <span className="shrink-0 text-lg text-muted" aria-hidden="true">›</span>
        </div>

        {/* Бейдж прибытия и расстояния */}
        <div className="neo absolute right-4 top-4 z-[1000] flex max-w-[9rem] flex-col items-end gap-0.5 px-3 py-2 text-right shadow-lg backdrop-blur-md">
          <span className="text-xs font-bold leading-tight text-accent">
            {etaMinutes !== null ? `Прибытие через ${etaMinutes} мин` : statusText}
          </span>
          {distanceAwayText ? <span className="text-[11px] leading-tight text-muted">{distanceAwayText}</span> : null}
        </div>

        {/* Облачко статуса слева внизу */}
        <div className="neo absolute bottom-4 left-4 z-[1000] flex items-center gap-2 rounded-2xl px-4 py-2.5 shadow-lg backdrop-blur-md">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isFinal ? "bg-muted" : "bg-accent pulse-dot"}`} />
          <span className="text-xs font-bold text-ink">
            {order.driver && !isFinal ? "Водитель в пути" : statusText}
          </span>
        </div>

        {/* Три круглые кнопки справа: геолокация, слои, навигация */}
        <div className="absolute right-4 top-1/2 z-[1000] flex -translate-y-1/2 flex-col gap-2">
          <button
            type="button"
            aria-label="Моё местоположение"
            title="Моё местоположение"
            onClick={locateMe}
            className="neo-btn flex h-11 w-11 items-center justify-center rounded-full text-xl text-ink"
          >
            ◎
          </button>
          <button
            type="button"
            aria-label="Сменить подложку карты"
            title="Сменить подложку карты"
            onClick={cycleLayer}
            className="neo-btn flex h-11 w-11 items-center justify-center rounded-full text-lg text-ink"
          >
            ▦
          </button>
          <a
            href={navigatorUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Маршрут в навигаторе"
            title="Маршрут в навигаторе"
            className="neo-btn flex h-11 w-11 items-center justify-center rounded-full text-lg text-accent"
          >
            ➤
          </a>
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
                Отменить поездку
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
            ) : (
              <Button
                variant="primary"
                className="w-full"
                onClick={() => void shareRide()}
              >
                Поделиться поездкой
              </Button>
            )}
            {notice ? <p className="text-center text-xs text-accent" role="status">{notice}</p> : null}
          </div>
        }
      >
        <div className="flex flex-col gap-3 pb-1">
          {/* Карточка водителя: аватар с первой буквой, имя, авто и действия */}
          {order.driver ? (
            <div className="neo flex items-center gap-3 p-3">
              <div className="neo-inset flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-bold text-accent">
                {order.driver.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={order.driver.photoUrl} alt={order.driver.name} className="h-full w-full object-cover" />
                ) : (
                  order.driver.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-bold text-ink">{order.driver.name}</div>
                <div className="truncate text-xs text-muted">
                  {driverVehicle
                    ? `${driverVehicle.brand} ${driverVehicle.model} · ${driverVehicle.color.toLowerCase()} · ${driverVehicle.plate}`
                    : "Автомобиль уточняется"}
                </div>
                {etaMinutes !== null ? (
                  <div className="mt-0.5 text-xs font-semibold text-accent">Прибудет через {etaMinutes} мин</div>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Позвонить водителю"
                  title="Позвонить водителю"
                  onClick={() => showUnavailable("Звонок водителю")}
                  className="neo-btn flex h-10 w-10 items-center justify-center rounded-full text-accent"
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
                <button
                  type="button"
                  aria-label="Написать водителю"
                  title="Написать водителю"
                  onClick={() => showUnavailable("Чат с водителем")}
                  className="neo-btn flex h-10 w-10 items-center justify-center rounded-full text-accent"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                    <path
                      d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8 8 0 0 1-3.4-.7L4 20l1.6-4.1A7.5 7.5 0 1 1 20 11.5z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <a
                  href={navigatorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Маршрут в навигаторе"
                  title="Маршрут в навигаторе"
                  className="neo-btn flex h-10 w-10 items-center justify-center rounded-full text-accent"
                >
                  ➤
                </a>
              </div>
            </div>
          ) : null}

          {/* Карточка автомобиля с иконкой такси */}
          <div className="neo flex items-center gap-3 p-3">
            <div className="neo-inset flex h-12 w-16 shrink-0 items-center justify-center rounded-xl">
              <Image
                src="/images/taxi-side.svg"
                alt=""
                width={72}
                height={36}
                unoptimized
                className="h-7 w-auto"
                draggable={false}
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-ink">
                {driverVehicle ? `${driverVehicle.brand} ${driverVehicle.model}` : "Автомобиль уточняется"}
              </div>
              <div className="truncate text-xs text-muted">
                {driverVehicle ? `${driverVehicle.color.toLowerCase()} · ${driverVehicle.plate}` : "Информация появится позже"}
              </div>
            </div>
            <span className="neo-inset shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-accent">
              {order.tariffName}
            </span>
          </div>

          {/* Строка маршрута: А → ETA/расстояние → Б */}
          <div className="neo flex items-center gap-3 p-3">
            <div className="flex w-2.5 shrink-0 flex-col items-center self-stretch">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-success" aria-hidden="true" />
              <span className="my-1 w-px flex-1 bg-muted/30" aria-hidden="true" />
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-ink" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
              <div className="w-full truncate text-sm font-semibold text-ink">{order.pickup.address}</div>
              <div className="neo-inset rounded-full px-3 py-1 text-xs font-bold text-accent">
                {formatDistance(order.distanceMeters)} · {formatDuration(order.durationSeconds)}
              </div>
              <div className="w-full truncate text-sm font-semibold text-ink">{order.destination.address}</div>
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
          <div className="w-full max-w-sm rounded-3xl bg-[#16191F] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
            <h3 className="mb-2 text-center text-xl font-bold text-ink">Отменить заказ?</h3>
            <p className="mb-6 text-center text-muted">Вы уверены, что хотите отменить поездку?</p>
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
          <div className="w-full max-w-sm rounded-3xl bg-[#16191F] p-6 text-center shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-3xl text-success">
              ✓
            </div>
            <h3 className="mb-2 text-xl font-bold text-ink">Поездка завершена</h3>
            <p className="mb-6 text-muted">Стоимость поездки <span className="text-xl font-bold text-ink">{formatMoney(order.finalPrice ?? order.estimatedPrice ?? 0)}</span></p>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => router.push("/home")}
            >
              Новый заказ
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
