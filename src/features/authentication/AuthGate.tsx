"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/shared/session";
import { homePathForRole, isAppRole, type AppRole } from "@/shared/role";
import { Button, Spinner } from "@/core/widgets/ui";
import { LoginFlow } from "./LoginFlow";

export const RETURN_NOTICE =
  "Чтобы продолжить, войдите по номеру телефона и паролю. После входа вы вернётесь на прежнюю страницу.";

export function AuthGate({ children, role }: { children: ReactNode; role: AppRole }) {
  const { user, loading, gateReason, signOut } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  
  const [maxLoginTried, setMaxLoginTried] = useState(false);

  // 🚀 Авто-логин через MAX
  useEffect(() => {
    if (loading || user || maxLoginTried) return;
    if (typeof window === 'undefined') return;

    const maxUserId = (window as any).WebApp?.initDataUnsafe?.user?.id;
    if (!maxUserId) return;

    setMaxLoginTried(true);
    console.log("Авто-логин через MAX ID:", maxUserId);

    fetch('/api/auth/max', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxUserId: String(maxUserId), role }),
    })
      .then(res => {
        if (res.ok) {
          window.location.reload(); // Перезагружаем, чтобы подхватились куки
        } else {
          console.error("Ошибка авто-логина MAX");
        }
      })
      .catch(console.error);
  }, [loading, user, maxLoginTried, role]);

  const otherRole = user && isAppRole(user.role) && user.role !== role ? user.role : null;
  useEffect(() => {
    if (otherRole) router.replace(homePathForRole(otherRole));
  }, [otherRole, router]);

  if (loading || otherRole || (maxLoginTried && !user)) {
    return (
      <main className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  if (!user) {
    const rootPath = homePathForRole(role);
    const showNotice = gateReason === "expired" || (gateReason === "initial" && pathname !== rootPath);
    return <LoginFlow key={`login-${role}`} role={role} notice={showNotice ? RETURN_NOTICE : null} />;
  }

  if (!isAppRole(user.role)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted">Эта учётная запись не поддерживается в приложении.</p>
        <Button onClick={() => void signOut()}>Выйти из аккаунта</Button>
      </main>
    );
  }

  return <>{children}</>;
}
