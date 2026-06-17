import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Mọi request /api/* được proxy về backend FastAPI
      // → trang chỉ cần fetch("/api/scripts"), không cần biết domain backend
      // → Funnel chỉ cần expose 1 port (3000)
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
