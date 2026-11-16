"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, type AddressSuggestion } from "@/shared/api";
import { useRequireAuth } from "@/shared/session";
import { formatDuration, formatMoney, type EstimateView, type Place } from "@/shared/types";
import type { LatLng } from "@/core/geo";
import { Button, ErrorBanner, Spinner } from "@/core/widgets/ui";
import { AppLogo } from "@/core/widgets/AppLogo";
import { CollapsibleSheet } from "@/core/widgets/CollapsibleSheet";
import { buildHomeCollapsedSummary } from "@/core/collapsible";
import { AddressInput } from "@/features/addresses/AddressInput";
import { useGeolocation } from "@/features/home/useGeolocation";

const RideMap = dynamic(() => import("@/features/map/RideMap"), { ssr: false });

const DEFAULT_CENTER: LatLng = { latitude: 56.4846, longitude: 84.9476 };

/** Миниатюрная машина для карточки тарифа. */
function TariffCar({ tone }: { tone: "yellow" | "silver" | "dark" }) {
  const color = tone === "yellow" ? "#FFC72C" : tone === "silver" ? "#B9C3CE" : "#263445";
  return (
    <svg viewBox="0 0 64 32" className="h-5 w-12 shrink-0" aria-hidden="true">
      <path
        d="M5 22h54v-5c0-3-2-5-5-5H43l-6-6H18c-4 0-7 3-8 7l-2 6v3z"
        fill={color}
      />
      <path d="M21 8h15l4 5H18l3-5z" fill="#fff" opacity="0.55" />
      <circle cx="17" cy="23" r="5" fill="#263445" />
      <circle cx="17" cy="23" r="2" fill="#c6ccd4" />
      <circle cx="47" cy="23" r="5" fill="#263445" />
      <circle cx="47" cy="23" r="2" fill="#c6ccd4" />
    </svg>
  );
}

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

  // Состояния для фокуса и списка подсказок
  const [activeInput, setActiveInput] = useState<"pickup" | "destination" | null>(null);

  const CATEGORIES = ["ТАКСИ", "ДОСТАВКА"];

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
    setFlyTo({ point: place, nonce: Date.now() });
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

  if (loading || !user || checkingActive) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-surface">
        {/* Логотип */}
        <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-500">
          <AppLogo className="h-auto w-56 max-w-full" />
        </div>

        {/* Кружок загрузки (с задержкой появления) */}
        <div className="animate-in fade-in duration-1000 delay-500">
          <Spinner className="h-8 w-8 text-accent" />
        </div>
      </main>
    );
  }

  const selectedTariff = estimate?.tariffs.find((t) => t.id === selectedTariffId);
  const collapsedSummary = buildHomeCollapsedSummary({ pickup, destination, estimate });
  const panelTitle = estimate ? "Маршрут готов" : "Куда поедем?";

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-surface">
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
        />
      </div>

      {/* Плашка свободных машин */}
      {availableDrivers !== null && !activeInput && (
        <div className="absolute left-4 top-4 z-[1000] flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 shadow-lg backdrop-blur-md border border-gray-200">
          <span className="text-2xl leading-none">🚕</span>
          <div className={`h-3.5 w-3.5 rounded-full ${availableDrivers > 0 ? "bg-green-500" : "bg-red-500"}`} />
          {availableDrivers > 0 && <span className="font-bold text-black">{availableDrivers}</span>}
        </div>
      )}

      {/* Время прибытия на карте */}
      {arrivalTime && !activeInput && (
        <div className="absolute right-4 top-[22%] z-[1000] rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-ink shadow-lg backdrop-blur-md">
          прибытие в {arrivalTime}
        </div>
      )}

      {/* Время подачи у точки посадки */}
      {estimate && !activeInput && (
        <div className="absolute left-4 top-[34%] z-[1000] flex flex-col items-center rounded-2xl bg-[#FFA000] px-3 py-2 text-white shadow-lg">
          <span className="text-2xl font-black leading-none">
            {Math.max(1, Math.round((estimate.tariffs.find((t) => t.id === selectedTariffId)?.pickupEtaSeconds ?? 300) / 60))}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide">мин</span>
        </div>
      )}

      {/* Кнопки поверх карты: назад и геолокация */}
      {!activeInput && (
        <div
          className={`pointer-events-none absolute inset-x-0 z-[1000] flex items-center justify-between px-4 transition-all duration-200 ${
            sheetCollapsed ? "bottom-[14dvh]" : "bottom-[54dvh]"
          }`}
        >
          <button
            type="button"
            aria-label="Назад к адресам"
            onClick={() => { setEstimate(null); setSelectedTariffId(null); setCategory("ТАКСИ"); }}
            className="neo-btn pointer-events-auto flex h-12 w-12 items-center justify-center text-2xl text-ink"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Моё местоположение"
            onClick={onLocate}
            className="neo-btn pointer-events-auto flex h-12 w-12 items-center justify-center text-xl"
            disabled={geo.loading}
          >
            {geo.loading ? <Spinner className="h-5 w-5 text-accent" /> : "◎"}
          </button>
        </div>
      )}

      {/* Ошибка расчёта или заказа — видна независимо от состояния нижней панели */}
      {error ? (
        <div className="absolute left-3 right-3 top-16 z-[1000]">
          <ErrorBanner message={error} />
        </div>
      ) : null}

      {/* Полноэкранный режим ввода адресов */}
      {activeInput ? (
        <div className="absolute inset-0 z-[1500] flex h-full flex-col bg-[#F4F6F9]">
          <div className="flex items-center justify-between p-4 pb-2">
            <button onClick={() => setActiveInput(null)} className="text-2xl text-ink">←</button>
            <h2 className="text-lg font-bold text-ink">Куда поедем?</h2>
            <div className="w-6" />
          </div>

          <div className="flex flex-col gap-3 px-4 pb-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted ml-2">Точка посадки</span>
              <AddressInput
                label=""
                icon="●"
                placeholder="Адрес отправления"
                value={pickupText}
                near={geo.position ?? pickup}
                onTextChange={(t) => { setPickupText(t); setEstimate(null); }}
                onSelect={(s) => { selectPlace(s, "pickup"); setActiveInput(null); }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted ml-2">Куда</span>
              <AddressInput
                label=""
                icon="■"
                placeholder="Адрес назначения"
                value={destinationText}
                near={pickup ?? geo.position}
                onTextChange={(t) => { setDestinationText(t); setEstimate(null); }}
                onSelect={(s) => { selectPlace(s, "destination"); setActiveInput(null); }}
              />
            </div>
          </div>

          {/* Список подсказок (рендерится внутри AddressInput) */}
          <div className="flex-1 overflow-y-auto bg-white rounded-t-3xl shadow-lg">
            <button
              className="flex w-full items-center gap-3 border-b border-gray-100 p-4 text-left active:bg-gray-50"
              onClick={() => { onLocate(); setActiveInput(null); }}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500">📍</div>
              <div>
                <div className="font-semibold text-ink">Ваше местоположение</div>
                <div className="text-xs text-muted">Определим по GPS</div>
              </div>
            </button>
          </div>
        </div>
      ) : null}

      {/* Сворачиваемая нижняя панель заказа. Содержимое остаётся в DOM при сворачивании. */}
      <CollapsibleSheet
        id="home-order-sheet"
        collapsed={sheetCollapsed}
        onCollapsedChange={setSheetCollapsed}
        title={collapsedSummary.title}
        subtitle={collapsedSummary.subtitle}
        badge={collapsedSummary.badge}
        maxHeightClass="max-h-[56dvh]"
        headerExtra={<div className="truncate text-sm font-bold text-ink">{panelTitle}</div>}
        footer={
          sheetCollapsed ? null : (
            <div className="neo pointer-events-auto mx-3 mb-2 flex items-center gap-2 p-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFA000] text-xl font-black text-white">
                Т
              </div>
              <Button
                variant="primary"
                className="min-h-14 flex-1 text-lg"
                onClick={estimate ? placeOrder : buildRoute}
                loading={estimate ? ordering : estimating}
                disabled={estimate ? !selectedTariff : !pickup || !destination}
              >
                {estimate ? "Заказать" : "Построить маршрут"}
              </Button>
              <button
                type="button"
                aria-label="Настройки заказа"
                onClick={() => router.push("/settings")}
                className="neo-btn flex h-12 w-12 shrink-0 items-center justify-center text-ink"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                  <path d="M4 7h10M18 7h2M4 17h2M10 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="16" cy="7" r="2.5" stroke="currentColor" strokeWidth="2" />
                  <circle cx="8" cy="17" r="2.5" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
            </div>
          )
        }
      >
        {geo.error && !pickup && !estimate && (
          <div className="rounded-xl bg-orange-50 p-3 text-sm text-orange-700 flex items-center justify-between shadow-sm border border-orange-100">
            <span>Не удалось определить местоположение</span>
            <button onClick={onLocate} className="font-bold underline text-orange-800">Повторить</button>
          </div>
        )}

        {/* Адреса: строка посадки и строка назначения */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setActiveInput("pickup")}
            className="flex items-center gap-3 py-2 text-left"
          >
            <span className="text-xl" aria-hidden="true">🚶</span>
            <span className="min-w-0 flex-1 truncate text-lg font-semibold text-ink">
              {pickupText || "Адрес отправления"}
            </span>
            <span className="shrink-0 rounded-full bg-muted/15 px-3 py-1.5 text-sm font-semibold text-muted">Подъезд</span>
          </button>
          <div className="h-px bg-muted/20" />
          <button
            type="button"
            onClick={() => setActiveInput("destination")}
            className="flex items-center gap-3 py-2 text-left"
          >
            <span className="text-xl" aria-hidden="true">🚶</span>
            <span className="min-w-0 flex-1 truncate text-lg font-semibold text-ink">
              {destinationText || "Куда едем?"}
              {estimate ? <span className="font-normal text-muted"> · {formatDuration(estimate.durationSeconds)}</span> : null}
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/15 text-xl font-bold text-muted">+</span>
          </button>
        </div>

        {/* Категории тарифов */}
        <div className="flex gap-4 overflow-x-auto border-b border-muted/15 scrollbar-hide">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => chooseCategory(c)}
              className={`shrink-0 border-b-2 pb-2 text-sm font-bold uppercase tracking-wide transition-colors ${
                category === c ? "border-accent text-ink" : "border-transparent text-muted/60"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Тарифы */}
        {!estimate ? (
          <p className="py-4 text-center text-sm text-muted">
            Укажите адреса и нажмите «Построить маршрут», чтобы увидеть тарифы
          </p>
        ) : visibleTariffs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">Для этой категории тарифов пока нет предложений</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {visibleTariffs.map((t, index) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTariffId(t.id)}
                className={`flex min-w-[118px] flex-col items-start gap-0.5 rounded-2xl p-2.5 text-left transition-all ${
                  selectedTariffId === t.id ? "neo-inset" : "bg-white/60"
                }`}
              >
                <TariffCar tone={index === 0 ? "yellow" : index === 1 ? "silver" : "dark"} />
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">
                  {formatDuration(t.pickupEtaSeconds)}
                </span>
                <span className="text-sm font-semibold text-ink">{t.name}</span>
                <span className="text-lg font-bold text-ink">
                  {selectedTariffId === t.id ? "⚡" : ""}
                  {formatMoney(t.price)}
                </span>
              </button>
            ))}
          </div>
        )}
      </CollapsibleSheet>
    </main>
  );
}
