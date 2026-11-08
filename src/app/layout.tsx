import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SessionProvider } from "@/shared/session";
import { OfflineBanner } from "@/core/widgets/ui";

/**
 * HTML всегда формируется заново и не кешируется прокси (иначе после пересборки
 * браузер может получить устаревшую страницу со ссылками на старые скрипты).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Рядом",
  description: "Заказ такси: адрес, стоимость, поиск водителя, поездка, оплата",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#E9EDF2",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-bg text-ink antialiased">
        <SessionProvider>
          <OfflineBanner />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
