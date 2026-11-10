"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/shared/session";
import { Spinner } from "@/core/widgets/ui";
import type { AppRole } from "@/shared/role";

export function AuthGate({ children, role }: { children: ReactNode; role: AppRole }) {
  const { user, loading } = useSession();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;

    // 🚀 ГЛАВНОЕ ПРАВИЛО: Если нет юзера или его активная роль не совпадает, 
    // выкидываем на главный экран выбора роли. Никаких автологинов.
    if (!user || user.role !== role) {
      router.replace("/");
      return;
    }

    setChecking(false);
  }, [user, loading, role, router]);

  if (loading || checking) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-accent" />
      </main>
    );
  }

  return <>{children}</>;
}
