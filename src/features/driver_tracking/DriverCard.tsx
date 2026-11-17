"use client";

import { GlassCard, TaxiArt } from "@/core/widgets/TuberUI";
import { formatDistance, formatDuration, type DriverView } from "@/shared/types";

/** Карточка водителя и автомобиля в стиле эталона. Обновляются только изменившиеся значения. */
export function DriverCard({ driver, showEta }: { driver: DriverView; showEta: boolean }) {
  const v = driver.vehicle;
  return (
    <GlassCard className="flex items-center gap-3 p-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#FFC400] bg-[#FFC400]/10 text-2xl font-black text-[#FFC400]">
        {driver.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={driver.photoUrl} alt={driver.name} className="h-full w-full object-cover" />
        ) : (
          driver.name.charAt(0) || "👤"
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-base font-extrabold text-white">{driver.name}</div>
        </div>
        {v ? (
          <div className="flex items-center gap-1.5 text-sm text-white/70">
            <span className="relative h-5 w-8 shrink-0">
              <TaxiArt view="front" className="absolute inset-0" />
            </span>
            <span className="truncate">
              {v.brand} {v.model}, {v.color.toLowerCase()} · {v.tariffName}
            </span>
          </div>
        ) : null}
        {showEta && driver.distanceToPassengerMeters !== null ? (
          <div className="text-xs font-semibold text-[#FFC400]">
            {formatDistance(driver.distanceToPassengerMeters)} до вас
            {driver.etaSeconds !== null ? ` · прибудет через ${formatDuration(driver.etaSeconds)}` : ""}
          </div>
        ) : null}
      </div>
      {v ? (
        <div className="shrink-0 rounded-lg border border-white/20 bg-white/10 px-2 py-1 font-mono text-sm font-bold tracking-wider text-white">
          {v.plate}
        </div>
      ) : null}
    </GlassCard>
  );
}
