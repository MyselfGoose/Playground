"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError } from "../../lib/api.js";
import { useUser } from "../../lib/context/UserContext.jsx";
import { Button } from "../../components/Button.jsx";

const passwordHint =
  "At least 12 characters with upper, lower, number, and a special character.";

export default function RegisterPage() {
  const { register } = useUser();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await register({ username: username.trim(), email: email.trim(), password });
      router.push("/");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-md rounded-[var(--radius-2xl)] bg-white/80 p-8 shadow-[var(--shadow-soft)] ring-2 ring-white/80 backdrop-blur-sm sm:p-10">
        <h1 className="text-center text-3xl font-extrabold text-ink">Create an account</h1>
        <p className="mt-2 text-center text-sm text-ink-muted">
          You will be signed in automatically. Tokens stay in httpOnly cookies only.
        </p>
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 flex flex-col gap-5">
          {error ? (
            <p
              className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <label className="block text-left">
            <span className="mb-1.5 block text-sm font-bold text-ink-muted">Username</span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              required
              minLength={3}
              maxLength={32}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 text-ink shadow-sm outline-none ring-accent/0 transition focus:border-accent/40 focus:ring-4 focus:ring-accent/15"
              placeholder="cool_player"
            />
            <span className="mt-1 block text-xs text-ink-muted">Letters, numbers, underscore, or hyphen only.</span>
          </label>
          <label className="block text-left">
            <span className="mb-1.5 block text-sm font-bold text-ink-muted">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 text-ink shadow-sm outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/15"
              placeholder="you@example.com"
            />
          </label>
          <label className="block text-left">
            <span className="mb-1.5 block text-sm font-bold text-ink-muted">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 text-ink shadow-sm outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/15"
              placeholder="••••••••••••"
            />
            <span className="mt-1 block text-xs text-ink-muted">{passwordHint}</span>
          </label>
          <Button type="submit" variant="primary" className="mt-2 w-full" disabled={pending}>
            {pending ? "Creating account…" : "Register"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-accent underline-offset-2 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
