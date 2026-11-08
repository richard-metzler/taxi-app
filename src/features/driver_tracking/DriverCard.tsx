"use client";

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
          <div className="truncate text-base font-bold">{driver.name}</div>
          <span className="text-xs text-muted">★ {driver.rating.toFixed(1)}</span>
        </div>
        {v ? (
          <div className="text-sm text-muted">
            {v.brand} {v.model}, {v.color.toLowerCase()} · {v.tariffName}
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
        <div className="neo-sm shrink-0 rounded-lg px-2 py-1 font-mono text-sm font-bold tracking-wider">{v.plate}</div>
      ) : null}
    </div>
  );
}
