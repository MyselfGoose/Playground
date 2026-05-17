This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

`npm run dev` runs **Webpack** dev mode (`next dev --webpack`) to keep RAM and CPU lower than Turbopack on constrained machines. For Turbopack instead:

```bash
npm run dev:turbo
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

## API URL (Playgrounds)

- **Local:** By default the app calls `http://localhost:4000` for REST (see `src/lib/api.js`).
- **Production (recommended — mobile-safe cookies):** Use the same-origin REST proxy (see `frontend/.env.example`):
  - Vercel **server** env: `API_PROXY_TARGET=https://<your-railway-host>`
  - Vercel **client** env: `NEXT_PUBLIC_SAME_ORIGIN_API=1`
  - Vercel **client** env: `NEXT_PUBLIC_SOCKET_URL=https://<your-railway-host>`
  - Remove or leave unset `NEXT_PUBLIC_API_URL` when using same-origin mode.
  - Railway: `CORS_ORIGIN` must list your exact Vercel URL(s); leave `COOKIE_DOMAIN` unset.
- **Production (legacy cross-origin):** `NEXT_PUBLIC_API_URL` only — cookies are third-party and unreliable on iOS/Android.

Verify after deploy: `npm run smoke:auth-proxy` (set `API_PROXY_TARGET` / `FRONTEND_URL`).

See [backend `docs/auth-flow.md`](../backend/src/docs/auth-flow.md) for cookie and mobile debugging.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
