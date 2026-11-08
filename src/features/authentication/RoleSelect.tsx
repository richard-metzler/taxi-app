"use client";

import { useState } from "react";
import { AppLogo } from "@/core/widgets/AppLogo";
import type { AppRole } from "@/shared/role";

const OPTIONS: { role: AppRole; icon: string; title: string; text: string }[] = [
  { role: "passenger", icon: "🧍", title: "Я пассажир", text: "Заказать поездку по городу" },
  { role: "driver", icon: "🚖", title: "Я водитель", text: "Принимать заказы и возить пассажиров" },
];

export function RoleSelect({ onChoose }: { onChoose: (role: AppRole) => void }) {
  const [loading, setLoading] = useState<AppRole | null>(null);

  const handleSelect = async (role: AppRole) => {
    setLoading(role);
    try {
      if (typeof window !== 'undefined' && !(window as any).WebApp) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://st.max.ru/js/max-web-app.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Не удалось загрузить MAX SDK'));
          document.body.appendChild(script);
        });
      }
      const maxUserId = (window as any).WebApp?.initDataUnsafe?.user?.id;
      if (!maxUserId) {
        alert('Не удалось получить ID пользователя MAX. Откройте приложение через MAX.');
        setLoading(null);
        return;
      }
      const res = await fetch('/api/auth/max', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxUserId: String(maxUserId), role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || 'Ошибка входа');
      }
      onChoose(role);
    } catch (err: any) {
      alert(err.message || 'Ошибка');
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
          <p className="mt-1 text-sm text-muted">Выберите роль — в следующий раз приложение откроется сразу.</p>
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
