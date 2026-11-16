"use client";

import { useEffect, type ReactNode } from "react";
import { useSession } from "@/shared/session";
import { Spinner } from "@/core/widgets/ui";
import type { AppRole } from "@/shared/role";

export function AuthGate({ children, role }: { children: ReactNode; role: AppRole }) {
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;

    // 🚀 Если нет пользователя или его роль не совпадает с требуемой,
    // просто выкидываем на главную страницу (онбординг или выбор роли).
    if (!user || user.role !== role) {
      window.location.replace("/");
    }
  }, [user, loading, role]);

  // Пока сессия не загружена (и во время перенаправления) показываем спиннер.
  if (loading || !user || user.role !== role) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  return <>{children}</>;
}
