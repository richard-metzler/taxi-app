"use client";

import { formatMoney, formatDistance } from "@/shared/types";
import { SwipeButton } from "@/core/widgets/SwipeButton";
import type { AvailableOrderView } from "@/shared/driver-types";

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
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="neo-btn w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <h2 className="mb-4 text-center text-2xl font-bold text-ink">Новый заказ!</h2>
        
        <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-surface p-4 neo-inset">
          <div className="flex gap-2">
            <span className="text-accent mt-1">●</span>
            <div>
              <div className="text-xs text-muted">Откуда</div>
              <div className="font-semibold text-sm">{order.pickup.address}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="mt-1">■</span>
            <div>
              <div className="text-xs text-muted">Куда</div>
              <div className="font-semibold text-sm">{order.destination.address}</div>
            </div>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between px-2">
          <div className="text-sm text-muted">
            {formatDistance(order.tripDistanceMeters)} · {formatDistance(order.distanceToPickupMeters)} до подачи
          </div>
          <div className="text-2xl font-bold text-ink">{formatMoney(order.price)}</div>
        </div>

        <div className="flex flex-col gap-3">
          <SwipeButton onComplete={onAccept} loading={isAccepting} text="Свайп для принятия" />
          
          <button
            onClick={onDecline}
            disabled={isAccepting}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-white text-sm font-semibold text-red-500 shadow-sm border border-gray-100 active:bg-gray-50 disabled:opacity-50"
          >
            Отказаться
          </button>
        </div>
      </div>
    </div>
  );
}
