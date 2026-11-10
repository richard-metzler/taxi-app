"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/shared/api";
import type { EstimateView } from "@/shared/types";
import { AddressInput } from "@/features/addresses/AddressInput";
import { Button } from "@/core/widgets/ui";

export default function HomePage() {
  const router = useRouter();
  const [pickup, setPickup] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [estimate, setEstimate] = useState<EstimateView | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [ordering, setOrdering] = useState(false);

  const handleEstimate = async () => {
    if (!pickup || !destination) return;
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-gray-50 p-4">
      <h1 className="text-2xl font-bold mb-4">Заказ такси</h1>
      
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm">{error}</div>}

      <div className="bg-white p-4 rounded-xl shadow-sm mb-4 flex flex-col gap-3">
        <AddressInput label="Откуда" value={pickup} onChange={setPickup} />
        <AddressInput label="Куда" value={destination} onChange={setDestination} />
        <Button onClick={handleEstimate} disabled={!pickup || !destination || estimating}>
          {estimating ? "Расчёт..." : "Рассчитать стоимость"}
        </Button>
      </div>

      {estimate && selected && (
        <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
          <h2 className="font-bold text-lg mb-2">{selected.name}</h2>
          <p className="text-2xl font-bold mb-4">{selected.price / 100} ₽</p>
          <Button variant="primary" className="w-full" onClick={handleOrder} loading={ordering}>
            Заказать
          </Button>
        </div>
      )}
    </main>
  );
}
