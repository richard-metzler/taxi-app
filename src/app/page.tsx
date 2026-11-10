"use client";

import { useRouter } from "next/navigation";
import { RoleSelect } from "@/features/authentication/RoleSelect";

export default function Home() {
  const router = useRouter();

  const selectRole = async (role: 'passenger' | 'driver') => {
    // Сбрасываем старую сессию и флаги
    localStorage.removeItem("taxi_passenger_session");
    localStorage.removeItem("max_auto_login_disabled");
    if (typeof window !== "undefined") window.name = "";

    // Если открыто в MAX, принудительно меняем роль в базе
    if (typeof window !== "undefined" && (window as any).WebApp?.initDataUnsafe?.user?.id) {
      const maxUserId = String((window as any).WebApp.initDataUnsafe.user.id);
      await fetch('/api/auth/max', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxUserId, role }),
      });
    }
    
    router.push(`/${role}`);
  };

  return <RoleSelect onChoose={selectRole} />;
}
