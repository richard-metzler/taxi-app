"use client";

import { useState, type FormEvent } from "react";
import { GlassCard, TaxiArt, TuberBackdrop, TuberHeader } from "@/core/widgets/TuberUI";
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

const FIELD =
  "w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-base text-white outline-none placeholder:text-white/35 focus:border-[#FFC400]/70";
const LABEL = "mb-1 block text-sm font-bold text-white";
const FILE_INPUT =
  "w-full text-sm text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-[#FFC400]/15 file:px-4 file:py-2 file:text-sm file:font-bold file:text-[#FFC400] hover:file:bg-[#FFC400]/25";

/** Анкета водителя: тёмная форма, жёлтая CTA и оранжевая 3D-машина. */
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

  const handleSubmit = async (e: FormEvent) => {
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
    <main className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-[#07071A] text-white">
      <TuberBackdrop />
      <TaxiArt view="front" className="pointer-events-none absolute -bottom-6 left-1/2 z-0 h-52 w-80 -translate-x-1/2 opacity-25" />

      <div className="relative z-10 flex flex-1 flex-col">
        <TuberHeader onBack={undefined} onProfile={undefined} />

        <div className="flex flex-1 flex-col px-4 pb-6 pt-5">
          <GlassCard className="p-6">
            <h1 className="mb-2 text-2xl font-black text-white">Данные водителя</h1>
            <p className="mb-6 text-sm text-white/70">Заполните информацию. Она уйдёт на модерацию администратору.</p>

            {error && (
              <div className="mb-4 rounded-2xl border border-red-400/40 bg-red-500/15 p-3 text-sm text-red-300" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className={LABEL}>Ваше имя</label>
                <input type="text" required placeholder="Например: Сергей" className={FIELD} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Телефон (необязательно)</label>
                <input type="tel" placeholder="+7 XXX XXX-XX-XX" className={FIELD} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Пароль (необязательно)</label>
                <input type="password" placeholder="Для входа по номеру" className={FIELD} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Марка автомобиля</label>
                <input type="text" required placeholder="Например: Kia" className={FIELD} value={brand} onChange={(e) => setBrand(e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Модель автомобиля</label>
                <input type="text" required placeholder="Например: Rio" className={FIELD} value={model} onChange={(e) => setModel(e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Госномер</label>
                <input type="text" required placeholder="Например: А123ВС70" className={FIELD} value={plate} onChange={(e) => setPlate(e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Цвет авто</label>
                <input type="text" required placeholder="Например: Белый" className={FIELD} value={color} onChange={(e) => setColor(e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Класс автомобиля</label>
                <select className={FIELD} value={vehicleClass} onChange={(e) => setVehicleClass(e.target.value)}>
                  <option value="econom" className="bg-[#16191f] text-white">Эконом</option>
                  <option value="comfort" className="bg-[#16191f] text-white">Комфорт</option>
                  <option value="business" className="bg-[#16191f] text-white">Бизнес</option>
                </select>
              </div>

              <div>
                <label className={LABEL}>Селфи</label>
                <input type="file" accept="image/*" capture="user" required className={FILE_INPUT} onChange={(e) => setSelfie(e.target.files?.[0] || null)} />
              </div>
              <div>
                <label className={LABEL}>Фото водительского удостоверения</label>
                <input type="file" accept="image/*" required className={FILE_INPUT} onChange={(e) => setLicensePhoto(e.target.files?.[0] || null)} />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#FFC400] text-base font-extrabold text-[#1a1200] shadow-[0_0_22px_rgba(255,196,0,0.3)] disabled:opacity-50"
              >
                {loading ? "Отправляем…" : "Отправить на модерацию"}
              </button>
            </form>
          </GlassCard>
        </div>
      </div>
    </main>
  );
}
