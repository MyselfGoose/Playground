"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ApiError } from "../../lib/api.js";
import { useUser } from "../../lib/context/UserContext.jsx";
import { Button } from "../../components/Button.jsx";

function safeNextPath(raw) {
  if (typeof raw !== "string" || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  return raw;
}

function LoginForm() {
  const { login, user, loading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(safeNextPath(searchParams.get("next")));
    }
  }, [loading, user, router, searchParams]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      router.push(safeNextPath(searchParams.get("next")));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 sm:px-6 relative overflow-hidden">
      {/* Animated background orbs */}
      <motion.div
        aria-hidden
        className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-gradient-to-br from-accent-purple/30 to-accent-pink/30 blur-3xl"
        animate={{ y: [0, 30, 0], x: [0, 20, 0] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-gradient-to-tr from-accent-mint/20 to-accent-sky/20 blur-3xl"
        animate={{ y: [0, -30, 0], x: [0, -20, 0] }}
        transition={{ duration: 10, repeat: Infinity }}
      />

      {/* Main content */}
      <div className="relative w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-center">
        {/* Left: Branding & Message */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center md:text-left"
        >
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="inline-block text-5xl sm:text-6xl mb-6"
          >
            🎮
          </motion.div>
          
          <h1 className="text-4xl sm:text-5xl font-black text-foreground mb-4 leading-tight">
            Welcome back to the <span className="text-primary">Playground</span>
          </h1>
          
          <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
            Sign in to jump back into the action. Climb the leaderboards, challenge friends, and compete for glory.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
            <Link
              href="/games"
              className="px-6 py-3 rounded-full bg-muted-bright/50 text-foreground font-bold transition-all hover:bg-muted-bright/70 text-center"
            >
              Browse games without signing in
            </Link>
          </div>
        </motion.div>

        {/* Right: Form */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full"
        >
          <div className="bg-background/80 backdrop-blur-sm rounded-[var(--radius-2xl)] p-8 sm:p-10 shadow-[var(--shadow-md)] ring-2 ring-muted-bright/40">
            <h2 className="text-2xl font-extrabold text-foreground mb-2">Sign in</h2>
            <p className="text-sm text-foreground/60 mb-8">Enter your email and password to continue</p>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
              {error ? (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[var(--radius-lg)] bg-error/10 border border-error/40 px-4 py-3 text-sm font-bold text-error"
                  role="alert"
                >
                  {error}
                </motion.div>
              ) : null}

              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">Email address</label>
                <motion.input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--input-bg)] border-2 border-[var(--input-border)] text-foreground placeholder-[var(--input-placeholder)] outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_rgba(255,107,91,0.15)]"
                  animate={emailFocused ? { scale: 1.02 } : { scale: 1 }}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">Password</label>
                <motion.input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--input-bg)] border-2 border-[var(--input-border)] text-foreground placeholder-[var(--input-placeholder)] outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_rgba(255,107,91,0.15)]"
                  animate={passwordFocused ? { scale: 1.02 } : { scale: 1 }}
                />
              </div>

              <motion.button
                type="submit"
                disabled={pending}
                whileHover={!pending ? { scale: 1.02 } : {}}
                whileTap={!pending ? { scale: 0.98 } : {}}
                className="w-full px-6 py-4 rounded-[var(--radius-lg)] bg-primary text-white font-extrabold text-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-[var(--shadow-play)] hover:shadow-lg"
              >
                {pending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Signing in…
                  </span>
                ) : (
                  "Sign in"
                )}
              </motion.button>
            </form>

            <div className="mt-8 pt-8 border-t border-muted-bright/30">
              <p className="text-sm text-foreground/60 text-center">
                New to Playground?{" "}
                <Link href="/register" className="font-bold text-primary hover:underline">
                  Create account
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-4 py-20 text-ink-muted">Loading…</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
