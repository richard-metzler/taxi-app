"use client";

import { useEffect, useState } from "react";
import { formatMoney, formatDistance, formatDuration } from "@/shared/types";
import { Button } from "@/core/widgets/ui";
import { SwipeButton } from "@/core/widgets/SwipeButton";
import type { AvailableOrderView } from "@/shared/driver-types";

const OFFER_SECONDS = 10;

/** Входящий оффер заказа в стиле «Новый заказ» с визуальным таймером ~10 секунд. */
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
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="neo-btn w-full max-w-sm overflow-hidden rounded-3xl bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-accent">Предложение поездки</div>
            <h2 className="truncate text-xl font-bold text-ink">Новый заказ</h2>
          </div>
          <div className="neo-inset flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full" aria-label={`Осталось ${secondsLeft} секунд`}>
            <span className="text-base font-bold leading-none text-accent">{secondsLeft}</span>
            <span className="text-[8px] leading-none text-muted">сек</span>
          </div>
        </div>

        <div className="h-1 w-full bg-accent/15" aria-hidden="true">
          <div
            className="h-full bg-accent transition-all duration-1000 ease-linear"
            style={{ width: `${(secondsLeft / OFFER_SECONDS) * 100}%` }}
          />
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="neo-inset flex flex-col gap-3 px-4 py-3.5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-bg">
                А
              </span>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Подача</div>
                <div className="text-sm font-semibold text-ink">{order.pickup.address}</div>
              </div>
            </div>
            <div className="ml-2.5 h-4 w-px bg-border" aria-hidden="true" />
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-[11px] font-bold text-bg">
                Б
              </span>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Назначение</div>
                <div className="text-sm font-semibold text-ink">{order.destination.address}</div>
              </div>
            </div>
          </div>

          <div className="flex items-end justify-between gap-3 px-1">
            <div className="text-xs text-muted">
              <div>
                {formatDistance(order.tripDistanceMeters)} · {formatDuration(order.tripDurationSeconds)}
              </div>
              <div>{formatDistance(order.distanceToPickupMeters)} до подачи</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Стоимость</div>
              <div className="text-3xl font-bold text-accent">{formatMoney(order.price)}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <Button variant="primary" loading={isAccepting} onClick={onAccept} className="text-lg">
              Принять
            </Button>
            <SwipeButton onComplete={onAccept} loading={isAccepting} text="Свайп для принятия" />
            <button
              type="button"
              onClick={onDecline}
              disabled={isAccepting}
              className="neo-btn flex h-12 w-full items-center justify-center text-base font-semibold text-muted disabled:opacity-50"
            >
              Пропустить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
