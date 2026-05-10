This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

## API URL (Playgrounds)

- **Local:** By default the app calls `http://localhost:4000` for REST (see `src/lib/api.js`).
- **Production (cross-origin):** Set `NEXT_PUBLIC_API_URL` to your API origin (no `/api/v1` suffix).
- **Production (same-origin REST proxy):** On Vercel/hosting, set server env `API_PROXY_TARGET` to the API base URL, set `NEXT_PUBLIC_SAME_ORIGIN_API=1`, and set `NEXT_PUBLIC_SOCKET_URL` to that same API origin so Socket.IO connections still hit the backend directly.

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
