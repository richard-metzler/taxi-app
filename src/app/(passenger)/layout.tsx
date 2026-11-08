import type { ReactNode } from "react";
import { AuthGate } from "@/features/authentication/AuthGate";

/**
 * Экраны пассажира доступны только после входа.
 * Вход показывается на месте страницы — без перехода, после входа пользователь остаётся на ней.
 */
export default function PassengerLayout({ children }: { children: ReactNode }) {
  return <AuthGate role="passenger">{children}</AuthGate>;
}
