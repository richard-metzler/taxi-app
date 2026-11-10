"use client";

import { useState } from "react";
import { Button } from "@/core/widgets/ui";

export function DriverSetup({ onComplete }: { onComplete: () => void }) {
  const [name, setName] = useState("");
  const [carModel, setCarModel] = useState("");
  const [plate, setPlate] = useState("");
  const [color, setColor] = useState("");
  
  const [selfie, setSelfie] = useState<File | null>(null);
  const [licensePhoto, setLicensePhoto] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfie || !licensePhoto) {
      setError("Пожалуйста, прикрепите селфи и фото прав");
      return;
    }
    
    // Проверка размера (до 5 МБ), чтобы Layero не выдал ошибку 413
    if (selfie.size > 5 * 1024 * 1024 || licensePhoto.size > 5 * 1024 * 1024) {
      setError("Размер каждого фото не должен превышать 5 МБ");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("carModel", carModel);
      formData.append("plate", plate);
      formData.append("color", color);
      formData.append("selfie", selfie);
      formData.append("licensePhoto", licensePhoto);

      const res = await fetch("/api/driver/register", {
        method: "POST",
        body: formData, // Отправляем как FormData (с файлами)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка отправки");

      onComplete();
    } catch (err: any) {
      if (err.message.includes('backend_starting')) {
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
        <p className="text-sm text-muted mb-6">Заполните информацию. Она уйдет на модерацию администратору.</p>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Ваше имя</label>
            <input type="text" required placeholder="Например: Сергей" className="neo-inset w-full p-3 rounded-xl outline-none text-ink" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Марка и модель авто</label>
            <input type="text" required placeholder="Например: Kia Rio" className="neo-inset w-full p-3 rounded-xl outline-none text-ink" value={carModel} onChange={(e) => setCarModel(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Госномер</label>
            <input type="text" required placeholder="Например: А123ВС70" className="neo-inset w-full p-3 rounded-xl outline-none text-ink" value={plate} onChange={(e) => setPlate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Цвет авто</label>
            <input type="text" required placeholder="Например: Белый" className="neo-inset w-full p-3 rounded-xl outline-none text-ink" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          
          {/* Загрузка файлов */}
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Селфи</label>
            <input type="file" accept="image/*" capture="user" required className="w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-accent/10 file:text-accent hover:file:bg-accent/20" onChange={(e) => setSelfie(e.target.files?.[0] || null)} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Фото водительского удостоверения</label>
            <input type="file" accept="image/*" required className="w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-accent/10 file:text-accent hover:file:bg-accent/20" onChange={(e) => setLicensePhoto(e.target.files?.[0] || null)} />
          </div>

          <Button type="submit" variant="primary" className="mt-2 w-full" loading={loading}>
            Отправить на модерацию
          </Button>
        </form>
      </div>
    </main>
  );
}
