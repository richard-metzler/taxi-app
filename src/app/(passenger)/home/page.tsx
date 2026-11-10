"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/shared/api";
import type { EstimateView } from "@/shared/types";
import { AddressInput } from "@/features/addresses/AddressInput";
import { Button } from "@/core/widgets/ui";
import RideMap from "@/features/map/RideMap";
import { useGeolocation } from "@/features/home/useGeolocation";
import { CollapsibleSheet } from "@/core/widgets/CollapsibleSheet";

export default function HomePage() {
  const router = useRouter();
  const geo = useGeolocation();
  
  const [pickup, setPickup] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [pickupText, setPickupText] = useState("");
  const [destinationText, setDestinationText] = useState("");
  
  const [estimate, setEstimate] = useState<EstimateView | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);

  // Состояние для плашки свободных машин
  const [availableDrivers, setAvailableDrivers] = useState<number | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { count } = await api.system.getStatus();
        setAvailableDrivers(count);
      } catch (e) {
        console.error("Не удалось узнать количество машин");
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Автоматически подставляем геопозицию в "Откуда", если пользователь еще ничего не ввел
  useEffect(() => {
    if (geo.position && !pickup && !pickupText) {
      const timer = setTimeout(async () => {
        try {
          const { item } = await api.geocode.reverse(geo.position!.latitude, geo.position!.longitude);
          if (item) {
            setPickup(item);
            setPickupText(item.address);
          }
        } catch (e) {
          console.error("Не удалось определить адрес");
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [geo.position, pickup, pickupText]);

  const handleEstimate = async () => {
    if (!pickup || !destination) {
      setError("Пожалуйста, выберите адреса из списка подсказок");
      return;
    }
    setEstimating(true);
    setError(null);
    try {
      const res = await api.fare.estimate(pickup, destination);
      setEstimate(res);
      setSelected(res.tariffs[0]);
      setSheetCollapsed(false); // Разворачиваем шторку, чтобы показать цену
    } catch (err) {
      setEstimate(null);
      setError(err instanceof ApiError ? err.message : "Не удалось рассчитать маршрут");
    } finally {
      setEstimating(false);
    }
  };

  const handleOrder = async () => {
    if (!estimate || !selected) return;
    setOrdering(true);
    setError(null);
    try {
      const res = await api.orders.create(estimate.estimateId, selected.id);
      if (!res.orderId) throw new Error("Сервер не вернул ID заказа");
      router.push(`/orders/${res.orderId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось создать заказ");
    } finally {
      setOrdering(false);
    }
  };

  return (
    <main className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-surface">
      {/* Карта */}
      <div className="absolute inset-0 z-0">
        <RideMap
          center={pickup || geo.position || { latitude: 56.4846, longitude: 84.9476 }}
          pickup={pickup}
          destination={destination}
          userLocation={geo.position}
          fitKey={estimate ? estimate.estimateId : (pickup ? "pickup" : "")}
          layoutKey={!sheetCollapsed}
          className="h-full w-full"
        />
      </div>

      {/* Плашка со свободными машинами (поверх всего) */}
      {availableDrivers !== null && (
        <div className="absolute left-4 top-4 z-[9999] flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 shadow-lg backdrop-blur-md border border-gray-200">
          <span className="text-2xl leading-none">🚕</span>
          <div className={`h-3.5 w-3.5 rounded-full ${availableDrivers > 0 ? "bg-green-500" : "bg-red-500"}`} />
          {availableDrivers > 0 && (
            <span className="font-bold text-black">{availableDrivers}</span>
          )}
        </div>
      )}

      {/* Шторка */}
      <CollapsibleSheet
        id="passenger-sheet"
        collapsed={sheetCollapsed}
        onCollapsedChange={setSheetCollapsed}
        title={estimate ? `Маршрут готов · ${estimate.tariffs[0].price / 100} ₽` : "Куда поедем?"}
      >
        <div className="flex flex-col gap-4 pb-4">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>}

          <AddressInput
            label="Откуда"
            value={pickup}
            onSelect={(p) => { setPickup(p); setEstimate(null); }}
            placeholder="Улица, дом..."
            onTextChange={setPickupText}
            icon="📍"
          />
          <AddressInput
            label="Куда"
            value={destination}
            onSelect={(d) => { setDestination(d); setEstimate(null); }}
            placeholder="Куда едем?"
            onTextChange={setDestinationText}
            icon="🏁"
          />

          {!estimate ? (
            <Button
              onClick={handleEstimate}
              disabled={!pickup || !destination || estimating}
              className="mt-2 w-full"
            >
              {estimating ? "Расчёт..." : "Рассчитать стоимость"}
            </Button>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>{selected.name} • {selected.pickupEtaSeconds ? `${Math.ceil(selected.pickupEtaSeconds / 60)} мин.` : ""}</span>
                <button onClick={() => setEstimate(null)} className="text-accent underline">Изменить</button>
              </div>
              <Button variant="primary" className="w-full" onClick={handleOrder} loading={ordering}>
                Заказать за {selected.price / 100} ₽
              </Button>
            </div>
          )}
        </div>
      </CollapsibleSheet>
    </main>
  );
}
