"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { useRequireAuth } from "@/shared/session";
import { driverStatusText, type DriverTripView } from "@/shared/driver-types";
import { formatMoney } from "@/shared/types";
import { GlassCard, TaxiArt, TuberBackdrop, TuberHeader } from "@/core/widgets/TuberUI";
import { BottomNav, DRIVER_NAV, ErrorBanner, Spinner } from "@/core/widgets/ui";

type Period = "today" | "week" | "all";

const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Сегодня" },
  { id: "week", label: "Неделя" },
  { id: "all", label: "Все" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

function tripWord(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return "поездка";
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)) return "поездки";
  return "поездок";
}

/** Реальная фильтрация по createdAt. */
function inPeriod(iso: string, period: Period): boolean {
  if (period === "all") return true;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  if (period === "today") return date.toDateString() === now.toDateString();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  return date >= weekAgo;
}

function StatusPill({ text, tone }: { text: string; tone: "success" | "danger" | "accent" }) {
  const color = tone === "success" ? "text-[#FFC400]" : tone === "danger" ? "text-[#FF8A8A]" : "text-white/80";
  return (
    <span className={`rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold ${color}`}>
      {text}
    </span>
  );
}

/** История поездок водителя в стиле эталона tuber. */
export default function DriverHistoryPage() {
  const router = useRouter();
  const { user } = useRequireAuth();
  const [items, setItems] = useState<DriverTripView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("today");

  const load = useCallback(async () => {
    setError(null);
    try {
      const { items } = await api.driver.history();
      setItems(items);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось загрузить поездки");
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    // setState внутри load выполняется в асинхронном колбэке, а не синхронно в эффекте.
    void Promise.resolve().then(load);
  }, [user, load]);

  if (!user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#07071A]">
        <Spinner className="h-8 w-8 text-[#FFC400]" />
      </main>
    );
  }

  const filtered = (items ?? []).filter((trip) => inPeriod(trip.createdAt, period));
  const income = filtered.reduce((sum, trip) => sum + trip.price, 0);

  return (
    <main className="relative flex min-h-dvh w-full flex-col bg-[#07071A] text-white">
      <TuberBackdrop />

      <TuberHeader onBack={() => router.back()} onProfile={() => router.push("/driver/settings")} />

      <h1 className="relative z-10 mt-8 px-6 text-[34px] font-bold leading-tight tracking-tight">Поездки</h1>

      {/* Сегмент периодов: активная вкладка с жёлтой линией */}
      <div className="relative z-10 mt-6 flex gap-6 overflow-x-auto border-b border-white/15 px-6 scrollbar-hide" role="tablist" aria-label="Период поездок">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={period === item.id}
            onClick={() => setPeriod(item.id)}
            className={`relative shrink-0 whitespace-nowrap pb-3 text-[15px] font-semibold transition-colors ${
              period === item.id ? "text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            {item.label}
            {period === item.id ? (
              <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-[#FFC400] shadow-[0_0_10px_rgba(255,196,0,0.7)]" aria-hidden="true" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="relative z-10 flex flex-1 flex-col gap-3 px-4 pb-4 pt-5">
        {error ? (
          <div className="[&_.neo-inset]:!rounded-[20px] [&_.neo-inset]:!border [&_.neo-inset]:!border-white/20 [&_.neo-inset]:!bg-white/10 [&_.neo-inset]:!shadow-none [&_.neo-inset]:!backdrop-blur-2xl">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        ) : null}

        {/* Карточка дохода */}
        <GlassCard className="relative overflow-hidden p-5">
          <TaxiArt view="top" className="absolute -right-3 -top-4 h-36 w-24 opacity-20" />
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FFC400]">Доход за период</div>
          <div className="mt-1 text-4xl font-black tracking-tight text-white">{formatMoney(income)}</div>
          <div className="mt-2 text-sm text-white/65">
            {filtered.length} {tripWord(filtered.length)}
          </div>
        </GlassCard>

        {items === null && !error ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-8 w-8 text-[#FFC400]" />
          </div>
        ) : null}
        {items && filtered.length === 0 ? (
          <GlassCard className="mt-2 p-6 text-center text-sm text-white/70">
            Поездок за этот период нет. Выйдите на линию, чтобы принимать заказы.
          </GlassCard>
        ) : null}

        {filtered.map((trip) => (
          <GlassCard key={trip.id} className="p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-white/60">{formatDate(trip.createdAt)}</span>
              <StatusPill
                text={driverStatusText(trip.status)}
                tone={trip.status === "completed" ? "success" : trip.status === "cancelled" ? "danger" : "accent"}
              />
            </div>

            <div className="mt-4 flex items-start gap-3">
              {/* Жёлтые маркеры А и Б с соединительной линией */}
              <div className="flex shrink-0 flex-col items-center pt-0.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FFC400] text-[11px] font-black text-[#07071A]">А</span>
                <span className="my-1 h-7 w-0.5 rounded-full bg-[#FFC400]/45" aria-hidden="true" />
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#FFC400] text-[11px] font-black text-[#FFC400]">Б</span>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-6 pt-0.5">
                <span className="truncate text-[15px] font-medium text-white">{trip.pickupAddress}</span>
                <span className="truncate text-[15px] font-medium text-white">{trip.destinationAddress}</span>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-2xl font-bold tracking-tight text-[#FFC400]">{formatMoney(trip.price)}</div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-white/15 pt-3">
              <div className="min-w-0 flex-1 truncate text-xs text-white/65">
                {trip.passengerName} · {trip.tariffName}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="sticky bottom-0 z-40">
        <BottomNav items={DRIVER_NAV} />
      </div>
    </main>
  );
}
