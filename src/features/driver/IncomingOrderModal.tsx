"use client";

import { useEffect, useState } from "react";
import { formatMoney, formatDistance, formatDuration } from "@/shared/types";
import { Button } from "@/core/widgets/ui";
import { GlassCard } from "@/core/widgets/TuberUI";
import { SwipeButton } from "@/core/widgets/SwipeButton";
import { TuberRing } from "@/features/driver/DriverPanels";
import type { AvailableOrderView } from "@/shared/driver-types";

const OFFER_SECONDS = 10;

/** Входящий оффер заказа: glass-карточка эталона с жёлтым таймером и CTA. */
export function IncomingOrderModal({
  order,
  onAccept,
  onDecline,
  isAccepting,
}: {
  order: AvailableOrderView;
  onAccept: () => void;
  onDecline: () => void;
  isAccepting: boolean;
}) {
  const [secondsLeft, setSecondsLeft] = useState(OFFER_SECONDS);

  useEffect(() => {
    let current = OFFER_SECONDS;
    // setState вызывается в микрозадаче, а не синхронно в эффекте.
    void Promise.resolve().then(() => setSecondsLeft(current));
    const timer = setInterval(() => {
      current -= 1;
      setSecondsLeft(Math.max(0, current));
    }, 1000);
    return () => clearInterval(timer);
  }, [order.id]);

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-[#07071A]/80 px-4 backdrop-blur-md">
      <GlassCard className="w-full max-w-sm animate-in fade-in zoom-in-95 overflow-hidden !p-0">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFC400]">Предложение поездки</div>
            <h2 className="truncate text-2xl font-black text-white">Новый заказ</h2>
          </div>
          <div aria-label={`Осталось ${secondsLeft} секунд`}>
            <TuberRing value={secondsLeft} unit="сек" progress={secondsLeft / OFFER_SECONDS} />
          </div>
        </div>

        <div className="h-1 w-full bg-white/10" aria-hidden="true">
          <div
            className="h-full bg-[#FFC400] shadow-[0_0_12px_rgba(255,196,0,0.8)] transition-all duration-1000 ease-linear"
            style={{ width: `${(secondsLeft / OFFER_SECONDS) * 100}%` }}
          />
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-3 rounded-[22px] border border-white/20 bg-white/10 p-4 backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[#FFC400] bg-[#FFC400]/10 text-[10px] font-black text-[#FFC400]">
                А
              </span>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">Подача</div>
                <div className="text-sm font-semibold text-white">{order.pickup.address}</div>
              </div>
            </div>
            <div className="ml-2.5 h-4 w-px bg-white/20" aria-hidden="true" />
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[#5B8FE8] bg-[#5B8FE8]/15 text-[10px] font-black text-white">
                Б
              </span>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">Назначение</div>
                <div className="text-sm font-semibold text-white">{order.destination.address}</div>
              </div>
            </div>
          </div>

          <div className="flex items-end justify-between gap-3 px-1">
            <div className="text-xs text-white/65">
              <div>{formatDistance(order.tripDistanceMeters)} · {formatDuration(order.tripDurationSeconds)}</div>
              <div>{formatDistance(order.distanceToPickupMeters)} до подачи</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">Стоимость</div>
              <div className="text-3xl font-black text-[#FFC400]">{formatMoney(order.price)}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <Button
              variant="primary"
              loading={isAccepting}
              onClick={onAccept}
              className="!min-h-12 !rounded-2xl !text-base !font-extrabold !text-[#1a1200] [&_svg]:!text-[#1a1200]"
            >
              Принять
            </Button>
            <SwipeButton onComplete={onAccept} loading={isAccepting} text="Свайп для принятия" />
            <button
              type="button"
              onClick={onDecline}
              disabled={isAccepting}
              className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-base font-semibold text-white/75 backdrop-blur-xl disabled:opacity-50"
            >
              Пропустить
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
