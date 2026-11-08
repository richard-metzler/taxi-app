"use client";

import { useEffect } from "react";

/** Ошибка интерфейса. Частая причина в превью — приложение обновилось, пока страница была открыта. */
export default function AppError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error("[ui] Ошибка интерфейса:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="neo flex h-16 w-16 items-center justify-center rounded-2xl text-3xl">⚠️</div>
      <h1 className="text-xl font-bold">Что-то пошло не так</h1>
      <p className="text-muted">
        Возможно, приложение обновилось, пока страница была открыта. Обновите страницу — вход и активный заказ
        восстановятся автоматически.
      </p>
      <button onClick={() => window.location.reload()} className="neo-btn-primary px-6 py-3 font-semibold">
        Обновить страницу
      </button>
    </main>
  );
}
