"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/shared/session";
import { setSessionToken } from "@/shared/api";
import { Button, Spinner } from "@/core/widgets/ui";
import { RoleSelect } from "@/features/authentication/RoleSelect";

/** Минимальный интерфейс MAX Bridge: unsafe-данные — только для подсказок в интерфейсе. */
type MaxWebApp = {
  initData?: string;
  initDataUnsafe?: { user?: { id?: number | string; first_name?: string; last_name?: string } };
};
function getWebApp(): MaxWebApp | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { WebApp?: MaxWebApp }).WebApp;
}

export default function LandingPage() {
  const { user, loading } = useSession();
  const [isSwitching, setIsSwitching] = useState(false);

  // Состояния для онбординга
  const [name, setName] = useState("");
  const [nameHint, setNameHint] = useState("");
  const [idHint, setIdHint] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Проверяем, пришли ли мы на страницу для смены роли
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const switching = params.get("switch") === "true";
    void Promise.resolve().then(() => setIsSwitching(switching));
  }, []);

  // Имя и ID из initDataUnsafe показываем как подсказку; на сервер уйдёт подписанный initData.
  useEffect(() => {
    const unsafeUser = getWebApp()?.initDataUnsafe?.user;
    if (!unsafeUser) return;
    void Promise.resolve().then(() => {
      if (unsafeUser.first_name) {
        setNameHint(String(unsafeUser.first_name));
        setName((current) => current || String(unsafeUser.first_name));
      }
      if (unsafeUser.id !== undefined) setIdHint(String(unsafeUser.id));
    });
  }, []);

  // АВТО-ВХОД: Если пользователь есть и мы не меняем роль — кидаем в его кабинет
  useEffect(() => {
    if (loading) return;
    if (isSwitching) return; // Если меняем роль, ничего не делаем

    if (user) {
      window.location.replace(user.role === "driver" ? "/driver" : "/home");
    }
  }, [user, loading, isSwitching]);

  // Обработка онбординга (ввод имени)
  const handleOnboard = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setError("");

    try {
      const initData = getWebApp()?.initData;
      if (!initData) throw new Error("Откройте приложение через MAX, чтобы продолжить");

      const res = await fetch("/api/auth/max", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, role: "passenger", name: name.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error?.message || "Ошибка сохранения. Попробуйте ещё раз.");
      }
      // Cookie может быть срезана прокси превью — сессия должна выжить через тело RPC.
      if (typeof data.token === "string") setSessionToken(data.token);

      window.location.href = "/home";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
      setIsSubmitting(false);
    }
  };

  // Обработка смены роли
  const handleSwitchRole = async (role: "passenger" | "driver") => {
    try {
      const initData = getWebApp()?.initData;
      if (!initData) {
        alert("Не удалось получить данные MAX. Откройте приложение через MAX.");
        return;
      }
      const res = await fetch("/api/auth/max", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message || "Ошибка смены роли");
      if (typeof data.token === "string") setSessionToken(data.token);
      window.location.href = role === "passenger" ? "/home" : "/driver";
    } catch (err) {
      console.error(err);
    }
  };

  // Если идет загрузка или мы перенаправляем — показываем спиннер
  if (loading || (user && !isSwitching)) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  // Экран выбора роли (только если нажали "Сменить роль")
  if (isSwitching) {
    return <RoleSelect onChoose={handleSwitchRole} />;
  }

  // Онбординг (если пользователя нет в базе)
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-surface p-6">
      <div className="neo-btn p-8 rounded-3xl text-center">
        <div className="w-20 h-20 bg-[#FFA500] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
          <span className="text-4xl font-bold text-black">Р</span>
        </div>
        <h1 className="text-2xl font-bold text-ink mb-2">Давай знакомиться</h1>
        <p className="text-sm text-muted mb-6">Как тебя зовут? Это имя будут видеть водители.</p>
        {idHint && <p className="text-xs text-muted mb-4">MAX ID: {idHint}</p>}

        <form onSubmit={handleOnboard} className="flex flex-col gap-4">
          {error && <div className="text-red-500 text-sm">{error}</div>}
          <input
            type="text"
            placeholder={nameHint ? `Например: ${nameHint}` : "Ваше имя"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleOnboard(); }
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
