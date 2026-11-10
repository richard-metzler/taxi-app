"use client";

import { useState } from "react";
import { Button } from "@/core/widgets/ui";

export function DriverSetup({ onComplete }: { onComplete: () => void }) {
  const [name, setName] = useState("");
  const [carModel, setCarModel] = useState("");
  const [plate, setPlate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/driver/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, carModel, plate }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения");

      onComplete();
    } catch (err: any) {
      if (err.message.includes('backend_starting') || err.message.includes('fetch')) {
        setError("Сервер просыпается. Подождите 5 секунд и нажмите еще раз.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-surface p-6">
      <div className="neo-btn p-6 rounded-3xl">
        <h1 className="text-2xl font-bold text-ink mb-2">Данные водителя</h1>
        <p className="text-sm text-muted mb-6">Заполните информацию один раз, и она сохранится в базе.</p>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Ваше имя</label>
            <input
              type="text"
              required
              placeholder="Например: Сергей"
              className="neo-inset w-full p-3 rounded-xl outline-none text-ink"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Марка и модель авто</label>
            <input
              type="text"
              required
              placeholder="Например: Kia Rio"
              className="neo-inset w-full p-3 rounded-xl outline-none text-ink"
              value={carModel}
              onChange={(e) => setCarModel(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Госномер</label>
            <input
              type="text"
              required
              placeholder="Например: А123ВС70"
              className="neo-inset w-full p-3 rounded-xl outline-none text-ink"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" className="mt-2 w-full" loading={loading}>
            Начать работу
          </Button>
        </form>
      </div>
    </main>
  );
}
