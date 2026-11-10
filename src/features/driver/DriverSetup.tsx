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

      onComplete(); // Перезагружаем страницу водителя
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl p-6 shadow-xl">
        <h1 className="text-2xl font-bold mb-2">Данные водителя</h1>
        <p className="text-sm text-gray-500 mb-6">Заполните информацию один раз, и она сохранится в базе.</p>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Ваше имя</label>
            <input
              type="text"
              required
              placeholder="Например: Сергей"
              className="w-full p-3 border rounded-xl outline-none focus:border-accent"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Марка и модель авто</label>
            <input
              type="text"
              required
              placeholder="Например: Kia Rio"
              className="w-full p-3 border rounded-xl outline-none focus:border-accent"
              value={carModel}
              onChange={(e) => setCarModel(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Госномер</label>
            <input
              type="text"
              required
              placeholder="Например: А123ВС70"
              className="w-full p-3 border rounded-xl outline-none focus:border-accent"
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
