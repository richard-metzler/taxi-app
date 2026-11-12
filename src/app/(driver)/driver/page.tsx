"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { useRequireAuth } from "@/shared/session";
import { driverStatusText, type AvailableOrderView } from "@/shared/driver-types";
import { formatMoney } from "@/shared/types";
import type { DriverAction } from "@/core/driver-flow";
import type { LatLng } from "@/core/geo";
import { CollapsibleSheet } from "@/core/widgets/CollapsibleSheet";
import { BottomNav, DRIVER_NAV, ErrorBanner, Spinner } from "@/core/widgets/ui";
import { useGeolocation } from "@/features/home/useGeolocation";
import { useDriverDashboard } from "@/features/driver/useDriverDashboard";
import { useDriverLocation } from "@/features/driver/useDriverLocation";
import { ActiveOrderPanel, OfflinePanel, OnlinePanel } from "@/features/driver/DriverPanels";
import { IncomingOrderModal } from "@/features/driver/IncomingOrderModal";
import { DriverSetup } from "@/features/driver/DriverSetup";

const RideMap = dynamic(() => import("@/features/map/RideMap"), { ssr: false });

const DEFAULT_CENTER: LatLng = { latitude: 56.4846, longitude: 84.9476 };

/** Главный экран водителя: карта, выход на линию, заказы рядом и ведение поездки. */
export default function DriverHomePage() {
  const { user } = useRequireAuth();
  const { state, available, error, reload } = useDriverDashboard();
  const geo = useGeolocation();
  const isOnline = state?.driver.isOnline ?? false;
  const tracking = useDriverLocation(isOnline);

  const [busy, setBusy] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [incomingOrder, setIncomingOrder] = useState<AvailableOrderView | null>(null);
  const notifiedOrders = useRef<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ point: LatLng; nonce: number } | null>(null);
  const previousOrderId = useRef<string | null>(null);
  const centered = useRef(false);

  const currentOrder = state?.currentOrder ?? null;
  const selected = available.find((order) => order.id === selectedId) ?? null;

  // Показываем модалку при поступлении нового заказа
  useEffect(() => {
    if (available.length > 0 && !currentOrder && !incomingOrder) {
      const nextOrder = available.find(o => !notifiedOrders.current.has(o.id));
      if (nextOrder) {
        notifiedOrders.current.add(nextOrder.id);
        setIncomingOrder(nextOrder);
      }
    }
    
    // Если заказ исчез из списка (его кто-то перехватил), закрываем модалку
    if (incomingOrder && !available.find(o => o.id === incomingOrder.id)) {
      setIncomingOrder(null);
    }
  }, [available, currentOrder, incomingOrder]);

  // Новый заказ раскрывает панель; исчезновение заказа объясняется пользователю.
  useEffect(() => {
    const id = currentOrder?.id ?? null;
    if (id && !previousOrderId.current) setCollapsed(false);
    if (!id && previousOrderId.current) setNotice("Заказ закрыт: поездка завершена или пассажир отменил заказ.");
    previousOrderId.current = id;
  }, [currentOrder?.id]);

  // Первое определение позиции — центрируем карту.
  useEffect(() => {
    if (tracking.position && !centered.current) {
      centered.current = true;
      setFlyTo({ point: tracking.position, nonce: Date.now() });
    }
  }, [tracking.position]);

  const fail = (cause: unknown, fallback: string) => setActionError(cause instanceof ApiError ? cause.message : fallback);

  const goOnline = async () => {
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const point = await geo.locate();
      if (!point) {
        setActionError("Не удалось определить местоположение. Разрешите доступ к геолокации и повторите.");
        return;
      }
      await api.driver.setStatus(true, point);
      // Принудительно отправляем координаты сразу, чтобы сервер знал, где мы
      await api.driver.sendLocation({ ...point, heading: 0 });
      await reload();
    } catch (cause) {
      fail(cause, "Не удалось выйти на линию");
    } finally {
      setBusy(false);
    }
  };

  const goOffline = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await api.driver.setStatus(false);
      setSelectedId(null);
      await reload();
    } catch (cause) {
      fail(cause, "Не удалось уйти с линии");
    } finally {
      setBusy(false);
    }
  };

  const accept = async (orderId: string) => {
    setAcceptingId(orderId);
    setActionError(null);
    setNotice(null);
    try {
      await api.driver.accept(orderId);
      setSelectedId(null);
    } catch (cause) {
      fail(cause, "Не удалось принять заказ");
    } finally {
      setAcceptingId(null);
      await reload();
    }
  };

  const act = async (action: DriverAction) => {
    if (!currentOrder) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.driver.action(currentOrder.id, action);
      if (action === "complete") {
        alert("Спасибо за выполненный заказ!");
      }
    } catch (cause) {
      fail(cause, "Не удалось выполнить действие");
    } finally {
      setBusy(false);
      await reload();
    }
  };

  if (!user || !state) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
        {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : <Spinner className="h-8 w-8 text-accent" />}
      </main>
    );
  }

  if (!state.driver.vehicle) {
    return <DriverSetup onComplete={() => window.location.reload()} />;
  }

  if (!state.driver.isApproved) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-surface p-6 text-center">
        <div className="neo-btn p-8 rounded-3xl">
          <div className="w-16 h-16 bg-accent/20 text-accent rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            ⏳
          </div>
          <h1 className="text-2xl font-bold text-ink mb-2">Анкета на модерации</h1>
          <p className="text-muted mb-6">Мы проверяем ваши документы. Обычно это занимает до 24 часов. Пожалуйста, зайдите позже.</p>
        </div>
      </main>
    );
  }

  const summary = currentOrder
    ? { title: driverStatusText(currentOrder.status), subtitle: currentOrder.pickup.address, badge: formatMoney(currentOrder.price) }
    : isOnline
      ? {
          title: "На линии",
          subtitle: available.length > 0 ? `Заказов рядом: ${available.length}` : "Ищем заказы рядом",
          badge: available.length > 0 ? String(available.length) : null,
        }
      : { title: "Вы не на линии", subtitle: "Нажмите, чтобы выйти на линию", badge: null };

  const mapPickup = currentOrder ? currentOrder.pickup : (selected?.pickup ?? null);
  const mapDestination = currentOrder ? currentOrder.destination : (selected?.destination ?? null);
  const fitKey = currentOrder
    ? `order-${currentOrder.id}-${currentOrder.status === "in_progress" ? "ride" : "approach"}`
    : selected
      ? `selected-${selected.id}`
      : "";

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden">
      <div className="absolute inset-0">
        <RideMap
          center={DEFAULT_CENTER}
          pickup={mapPickup}
          destination={mapDestination}
          route={currentOrder?.routeGeometry ?? null}
          userLocation={tracking.position}
          fitKey={fitKey}
          layoutKey={collapsed}
          flyTo={flyTo}
        />
      </div>

      {tracking.position ? (
        <button
          type="button"
          onClick={() => tracking.position && setFlyTo({ point: tracking.position, nonce: Date.now() })}
          className="neo-btn absolute right-4 top-4 z-[1000] flex h-12 w-12 items-center justify-center text-xl"
          aria-label="Моё местоположение"
        >
          ◎
        </button>
      ) : null}

      {error ? (
        <div className="absolute left-4 right-20 top-4 z-[1000]">
          <ErrorBanner message={`Нет связи с сервером: ${error}`} />
        </div>
      ) : null}

      {incomingOrder && (
        <IncomingOrderModal
          order={incomingOrder}
          isAccepting={acceptingId === incomingOrder.id}
          onAccept={() => {
            void accept(incomingOrder.id);
            setIncomingOrder(null);
          }}
          onDecline={() => setIncomingOrder(null)}
        />
      )}

      <CollapsibleSheet
        id="driver-sheet"
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        title={summary.title}
        subtitle={summary.subtitle}
        badge={summary.badge}
        pulse={isOnline && !currentOrder}
        collapseLabel="Свернуть панель водителя"
        expandLabel="Развернуть панель водителя"
        maxHeightClass="max-h-[75dvh]"
        headerExtra={
          <div className="flex items-center gap-2 px-1 text-sm font-bold text-ink">
            {isOnline && !currentOrder ? <span className="pulse-dot inline-block h-3 w-3 rounded-full bg-success" /> : null}
            {currentOrder ? "Текущий заказ" : isOnline ? "На линии" : "Вы не на линии"}
          </div>
        }
        footer={!collapsed ? <BottomNav items={DRIVER_NAV} /> : <div className="safe-bottom" />}
      >
        {notice ? (
          <div className="neo-inset px-4 py-3 text-sm font-semibold text-accent" role="status">
            {notice}
          </div>
        ) : null}
        {isOnline && tracking.error ? <ErrorBanner message={tracking.error} /> : null}
        <ErrorBanner message={actionError} />

        {currentOrder ? (
          <ActiveOrderPanel
            order={currentOrder}
            navigator={user.navigator}
            busy={busy}
            onAction={() => currentOrder.nextAction && void act(currentOrder.nextAction.action)}
            onDecline={() => {
              if (confirm("Отказаться от заказа? Он вернётся в поиск.")) void act("decline");
            }}
          />
        ) : isOnline ? (
          <OnlinePanel
            available={available}
            selectedId={selectedId}
            acceptingId={acceptingId}
            busy={busy}
            onSelect={setSelectedId}
            onAccept={(id) => void accept(id)}
            onGoOffline={() => void goOffline()}
          />
        ) : (
          <OfflinePanel vehicle={state.driver.vehicle} busy={busy} onGoOnline={() => void goOnline()} />
        )}
      </CollapsibleSheet>
    </main>
  );
}
