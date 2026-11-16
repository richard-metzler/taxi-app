"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { useRequireAuth } from "@/shared/session";
import { driverStatusText, type DriverTripView } from "@/shared/driver-types";
import { formatMoney } from "@/shared/types";
import { BottomNav, DRIVER_NAV, ErrorBanner, PageHeader, Spinner, StatusPill } from "@/core/widgets/ui";

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

/** История поездок водителя. */
export default function DriverHistoryPage() {
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
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  const filtered = (items ?? []).filter((trip) => inPeriod(trip.createdAt, period));
  const income = filtered.reduce((sum, trip) => sum + trip.price, 0);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <PageHeader title="Поездки" />
      <div className="flex flex-1 flex-col gap-3 px-3 pb-3">
        <ErrorBanner message={error} onRetry={load} />

        <div className="neo-inset flex gap-1 p-1" role="tablist" aria-label="Период поездок">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={period === item.id}
              onClick={() => setPeriod(item.id)}
              className={`flex min-h-10 flex-1 items-center justify-center rounded-xl text-sm font-semibold ${
                period === item.id ? "neo-btn text-accent" : "text-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <section className="neo flex flex-col gap-1 p-4">
          <div className="text-xs font-semibold text-muted">Доход за период</div>
          <div className="text-3xl font-bold text-ink">{formatMoney(income)}</div>
          <div className="mt-1 text-sm text-muted">
            {filtered.length} {tripWord(filtered.length)}
          </div>
        </section>

        {items === null && !error ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-8 w-8 text-accent" />
          </div>
        ) : null}
        {items && filtered.length === 0 ? (
          <div className="neo mt-3 p-6 text-center text-sm text-muted">
            Поездок за этот период нет. Выйдите на линию, чтобы принимать заказы.
          </div>
        ) : null}
        {filtered.map((trip) => (
          <article key={trip.id} className="neo flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted">{formatDate(trip.createdAt)}</div>
              <StatusPill
                text={driverStatusText(trip.status)}
                tone={trip.status === "completed" ? "success" : trip.status === "cancelled" ? "danger" : "accent"}
              />
            </div>

            <div className="neo-inset flex flex-col gap-2 px-3.5 py-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">А</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{trip.pickupAddress}</span>
              </div>
              <div className="ml-2 h-3 w-px bg-border" aria-hidden="true" />
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-[10px] font-bold text-white">Б</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{trip.destinationAddress}</span>
              </div>
            </div>

            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 truncate text-xs text-muted">
                {trip.passengerName} · {trip.tariffName}
              </div>
              <div className="shrink-0 text-lg font-bold text-ink">{formatMoney(trip.price)}</div>
            </div>
          </article>
        ))}
      </div>
      <div className="sticky bottom-0">
        <BottomNav items={DRIVER_NAV} />
      </div>
    </main>
  );
}
