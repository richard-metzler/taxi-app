"use client";

import Image from "next/image";
import { formatDistance, formatDuration, type DriverView } from "@/shared/types";

/** Карточка водителя и автомобиля. Обновляются только изменившиеся значения. */
export function DriverCard({ driver, showEta }: { driver: DriverView; showEta: boolean }) {
  const v = driver.vehicle;
  return (
    <div className="flex items-center gap-3">
      <div className="neo-inset flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl">
        {driver.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={driver.photoUrl} alt={driver.name} className="h-full w-full object-cover" />
        ) : (
          "👤"
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-base font-bold text-ink">{driver.name}</div>
          
        </div>
        {v ? (
          <div className="flex items-center gap-1.5 text-sm text-muted">
            <Image src="/images/taxi-side.svg" alt="" width={18} height={18} className="h-4 w-4 shrink-0" draggable={false} />
            <span className="truncate">
              {v.brand} {v.model}, {v.color.toLowerCase()} · {v.tariffName}
            </span>
          </div>
        ) : null}
        {showEta && driver.distanceToPassengerMeters !== null ? (
          <div className="text-xs text-accent">
            {formatDistance(driver.distanceToPassengerMeters)} до вас
            {driver.etaSeconds !== null ? ` · прибудет через ${formatDuration(driver.etaSeconds)}` : ""}
          </div>
        ) : null}
      </div>
      {v ? (
        <div className="neo-sm shrink-0 rounded-lg px-2 py-1 font-mono text-sm font-bold tracking-wider text-ink">{v.plate}</div>
      ) : null}
    </div>
  );
}
