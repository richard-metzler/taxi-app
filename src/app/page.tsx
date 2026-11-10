"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/shared/session";
import { Button, Spinner } from "@/core/widgets/ui";
import { RoleSelect } from "@/features/authentication/RoleSelect";

export default function LandingPage() {
  const { user, loading } = useSession();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleOnboard = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  // Если пользователь уже есть в базе, показываем выбор роли (Пассажир/Водитель)
  if (user) {
    return <RoleSelect onChoose={(role) => {
      // При выборе роли обновляем её на сервере и переходим
      fetch('/api/auth/max', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxUserId: user.phone.replace('max_', ''), role }),
      }).then(() => {
        window.location.href = role === 'passenger' ? '/home' : '/driver';
      });
    }} />;
  }

  // Онбординг для новых пользователей
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-surface p-6">
      <div className="neo-btn p-8 rounded-3xl text-center">
        <div className="w-20 h-20 bg-[#FFA500] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
          <span className="text-4xl font-bold text-black">Р</span>
        </div>
        <h1 className="text-2xl font-bold text-ink mb-2">Давай знакомиться</h1>
        <p className="text-sm text-muted mb-6">Как тебя зовут? Это имя будут видеть водители.</p>
        
        <form onSubmit={handleOnboard} className="flex flex-col gap-4">
          {error && <div className="text-red-500 text-sm">{error}</div>}
          <input
            type="text"
            placeholder="Ваше имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleOnboard(); }
            }}
            className="neo-inset w-full p-3 rounded-xl outline-none text-center text-lg text-ink"
          />
          <Button 
            type="button" 
            onClick={() => handleOnboard()} 
            variant="primary" 
            className="w-full touch-manipulation" 
            loading={isSubmitting}
          >
            Продолжить
          </Button>
        </form>
      </div>
    </main>
  );
}
