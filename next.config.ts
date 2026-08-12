import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.qwickword.com" }],
        destination: "https://qwickword.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
