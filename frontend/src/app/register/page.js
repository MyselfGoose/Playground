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

function RegisterForm() {
  const { register, user, loading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);
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
      await register({
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
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
        className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-gradient-to-br from-accent-mint/30 to-accent-sky/30 blur-3xl"
        animate={{ y: [0, 30, 0], x: [0, -20, 0] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full bg-gradient-to-tl from-accent-lemon/20 to-accent-pink/20 blur-3xl"
        animate={{ y: [0, -30, 0], x: [0, 20, 0] }}
        transition={{ duration: 10, repeat: Infinity }}
      />

      {/* Main content */}
      <div className="relative w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-center">
        {/* Left: Form */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full md:order-2"
        >
          <div className="bg-background/80 backdrop-blur-sm rounded-[var(--radius-2xl)] p-8 sm:p-10 shadow-[var(--shadow-md)] ring-2 ring-muted-bright/40">
            <h2 className="text-2xl font-extrabold text-foreground mb-2">Join the Playground</h2>
            <p className="text-sm text-foreground/60 mb-8">Create your account and start playing today</p>

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

              {/* Username */}
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">Username</label>
                <motion.input
                  type="text"
                  name="username"
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={32}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setUsernameFocused(true)}
                  onBlur={() => setUsernameFocused(false)}
                  placeholder="cool_player"
                  className="w-full px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--input-bg)] border-2 border-[var(--input-border)] text-foreground placeholder-[var(--input-placeholder)] outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_rgba(255,107,91,0.15)]"
                  animate={usernameFocused ? { scale: 1.02 } : { scale: 1 }}
                />
                <p className="mt-1 text-xs text-foreground/50">Letters, numbers, underscore, or hyphen</p>
              </div>

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
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--input-bg)] border-2 border-[var(--input-border)] text-foreground placeholder-[var(--input-placeholder)] outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_rgba(255,107,91,0.15)]"
                  animate={passwordFocused ? { scale: 1.02 } : { scale: 1 }}
                />
                <p className="mt-1 text-xs text-foreground/50">12+ characters, mixed case, number, and symbol</p>
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
                    Creating account…
                  </span>
                ) : (
                  "Create account"
                )}
              </motion.button>
            </form>

            <div className="mt-8 pt-8 border-t border-muted-bright/30">
              <p className="text-sm text-foreground/60 text-center">
                Already have an account?{" "}
                <Link href="/login" className="font-bold text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Right: Branding & Message */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center md:text-left md:order-1"
        >
          <motion.div
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="inline-block text-5xl sm:text-6xl mb-6"
          >
            🎉
          </motion.div>
          
          <h1 className="text-4xl sm:text-5xl font-black text-foreground mb-4 leading-tight">
            Ready to <span className="text-primary">compete</span>?
          </h1>
          
          <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
            Join thousands of players. Play Typing Races, NPAT, Taboo, and more. Climb the global leaderboard and prove you&apos;re the best.
          </p>

          <ul className="space-y-3 mb-8">
            <li className="flex items-center gap-3 text-foreground/70">
              <span className="text-2xl">⚡</span>
              <span>Real-time multiplayer action</span>
            </li>
            <li className="flex items-center gap-3 text-foreground/70">
              <span className="text-2xl">🏆</span>
              <span>Compete on global leaderboards</span>
            </li>
            <li className="flex items-center gap-3 text-foreground/70">
              <span className="text-2xl">👥</span>
              <span>Challenge friends and strangers</span>
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-4 py-20 text-ink-muted">
          Loading…
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
