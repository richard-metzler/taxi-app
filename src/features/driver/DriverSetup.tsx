"use client";

import { useState } from "react";
import { Button } from "@/core/widgets/ui";
import { api } from "@/shared/api";

/** Сжатие изображения до data URL, чтобы не переполнить память сервера и конверт RPC. */
const compressImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

export function DriverSetup({ onComplete }: { onComplete: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [color, setColor] = useState("");
  const [vehicleClass, setVehicleClass] = useState("econom");

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
      const [selfieBase64, licenseBase64] = await Promise.all([
        compressImage(selfie),
        compressImage(licensePhoto),
      ]);

      // JSON через RPC: сессия уходит в конверте, FormData больше не используется.
      await api.driver.register({
        name: name.trim(),
        phone: phone.trim() || undefined,
        password: password || undefined,
        vehicle: {
          brand: brand.trim(),
          model: model.trim(),
          color: color.trim(),
          plate: plate.trim(),
          class: vehicleClass,
        },
        selfieBase64,
        licenseBase64,
      });

      onComplete();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка отправки";
      setError(
        message.includes("fetch") || message.includes("network")
          ? "Сервер не отвечает. Проверьте интернет и попробуйте ещё раз."
          : message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-bg p-6">
      <div className="neo-btn p-6 rounded-3xl">
        <h1 className="text-2xl font-bold text-ink mb-2">Данные водителя</h1>
        <p className="text-sm text-muted mb-6">Заполните информацию. Она уйдёт на модерацию администратору.</p>

        {error && <div className="neo-inset text-danger p-3 rounded-xl mb-4 text-sm" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Ваше имя</label>
            <input type="text" required placeholder="Например: Сергей" className="neo-inset w-full p-3 rounded-xl outline-none text-ink placeholder:text-muted" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Телефон (необязательно)</label>
            <input type="tel" placeholder="+7 XXX XXX-XX-XX" className="neo-inset w-full p-3 rounded-xl outline-none text-ink placeholder:text-muted" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Пароль (необязательно)</label>
            <input type="password" placeholder="Для входа по номеру" className="neo-inset w-full p-3 rounded-xl outline-none text-ink placeholder:text-muted" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Марка автомобиля</label>
            <input type="text" required placeholder="Например: Kia" className="neo-inset w-full p-3 rounded-xl outline-none text-ink placeholder:text-muted" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Модель автомобиля</label>
            <input type="text" required placeholder="Например: Rio" className="neo-inset w-full p-3 rounded-xl outline-none text-ink placeholder:text-muted" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Госномер</label>
            <input type="text" required placeholder="Например: А123ВС70" className="neo-inset w-full p-3 rounded-xl outline-none text-ink placeholder:text-muted" value={plate} onChange={(e) => setPlate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Цвет авто</label>
            <input type="text" required placeholder="Например: Белый" className="neo-inset w-full p-3 rounded-xl outline-none text-ink placeholder:text-muted" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink mb-1">Класс автомобиля</label>
            <select
              className="neo-inset w-full p-3 rounded-xl outline-none text-ink"
              value={vehicleClass}
              onChange={(e) => setVehicleClass(e.target.value)}
            >
              <option value="econom" className="bg-card text-ink">Эконом</option>
              <option value="comfort" className="bg-card text-ink">Комфорт</option>
              <option value="business" className="bg-card text-ink">Бизнес</option>
            </select>
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
