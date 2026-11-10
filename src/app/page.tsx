"use client";

import { useRouter } from "next/navigation";
import { RoleSelect } from "@/features/authentication/RoleSelect";

export default function Home() {
  const router = useRouter();

  const selectRole = async (role: 'passenger' | 'driver') => {
    try {
      // Сбрасываем сессию и блокировки
      localStorage.removeItem("taxi_passenger_session");
      localStorage.removeItem("max_auto_login_disabled");
      if (typeof window !== "undefined") window.name = "";

      // Если есть MAX, обновляем роль на сервере
      if (typeof window !== "undefined" && (window as any).WebApp?.initDataUnsafe?.user?.id) {
        const maxUserId = String((window as any).WebApp.initDataUnsafe.user.id);
        const res = await fetch('/api/auth/max', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxUserId, role }),
        });
        if (!res.ok) {
          console.error("Ошибка смены роли", await res.text());
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      // Принудительный переход по правильным путям
      if (role === 'passenger') {
        window.location.href = "/home";
      } else {
        window.location.href = "/driver";
      }
    }
  };

  return <RoleSelect onChoose={selectRole} />;
}
