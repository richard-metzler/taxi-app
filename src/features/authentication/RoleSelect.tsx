"use client";

import { useState } from "react";
import { BrandMark } from "@/core/widgets/BrandMark";
import { GlassCard, TaxiArt, TuberBackdrop } from "@/core/widgets/TuberUI";
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
    <main className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-[#07071A] text-white">
      <TuberBackdrop />

      {/* Оранжевая машина на фоне, как в эталоне */}
      <div className="pointer-events-none absolute -bottom-14 left-1/2 z-0 h-56 w-[360px] max-w-[110%] -translate-x-1/2 opacity-90">
        <TaxiArt view="top" className="h-full w-full" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 py-12">
        <div className="flex flex-col items-center">
          <BrandMark className="h-20 w-20 drop-shadow-[0_12px_24px_rgba(0,0,0,0.5)]" />
          <span className="mt-2 text-[42px] font-black leading-none tracking-tight">рядом</span>
        </div>

        <GlassCard className="mt-10 p-6">
          <span className="inline-flex h-1.5 w-10 rounded-full bg-[#FFC400]" aria-hidden="true" />
          <div className="mt-4 text-center" aria-label="Выбор роли">
            <h1 className="text-[28px] font-bold leading-tight">Кто вы?</h1>
            <p className="mt-2 text-sm leading-snug text-white/70">
              {nameHint
                ? `${nameHint}, выберите роль — в следующий раз приложение откроется сразу.`
                : "Выберите роль — в следующий раз приложение откроется сразу."}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {OPTIONS.map((option) => (
              <button
                key={option.role}
                id={`role-${option.role}`}
                type="button"
                onClick={() => handleSelect(option.role)}
                disabled={loading !== null}
                className="group flex min-h-24 items-center gap-4 rounded-[22px] border border-white/20 bg-white/10 p-4 text-left backdrop-blur-xl transition disabled:opacity-50"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFC400]/15 text-3xl" aria-hidden="true">
                  {option.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-bold text-white">{option.title}</span>
                  <span className="block text-sm leading-snug text-white/70">{option.text}</span>
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFC400] text-lg font-bold text-[#07071A]" aria-hidden="true">
                  →
                </span>
              </button>
            ))}
          </div>

          <p className="mt-5 text-center text-xs text-white/55">
            Роль можно сменить на экране входа или в настройках.
          </p>
        </GlassCard>
      </div>
    </main>
  );
}
