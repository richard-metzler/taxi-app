import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // gRPC-клиент YDB и его зависимости нельзя упаковывать в серверный бандл Next.js.
  serverExternalPackages: [
    "@ydbjs/core",
    "@ydbjs/query",
    "@ydbjs/value",
    "@ydbjs/auth",
    "@ydbjs/auth-yandex-cloud",
    "@ydbjs/drizzle-adapter",
    "@grpc/grpc-js",
    "nice-grpc",
  ],
};

export default nextConfig;
