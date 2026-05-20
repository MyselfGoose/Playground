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
import {
  messageForGoogleOAuthError,
  safeNextPath,
} from "../../lib/auth/oauth.js";

function LoginForm() {
  const { login, user, loading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const nextPath = safeNextPath(searchParams.get("next"));

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) {
      setError(messageForGoogleOAuthError(oauthError) ?? "Google sign-in failed. Please try again.");
    }
  }, [searchParams]);

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
      await login({ email: email.trim().toLowerCase(), password });
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
      {/* Main content */}
      <motion.div
        className="relative w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-center"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        {/* Left: Branding & Message */}
        <div className="text-center md:text-left">
          <Image
            src="/brand/playground-mark.svg"
            alt=""
            width={56}
            height={56}
            className="mb-6 inline-block h-14 w-14"
          />

          <h1 className="text-4xl sm:text-5xl font-black text-foreground mb-4 leading-tight">
            Welcome back to the <span className="text-primary">Playground</span>
          </h1>
          
          <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
            Sign in to jump back into the action. Climb the leaderboards, challenge friends, and compete for glory.
          </p>

          <motion.div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
            <Link
              href="/games"
              className="px-6 py-3 rounded-xl bg-muted-bright/50 text-foreground font-bold transition-all hover:bg-muted-bright/70 text-center"
            >
              Browse games without signing in
            </Link>
          </motion.div>
        </div>

        {/* Right: Form */}
        <div className="w-full">
          <div className="bg-background/80 backdrop-blur-sm rounded-[var(--radius-2xl)] p-8 sm:p-10 shadow-[var(--shadow-md)] ring-2 ring-muted-bright/40">
            <h2 className="text-2xl font-extrabold text-foreground mb-2">Sign in</h2>
            <p className="text-sm text-foreground/60 mb-8">Enter your email and password to continue</p>

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

              <Input
                label="Password"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />

              <Button
                type="submit"
                variant="primary"
                disabled={pending}
                className="w-full bg-primary-dark py-4 text-lg font-extrabold text-white"
              >
                {pending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Signing in…
                  </span>
                ) : (
                  "Sign in"
                )}
              </Button>
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
        </div>
      </motion.div>
    </motion.div>
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
