"use client";

import { useEffect } from "react";
import { Button } from "@/core/widgets/ui";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    console.error("💥 ПАССАЖИРСКИЙ ИНТЕРФЕЙС УПАЛ:", error);
    fetch("/api/debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Passenger UI Crash", data: { message: error.message, stack: error.stack } })
    }).catch(() => {});
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg p-6 text-center">
      <div className="neo max-w-md w-full rounded-3xl border border-danger/30 p-6">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/15 text-3xl">⚠️</div>
        <h2 className="mb-2 text-xl font-bold text-ink">Произошла ошибка</h2>
        <p className="mb-4 text-sm text-muted">{error.message}</p>
        <Button variant="primary" onClick={() => reset()}>Попробовать снова</Button>
      </div>
    </main>
  );
}
