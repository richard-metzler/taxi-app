"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/shared/session";
import { Spinner } from "@/core/widgets/ui";
import type { AppRole } from "@/shared/role";

export function AuthGate({ children, role }: { children: ReactNode; role: AppRole }) {
  const { user, loading } = useSession();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;

    // 🚀 Если нет пользователя или его роль не совпадает с требуемой,
    // просто выкидываем на главную страницу (онбординг или выбор роли).
    if (!user || user.role !== role) {
      window.location.replace("/");
      return;
    }

    setChecking(false);
  }, [user, loading, role]);

  if (loading || checking) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  return <>{children}</>;
}
