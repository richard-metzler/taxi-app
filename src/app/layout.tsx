import Script from "next/script";
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
  description: "Рядом — заказ такси: адрес, расчёт стоимости, поиск водителя и поездка",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B0D10",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-bg text-ink antialiased">
        <SessionProvider>
          <OfflineBanner />
          <Script src="https://st.max.ru/js/max-web-app.js" strategy="beforeInteractive" />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
