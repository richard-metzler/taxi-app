"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/shared/session";
import { homePathForRole, isAppRole, type AppRole } from "@/shared/role";
import { Button, Spinner } from "@/core/widgets/ui";
import { LoginFlow } from "./LoginFlow";
import { logClient } from "@/shared/logger";

export const RETURN_NOTICE = "Чтобы продолжить, войдите по номеру телефона и паролю.";

export function AuthGate({ children, role }: { children: ReactNode; role: AppRole }) {
  const { user, loading, gateReason, signOut } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  
  const [maxLoginTried, setMaxLoginTried] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

  useEffect(() => {
    if (loading || maxLoginTried) return;
    if (typeof window === 'undefined') return;

    const isRoleMismatch = user && user.role !== role;

    // Если роль совпадает, ничего не делаем
    if (user && !isRoleMismatch) return;

    // Если роль не совпадает (например, пассажир зашел на страницу водителя)
    if (isRoleMismatch) {
      setSwitchingRole(true);
    }

    // Проверяем блокировку автовхода (если нажали "Выйти")
    if (localStorage.getItem("max_auto_login_disabled") === "true") {
      if (isRoleMismatch) window.location.href = "/";
      return;
    }

    const maxUserId = (window as any).WebApp?.initDataUnsafe?.user?.id;
    
    if (!maxUserId) {
      if (isRoleMismatch) window.location.href = "/";
      return;
    }

    setMaxLoginTried(true);
    logClient(`AuthGate: switching role to ${role}`, { maxUserId });

    fetch('/api/auth/max', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxUserId: String(maxUserId), role }),
    })
      .then(res => {
        if (res.ok) {
          window.location.reload(); // Перезагружаем, чтобы сервер выдал новую сессию
        } else {
          setSwitchingRole(false);
          setMaxLoginTried(false);
        }
      })
      .catch(() => {
        setSwitchingRole(false);
        setMaxLoginTried(false);
      });
  }, [loading, user, maxLoginTried, role]);

  if (loading || switchingRole) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined' && localStorage.getItem("max_auto_login_disabled") === "true") {
      window.location.href = "/";
      return null;
    }
    const rootPath = homePathForRole(role);
    const showNotice = gateReason === "expired" || (gateReason === "initial" && pathname !== rootPath);
    return <LoginFlow key={`login-${role}`} role={role} notice={showNotice ? RETURN_NOTICE : null} />;
  }

  if (!isAppRole(user.role)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted">Эта учётная запись не поддерживается в приложении.</p>
        <Button onClick={() => { localStorage.setItem("max_auto_login_disabled", "true"); void signOut().then(() => { window.location.href = "/"; }); }}>
          Выйти из аккаунта
        </Button>
      </main>
    );
  }

  // Если роль всё ещё не совпадает (не удалось переключить)
  if (user.role !== role) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted">У вас нет доступа к этой странице.</p>
        <Button onClick={() => { window.location.href = "/"; }}>На главную</Button>
      </main>
    );
  }

  return <>{children}</>;
}
