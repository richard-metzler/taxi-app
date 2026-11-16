import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // В Next.js 16 + Turbopack это помогает избежать лишних оптимизаций
  experimental: {
    // Можно добавить сюда другие флаги, если нужно
  },
};

export default nextConfig;
