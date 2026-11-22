"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/shared/session";
import { setSessionToken } from "@/shared/api";
import { Spinner } from "@/core/widgets/ui";
import { SplashScreen } from "@/core/widgets/SplashScreen";
import { BrandMark } from "@/core/widgets/BrandMark";
import { GlassCard, TaxiArt, TuberBackdrop } from "@/core/widgets/TuberUI";
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
  const router = useRouter();
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

      router.push("/home");
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
      router.push(role === "passenger" ? "/home" : "/driver");
    } catch (err) {
      console.error(err);
    }
  };

  // Пока проверяется сессия — стартовый экран с логотипом.
  if (loading || (user && !isSwitching)) {
    return <SplashScreen />;
  }

  // Экран выбора роли (только если нажали "Сменить роль")
  if (isSwitching) {
    return <RoleSelect onChoose={handleSwitchRole} />;
  }

  // Онбординг (если пользователя нет в базе)
  return (
    <main className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-[#07071A] text-white">
      <TuberBackdrop />

      {/* Оранжевая 3D-машина — как в эталоне, законтентным слоем */}
      <div className="pointer-events-none absolute -bottom-16 left-1/2 z-0 h-[260px] w-[380px] max-w-[110%] -translate-x-1/2">
        <TaxiArt view="front" className="h-full w-full" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col px-6 pb-14 pt-12">
        {/* Крупный логотип «рядом» */}
        <div className="flex flex-col items-center">
          <BrandMark className="h-20 w-20 drop-shadow-[0_12px_24px_rgba(0,0,0,0.5)]" />
          <h1 className="mt-2 text-[46px] font-black leading-none tracking-tight">рядом</h1>
          <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.28em] text-[#FFC400]">
            такси на связи
          </p>
        </div>

        <GlassCard className="mt-10 p-6">
          <span className="inline-flex h-1.5 w-10 rounded-full bg-[#FFC400]" aria-hidden="true" />
          <h2 className="mt-4 text-[26px] font-bold leading-tight">Давай знакомиться</h2>
          <p className="mt-2 text-sm leading-snug text-white/70">
            Как тебя зовут? Это имя будут видеть водители.
          </p>
          {idHint ? <p className="mt-2 text-xs font-medium text-[#FFC400]">MAX ID: {idHint}</p> : null}

          <form onSubmit={handleOnboard} className="mt-6 flex flex-col gap-4">
            {error ? (
              <div className="rounded-2xl border border-danger/40 bg-danger/15 px-4 py-3 text-sm text-danger" role="alert">
                {error}
              </div>
            ) : null}
            <input
              type="text"
              placeholder={nameHint ? `Например: ${nameHint}` : "Ваше имя"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleOnboard(); }
              }}
              aria-label="Ваше имя"
              className="w-full rounded-2xl border border-white/25 bg-white/10 px-4 py-4 text-center text-lg text-white outline-none transition placeholder:text-white/45 focus:border-[#FFC400] focus:bg-white/15"
            />
            <button
              type="button"
              onClick={() => handleOnboard()}
              disabled={isSubmitting}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#FFC400] px-5 py-4 text-base font-bold text-[#07071A] shadow-[0_12px_30px_rgba(255,196,0,0.28)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <Spinner className="h-5 w-5" /> : null}
              Продолжить
            </button>
          </form>
        </GlassCard>

        <p className="mt-auto pt-8 text-center text-xs leading-snug text-white/50">
          Продолжая, вы соглашаетесь с правилами сервиса
        </p>
      </div>
    </main>
  );
}
