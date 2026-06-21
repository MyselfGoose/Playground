import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Next.js rewrites require destination to start with `/`, `http://`, or `https://`.
 * Vercel env values are sometimes pasted without a scheme — normalize defensively.
 * @param {string | undefined} raw
 */
export function normalizeProxyTarget(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const withoutTrailingSlash = s.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }
  return `https://${withoutTrailingSlash}`;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Monorepo: repo root also has package-lock.json, so Next was inferring the wrong Turbopack root and
   * watching/resolving the whole tree (backend + multiple node_modules) — huge RAM/CPU. Lock scope to this app.
   * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory
   */
  turbopack: {
    root: __dirname,
  },
  /** Dev: skip React Compiler to cut compile RAM/CPU; production builds still optimize. */
  reactCompiler: process.env.NODE_ENV === "production",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/7.x/**",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "4000",
        pathname: "/api/v1/users/avatars/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "4000",
        pathname: "/api/v1/users/avatars/**",
      },
      ...(process.env.NEXT_PUBLIC_AVATAR_HOSTS ?? "")
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean)
        .map((hostname) => ({
          protocol: "https",
          hostname,
          pathname: "/**",
        })),
    ],
  },
  /**
   * Same-origin REST proxy: browser requests `/api/v1/*` on the Next host; Next forwards to the API.
   * Set `API_PROXY_TARGET` on the Next deployment (e.g. `https://your-api.up.railway.app`).
   * Pair with `NEXT_PUBLIC_SAME_ORIGIN_API=1` and `NEXT_PUBLIC_SOCKET_URL=<API origin>` for Socket.IO.
   */
  async rewrites() {
    const raw =
      process.env.API_PROXY_TARGET?.trim() || process.env.BACKEND_URL?.trim() || "";
    const base = normalizeProxyTarget(raw);
    if (!base) return [];
    return [{ source: "/api/v1/:path*", destination: `${base}/api/v1/:path*` }];
  },
};

export default nextConfig;
