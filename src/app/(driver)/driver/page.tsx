"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { api, ApiError } from "@/shared/api";
import { useRequireAuth } from "@/shared/session";
import { driverStatusText, type AvailableOrderView } from "@/shared/driver-types";
import { formatMoney } from "@/shared/types";
import type { DriverAction } from "@/core/driver-flow";
import type { LatLng } from "@/core/geo";
import { resolveSheetSwipe } from "@/core/collapsible";
import { GlassCard, RoundAction, TaxiArt, TuberBackdrop, TuberHeader } from "@/core/widgets/TuberUI";
import { BottomNav, DRIVER_NAV, ErrorBanner } from "@/core/widgets/ui";
import { SplashScreen } from "@/core/widgets/SplashScreen";
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
  const router = useRouter();
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
  const sheetStartY = useRef<number | null>(null);

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

  // Свайп шапки сворачивает/разворачивает панель, как в эталоне.
  const onSheetPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    sheetStartY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onSheetPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (sheetStartY.current === null) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const action = resolveSheetSwipe(event.clientY - sheetStartY.current);
    sheetStartY.current = null;
    if (action === "collapse" && !collapsed) setCollapsed(true);
    if (action === "expand" && collapsed) setCollapsed(false);
  };

  if (!user || !state) {
    if (error) {
      return (
        <main className="relative flex min-h-dvh flex-col items-center justify-center gap-4 overflow-hidden px-6">
          <TuberBackdrop />
          <div className="relative z-10 w-full max-w-md"><ErrorBanner message={error} onRetry={() => void reload()} /></div>
        </main>
      );
    }
    return <SplashScreen />;
  }

  if (!state.driver.vehicle) {
    return <DriverSetup onComplete={() => window.location.reload()} />;
  }

  if (!state.driver.isApproved) {
    return (
      <main className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden p-6">
        <TuberBackdrop />
        <GlassCard className="relative z-10 w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#FFC400] bg-[#FFC400]/10 text-3xl">
            ⏳
          </div>
          <h1 className="mb-2 text-2xl font-black text-white">Анкета на модерации</h1>
          <p className="text-sm text-white/70">Мы проверяем ваши документы. Обычно это занимает до 24 часов.</p>
        </GlassCard>
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
    <main className="relative flex h-dvh flex-col overflow-hidden bg-[#07071A] text-white">
      {/* Тёмный фон эталона с синим underglow */}
      <div className="absolute inset-0 z-0">
        <TuberBackdrop />
      </div>

      {/* Карта — тонкий подчинённый слой в нижней части: маршрут остаётся доступным, но не доминирует. */}
      <div className="absolute inset-x-0 bottom-0 z-[1] h-[36%] opacity-[0.24] grayscale-[0.5]">
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

      {/* Оранжевая 3D-машина по центру, частично за glass-панелью */}
      <TaxiArt view="front" className="absolute bottom-[40%] left-1/2 z-[2] h-[32%] w-[78%] -translate-x-1/2" />

      {/* Шапка «‹ Back / рядом / профиль» */}
      <div className="relative z-10">
        <TuberHeader onBack={() => router.back()} onProfile={() => router.push("/driver/settings")} />

        {/* Жёлтый кружок статуса и плашка заработка в glass-стиле */}
        <div className="mt-5 flex items-start justify-between gap-3 px-5">
          <GlassCard className="!rounded-full px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <span
                className={`inline-block h-4 w-4 shrink-0 rounded-full border-2 border-[#FFC400] ${
                  isOnline ? "bg-[#FFC400] shadow-[0_0_14px_rgba(255,196,0,0.9)]" : "bg-transparent"
                }`}
              />
              <div className="leading-tight">
                <div className="text-sm font-extrabold text-white">{isOnline ? "На линии" : "Не на линии"}</div>
                <div className="text-[10px] text-white/60">
                  {currentOrder ? "Активный заказ" : isOnline ? "Приоритет: высокий" : "Приоритет: обычный"}
                </div>
              </div>
            </div>
          </GlassCard>

          {!currentOrder ? (
            <GlassCard className="!rounded-full px-4 py-2.5 text-right">
              <div className="text-sm font-extrabold text-[#FFC400]">{formatMoney(todayEarnings)}</div>
              <div className="text-[10px] text-white/60">за сегодня</div>
            </GlassCard>
          ) : null}
        </div>

        {tracking.position ? (
          <div className="absolute right-5 top-[10rem] z-20">
            <RoundAction
              glyph="◎"
              label="Я здесь"
              onClick={() => tracking.position && setFlyTo({ point: tracking.position, nonce: Date.now() })}
            />
          </div>
        ) : null}

        {error ? (
          <div className="mx-4 mt-4">
            <ErrorBanner message={`Нет связи с сервером: ${error}`} />
          </div>
        ) : null}
      </div>

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
              // Текущий заказ (уже принятый) — стандартный API отказа.
              // Оффер ещё не принят — отдельный API, который записывает отказ в БД
              // и убирает заказ из списка даже после перезагрузки.
              if (declineTargetId === currentOrder?.id) {
                await api.driver.action(declineTargetId, "decline");
              } else {
                await api.driver.declineOffer(declineTargetId);
              }
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

      {/* Нижняя glass-панель водителя. Содержимое остаётся в DOM при сворачивании. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] mt-auto flex flex-col">
        <GlassCard className={`pointer-events-auto mx-3 mb-2 flex flex-col overflow-hidden ${collapsed ? "" : "max-h-[64dvh]"}`}>
          <div
            onPointerDown={onSheetPointerDown}
            onPointerUp={onSheetPointerUp}
            onPointerCancel={(event) => {
              sheetStartY.current = null;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            className="flex touch-pan-x flex-col gap-1.5 px-4 pb-2 pt-3 select-none"
          >
            <div className="mx-auto h-1.5 w-11 rounded-full bg-white/25" aria-hidden="true" />
            <div className="flex items-center justify-between gap-2">
              {collapsed ? (
                <button
                  type="button"
                  aria-expanded={false}
                  aria-controls="driver-sheet-body"
                  onClick={() => setCollapsed(false)}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  {isOnline && !currentOrder ? <span className="pulse-dot inline-block h-3 w-3 shrink-0 rounded-full bg-[#FFC400]" /> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-extrabold text-white">{summary.title}</span>
                    {summary.subtitle ? <span className="block truncate text-xs text-white/60">{summary.subtitle}</span> : null}
                  </span>
                </button>
              ) : (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isOnline && !currentOrder ? <span className="pulse-dot inline-block h-3 w-3 shrink-0 rounded-full bg-[#FFC400]" /> : null}
                    <span className="truncate text-lg font-extrabold text-white">{summary.title}</span>
                  </div>
                  <div className="truncate text-xs text-white/60">{summary.subtitle}</div>
                </div>
              )}

              <button
                type="button"
                id="driver-sheet-toggle"
                aria-label={collapsed ? "Развернуть панель водителя" : "Свернуть панель водителя"}
                aria-expanded={!collapsed}
                aria-controls="driver-sheet-body"
                onClick={() => setCollapsed(!collapsed)}
                className="flex min-h-10 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-[#FFC400] backdrop-blur-xl"
              >
                <span>{collapsed ? "Развернуть" : "Карта"}</span>
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          <div
            id="driver-sheet-body"
            hidden={collapsed}
            data-collapsed={collapsed ? "true" : "false"}
            className={collapsed ? "hidden" : "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4"}
          >
            {notice ? (
              <div className="rounded-2xl border border-[#FFC400]/30 bg-[#FFC400]/10 px-4 py-3 text-sm font-semibold text-[#FFC400]" role="status">
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
          </div>
        </GlassCard>

        {!collapsed ? (
          <div className="pointer-events-auto z-40">
            <BottomNav items={DRIVER_NAV} />
          </div>
        ) : (
          <div className="safe-bottom" />
        )}
      </div>
    </main>
  );
}
