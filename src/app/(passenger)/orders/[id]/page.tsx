"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { useRequireAuth } from "@/shared/session";
import { formatDistance, formatDuration, formatMoney, ORDER_STATUS_TEXT, type OrderView } from "@/shared/types";
import { buildOrderCollapsedSummary, shouldAutoExpandOrderSheet } from "@/core/collapsible";
import { CollapsibleSheet } from "@/core/widgets/CollapsibleSheet";
import { Button, CollapsibleSection, ErrorBanner, Spinner, StatusPill } from "@/core/widgets/ui";
import { useOrder } from "@/features/ride_order/useOrder";
import { DriverCard } from "@/features/driver_tracking/DriverCard";
import { PaymentPanel } from "@/features/payment/PaymentPanel";

const RideMap = dynamic(() => import("@/features/map/RideMap"), { ssr: false });

const STATUS_HINT: Partial<Record<OrderView["status"], string>> = {
  searching: "Подбираем ближайший автомобиль. Обычно это занимает меньше минуты.",
  driver_assigned: "Водитель принял заказ и скоро выедет к вам.",
  driver_arriving: "Следите за автомобилем на карте.",
  driver_waiting: "Автомобиль на месте. Проверьте номер перед посадкой.",
  in_progress: "Счастливого пути!",
  payment_pending: "Поездка завершена. Оплатите, чтобы закрыть заказ.",
  payment_failed: "Платёж не прошёл. Попробуйте ещё раз.",
  paid: "Спасибо за поездку!",
  cancelled: "Вы можете оформить новый заказ.",
};

function OrderScreen() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { user, loading } = useRequireAuth();
  const { order, error, forbidden, reload } = useOrder(params.id);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [driverCollapsed, setDriverCollapsed] = useState(false);
  const [routeCollapsed, setRouteCollapsed] = useState(false);
  const previousStatusRef = useRef<OrderView["status"] | null>(null);
  const returnedFromProvider = search.get("payment") === "return";

  useEffect(() => {
    if (!order) return;
    if (shouldAutoExpandOrderSheet(previousStatusRef.current, order.status) || returnedFromProvider) {
      setSheetCollapsed(false);
    }
    previousStatusRef.current = order.status;
  }, [order, returnedFromProvider]);

  const fitKey = useMemo(() => {
    if (!order) return "";
    const phase = ["driver_assigned", "driver_arriving"].includes(order.status) ? "approach" : order.status === "in_progress" ? "ride" : "static";
    return `${order.id}-${phase}`;
  }, [order]);

  const cancel = async () => {
    if (!order || !confirm("Отменить заказ?")) return;
    setCancelling(true);
    setActionError(null);
    try {
      await api.orders.cancel(order.id);
      await reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Не удалось отменить заказ");
    } finally {
      setCancelling(false);
    }
  };

  if (loading || !user) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      
      {showCancelModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold mb-2 text-ink">Отменить заказ?</h3>
            <p className="text-sm text-muted mb-6">Вы уверены, что хотите отменить поездку?</p>
            <div className="flex gap-3">
              <Button variant="default" className="flex-1" onClick={() => setShowCancelModal(false)}>
                Нет
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => setShowCancelModal(true)}>
                Да, отменить
              </Button>
            </div>
          </div>
        </div>
      )}

    </main>
    );
  }

  if (forbidden) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6">
        <div className="text-5xl">🔒</div>
        <p className="text-center">Заказ не найден или у вас нет к нему доступа.</p>
        <Link href="/home" className="neo-btn-primary px-6 py-3 font-semibold">
          На главную
        </Link>
      
      {showCancelModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold mb-2 text-ink">Отменить заказ?</h3>
            <p className="text-sm text-muted mb-6">Вы уверены, что хотите отменить поездку?</p>
            <div className="flex gap-3">
              <Button variant="default" className="flex-1" onClick={() => setShowCancelModal(false)}>
                Нет
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => setShowCancelModal(true)}>
                Да, отменить
              </Button>
            </div>
          </div>
        </div>
      )}

    </main>
    );
  }

  if (!order) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
        {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : <Spinner className="h-8 w-8 text-accent" />}
      
      {showCancelModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold mb-2 text-ink">Отменить заказ?</h3>
            <p className="text-sm text-muted mb-6">Вы уверены, что хотите отменить поездку?</p>
            <div className="flex gap-3">
              <Button variant="default" className="flex-1" onClick={() => setShowCancelModal(false)}>
                Нет
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => setShowCancelModal(true)}>
                Да, отменить
              </Button>
            </div>
          </div>
        </div>
      )}

    </main>
    );
  }

  const tone =
    order.status === "paid" ? "success" : order.status === "cancelled" || order.status === "payment_failed" ? "danger" : "accent";
  const showDriverEta = ["driver_assigned", "driver_arriving"].includes(order.status);
  const showDriverOnMap = ["driver_assigned", "driver_arriving", "driver_waiting", "in_progress"].includes(order.status);
  const isFinal = order.status === "paid" || order.status === "cancelled";
  const collapsedSummary = buildOrderCollapsedSummary(order);
  const driverSummary = order.driver?.vehicle
    ? `${order.driver.name} · ${order.driver.vehicle.brand} ${order.driver.vehicle.model} · ${order.driver.vehicle.plate}`
    : order.driver?.name ?? null;
  const priceLabel = order.finalPrice !== null ? `итого ${formatMoney(order.finalPrice)}` : `предварительно ${formatMoney(order.estimatedPrice)}`;

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden">
      <div className="absolute inset-0">
        <RideMap
          center={order.pickup}
          pickup={order.pickup}
          destination={order.destination}
          route={order.routeGeometry}
          driver={showDriverOnMap && order.driver?.location ? order.driver.location : null}
          fitKey={fitKey}
          layoutKey={sheetCollapsed}
        />
      </div>

      <Link href="/home" className="neo-btn absolute left-4 top-4 z-[1000] flex h-12 w-12 items-center justify-center text-xl" aria-label="Назад">
        ←
      </Link>

      {error ? (
        <div className="absolute left-20 right-4 top-4 z-[1000]">
          <ErrorBanner message={`Нет связи с сервером: ${error}`} />
        </div>
      ) : null}

      <CollapsibleSheet
        id="order-status-sheet"
        collapsed={sheetCollapsed}
        onCollapsedChange={setSheetCollapsed}
        title={collapsedSummary.title}
        subtitle={collapsedSummary.subtitle}
        badge={collapsedSummary.badge}
        badgeTone={tone}
        pulse={order.status === "searching"}
        collapseLabel="Свернуть карточку поездки"
        expandLabel="Развернуть карточку поездки"
        maxHeightClass="max-h-[75dvh]"
        headerExtra={
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                {order.status === "searching" ? <span className="pulse-dot inline-block h-3 w-3 rounded-full bg-accent" /> : null}
                <h1 className="text-xl font-bold">{ORDER_STATUS_TEXT[order.status]}</h1>
              </div>
              <p className="mt-1 text-sm text-muted">
                {order.status === "cancelled" && order.cancelReason ? order.cancelReason : STATUS_HINT[order.status]}
              </p>
            </div>
            <StatusPill text={order.tariffName} tone={tone} />
          </div>
        }
        footer={<div className="safe-bottom" />}
      >
        {/* Водитель */}
        {order.driver ? (
          <CollapsibleSection
            id="order-driver"
            title="Водитель и автомобиль"
            summary={driverSummary}
            collapsed={driverCollapsed}
            onToggle={() => setDriverCollapsed((current) => !current)}
          >
            <DriverCard driver={order.driver} showEta={showDriverEta} />
            {order.driver.isSimulated ? (
              <div className="mt-2 text-[11px] text-muted">
                Демо-диспетчер: приложение водителя не подключено, водитель и его движение имитируются сервером.
              </div>
            ) : null}
          </CollapsibleSection>
        ) : null}

        {/* Маршрут */}
        <CollapsibleSection
          id="order-route"
          title="Маршрут и стоимость"
          summary={`${formatDistance(order.distanceMeters)} · ${formatDuration(order.durationSeconds)} · ${priceLabel}`}
          collapsed={routeCollapsed}
          onToggle={() => setRouteCollapsed((current) => !current)}
        >
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex gap-2">
              <span className="text-accent">●</span>
              <span className="flex-1">{order.pickup.address}</span>
            </div>
            <div className="flex gap-2">
              <span>■</span>
              <span className="flex-1">{order.destination.address}</span>
            </div>
            <div className="text-xs text-muted">
              {formatDistance(order.distanceMeters)} · {formatDuration(order.durationSeconds)} · {priceLabel}
            </div>
          </div>
        </CollapsibleSection>

        {/* Оплата */}
        {["payment_pending", "payment_failed", "paid", "completed"].includes(order.status) ? (
          <PaymentPanel order={order} returnedFromProvider={returnedFromProvider} />
        ) : null}

        <ErrorBanner message={actionError} />

        {/* Действия */}
        {order.canCancel ? (
          <Button variant="danger" onClick={() => { console.log("Нажато!"); cancel(); }} loading={cancelling}>
            Отменить заказ
          </Button>
        ) : null}
        {isFinal ? (
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => router.push("/history")}>
              История
            </Button>
            <Button className="flex-1" variant="primary" onClick={() => router.push("/home")}>
              Новый заказ
            </Button>
          </div>
        ) : null}
      </CollapsibleSheet>
    
      {showCancelModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold mb-2 text-ink">Отменить заказ?</h3>
            <p className="text-sm text-muted mb-6">Вы уверены, что хотите отменить поездку?</p>
            <div className="flex gap-3">
              <Button variant="default" className="flex-1" onClick={() => setShowCancelModal(false)}>
                Нет
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => setShowCancelModal(true)}>
                Да, отменить
              </Button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

export default function OrderPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center">
          <Spinner className="h-8 w-8 text-accent" />
        
      {showCancelModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold mb-2 text-ink">Отменить заказ?</h3>
            <p className="text-sm text-muted mb-6">Вы уверены, что хотите отменить поездку?</p>
            <div className="flex gap-3">
              <Button variant="default" className="flex-1" onClick={() => setShowCancelModal(false)}>
                Нет
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => setShowCancelModal(true)}>
                Да, отменить
              </Button>
            </div>
          </div>
        </div>
      )}

    </main>
      }
    >
      <OrderScreen />
    </Suspense>
  );
}
