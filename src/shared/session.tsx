"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, getLoginEpoch, UNAUTHORIZED_EVENT } from "./api";
import { homePathForRole, isAppRole, setStoredRole } from "./role";
import type { UserProfile } from "./types";

type Toast = { id: string; title: string; body: string; orderId?: string };

/** Почему показывается экран входа. */
export type GateReason = "initial" | "expired" | "signed_out";

type SessionContextValue = {
  user: UserProfile | null;
  loading: boolean;
  gateReason: GateReason;
  /** Завершение входа: экран входа скрывается, пользователь остаётся на той же странице. */
  completeSignIn: (u: UserProfile) => void;
  /** Обновление профиля (имя, навигатор). */
  setUser: (u: UserProfile) => void;
  refresh: () => Promise<void>;
  /** Выход. По умолчанию остаётся в разделе своей роли; `to` задаёт другой адрес (например, "/" для смены роли). */
  signOut: (options?: { to?: string }) => Promise<void>;
  notify: (title: string, body: string) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Провайдер сессии и уведомлений.
 * Восстанавливает сессию с сервера и опрашивает события заказов для in-app уведомлений
 * (в веб-версии заменяет push через FCM).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [gateReason, setGateReason] = useState<GateReason>("initial");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const sinceRef = useRef<string | null>(null);
  const userRef = useRef<UserProfile | null>(null);
  const router = useRouter();

  userRef.current = user;

  const notify = useCallback((title: string, body: string, orderId?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, title, body, orderId }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  /**
   * Восстановление сессии. Без сети вход не сбрасывается — попытка повторяется.
   * Результат игнорируется, если за время запроса пользователь успел войти заново.
   */
  const refresh = useCallback(async () => {
    const epoch = getLoginEpoch();
    for (;;) {
      try {
        const { user } = await api.auth.me();
        if (getLoginEpoch() === epoch) setUserState(user);
        break;
      } catch (err) {
        if (err instanceof ApiError && (err.code === "offline" || err.code === "network")) {
          await sleep(3000);
          if (getLoginEpoch() !== epoch) break;
          continue;
        }
        // Если сервер вернул 500-ю ошибку, НЕ разлогиниваем пользователя
        if (err instanceof ApiError && err.status && err.status >= 500) {
          console.error("Ошибка сервера при проверке сессии:", err);
          // Оставляем пользователя в текущем состоянии, просто завершаем загрузку
        } else if (getLoginEpoch() === epoch) {
          setUserState(null);
        }
        break;
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Сервер ответил 401: сессия недействительна — экран входа появится на текущей странице.
  useEffect(() => {
    const onUnauthorized = () => {
      if (!userRef.current) return;
      setGateReason("expired");
      setUserState(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // Роль учётной записи запоминается на устройстве: при следующем запуске выбирать её не нужно.
  useEffect(() => {
    if (user && isAppRole(user.role)) setStoredRole(user.role);
  }, [user]);

  // Опрос событий заказов для уведомлений (только у пассажира)
  useEffect(() => {
    if (!user || user.role !== "passenger") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const { items, now } = await api.orders.events(sinceRef.current);
        if (cancelled) return;
        sinceRef.current = now;
        items.forEach((e) => notify(e.title, e.body, e.orderId));
      } catch {
        /* сеть недоступна — повторим позже */
      }
    };
    void tick();
    const timer = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user, notify]);

  const completeSignIn = useCallback((u: UserProfile) => {
    setGateReason("initial");
    setUserState(u);
    setLoading(false);
  }, []);

  const setUser = useCallback((u: UserProfile) => setUserState(u), []);

  const signOut = useCallback(
    async (options?: { to?: string }) => {
      const role = userRef.current?.role;
      try {
        await api.auth.logout();
      } finally {
        setGateReason("signed_out");
        setUserState(null);
        // Обычный выход остаётся в разделе своей роли (вход появится на месте страницы, без полной
        // перезагрузки); в корень, к выбору роли, ведёт только явная смена роли.
        router.replace(options?.to ?? (isAppRole(role) ? homePathForRole(role) : "/"));
      }
    },
    [router],
  );

  return (
    <SessionContext.Provider value={{ user, loading, gateReason, completeSignIn, setUser, refresh, signOut, notify }}>
      {children}
      <div className="pointer-events-none fixed top-3 left-0 right-0 z-[3000] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => t.orderId && router.push(`/orders/${t.orderId}`)}
            className="neo toast-in pointer-events-auto w-full max-w-md px-4 py-3 text-left"
          >
            <div className="text-sm font-bold">{t.title}</div>
            <div className="text-sm text-muted">{t.body}</div>
          </button>
        ))}
      </div>
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession должен использоваться внутри SessionProvider");
  return ctx;
}

/**
 * Пользователь на экранах пассажира. Эти экраны рендерятся внутри AuthGate,
 * поэтому перенаправлений нет: без сессии на месте страницы показывается вход.
 */
export function useRequireAuth(): { user: UserProfile | null; loading: boolean } {
  const { user, loading } = useSession();
  return { user, loading };
}
