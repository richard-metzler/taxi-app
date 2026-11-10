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
    <main className="flex min-h-dvh flex-col items-center justify-center p-6 text-center bg-surface">
      <div className="bg-red-50 text-red-600 p-6 rounded-3xl max-w-md w-full shadow-lg border border-red-100">
        <h2 className="text-xl font-bold mb-2">Произошла ошибка</h2>
        <p className="text-sm mb-4">{error.message}</p>
        <Button onClick={() => reset()}>Попробовать снова</Button>
      </div>
    </main>
  );
}
