"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { api, ApiError, type AddressSuggestion } from "@/shared/api";
import { useRequireAuth } from "@/shared/session";
import { formatDuration, formatMoney, type EstimateView, type Place } from "@/shared/types";
import type { LatLng } from "@/core/geo";
import { ErrorBanner, Spinner } from "@/core/widgets/ui";
import { SplashScreen } from "@/core/widgets/SplashScreen";
import { BrandMark } from "@/core/widgets/BrandMark";
import { buildHomeCollapsedSummary, resolveSheetSwipe } from "@/core/collapsible";
import { GlassCard, TuberBackdrop, TuberHeader } from "@/core/widgets/TuberUI";
import { AddressInput } from "@/features/addresses/AddressInput";
import { OrderDetailsSheet } from "@/features/ride_order/OrderDetailsSheet";
import { useGeolocation } from "@/features/home/useGeolocation";

const RideMap = dynamic(() => import("@/features/map/RideMap"), { ssr: false });

const DEFAULT_CENTER: LatLng = { latitude: 56.4846, longitude: 84.9476 };
const CATEGORIES = ["ТАКСИ", "ДОСТАВКА"];

/** Круглая кнопка над картой: тонкая синяя рамка и свечение как в эталоне. */
const ROUND_GLOW = {
  border: "1.5px solid #5B8FE8",
  boxShadow: "0 0 18px rgba(91,143,232,0.55), inset 0 0 12px rgba(91,143,232,0.18)",
};

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useRequireAuth();
  const geo = useGeolocation();

  const [pickup, setPickup] = useState<Place | null>(null);
  const [pickupText, setPickupText] = useState("");
  const [destination, setDestination] = useState<Place | null>(null);
  const [destinationText, setDestinationText] = useState("");
  const [estimate, setEstimate] = useState<EstimateView | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState<number | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ point: LatLng; nonce: number } | null>(null);
  const [checkingActive, setCheckingActive] = useState(true);
  const [selectedTariffId, setSelectedTariffId] = useState<string | null>(null);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [category, setCategory] = useState("ТАКСИ");
  const [arrivalTime, setArrivalTime] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Редактирование адресов: панель вытягивается вверх, без отдельного окна.
  const [activeInput, setActiveInput] = useState<"pickup" | "destination" | null>(null);

  const sheetStartYRef = useRef<number | null>(null);
  const panelWrapRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(0);

  // Восстановление активного заказа
  useEffect(() => {
    if (!user) return;
    api.orders
      .active()
      .then(({ orderId }) => {
        if (orderId) router.replace(`/orders/${orderId}`);
        else setCheckingActive(false);
      })
      .catch(() => setCheckingActive(false));
  }, [user, router]);

  // Получение статуса свободных машин
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { count } = await api.system.getStatus();
        setAvailableDrivers(count);
      } catch {
        // Статус необязателен — карта и заказ работают и без него.
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const onLocate = async () => {
    const p = await geo.locate();
    if (p) setFlyTo({ point: p, nonce: Date.now() });
  };

  const applyPickupFromPoint = useCallback(async (p: LatLng) => {
    setEstimate(null);
    try {
      const { item } = await api.geocode.reverse(p.latitude, p.longitude);
      const address = item?.address || "Моё местоположение";
      setPickup({ address, latitude: p.latitude, longitude: p.longitude });
      setPickupText(address);
    } catch {
      const address = "Моё местоположение";
      setPickup({ address, latitude: p.latitude, longitude: p.longitude });
      setPickupText(address);
    }
  }, []);

  // Первичное определение местоположения (при загрузке)
  useEffect(() => {
    if (!user || checkingActive) return;

    // Запрашиваем GPS один раз при загрузке
    geo.locate().then((p) => {
      if (p) {
        setFlyTo({ point: p, nonce: Date.now() });
        if (!pickup) void applyPickupFromPoint(p);
      }
    }).catch((err) => {
      console.error("Ошибка GPS при загрузке:", err);
    });
    // geo и pickup намеренно не в зависимостях: иначе смена точки вызвала бы повторный запрос разрешения.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, checkingActive]);

  const selectPlace = (s: AddressSuggestion, kind: "pickup" | "destination") => {
    const place: Place = { address: s.address, latitude: s.latitude, longitude: s.longitude };
    setEstimate(null);
    if (kind === "pickup") {
      setPickup(place);
      setPickupText(s.address);
    } else {
      setDestination(place);
      setDestinationText(s.address);
    }
    // Центрированием управляет fitBounds по точкам/маршруту с учётом высоты панели,
    // поэтому отдельный flyTo здесь не нужен — он перебил бы центрирование.
    setActiveInput(null); // Закрываем подсказки
  };

  const buildRoute = async () => {
    if (!pickup || !destination) return;
    setError(null);
    setEstimating(true);
    try {
      const res = await api.fare.estimate(pickup, destination);
      setEstimate(res);
      if (res.tariffs.length > 0) setSelectedTariffId(res.tariffs[0].id);
    } catch (err) {
      setEstimate(null);
      setError(err instanceof ApiError ? err.message : "Не удалось рассчитать маршрут");
    } finally {
      setEstimating(false);
    }
  };

  const placeOrder = async () => {
    if (!estimate || !selectedTariffId) return;
    setOrdering(true);
    setError(null);
    try {
      const res = await api.orders.create(estimate.estimateId, selectedTariffId);
      const orderId = res.orderId || (res as any).id;
      if (!orderId) throw new Error("Ошибка сервера");
      router.push(`/orders/${orderId}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Не удалось создать заказ";
      setError(message);
      setOrdering(false);
    }
  };

  const fitKey = useMemo(
    () => (estimate ? `route-${estimate.estimateId}` : pickup && destination ? `pts-${pickup.latitude}-${destination.latitude}` : ""),
    [estimate, pickup, destination],
  );

  // Реальная высота панели — карта центрируется в свободной области выше неё.
  useEffect(() => {
    const node = panelWrapRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0;
      void Promise.resolve().then(() => setPanelHeight(height));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Время прибытия считаем на клиенте, чтобы не ломать гидратацию.
  useEffect(() => {
    void Promise.resolve().then(() => {
      setArrivalTime(
        estimate
          ? new Date(Date.now() + estimate.durationSeconds * 1000).toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : null,
      );
    });
  }, [estimate]);

  const visibleTariffs = useMemo(() => {
    if (!estimate || category === "ДОСТАВКА") return [];
    return estimate.tariffs;
  }, [estimate, category]);

  const chooseCategory = (next: string) => {
    setCategory(next);
    if (next === "ДОСТАВКА") return;
    if (estimate?.tariffs.length && !estimate.tariffs.some((t) => t.id === selectedTariffId)) {
      setSelectedTariffId(estimate.tariffs[0].id);
    }
  };

  // Свайп шапки панели — та же логика, что у общего CollapsibleSheet.
  const onSheetPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    sheetStartYRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onSheetPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (sheetStartYRef.current === null) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const action = resolveSheetSwipe(event.clientY - sheetStartYRef.current);
    sheetStartYRef.current = null;
    if (action === "collapse" && !sheetCollapsed) setSheetCollapsed(true);
    if (action === "expand" && sheetCollapsed) setSheetCollapsed(false);
  };

  const onSheetPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    sheetStartYRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (loading || !user || checkingActive) {
    return <SplashScreen />;
  }

  const selectedTariff = estimate?.tariffs.find((t) => t.id === selectedTariffId);
  const collapsedSummary = buildHomeCollapsedSummary({ pickup, destination, estimate });
  const panelTitle = estimate ? "Маршрут готов" : "Куда поедем?";

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-[#07071A] text-white">
      <TuberBackdrop />

      {/* Карта */}
      <div className="absolute inset-0">
        <RideMap
          center={DEFAULT_CENTER}
          pickup={pickup}
          destination={destination}
          userLocation={geo.position}
          route={estimate?.routeGeometry ?? null}
          pickupDraggable={!estimate}
          onPickupDragEnd={applyPickupFromPoint}
          fitKey={fitKey}
          flyTo={flyTo}
          focusPaddingBottom={panelHeight}
        />
      </div>

      {/* Тонировка карты под тёмную палитру эталона */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(180deg, rgba(7,7,26,0.94) 0%, rgba(7,7,26,0.45) 22%, rgba(7,7,26,0.18) 48%, rgba(7,7,26,0.72) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%]"
        aria-hidden="true"
        style={{
          background: "radial-gradient(ellipse at 50% 100%, rgba(78,143,224,0.55) 0%, rgba(44,93,170,0.32) 45%, rgba(7,7,26,0) 78%)",
        }}
      />

      <TuberHeader
        onBack={() => router.push("/home")}
        onProfile={() => router.push("/settings")}
        brand="рядом"
      />

      {/* Верхний ряд над картой: назад, свободные машины и геолокация. */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+16px)] z-[1000] flex items-center gap-2 px-6">
        <button
          type="button"
          aria-label="Назад к адресам"
          onClick={() => { setEstimate(null); setSelectedTariffId(null); setCategory("ТАКСИ"); }}
          className="pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl text-white backdrop-blur-2xl"
          style={ROUND_GLOW}
        >
          ‹
        </button>

        {availableDrivers !== null && (
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-2xl">
            <Image
              src="/images/taxi-3d-front.jpg"
              alt=""
              width={22}
              height={16}
              unoptimized
              className="h-4 w-auto"
              draggable={false}
            />
            <span className={`h-2.5 w-2.5 rounded-full ${availableDrivers > 0 ? "bg-success" : "bg-danger"}`} aria-hidden="true" />
            {availableDrivers > 0 ? <span className="text-sm font-bold text-white">{availableDrivers}</span> : null}
          </div>
        )}

        <button
          type="button"
          aria-label="Моё местоположение"
          onClick={onLocate}
          className="pointer-events-auto ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl text-white backdrop-blur-2xl"
          style={ROUND_GLOW}
          disabled={geo.loading}
        >
          {geo.loading ? <Spinner className="h-5 w-5 text-[#FFC400]" /> : "◎"}
        </button>
      </div>

      {/* Ошибка расчёта или заказа — видна независимо от состояния нижней панели */}
      {error ? (
        <div className="absolute left-4 right-4 top-[148px] z-[1000]">
          <ErrorBanner message={error} />
        </div>
      ) : null}

      {/* Нижняя glass-панель заказа. При редактировании адресов вытягивается вверх. */}
      <div
        ref={panelWrapRef}
        className={`pointer-events-none relative z-[1000] mt-auto flex flex-col transition-[max-height] duration-300 ${
          activeInput ? "min-h-[62dvh] max-h-[70dvh]" : sheetCollapsed ? "" : "max-h-[62dvh]"
        }`}
      >
        <GlassCard className="pointer-events-auto mx-3 mb-2 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            onPointerDown={onSheetPointerDown}
            onPointerUp={onSheetPointerUp}
            onPointerCancel={onSheetPointerCancel}
            className="flex touch-pan-x flex-col gap-2 px-5 pt-3 select-none"
          >
            <div className="mx-auto h-1.5 w-11 rounded-full bg-white/25" aria-hidden="true" />
            <div className="flex items-center justify-between gap-3 pb-1">
              {sheetCollapsed ? (
                <button
                  type="button"
                  aria-expanded={false}
                  aria-controls="home-order-sheet-body"
                  onClick={() => setSheetCollapsed(false)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  {collapsedSummary.badge ? (
                    <span className="shrink-0 rounded-full bg-[#FFC400] px-2.5 py-1 text-xs font-bold text-[#07071A]">
                      {collapsedSummary.badge}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-white">{collapsedSummary.title}</span>
                    {collapsedSummary.subtitle ? (
                      <span className="block truncate text-xs text-white/55">{collapsedSummary.subtitle}</span>
                    ) : null}
                  </span>
                </button>
              ) : (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[17px] font-bold text-white">
                    {activeInput ? "Куда поедем?" : panelTitle}
                  </div>
                  {arrivalTime && !activeInput ? (
                    <div className="text-[12px] text-white/55">прибытие в {arrivalTime}</div>
                  ) : null}
                </div>
              )}

              <button
                type="button"
                id="home-order-sheet-toggle"
                aria-label={activeInput ? "Закрыть ввод адресов" : sheetCollapsed ? "Развернуть панель" : "Свернуть панель"}
                aria-expanded={activeInput ? true : !sheetCollapsed}
                aria-controls="home-order-sheet-body"
                onClick={() => (activeInput ? setActiveInput(null) : setSheetCollapsed(!sheetCollapsed))}
                className="flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-[#FFC400]"
              >
                <span>{activeInput ? "Готово" : sheetCollapsed ? "Развернуть" : "Карта"}</span>
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${sheetCollapsed ? "rotate-180" : ""}`}
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
            id="home-order-sheet-body"
            hidden={sheetCollapsed}
            className={sheetCollapsed ? "hidden" : "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4"}
          >
            {geo.error && !pickup && !estimate && (
              <div className="flex items-center justify-between rounded-2xl border border-[#FFC400]/30 bg-[#FFC400]/10 p-3 text-sm text-[#FFC400]">
                <span>Не удалось определить местоположение</span>
                <button onClick={onLocate} className="font-bold underline">Повторить</button>
              </div>
            )}

            {/* Режим ввода адресов — панель вытянулась вверх, всё в одном месте */}
            {activeInput ? (
              <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="ml-2 text-xs font-semibold text-white/60">Точка посадки</span>
                  <AddressInput
                    label=""
                    icon="●"
                    placeholder="Адрес отправления"
                    value={pickupText}
                    near={geo.position ?? pickup}
                    onTextChange={(t) => { setPickupText(t); setEstimate(null); }}
                    onSelect={(s) => selectPlace(s, "pickup")}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="ml-2 text-xs font-semibold text-white/60">Куда</span>
                  <AddressInput
                    label=""
                    icon="■"
                    placeholder="Адрес назначения"
                    value={destinationText}
                    near={pickup ?? geo.position}
                    onTextChange={(t) => { setDestinationText(t); setEstimate(null); }}
                    onSelect={(s) => selectPlace(s, "destination")}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { onLocate(); setActiveInput(null); }}
                  className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-3 text-left active:bg-white/10"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10">📍</span>
                  <span>
                    <span className="block font-semibold text-white">Ваше местоположение</span>
                    <span className="block text-xs text-white/55">Определим по GPS</span>
                  </span>
                </button>
              </div>
            ) : (
              <>
            {/* Адреса: жёлтые маркеры А/Б и крупный жирный текст */}
            <div className="relative flex flex-col">
              <span className="absolute bottom-7 left-[6px] top-7 w-px bg-white/25" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setActiveInput("pickup")}
                className="relative flex items-center gap-3 py-2 text-left"
              >
                <span className="h-[14px] w-[14px] shrink-0 rounded-full bg-[#FFC400] ring-4 ring-[#FFC400]/20" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[18px] font-bold text-white">
                  {pickupText || "Адрес отправления"}
                </span>
                <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white/85">
                  Подъезд
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveInput("destination")}
                className="relative flex items-center gap-3 py-2 text-left"
              >
                <span className="h-[14px] w-[14px] shrink-0 rounded-full bg-[#FFC400] ring-4 ring-[#FFC400]/20" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[18px] font-bold text-white">
                  {destinationText || "Куда едем?"}
                  {estimate ? <span className="font-normal text-white/55"> · {formatDuration(estimate.durationSeconds)}</span> : null}
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xl font-bold text-white">
                  +
                </span>
              </button>
            </div>

            {/* Категории тарифов */}
            <div className="flex gap-6 border-b border-white/15">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => chooseCategory(c)}
                  className={`relative pb-3 text-[15px] font-bold tracking-wide transition-colors ${
                    category === c ? "text-[#FFC400]" : "text-white/45"
                  }`}
                >
                  {c}
                  {category === c ? (
                    <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-[#FFC400]" aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </div>

            {/* Тарифы */}
            {!estimate ? (
              <p className="py-3 text-center text-sm text-white/55">
                Укажите адреса и нажмите «Построить маршрут», чтобы увидеть тарифы
              </p>
            ) : visibleTariffs.length === 0 ? (
              <p className="py-3 text-center text-sm text-white/55">Для этой категории тарифов пока нет предложений</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                {visibleTariffs.map((t) => {
                  const selected = selectedTariffId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTariffId(t.id)}
                      className={`flex min-w-[134px] flex-col items-start gap-1 rounded-[22px] border p-3 text-left backdrop-blur-xl transition-all ${
                        selected
                          ? "border-[#FFC400] bg-[#FFC400]/10 shadow-[0_0_20px_rgba(255,196,0,0.18)]"
                          : "border-white/20 bg-white/10"
                      }`}
                    >
                      <span className="relative h-12 w-24 self-center">
                        <Image
                          src="/images/taxi-3d-front.jpg"
                          alt=""
                          fill
                          unoptimized
                          className="object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.4)]"
                          draggable={false}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="rounded-full bg-[#FFC400] px-2.5 py-0.5 text-xs font-bold text-[#07071A]">
                        {formatDuration(t.pickupEtaSeconds)}
                      </span>
                      <span className="mt-0.5 text-sm font-semibold text-white/90">{t.name}</span>
                      <span className="text-xl font-bold text-white">
                        {selected ? "⚡ " : ""}
                        {formatMoney(t.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
              </>
            )}
          </div>
        </GlassCard>

        {/* Нижняя панель действий */}
        {sheetCollapsed || activeInput ? null : (
          <GlassCard className="pointer-events-auto mx-3 mb-3 flex items-center gap-3 p-3">
            <BrandMark className="h-12 w-12 shrink-0" />
            <button
              type="button"
              onClick={estimate ? placeOrder : buildRoute}
              disabled={estimate ? !selectedTariff || ordering : !pickup || !destination || estimating}
              className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-[25px] bg-[#FFC400] text-[17px] font-bold text-[#07071A] shadow-[0_8px_24px_rgba(255,196,0,0.35)] transition active:scale-[0.99] disabled:opacity-50"
            >
              {estimate ? (ordering ? <Spinner className="h-5 w-5" /> : null) : estimating ? <Spinner className="h-5 w-5" /> : null}
              {estimate ? "Заказать" : "Построить маршрут"}
            </button>
            <button
              type="button"
              aria-label="Детали заказа"
              disabled={!estimate}
              onClick={() => setDetailsOpen(true)}
              className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-2xl disabled:opacity-40"
              style={ROUND_GLOW}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path d="M4 7h10M18 7h2M4 17h2M10 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="16" cy="7" r="2.5" stroke="currentColor" strokeWidth="2" />
                <circle cx="8" cy="17" r="2.5" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </GlassCard>
        )}
      </div>

      <OrderDetailsSheet
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        pickupText={pickupText}
        destinationText={destinationText}
        tariff={selectedTariff ?? null}
        onOrder={placeOrder}
        ordering={ordering}
      />
    </main>
  );
}
