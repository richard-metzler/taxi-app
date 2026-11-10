"use client";

import { useState } from "react";
import { Button } from "@/core/widgets/ui";

// Функция для сжатия изображения на клиенте (чтобы не переполнить память сервера)
const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800; // Сжимаем до 800px по ширине
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: "image/jpeg" }));
            } else {
              reject(new Error("Ошибка сжатия"));
            }
          },
          "image/jpeg",
          0.7 // Качество 70%
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

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

    setLoading(true);
    setError("");

    try {
      // 1. Сжимаем фото
      const compressedSelfie = await compressImage(selfie);
      const compressedLicense = await compressImage(licensePhoto);

      // 2. Формируем данные
      const formData = new FormData();
      formData.append("name", name);
      formData.append("carModel", carModel);
      formData.append("plate", plate);
      formData.append("color", color);
      formData.append("selfie", compressedSelfie);
      formData.append("licensePhoto", compressedLicense);

      // 3. Берем токен сессии (как в api.ts)
      const token = localStorage.getItem("taxi_passenger_session");

      // 4. Отправляем с правильными заголовками
      const res = await fetch("/api/driver/register", {
        method: "POST",
        headers: {
          "x-session-token": token || "",
          "x-taxi-client": "web",
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка отправки");

      onComplete();
    } catch (err: any) {
      if (err.message.includes('fetch') || err.message.includes('network')) {
        setError("Сервер не отвечает. Проверьте интернет и попробуйте еще раз.");
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
