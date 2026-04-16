"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "../../lib/context/UserContext.jsx";
import { Button } from "../../components/Button.jsx";

function avatarUrlFor(username) {
  const seed = encodeURIComponent(username || "player");
  return `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${seed}`;
}

export default function LoginPage() {
  const { setUser } = useUser();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const local = email.split("@")[0]?.trim() || "Goose";
    const username =
      local.length > 0
        ? local.charAt(0).toUpperCase() + local.slice(1)
        : "Goose";
    setUser({
      username,
      avatarUrl: avatarUrlFor(username),
    });
    router.push("/");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-md rounded-[var(--radius-2xl)] bg-white/80 p-8 shadow-[var(--shadow-soft)] ring-2 ring-white/80 backdrop-blur-sm sm:p-10">
        <h1 className="text-center text-3xl font-extrabold text-ink">Hey again!</h1>
        <p className="mt-2 text-center text-sm text-ink-muted">
          Demo login — no server yet. We will wire this to your API later.
        </p>
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
          <label className="block text-left">
            <span className="mb-1.5 block text-sm font-bold text-ink-muted">
              Email
            </span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 text-ink shadow-sm outline-none ring-accent/0 transition focus:border-accent/40 focus:ring-4 focus:ring-accent/15"
              placeholder="goose@example.com"
            />
          </label>
          <label className="block text-left">
            <span className="mb-1.5 block text-sm font-bold text-ink-muted">
              Password
            </span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 text-ink shadow-sm outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/15"
              placeholder="Anything works for now"
            />
          </label>
          <Button type="submit" variant="primary" className="mt-2 w-full">
            Login
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-ink-muted">
          Rather wander?{" "}
          <Link href="/games" className="font-bold text-accent underline-offset-2 hover:underline">
            Browse games
          </Link>
        </p>
      </div>
    </div>
  );
}
