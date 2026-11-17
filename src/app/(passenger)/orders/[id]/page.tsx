"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOrder } from "@/features/ride_order/useOrder";
import { Button } from "@/core/widgets/ui";
import { SplashScreen } from "@/core/widgets/SplashScreen";
import { api } from "@/shared/api";
import { formatMoney } from "@/shared/types";
import { useSession } from "@/shared/session";

/** Таймер: тонкое кольцо с жёлтой дугой — как в макете. */
function EtaRing({ minutes }: { minutes: number }) {
  const r = 58;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex h-[132px] w-[132px] items-center justify-center">
      <svg viewBox="0 0 132 132" className="absolute inset-0 h-full w-full -rotate-[92deg]" aria-hidden="true">
        <circle cx="66" cy="66" r={r} fill="none" stroke="#2A2A36" strokeWidth="1.5" />
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke="#FFC400"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${c * 0.78} ${c}`}
          style={{ filter: "drop-shadow(0 0 6px rgba(255,196,0,0.55))" }}
        />
      </svg>
      <span className="text-[26px] font-semibold tracking-tight text-white">
        {String(minutes).padStart(2, "0")} min
      </span>
    </div>
  );
}

/** Круглая кнопка действия с синим свечением. */
function RoundAction({ glyph, label, onClick }: { glyph: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-[92px] flex-col items-center gap-2">
      <span
        className="flex h-[58px] w-[58px] items-center justify-center rounded-full text-2xl text-white"
        style={{ border: "1.5px solid #5B8FE8", boxShadow: "0 0 18px rgba(91,143,232,0.55), inset 0 0 12px rgba(91,143,232,0.18)" }}
      >
        {glyph}
      </span>
      <span className="text-center text-[13px] font-medium leading-tight text-white/85">{label}</span>
    </button>
  );
}

/** Шапка эталона: Back / логотип / профиль. */
function TopBar({ onBack, onProfile }: { onBack: () => void; onProfile: () => void }) {
  return (
    <header className="relative z-10 flex items-center justify-between px-6 pt-11">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-[15px] font-medium text-white/90">
        <span className="text-xl leading-none">‹</span> Back
      </button>
      <span className="absolute left-1/2 -translate-x-1/2 text-[26px] font-black tracking-tight text-white">рядом</span>
      <button type="button" aria-label="Профиль" onClick={onProfile} className="flex h-9 w-9 items-center justify-center text-white/90">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="7" r="3.2" />
          <path d="M5.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" strokeLinecap="round" />
        </svg>
      </button>
    </header>
  );
}

/** Экран поездки: тёмный вариант эталона и экран прибытия. */
export default function OrderPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useSession();
  const orderId = params.id as string;
  const { order, error, forbidden, reload } = useOrder(orderId);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const orderStatus = order?.status;
  useEffect(() => {
    if (orderStatus === "completed") void Promise.resolve().then(() => setArrived(true));
  }, [orderStatus]);

  if (!orderId || orderId === "undefined" || orderId === "null") {
    return <main className="flex min-h-dvh items-center justify-center bg-[#07071A]"><p className="text-white">Ошибка: некорректный ID заказа</p></main>;
  }
  if (!order && !error && !forbidden) {
    return <SplashScreen />;
  }
  if (forbidden || error || !order) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#07071A] px-6 text-center">
        <p className="text-white">{forbidden ? "У вас нет доступа к этому заказу" : error || "Заказ не найден"}</p>
        <Button onClick={() => router.push("/home")}>На главную</Button>
      </main>
    );
  }

  const canCancel = ["searching", "driver_assigned", "driver_arriving", "driver_waiting"].includes(order.status);
  const driver = order.driver;
  const etaMinutes = driver?.etaSeconds != null ? Math.max(1, Math.round(driver.etaSeconds / 60)) : 5;
  const price = formatMoney(order.finalPrice ?? order.estimatedPrice ?? 0);

  const handleCancel = async () => {
    setShowCancelModal(false);
    setIsCancelling(true);
    try {
      await api.orders.cancel(order.id);
      await reload();
    } catch (e: any) {
      setNotice(e.message || "Не удалось отменить заказ");
    } finally {
      setIsCancelling(false);
    }
  };

  if (arrived) {
    return (
      <main className="relative h-dvh w-full overflow-hidden bg-[linear-gradient(180deg,#1C4283_0%,#5093D6_52%,#153A90_100%)] text-white">
        <TopBar onBack={() => router.push("/home")} onProfile={() => router.push("/settings")} />

        {/* Строка водителя и итоги */}
        <section className="relative z-10 mt-9 flex items-start gap-4 px-6">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FFC400] text-lg font-bold text-[#123] ring-2 ring-white/40">
            {driver?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={driver.photoUrl} alt={driver.name} className="h-full w-full object-cover" />
            ) : (
              driver?.name.charAt(0).toUpperCase() ?? "В"
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold">{driver?.name ?? "Водитель"}</div>
            <div className="flex items-center gap-1 text-sm text-white/85">
              <span className="text-[#FFC400]">★</span> {driver?.rating.toFixed(1) ?? "—"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[13px] font-medium text-white/75">Final cost</div>
            <div className="text-lg font-bold">{price}</div>
          </div>
          <div className="text-right">
            <div className="text-[13px] font-medium text-white/75">Time</div>
            <div className="text-lg font-bold">{Math.max(1, Math.round((order.durationSeconds || 1800) / 60))} min</div>
          </div>
        </section>

        {/* Машина сверху */}
        <div className="pointer-events-none absolute left-1/2 top-[176px] z-0 h-[330px] w-[230px] -translate-x-1/2">
          <Image src="/images/taxi-3d-top.jpg" alt="" fill unoptimized className="object-contain drop-shadow-[0_22px_30px_rgba(0,0,0,0.4)]" aria-hidden="true" />
        </div>

        {/* Итоговая панель */}
        <section className="absolute inset-x-0 bottom-0 z-10 rounded-t-[36px] border-t border-white/25 bg-white/10 px-7 pb-10 pt-8 backdrop-blur-2xl">
          <h2 className="text-center text-[34px] font-bold leading-tight">You arrived</h2>
          <p className="mt-4 text-center text-lg text-white/90">How was your trip?</p>
          <div className="mt-5 flex justify-center gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                aria-label={`Оценка ${star}`}
                onClick={() => { setRating(star); setRated(true); }}
                className={`flex h-11 w-11 items-center justify-center rounded-full text-xl ${star <= rating || (rated && star <= rating) ? "bg-[#FFC400] text-[#123]" : "bg-black/35 text-[#FFC400]"}`}
              >
                ★
              </button>
            ))}
          </div>
          <p className="mt-6 text-center text-[15px] leading-snug text-white/85">
            Your feedback will help us improve driving experience better
          </p>
          {rated ? (
            <Button variant="primary" className="mt-6 w-full" onClick={() => router.push("/home")}>Готово</Button>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#07071A] text-white">
      {/* Синий underglow снизу как в макете */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[44%] bg-[radial-gradient(ellipse_at_50%_100%,#4E8FE0_0%,#2C5DAA_45%,rgba(7,7,26,0)_78%)]" />

      <TopBar onBack={() => router.push("/home")} onProfile={() => router.push("/settings")} />

      {/* Маршрут и цена */}
      <section className="relative z-10 mt-10 px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-7">
            <div className="flex items-center gap-3">
              <span className="h-[15px] w-[15px] shrink-0 rounded-full bg-[#FFC400]" />
              <span className="max-w-[200px] truncate text-[17px] font-medium">{order.pickup.address}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="h-[15px] w-[15px] shrink-0 rounded-full bg-[#FFC400]" />
              <span className="max-w-[200px] truncate text-[17px] font-medium">{order.destination.address}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[15px] font-medium text-white/65">8 km</div>
            <div className="text-[36px] font-bold leading-tight tracking-tight">{price}</div>
          </div>
        </div>
      </section>

      {/* Водитель */}
      <section className="relative z-10 mt-10 flex items-center gap-4 px-6">
        <span className="flex h-[58px] w-[58px] items-center justify-center overflow-hidden rounded-full bg-[#FFC400] text-xl font-bold text-[#123] ring-2 ring-white/30">
          {driver?.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={driver.photoUrl} alt={driver.name} className="h-full w-full object-cover" />
          ) : (
            driver?.name.charAt(0).toUpperCase() ?? "В"
          )}
        </span>
        <div>
          <div className="text-[19px] font-semibold">{driver?.name ?? "Водитель подбирается"}</div>
          <div className="mt-1 flex items-center gap-1 text-[15px] text-white/85">
            <span className="text-[#FFC400]">★</span> {driver?.rating.toFixed(1) ?? "—"}
          </div>
        </div>
      </section>

      {/* Центральные элементы: кнопки и таймер */}
      <section className="relative z-10 mt-12 flex items-start justify-center gap-6">
        <RoundAction glyph="✎" label="Edit Details" onClick={() => setNotice("Изменение деталей пока недоступно")} />
        <EtaRing minutes={etaMinutes} />
        <RoundAction glyph="✕" label="Cancel" onClick={() => canCancel && setShowCancelModal(true)} />
      </section>

      <p className="relative z-10 mt-7 text-center text-[18px] font-medium leading-snug text-white/85">
        Ваше такси скоро<br />приедет
      </p>

      {/* Машина снизу по центру */}
      <div className="pointer-events-none absolute bottom-[1%] left-1/2 z-0 h-[240px] w-[360px] -translate-x-1/2">
        <Image src="/images/taxi-3d-front.jpg" alt="" fill unoptimized className="object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)]" aria-hidden="true" />
      </div>

      {notice ? <p className="absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-full bg-[#FFC400] px-4 py-2 text-xs font-bold text-[#07071A]">{notice}</p> : null}

      {showCancelModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-[#14204A] p-6 shadow-2xl">
            <h3 className="mb-2 text-center text-xl font-bold">Отменить заказ?</h3>
            <p className="mb-6 text-center text-sm text-white/70">Вы уверены, что хотите отменить поездку?</p>
            <div className="flex gap-3">
              <Button variant="default" className="flex-1 border border-white/20 bg-white/10 text-white" onClick={() => setShowCancelModal(false)}>Нет</Button>
              <Button variant="danger" className="flex-1" onClick={handleCancel} loading={isCancelling}>Да, отменить</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
