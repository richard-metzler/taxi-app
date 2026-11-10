"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/shared/api";
import type { EstimateView } from "@/shared/types";
import { AddressInput } from "@/features/addresses/AddressInput";
import { Button } from "@/core/widgets/ui";
import RideMap from "@/features/map/RideMap";

export default function HomePage() {
  const router = useRouter();
  
  const [pickup, setPickup] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [pickupText, setPickupText] = useState("");
  const [destinationText, setDestinationText] = useState("");
  
  const [estimate, setEstimate] = useState<EstimateView | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [ordering, setOrdering] = useState(false);

  // Состояние для плашки свободных машин
  const [availableDrivers, setAvailableDrivers] = useState<number | null>(null);

  // Опрос количества свободных машин каждые 10 секунд
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
      {/* Карта на весь экран */}
      <div className="absolute inset-0 z-0">
        <RideMap
          center={pickup || { latitude: 56.4846, longitude: 84.9476 }}
          pickup={pickup}
          destination={destination}
          fitKey={estimate ? estimate.estimateId : ""}
        />
      </div>

      {/* Плашка со свободными машинами (поверх карты) */}
      {availableDrivers !== null && (
        <div className="absolute left-4 top-4 z-[99999] flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 shadow-lg backdrop-blur-md border border-gray-200">
          <span className="text-2xl leading-none">🚕</span>
          <div className={`h-3.5 w-3.5 rounded-full ${availableDrivers > 0 ? "bg-green-500" : "bg-red-500"}`} />
          {availableDrivers > 0 && (
            <span className="font-bold text-black">{availableDrivers}</span>
          )}
        </div>
      )}

      {/* Нижняя панель с адресами и кнопкой заказа */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col rounded-t-3xl bg-white p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-300" />
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm">{error}</div>}

        <div className="flex flex-col gap-3">
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
      </div>
    </main>
  );
}
