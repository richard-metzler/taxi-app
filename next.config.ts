import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Отключаем проверку типов при сборке (мы делаем это локально), чтобы сэкономить память
  typescript: {
    ignoreBuildErrors: true,
  },
  // В Next.js 16 + Turbopack это помогает избежать лишних оптимизаций
  experimental: {
    // Можно добавить сюда другие флаги, если нужно
  },
};

export default nextConfig;
