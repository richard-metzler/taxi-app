import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // В Next.js 16 + Turbopack это помогает избежать лишних оптимизаций
  experimental: {
    // Можно добавить сюда другие флаги, если нужно
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // ВАЖНО: приложение — мини-приложение MAX и намеренно встраивается в iframe
          // на чужом origin (окно превью/MAX). Поэтому НЕ выставляем X-Frame-Options: DENY
          // и НЕ используем frame-ancestors 'none' — иначе приложение не загрузится в проде.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=*" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://st.max.ru",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              // Внешние вызовы (nominatim/osrm/max api) делает сервер, браузеру они не нужны —
              // оставляем только own-origin + MAX SDK для window.postMessage.
              "connect-src 'self' https://st.max.ru",
              "frame-ancestors *",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
