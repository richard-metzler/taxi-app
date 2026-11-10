"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/shared/session";
import { Button, Spinner } from "@/core/widgets/ui";

export default function LandingPage() {
  const { user, loading } = useSession();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    // Проверяем, пришли ли мы сюда со страницы настроек для смены роли
    if (typeof window !== "undefined") {
      setIsSwitching(window.location.search.includes("switch=driver"));
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (isSwitching) return; // Если меняем роль, не перенаправляем

    // Авто-вход при повторном запуске
    if (user) {
      if (user.role === "driver") {
        window.location.replace("/driver");
      } else {
        window.location.replace("/home");
      }
    }
  }, [user, loading, isSwitching]);

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setError("");

    try {
      const maxUserId = (window as any).WebApp?.initDataUnsafe?.user?.id;
      if (!maxUserId) throw new Error("Не удалось получить ID пользователя MAX");

      const res = await fetch("/api/auth/max", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxUserId: String(maxUserId), role: "passenger", name: name.trim() }),
      });

      if (!res.ok) throw new Error("Ошибка сохранения. Попробуйте еще раз.");
      
      window.location.href = "/home";
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  const handleSwitchToDriver = async () => {
    setIsSubmitting(true);
    setError("");

    try {
      const maxUserId = (window as any).WebApp?.initDataUnsafe?.user?.id;
      if (!maxUserId) throw new Error("Не удалось получить ID пользователя MAX");

      const res = await fetch("/api/auth/max", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxUserId: String(maxUserId), role: "driver" }),
      });

      if (!res.ok) throw new Error("Ошибка смены роли. Попробуйте еще раз.");
      
      window.location.href = "/driver";
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  if (loading || (user && !isSwitching)) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-surface p-6">
      <div className="neo-btn p-8 rounded-3xl text-center">
        {isSwitching ? (
          /* Экран смены роли (только водитель) */
          <>
            <h1 className="text-2xl font-bold text-ink mb-2">Стать водителем</h1>
            <p className="text-sm text-muted mb-6">Вы сможете принимать заказы и зарабатывать.</p>
            
            {error && <div className="text-red-500 text-sm mb-4">{error}</div>}
            
            <Button onClick={handleSwitchToDriver} loading={isSubmitting} className="w-full mb-4">
              Я водитель
            </Button>
            <button 
              onClick={() => window.location.href = "/home"}
              className="text-sm text-muted underline"
            >
              Отмена
            </button>
          </>
        ) : (
          /* Экран онбординга (первый запуск) */
          <>
            <div className="w-20 h-20 bg-[#FFA500] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <span className="text-4xl font-bold text-black">Р</span>
            </div>
            <h1 className="text-2xl font-bold text-ink mb-2">Давай знакомиться</h1>
            <p className="text-sm text-muted mb-6">Как тебя зовут? Это имя будут видеть водители.</p>
            
            <form onSubmit={handleOnboard} className="flex flex-col gap-4">
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <input
                type="text"
                required
                placeholder="Ваше имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="neo-inset w-full p-3 rounded-xl outline-none text-center text-lg text-ink"
              />
              <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>
                Продолжить
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
