"use client";

import { useState } from "react";
import { AppLogo } from "@/core/widgets/AppLogo";
import type { AppRole } from "@/shared/role";
import { setSessionToken } from "@/shared/api";

/** Минимальный интерфейс MAX Bridge: unsafe-данные — только для подсказок в интерфейсе. */
type MaxWebApp = {
  initData?: string;
  initDataUnsafe?: { user?: { id?: number | string; first_name?: string; last_name?: string } };
};
function getWebApp(): MaxWebApp | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { WebApp?: MaxWebApp }).WebApp;
}

const OPTIONS: { role: AppRole; icon: string; title: string; text: string }[] = [
  { role: "passenger", icon: "🧍", title: "Я пассажир", text: "Заказать поездку по городу" },
  { role: "driver", icon: "🚖", title: "Я водитель", text: "Принимать заказы и возить пассажиров" },
];

export function RoleSelect({ onChoose }: { onChoose: (role: AppRole) => void }) {
  const [loading, setLoading] = useState<AppRole | null>(null);
  const [nameHint, setNameHint] = useState("");

  const ensureWebApp = async (): Promise<MaxWebApp | undefined> => {
    let webApp = getWebApp();
    if (webApp || typeof window === "undefined") return webApp;

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://st.max.ru/js/max-web-app.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Не удалось загрузить MAX SDK"));
      document.body.appendChild(script);
    });
    webApp = getWebApp();
    const unsafeUser = webApp?.initDataUnsafe?.user;
    if (unsafeUser?.first_name) setNameHint(String(unsafeUser.first_name));
    return webApp;
  };

  const handleSelect = async (role: AppRole) => {
    localStorage.removeItem("max_auto_login_disabled");
    setLoading(role);
    try {
      const webApp = await ensureWebApp();
      const initData = webApp?.initData;
      if (!initData) {
        alert("Не удалось получить данные MAX. Откройте приложение через MAX.");
        return;
      }

      const res = await fetch("/api/auth/max", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // На сервер уходит только подписанная строка; initDataUnsafe используется для подсказки.
        body: JSON.stringify({ initData, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error?.message || "Ошибка входа");
      }
      // Сессия должна работать и без cookie (прокси превью их удаляет).
      if (typeof data.token === "string") setSessionToken(data.token);
      onChoose(role);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center justify-center">
        <AppLogo className="h-auto w-56 max-w-full drop-shadow-sm" />
      </div>

      <section className="flex flex-col gap-4" aria-label="Выбор роли">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Кто вы?</h1>
          <p className="mt-1 text-sm text-muted">
            {nameHint ? `${nameHint}, выберите роль — в следующий раз приложение откроется сразу.` : "Выберите роль — в следующий раз приложение откроется сразу."}
          </p>
        </div>
        {OPTIONS.map((option) => (
          <button
            key={option.role}
            id={`role-${option.role}`}
            type="button"
            onClick={() => handleSelect(option.role)}
            disabled={loading !== null}
            className="neo-btn flex min-h-24 items-center gap-4 px-5 py-4 text-left disabled:opacity-50"
          >
            <span className="neo-inset flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl" aria-hidden="true">
              {option.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold text-ink">{option.title}</span>
              <span className="block text-sm text-muted">{option.text}</span>
            </span>
            <span className="text-xl text-accent" aria-hidden="true">→</span>
          </button>
        ))}
        <p className="text-center text-xs text-muted">Роль можно сменить на экране входа или в настройках.</p>
      </section>
    </main>
  );
}
