"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOrder } from "@/features/ride_order/useOrder";
import { Button, Spinner } from "@/core/widgets/ui";
import { api } from "@/shared/api";
import { buildNavigatorUrl, type NavigatorId } from "@/core/navigator-links";
import { formatMoney, ORDER_STATUS_TEXT } from "@/shared/types";
import { useSession } from "@/shared/session";

/** Круговой таймер ожидания с жёлтым кольцом прогресса. */
function EtaRing({ minutes }: { minutes: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="5" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#FFCC00"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.72} ${circumference}`}
        />
      </svg>
      <div className="text-center">
        <div className="text-2xl font-black leading-none text-white">{String(minutes).padStart(2, "0")} мин</div>
        <div className="mt-1 text-[10px] uppercase tracking-widest text-white/60">ожидание</div>
      </div>
    </div>
  );
}

/** Экран поездки в стиле tuber: градиент, стеклянные карточки и крупный таймер. */
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
    if (orderStatus === "completed") {
      void Promise.resolve().then(() => setArrived(true));
    }
  }, [orderStatus]);

  if (!orderId || orderId === "undefined" || orderId === "null") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#0A1A44]">
        <p className="text-white">Ошибка: некорректный ID заказа</p>
      </main>
    );
  }

  if (!order && !error && !forbidden) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#0A1A44]">
        <Spinner className="h-8 w-8 text-[#FFCC00]" />
      </main>
    );
  }

  if (forbidden || error || !order) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 bg-[#0A1A44] px-6 text-center">
        <p className="text-white">{forbidden ? "У вас нет доступа к этому заказу" : error || "Заказ не найден"}</p>
        <Button onClick={() => router.push("/home")}>На главную</Button>
      </main>
    );
  }

  const canCancel = ["searching", "driver_assigned", "driver_arriving", "driver_waiting"].includes(order.status);
  const driver = order.driver;
  const vehicle = driver?.vehicle;
  const navigatorId: NavigatorId = user?.navigator ?? "yandex";
  const navigatorUrl = buildNavigatorUrl(navigatorId, order.destination);
  const etaMinutes = driver?.etaSeconds != null ? Math.max(1, Math.round(driver.etaSeconds / 60)) : 5;

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

  const roundButton = (label: string, glyph: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-2">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-white/10 text-2xl text-white backdrop-blur-lg transition active:scale-95">
        {glyph}
      </span>
      <span className="text-[11px] font-medium text-white/80">{label}</span>
    </button>
  );

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[linear-gradient(165deg,#2F5FD1_0%,#153A86_45%,#071736_100%)] text-white">
      <div className="pointer-events-none absolute -right-20 top-32 h-96 w-96 rounded-full bg-[#5B9BFF]/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-[#0A2E7A]/60 blur-3xl" />

      {/* Временная заглушка вместо 3D-рендера (заменится присланным PNG) */}
      <div className="pointer-events-none absolute right-[-56px] top-[190px] h-[300px] w-[220px] opacity-80">
        <Image src="/images/taxi-side.svg" alt="" fill unoptimized className="object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.45)]" aria-hidden="true" />
      </div>

      {/* Шапка */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-7">
        <button type="button" onClick={() => router.push("/home")} className="flex items-center gap-1.5 text-sm font-semibold text-white/90">
          <span className="text-xl leading-none">←</span> Назад
        </button>
        <span className="text-xl font-black tracking-tight">рядом</span>
        <button type="button" aria-label="Профиль" onClick={() => router.push("/settings")} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-lg">
          ☺
        </button>
      </header>

      {/* Маршрут и цена */}
      <section className="relative z-10 mt-9 px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-[#FFCC00] ring-4 ring-[#FFCC00]/20" />
              <span className="max-w-[190px] truncate text-sm font-semibold">{order.pickup.address}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#FFCC00] ring-4 ring-[#FFCC00]/10" />
              <span className="max-w-[190px] truncate text-sm font-semibold">{order.destination.address}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs font-medium text-white/60">поездка</div>
            <div className="text-3xl font-black tracking-tight">{formatMoney(order.finalPrice ?? order.estimatedPrice ?? 0)}</div>
          </div>
        </div>

        {/* Водитель */}
        <div className="mt-8 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white/15 text-lg font-bold">
            {driver?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={driver.photoUrl} alt={driver.name} className="h-full w-full object-cover" />
            ) : (
              driver?.name.charAt(0).toUpperCase() ?? "В"
            )}
          </span>
          <div>
            <div className="text-base font-bold">{driver?.name ?? "Водитель подбирается"}</div>
            <div className="flex items-center gap-1 text-xs text-white/70">
              <span className="text-[#FFCC00]">★</span> {driver?.rating.toFixed(1) ?? "—"}
            </div>
          </div>
          {vehicle ? <span className="ml-auto text-xs text-white/70">{vehicle.brand} {vehicle.model} · {vehicle.plate}</span> : null}
        </div>
      </section>

      {/* Стеклянная карточка с таймером */}
      {!arrived ? (
        <section className="absolute left-5 right-5 top-[330px] z-10 rounded-3xl border border-white/20 bg-white/10 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
          <p className="text-center text-sm font-medium text-white/80">Ваше такси уже в пути</p>
          <p className="mt-1 text-center text-xs text-white/50">{ORDER_STATUS_TEXT[order.status]}</p>
          <div className="mt-3 flex justify-center">
            <EtaRing minutes={etaMinutes} />
          </div>
        </section>
      ) : null}

      {notice ? <p className="absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-full bg-[#FFCC00] px-4 py-2 text-xs font-bold text-[#0A1A44]">{notice}</p> : null}

      {/* Круглые действия */}
      {!arrived ? (
        <div className="absolute inset-x-0 bottom-9 z-10 flex items-start justify-center gap-7">
          {roundButton("Позвонить", "☎", () => setNotice("Звонок водителю пока недоступен"))}
          {roundButton("Детали", "✎", () => setNotice("Изменение деталей пока недоступно"))}
          {roundButton("Отмена", "✕", () => canCancel && setShowCancelModal(true))}
        </div>
      ) : null}

      {/* Экран прибытия */}
      {arrived ? (
        <div className="absolute inset-0 z-30 flex flex-col justify-end">
          <section className="rounded-t-[36px] border-t border-white/20 bg-white/10 px-6 pb-8 pt-7 backdrop-blur-2xl">
            <h2 className="text-3xl font-black tracking-tight">Вы приехали</h2>
            <p className="mt-1 text-sm text-white/70">Как вам поездка?</p>
            {!rated ? (
              <div className="mt-5 flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    aria-label={`Оценка ${star}`}
                    onClick={() => { setRating(star); setRated(true); }}
                    className={`text-4xl transition ${star <= rating ? "text-[#FFCC00]" : "text-white/30"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-center text-base font-bold text-[#FFCC00]">Спасибо за оценку! ★ {rating}</p>
            )}
            <p className="mt-4 text-center text-xs leading-relaxed text-white/60">
              Ваш отзыв поможет нам сделать поездки лучше
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="default" className="flex-1 border border-white/20 bg-white/10 text-white" onClick={() => router.push("/home")}>
                Позже
              </Button>
              <Button variant="primary" className="flex-1" onClick={() => router.push("/home")}>
                Готово
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {/* Подтверждение отмены */}
      {showCancelModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-[#153A86] p-6 shadow-2xl">
            <h3 className="mb-2 text-center text-xl font-bold">Отменить заказ?</h3>
            <p className="mb-6 text-center text-sm text-white/70">Вы уверены, что хотите отменить поездку?</p>
            <div className="flex gap-3">
              <Button variant="default" className="flex-1 border border-white/20 bg-white/10 text-white" onClick={() => setShowCancelModal(false)}>Нет</Button>
              <Button variant="danger" className="flex-1" onClick={handleCancel} loading={isCancelling}>Да, отменить</Button>
            </div>
          </div>
        </div>
      )}

      {/* Навигатор —Accessibility: скрытая ссылка для совместимости */}
      <a href={navigatorUrl} target="_blank" rel="noopener noreferrer" className="sr-only">Маршрут в навигаторе</a>
    </main>
  );
}
