import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.31.41"],
  outputFileTracingIncludes: {
    '/api/**/*': ['./prisma/dev.db', './prisma/schema.prisma'],
  },
};

export default nextConfig;
