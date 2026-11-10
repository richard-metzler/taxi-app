"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { useRequireAuth } from "@/shared/session";
import { driverStatusText, type DriverTripView } from "@/shared/driver-types";
import { formatMoney } from "@/shared/types";
import { BottomNav, DRIVER_NAV, ErrorBanner, PageHeader, Spinner, StatusPill } from "@/core/widgets/ui";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

/** История поездок водителя. */
export default function DriverHistoryPage() {
  const { user } = useRequireAuth();
  const [items, setItems] = useState<DriverTripView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (user) void load();
  }, [user, load]);

  if (!user) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <PageHeader title="Поездки" />
      <div className="flex flex-1 flex-col gap-3 px-3 pb-3">
        <ErrorBanner message={error} onRetry={load} />
        {items === null && !error ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-8 w-8 text-accent" />
          </div>
        ) : null}
        {items && items.length === 0 ? (
          <div className="neo mt-6 p-6 text-center text-muted">Поездок пока нет. Выйдите на линию, чтобы принимать заказы.</div>
        ) : null}
        {items?.map((trip) => (
          <article key={trip.id} className="neo p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted">{formatDate(trip.createdAt)}</div>
              <StatusPill text={driverStatusText(trip.status)} tone={trip.status === "completed" ? "success" : trip.status === "cancelled" ? "danger" : "accent"} />
            </div>
            <div className="mt-2 flex flex-col gap-1 text-sm">
              <div className="flex gap-2">
                <span className="text-accent">●</span>
                <span className="truncate">{trip.pickupAddress}</span>
              </div>
              <div className="flex gap-2">
                <span>■</span>
                <span className="truncate">{trip.destinationAddress}</span>
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div className="text-xs text-muted">
                {trip.passengerName} · {trip.tariffName}
              </div>
              <div className="text-lg font-bold">{formatMoney(trip.price)}</div>
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
