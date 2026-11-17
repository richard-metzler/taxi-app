"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { useRequireAuth } from "@/shared/session";
import { formatMoney, ORDER_STATUS_TEXT, type OrderSummary } from "@/shared/types";
import { BottomNav, ErrorBanner, PageHeader, Spinner, StatusPill } from "@/core/widgets/ui";

type Filter = "all" | "active" | "completed" | "cancelled";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "active", label: "Активные" },
  { id: "completed", label: "Завершённые" },
  { id: "cancelled", label: "Отменённые" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

function toneOf(status: OrderSummary["status"]): "success" | "danger" | "accent" {
  return status === "completed" ? "success" : status === "cancelled" ? "danger" : "accent";
}

export default function HistoryPage() {
  const { user, loading } = useRequireAuth();
  const [items, setItems] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setError(null);
    try {
      const { items } = await api.orders.list();
      setItems(items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить историю");
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    // setState внутри load выполняется в асинхронном колбэке, а не синхронно в эффекте.
    void Promise.resolve().then(load);
  }, [user, load]);

  if (loading || !user) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  const visible = items?.filter((o) => {
    if (filter === "all") return true;
    if (filter === "active") return o.status !== "completed" && o.status !== "cancelled";
    if (filter === "completed") return o.status === "completed";
    return o.status === "cancelled";
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-bg">
      <PageHeader title="История поездок" back="/home" />

      {/* Сегментный фильтр периодов/статусов под заголовком */}
      <div className="px-3 pb-1">
        <div className="neo-inset flex gap-1 rounded-2xl p-1" role="tablist" aria-label="Фильтр поездок">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-9 flex-1 rounded-xl px-1.5 text-xs font-semibold transition-colors ${
                filter === f.id ? "neo-btn text-accent" : "text-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-3 pb-3 pt-2">
        <ErrorBanner message={error} onRetry={load} />
        {items === null && !error ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-8 w-8 text-accent" />
          </div>
        ) : null}

        {items && items.length === 0 ? (
          <div className="neo mt-2 flex flex-col items-center gap-3 px-6 py-10 text-center">
            <div className="neo-inset flex h-16 w-16 items-center justify-center rounded-full" aria-hidden="true">
              <Image
                src="/images/taxi-side.svg"
                alt=""
                width={80}
                height={48}
                unoptimized
                className="h-8 w-auto"
                draggable={false}
              />
            </div>
            <div>
              <div className="text-base font-bold text-ink">Поездок пока нет</div>
              <div className="mt-1 text-sm text-muted">Здесь появятся ваши поездки</div>
            </div>
            <Link
              href="/home"
              className="neo-btn-primary mt-2 inline-flex min-h-12 items-center justify-center rounded-2xl px-6 text-base font-semibold"
            >
              Заказать такси
            </Link>
          </div>
        ) : null}

        {items && items.length > 0 && visible?.length === 0 ? (
          <div className="neo mt-2 p-6 text-center text-sm text-muted">В этом разделе поездок нет</div>
        ) : null}

        {visible?.map((o) => (
          <Link key={o.id} href={`/orders/${o.id}`} className="neo block p-4 transition-transform active:scale-[0.99]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted">{formatDate(o.createdAt)}</span>
              <StatusPill text={ORDER_STATUS_TEXT[o.status]} tone={toneOf(o.status)} />
            </div>

            <div className="relative mt-3 flex flex-col gap-3 pl-1">
              <span className="absolute bottom-3 left-[5px] top-3 w-px bg-muted/30" aria-hidden="true" />
              <div className="relative flex items-center gap-3">
                <span className="relative z-10 h-3 w-3 shrink-0 rounded-full bg-success ring-4 ring-bg" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{o.pickupAddress}</span>
              </div>
              <div className="relative flex items-center gap-3">
                <span className="relative z-10 h-3 w-3 shrink-0 rounded-sm bg-ink ring-4 ring-bg" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{o.destinationAddress}</span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-muted/15 pt-3">
              <div className="min-w-0 flex-1 text-xs text-muted">
                <div className="truncate font-semibold text-ink">{o.tariffName}</div>
                <div className="truncate">
                  {[o.driverName, o.vehicle].filter(Boolean).join(" · ") || "Водитель не назначен"}
                </div>
              </div>
              <div className="shrink-0 text-xl font-bold text-ink">{formatMoney(o.price)}</div>
              <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-muted" fill="none" aria-hidden="true">
                <path d="M7.5 4.5L13 10L7.5 15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      <div className="sticky bottom-0 z-40">
        <BottomNav />
      </div>
    </main>
  );
}
