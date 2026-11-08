"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { useRequireAuth } from "@/shared/session";
import { formatMoney, ORDER_STATUS_TEXT, type OrderSummary } from "@/shared/types";
import { BottomNav, ErrorBanner, PageHeader, Spinner, StatusPill } from "@/core/widgets/ui";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

export default function HistoryPage() {
  const { user, loading } = useRequireAuth();
  const [items, setItems] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (user) void load();
  }, [user, load]);

  if (loading || !user) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <PageHeader title="История поездок" />
      <div className="flex flex-1 flex-col gap-3 px-3 pb-3">
        <ErrorBanner message={error} onRetry={load} />
        {items === null && !error ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-8 w-8 text-accent" />
          </div>
        ) : null}
        {items && items.length === 0 ? (
          <div className="neo mt-6 p-6 text-center text-muted">
            Поездок пока нет.
            <br />
            <Link href="/home" className="font-semibold text-accent">
              Заказать такси
            </Link>
          </div>
        ) : null}
        {items?.map((o) => {
          const tone = o.status === "paid" ? "success" : o.status === "cancelled" || o.status === "payment_failed" ? "danger" : "accent";
          return (
            <Link key={o.id} href={`/orders/${o.id}`} className="neo block p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted">{formatDate(o.createdAt)}</div>
                <StatusPill text={ORDER_STATUS_TEXT[o.status]} tone={tone} />
              </div>
              <div className="mt-2 flex flex-col gap-1 text-sm">
                <div className="flex gap-2">
                  <span className="text-accent">●</span>
                  <span className="truncate">{o.pickupAddress}</span>
                </div>
                <div className="flex gap-2">
                  <span>■</span>
                  <span className="truncate">{o.destinationAddress}</span>
                </div>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div className="text-xs text-muted">
                  {o.tariffName}
                  {o.driverName ? ` · ${o.driverName}` : ""}
                  {o.vehicle ? <div>{o.vehicle}</div> : null}
                </div>
                <div className="text-lg font-bold">{formatMoney(o.price)}</div>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="sticky bottom-0">
        <BottomNav />
      </div>
    </main>
  );
}
