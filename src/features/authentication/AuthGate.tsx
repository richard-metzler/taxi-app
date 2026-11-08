"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/shared/session";
import { homePathForRole, isAppRole, type AppRole } from "@/shared/role";
import { Button, Spinner } from "@/core/widgets/ui";
import { LoginFlow } from "./LoginFlow";

/** Пояснение, когда вход потребовался на конкретной странице или сессия завершилась. */
export const RETURN_NOTICE =
  "Чтобы продолжить, войдите по номеру телефона и паролю. После входа вы вернётесь на прежнюю страницу.";

/**
 * Защита экранов роли (пассажир или водитель).
 * Без сессии вместо страницы показывается вход — на том же адресе, без перенаправлений.
 * Если сессия принадлежит другой роли, пользователь переходит в свой раздел.
 */
export function AuthGate({ children, role }: { children: ReactNode; role: AppRole }) {
  const { user, loading, gateReason, signOut } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const otherRole = user && isAppRole(user.role) && user.role !== role ? user.role : null;
  useEffect(() => {
    if (otherRole) router.replace(homePathForRole(otherRole));
  }, [otherRole, router]);

  if (loading || otherRole) {
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
