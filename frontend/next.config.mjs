/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/7.x/**",
      },
    ],
  },
  /**
   * Same-origin REST proxy: browser requests `/api/v1/*` on the Next host; Next forwards to the API.
   * Set `API_PROXY_TARGET` on the Next deployment (e.g. `https://your-api.up.railway.app`).
   * Pair with `NEXT_PUBLIC_SAME_ORIGIN_API=1` and `NEXT_PUBLIC_SOCKET_URL=<API origin>` for Socket.IO.
   */
  async rewrites() {
    const target = process.env.API_PROXY_TARGET?.trim() || process.env.BACKEND_URL?.trim() || "";
    if (!target) return [];
    const base = target.replace(/\/+$/, "");
    return [{ source: "/api/v1/:path*", destination: `${base}/api/v1/:path*` }];
  },
};

export default nextConfig;
