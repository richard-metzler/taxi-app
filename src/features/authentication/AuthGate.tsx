"use client";

import { useEffect, type ReactNode } from "react";
import { useSession } from "@/shared/session";
import { Spinner } from "@/core/widgets/ui";
import { BrandMark } from "@/core/widgets/BrandMark";
import { TuberBackdrop } from "@/core/widgets/TuberUI";
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
      <main className="relative flex min-h-dvh flex-col items-center justify-center gap-5 overflow-hidden bg-[#07071A] text-white">
        <TuberBackdrop />
        <BrandMark className="relative z-10 h-16 w-16 drop-shadow-[0_0_20px_rgba(255,196,0,0.4)]" />
        <Spinner className="relative z-10 h-8 w-8 text-[#FFC400]" />
      </main>
    );
  }

  return <>{children}</>;
}
