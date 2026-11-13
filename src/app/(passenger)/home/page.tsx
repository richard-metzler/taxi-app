"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, type AddressSuggestion } from "@/shared/api";
import { useRequireAuth } from "@/shared/session";
import { formatDistance, formatDuration, formatMoney, type EstimateView, type Place } from "@/shared/types";
import type { LatLng } from "@/core/geo";
import { Button, Spinner } from "@/core/widgets/ui";
import { AddressInput } from "@/features/addresses/AddressInput";
import { useGeolocation } from "@/features/home/useGeolocation";

const RideMap = dynamic(() => import("@/features/map/RideMap"), { ssr: false });

const DEFAULT_CENTER: LatLng = { latitude: 56.4846, longitude: 84.9476 };

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
  
  // Состояния для фокуса и списка подсказок
  const [activeInput, setActiveInput] = useState<"pickup" | "destination" | null>(null);

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
      } catch (e) {}
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

  // Первичное определение местоположения
  useEffect(() => {
    if (!user || checkingActive) return;
    geo.locate().then((p) => {
      if (p) {
        setFlyTo({ point: p, nonce: Date.now() });
        if (!pickup) void applyPickupFromPoint(p);
      }
    });
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

  if (loading || !user || checkingActive) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  const selectedTariff = estimate?.tariffs.find((t) => t.id === selectedTariffId);

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

      {/* Кнопка геолокации */}
      <button
        onClick={onLocate}
        className="neo-btn absolute right-4 top-4 z-[1000] flex h-12 w-12 items-center justify-center text-xl"
      >
        ◎
      </button>

      {/* Панель ввода (поднимается вверх) */}
      <div className={`absolute left-0 right-0 z-[1000] flex flex-col transition-all duration-300 ${
        activeInput ? "top-0 bottom-0 bg-[#F4F6F9]" : "bottom-0 rounded-t-3xl bg-[#F4F6F9] shadow-[0_-10px_40px_rgba(0,0,0,0.1)]"
      }`}>
        {activeInput ? (
          // Состояние ввода: панель на весь экран
          <div className="flex h-full flex-col bg-[#F4F6F9]">
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
        ) : (
          // Состояние без ввода: нижняя панель
          <div className="flex flex-col gap-4 p-4">
            {!estimate ? (
              <div 
                className="flex flex-col gap-3"
                onClick={() => setActiveInput("pickup")}
              >
                <div className="neo-inset flex items-center gap-3 rounded-2xl bg-white p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-accent">●</div>
                  <div className="flex-1 text-ink">{pickupText || "Откуда поедем?"}</div>
                </div>
                <div className="neo-inset flex items-center gap-3 rounded-2xl bg-white p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/20 text-muted">■</div>
                  <div className="flex-1 text-ink">{destinationText || "Куда поедем?"}</div>
                </div>
                <Button variant="primary" onClick={buildRoute} loading={estimating} disabled={!pickup || !destination}>
                  Построить маршрут
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between text-sm text-muted">
                  <span>{formatDistance(estimate.distanceMeters)} · {formatDuration(estimate.durationSeconds)}</span>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {estimate.tariffs.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTariffId(t.id)}
                      className={`flex min-w-[120px] flex-col items-start gap-1 rounded-2xl border p-3 transition-all ${
                        selectedTariffId === t.id 
                          ? "border-accent bg-accent/5 shadow-sm" 
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-1 text-sm font-semibold text-ink">
                        <span>🚕</span>
                        {t.name}
                      </div>
                      <div className="text-xs text-muted">{formatDuration(t.pickupEtaSeconds)}</div>
                      <div className="text-lg font-bold text-ink">{formatMoney(t.price)}</div>
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => setEstimate(null)}>
                    Назад
                  </Button>
                  <Button className="flex-[2]" variant="primary" onClick={placeOrder} loading={ordering} disabled={!selectedTariff}>
                    Заказать {selectedTariff ? `за ${formatMoney(selectedTariff.price)}` : ""}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
