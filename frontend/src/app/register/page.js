"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ApiError } from "../../lib/api.js";
import { useUser } from "../../lib/context/UserContext.jsx";
import { GoogleSignInButton } from "../../components/GoogleSignInButton.jsx";
import { Button } from "../../components/Button.jsx";
import { Input } from "../../components/ui/index.js";
import { safeNextPath } from "../../lib/auth/oauth.js";

function RegisterForm() {
  const { register, user, loading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(nextPath);
    }
  }, [loading, user, router, nextPath]);

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
      router.push(nextPath);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <motion.div className="min-h-screen flex items-center justify-center px-4 py-12 sm:px-6">
      <div className="relative w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full md:order-2"
        >
          <motion.div className="bg-background/80 backdrop-blur-sm rounded-[var(--radius-2xl)] p-8 sm:p-10 shadow-[var(--shadow-md)] ring-2 ring-muted-bright/40">
            <h2 className="text-2xl font-extrabold text-foreground mb-2">Join the Playground</h2>
            <p className="text-sm text-foreground/60 mb-8">Create your account and start playing today</p>

            <div className="mb-6">
              <GoogleSignInButton nextPath={nextPath} disabled={pending} />
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t border-muted-bright/40" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wide">
                <span className="bg-background px-3 text-xs font-bold uppercase tracking-wide text-foreground">or</span>
              </div>
            </div>

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

              <div>
                <Input
                  label="Username"
                  type="text"
                  name="username"
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={32}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="cool_player"
                />
                <p className="mt-1 text-xs text-foreground/50">Letters, numbers, underscore, or hyphen</p>
              </div>

              <Input
                label="Email address"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />

              <div>
                <Input
                  label="Password"
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <p className="mt-1 text-xs text-foreground/50">
                  12+ characters, mixed case, number, and symbol
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={pending}
                className="w-full py-4 text-lg font-extrabold"
              >
                {pending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating account…
                  </span>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>

            <div className="mt-8 pt-8 border-t border-muted-bright/30">
              <p className="text-sm text-foreground/60 text-center">
                Already have an account?{" "}
                <Link href="/login" className="font-bold text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center md:text-left md:order-1"
        >
          <Image
            src="/brand/playground-mark.svg"
            alt=""
            width={56}
            height={56}
            className="mb-6 inline-block h-14 w-14"
          />

          <h1 className="text-4xl sm:text-5xl font-black text-foreground mb-4 leading-tight">
            Ready to <span className="text-primary">compete</span>?
          </h1>

          <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
            Join thousands of players. Play Typing Races, NPAT, Taboo, and more. Climb the global leaderboard and prove
            you&apos;re the best.
          </p>

          <ul className="space-y-3 mb-8">
            <li className="flex items-center gap-3 text-foreground/70">
              <span className="text-2xl" aria-hidden>
                ⚡
              </span>
              <span>Real-time multiplayer action</span>
            </li>
            <li className="flex items-center gap-3 text-foreground/70">
              <span className="text-2xl" aria-hidden>
                🏆
              </span>
              <span>Compete on global leaderboards</span>
            </li>
            <li className="flex items-center gap-3 text-foreground/70">
              <span className="text-2xl" aria-hidden>
                👥
              </span>
              <span>Challenge friends and strangers</span>
            </li>
          </ul>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-4 py-20 text-muted">Loading…</div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
