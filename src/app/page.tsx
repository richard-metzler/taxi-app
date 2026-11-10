"use client";
import { logClient } from "@/shared/logger";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/shared/session";
import { getStoredRole, homePathForRole, isAppRole, setStoredRole, type AppRole } from "@/shared/role";
import { RoleSelect } from "@/features/authentication/RoleSelect";
import { Spinner } from "@/core/widgets/ui";

/**
 * Точка входа приложения.
 * - Есть сессия — сразу открывается раздел роли учётной записи (без повторной регистрации).
 * - Нет сессии, но роль выбрана раньше — открывается вход этой роли.
 * - Ничего не выбрано — экран выбора роли.
 */
export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [stored, setStored] = useState<AppRole | null | undefined>(undefined);

  useEffect(() => {
    setStored(getStoredRole());
  }, []);

  useEffect(() => {
    if (loading || stored === undefined) return;
    if (user && isAppRole(user.role)) router.replace(homePathForRole(user.role));
    else if (stored) router.replace(homePathForRole(stored));
  }, [loading, stored, user, router]);

  if (loading || stored === undefined || (user && isAppRole(user.role)) || stored) {
    return (
      <main className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  return (
    <RoleSelect
      onChoose={(role) => {
        setStoredRole(role);
        setStored(role);
      }}
    />
  );
}
