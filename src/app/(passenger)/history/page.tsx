"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { useRequireAuth } from "@/shared/session";
import { formatMoney, ORDER_STATUS_TEXT, type OrderSummary } from "@/shared/types";
import { BottomNav, ErrorBanner, Spinner } from "@/core/widgets/ui";
import { GlassCard, TaxiArt, TuberBackdrop, TuberHeader } from "@/core/widgets/TuberUI";
import { SplashScreen } from "@/core/widgets/SplashScreen";

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

function StatusPill({ text, tone }: { text: string; tone: ReturnType<typeof toneOf> }) {
  const color = tone === "success" ? "text-[#7BE8A6]" : tone === "danger" ? "text-[#FF8A8A]" : "text-[#FFC400]";
  return (
    <span className={`rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold ${color}`}>
      {text}
    </span>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-white/55" fill="none" aria-hidden="true">
      <path d="M7.5 4.5L13 10L7.5 15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HistoryPage() {
  const router = useRouter();
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
    return <SplashScreen />;
  }

  const visible = items?.filter((o) => {
    if (filter === "all") return true;
    if (filter === "active") return o.status !== "completed" && o.status !== "cancelled";
    if (filter === "completed") return o.status === "completed";
    return o.status === "cancelled";
  });

  return (
    <main className="relative flex min-h-dvh w-full flex-col bg-[#07071A] text-white">
      <TuberBackdrop />

      <TuberHeader
        onBack={() => router.push("/home")}
        onProfile={() => router.push("/settings")}
      />

      <h1 className="relative z-10 mt-8 px-6 text-[34px] font-bold leading-tight tracking-tight">
        История поездок
      </h1>

      {/* Сегментный фильтр: активная вкладка с жёлтой линией */}
      <div className="relative z-10 mt-6 flex gap-6 overflow-x-auto border-b border-white/15 px-6 scrollbar-hide" role="tablist" aria-label="Фильтр поездок">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`relative shrink-0 whitespace-nowrap pb-3 text-[15px] font-semibold transition-colors ${
              filter === f.id ? "text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            {f.label}
            {filter === f.id ? (
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

        {items === null && !error ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-8 w-8 text-[#FFC400]" />
          </div>
        ) : null}

        {items && items.length === 0 ? (
          <GlassCard className="mt-2 flex flex-col items-center gap-3 px-6 py-8 text-center">
            <div className="pointer-events-none relative h-40 w-64">
              <TaxiArt view="front" className="h-full w-full" />
            </div>
            <div>
              <div className="text-2xl font-bold">Поездок пока нет</div>
              <div className="mt-1 text-sm text-white/70">Здесь появятся ваши поездки</div>
            </div>
            <Link
              href="/home"
              className="mt-2 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#FFC400] px-8 text-base font-bold text-[#07071A] shadow-[0_12px_30px_rgba(255,196,0,0.25)] transition active:scale-[0.99]"
            >
              Заказать такси
            </Link>
          </GlassCard>
        ) : null}

        {items && items.length > 0 && visible?.length === 0 ? (
          <GlassCard className="p-6 text-center text-sm text-white/70">В этом разделе поездок нет</GlassCard>
        ) : null}

        {visible?.map((o) => (
          <Link key={o.id} href={`/orders/${o.id}`} className="block transition-transform active:scale-[0.99]">
            <GlassCard className="p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-white/60">{formatDate(o.createdAt)}</span>
                <StatusPill text={ORDER_STATUS_TEXT[o.status]} tone={toneOf(o.status)} />
              </div>

              <div className="mt-4 flex items-start gap-3">
                {/* Жёлтые маркеры А и Б с соединительной линией */}
                <div className="flex shrink-0 flex-col items-center pt-0.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FFC400] text-[11px] font-black text-[#07071A]">А</span>
                  <span className="my-1 h-7 w-0.5 rounded-full bg-[#FFC400]/45" aria-hidden="true" />
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#FFC400] text-[11px] font-black text-[#FFC400]">Б</span>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-6 pt-0.5">
                  <span className="truncate text-[15px] font-medium text-white">{o.pickupAddress}</span>
                  <span className="truncate text-[15px] font-medium text-white">{o.destinationAddress}</span>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-2xl font-bold tracking-tight">{formatMoney(o.price)}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 border-t border-white/15 pt-3">
                <div className="min-w-0 flex-1 text-xs text-white/65">
                  <div className="truncate font-semibold text-white">{o.tariffName}</div>
                  <div className="truncate">
                    {[o.driverName, o.vehicle].filter(Boolean).join(" · ") || "Водитель не назначен"}
                  </div>
                </div>
                <Chevron />
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>

      <div className="sticky bottom-0 z-40">
        <BottomNav />
      </div>
    </main>
  );
}
