import type { ReactNode } from "react";
import { AuthGate } from "@/features/authentication/AuthGate";

/** Экраны водителя доступны только после входа водителя. */
export default function DriverLayout({ children }: { children: ReactNode }) {
  return <AuthGate role="driver">{children}</AuthGate>;
}
