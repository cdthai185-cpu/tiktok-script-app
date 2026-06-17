import type { NextConfig } from "next";

// /api/* được handle bởi app/api/[...path]/route.ts (server-side proxy)
// Không dùng rewrites — Route Handler reliable hơn trên Render Docker.
const nextConfig: NextConfig = {};

export default nextConfig;
