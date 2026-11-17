"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { useRequireAuth } from "@/shared/session";
import { driverStatusText, type AvailableOrderView } from "@/shared/driver-types";
import { formatMoney } from "@/shared/types";
import type { DriverAction } from "@/core/driver-flow";
import type { LatLng } from "@/core/geo";
import { BrandMark } from "@/core/widgets/BrandMark";
import { CollapsibleSheet } from "@/core/widgets/CollapsibleSheet";
import { BottomNav, DRIVER_NAV, ErrorBanner, Spinner } from "@/core/widgets/ui";
import { useGeolocation } from "@/features/home/useGeolocation";
import { useDriverDashboard } from "@/features/driver/useDriverDashboard";
import { useDriverLocation } from "@/features/driver/useDriverLocation";
import { ActiveOrderPanel, OfflinePanel, OnlinePanel } from "@/features/driver/DriverPanels";
import { DriverSetup } from "@/features/driver/DriverSetup";
import { IncomingOrderModal } from "@/features/driver/IncomingOrderModal";
import { ConfirmModal } from "@/core/widgets/ConfirmModal";

const RideMap = dynamic(() => import("@/features/map/RideMap"), { ssr: false });

const DEFAULT_CENTER: LatLng = { latitude: 56.4846, longitude: 84.9476 };

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ point: LatLng; nonce: number } | null>(null);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const previousOrderId = useRef<string | null>(null);
  const centered = useRef(false);

  const [incomingOrder, setIncomingOrder] = useState<AvailableOrderView | null>(null);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineTargetId, setDeclineTargetId] = useState<string | null>(null);
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(() => new Set());

  const currentOrder = state?.currentOrder ?? null;
  // Актуальные значения для обработчика размонтирования (эффект с пустыми зависимостями).
  const isOnlineRef = useRef(isOnline);
  const currentOrderRef = useRef(currentOrder);
  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);
  useEffect(() => {
    currentOrderRef.current = currentOrder;
  }, [currentOrder]);
  const selected = available.find((order) => order.id === selectedId) ?? null;
  const filteredAvailable = available.filter((o) => !declinedIds.has(o.id));

  // Заработок за сегодня — только сумма из уже загруженных поездок, без платежей и выплат.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void Promise.resolve().then(async () => {
      try {
        const { items } = await api.driver.history();
        if (cancelled) return;
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const total = items
          .filter((trip) => trip.status === "completed" && new Date(trip.createdAt) >= startOfToday)
          .reduce((sum, trip) => sum + trip.price, 0);
        setTodayEarnings(total);
      } catch {
        // Плашка заработка необязательна: при ошибке остаётся 0 ₽.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Новый заказ раскрывает панель; исчезновение заказа объясняется пользователю.
  useEffect(() => {
    const id = currentOrder?.id ?? null;
    if (id) {
      const isFirstOrder = !previousOrderId.current;
      void Promise.resolve().then(() => {
        setNotice(null);
        if (isFirstOrder) setCollapsed(false);
      });
    }
    if (!id && previousOrderId.current) {
      void Promise.resolve().then(() => setNotice("Заказ закрыт: поездка завершена или пассажир отменил заказ."));
      const timer = setTimeout(() => setNotice(null), 5000);
      return () => clearTimeout(timer);
    }
    previousOrderId.current = id;
  }, [currentOrder?.id]);

  // Первое определение позиции — центрируем карту.
  useEffect(() => {
    if (tracking.position && !centered.current) {
      const point = tracking.position;
      centered.current = true;
      void Promise.resolve().then(() => setFlyTo({ point, nonce: Date.now() }));
    }
  }, [tracking.position]);

  const fail = (cause: unknown, fallback: string) =>
    setActionError(cause instanceof ApiError ? cause.message : fallback);

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
    setNotice(null);
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
      setIncomingOrder(null);
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
    setNotice(null);
    try {
      await api.driver.action(currentOrder.id, action);
    } catch (cause) {
      fail(cause, "Не удалось выполнить действие");
    } finally {
      setBusy(false);
      await reload();
    }
  };

  // Логика входящего заказа
  useEffect(() => {
    void Promise.resolve().then(() => {
      if (filteredAvailable.length > 0 && !currentOrder && !incomingOrder) {
        const nextOrder = filteredAvailable[0];
        setIncomingOrder(nextOrder);
      }
      if (incomingOrder && !filteredAvailable.find((o) => o.id === incomingOrder.id)) {
        setIncomingOrder(null);
      }
    });
  }, [filteredAvailable, currentOrder, incomingOrder]);

  // При уходе со страницы (размонтировании) снимаем водителя с линии.
  // Эффект монтируется один раз: переключение isOnline и StrictMode не снимают с линии.
  // Во время активного заказа сервер всё равно запрещает уход с линии, поэтому запрос не шлём.
  useEffect(() => {
    return () => {
      if (!isOnlineRef.current || currentOrderRef.current) return;
      // Вызываем API без await (fire-and-forget), чтобы не блокировать переход
      import("@/shared/api")
        .then(({ api }) => {
          api.driver.setStatus(false).catch(() => {});
        })
        .catch(() => {});
    };
  }, []);

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
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-bg p-6 text-center">
        <div className="neo-btn p-8 rounded-3xl">
          <div className="w-16 h-16 bg-accent/20 text-accent rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            ⏳
          </div>
          <h1 className="text-2xl font-bold text-ink mb-2">Анкета на модерации</h1>
          <p className="text-muted mb-6">Мы проверяем ваши документы. Обычно это занимает до 24 часов.</p>
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
      : { title: "Вы не на линии", subtitle: "Выйдите на линию, чтобы получать заказы", badge: null };

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

      {/* Статус/приоритет слева и плашка аватара с заработком справа.
          Плашка заработка скрывается во время активного заказа. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-start justify-between gap-3 p-4">
        <div
          className="pointer-events-auto neo flex min-h-12 items-center gap-2.5 rounded-full px-3.5 py-2"
          aria-label={isOnline ? "На линии" : "Не на линии"}
        >
          <span className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full ${isOnline ? "pulse-dot bg-accent" : "bg-muted"}`} />
          <div className="leading-tight">
            <div className="text-sm font-bold text-ink">{isOnline ? "На линии" : "Не на линии"}</div>
            <div className="text-[10px] text-muted">
              {currentOrder ? "Активный заказ" : isOnline ? "Приоритет: высокий" : "Приоритет: обычный"}
            </div>
          </div>
        </div>

        {!currentOrder ? (
          <div className="pointer-events-auto neo flex min-h-12 items-center gap-2.5 rounded-full px-3 py-2" aria-label="Заработок за сегодня">
            <BrandMark className="h-9 w-9" />
            <div className="pr-1 text-right leading-tight">
              <div className="text-sm font-bold text-accent">{formatMoney(todayEarnings)}</div>
              <div className="text-[10px] text-muted">за сегодня</div>
            </div>
          </div>
        ) : null}
      </div>

      {tracking.position ? (
        <button
          type="button"
          onClick={() => tracking.position && setFlyTo({ point: tracking.position, nonce: Date.now() })}
          className="neo-btn absolute right-4 top-[5.5rem] z-[1000] flex h-12 w-12 items-center justify-center text-xl"
          aria-label="Моё местоположение"
        >
          ◎
        </button>
      ) : null}

      {error ? (
        <div className="absolute left-4 right-20 top-[5.5rem] z-[1000]">
          <ErrorBanner message={`Нет связи с сервером: ${error}`} />
        </div>
      ) : null}

      {/* Входящий заказ (модалка) */}
      {incomingOrder && (
        <IncomingOrderModal
          order={incomingOrder}
          isAccepting={acceptingId === incomingOrder.id}
          onAccept={() => {
            void accept(incomingOrder.id);
            setIncomingOrder(null);
          }}
          onDecline={() => {
            setDeclineTargetId(incomingOrder.id);
            setIncomingOrder(null);
            setDeclineModalOpen(true);
          }}
        />
      )}

      {/* Модалка подтверждения отказа */}
      <ConfirmModal
        isOpen={declineModalOpen}
        title="Отменить заказ?"
        message="Вы уверены, что хотите отказаться от этого заказа?"
        confirmText="Да, отказаться"
        cancelText="Нет"
        isDestructive={true}
        onConfirm={async () => {
          if (declineTargetId) {
            try {
              // Если это текущий заказ (уже принятый), вызываем API отказа
              if (declineTargetId === currentOrder?.id) {
                await api.driver.action(declineTargetId, "decline");
              }
              // В любом случае скрываем заказ локально
              setDeclinedIds((current) => new Set(current).add(declineTargetId));
              setIncomingOrder(null);
              await reload();
            } catch (e) {
              console.error("Ошибка отказа:", e);
            }
          }
          setDeclineModalOpen(false);
          setDeclineTargetId(null);
        }}
        onCancel={() => setDeclineModalOpen(false)}
      />

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
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            {isOnline && !currentOrder ? <span className="pulse-dot inline-block h-3 w-3 rounded-full bg-accent" /> : null}
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
              setDeclineTargetId(currentOrder.id);
              setDeclineModalOpen(true);
            }}
          />
        ) : isOnline ? (
          <OnlinePanel
            available={filteredAvailable}
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
