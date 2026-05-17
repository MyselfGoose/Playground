"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ApiError, apiFetch } from "../../../../lib/api.js";
import { useUser } from "../../../../lib/context/UserContext.jsx";
import { OAuthFullScreenShell } from "../../../../components/OAuthFullScreenShell.jsx";
import {
  messageForGoogleOAuthError,
  safeNextPath,
} from "../../../../lib/auth/oauth.js";
import { suggestUsernameFromDisplayName } from "../../../../lib/auth/suggestUsername.js";

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,32}$/;

function GoogleCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeOAuth, completeOAuthRegister, user, loading } = useUser();

  const nextPath = safeNextPath(searchParams.get("next"));
  const oauthTicket = searchParams.get("oauth_ticket");
  const signupTicket = searchParams.get("oauth_signup_ticket");
  const oauthError = searchParams.get("error");

  const [phase, setPhase] = useState(
    /** @type {'loading' | 'signup' | 'error'} */ ("loading"),
  );
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState(
    /** @type {'idle' | 'checking' | 'available' | 'taken' | 'invalid'} */ ("idle"),
  );
  const [submitPending, setSubmitPending] = useState(false);
  const sessionStartedRef = useRef(false);
  const signupLoadedRef = useRef(false);

  const redirectToApp = useCallback(() => {
    router.replace(nextPath);
  }, [router, nextPath]);

  useEffect(() => {
    if (oauthError) {
      setPhase("error");
      setError(messageForGoogleOAuthError(oauthError) ?? "Google sign-in failed. Please try again.");
    }
  }, [oauthError]);

  useEffect(() => {
    if (loading || !oauthTicket || oauthError || sessionStartedRef.current) return;
    if (user) {
      redirectToApp();
      return;
    }

    sessionStartedRef.current = true;
    void (async () => {
      try {
        await completeOAuth(oauthTicket);
        redirectToApp();
      } catch (err) {
        sessionStartedRef.current = false;
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Google sign-in could not be completed";
        setError(message);
        setPhase("error");
      }
    })();
  }, [loading, oauthTicket, oauthError, user, completeOAuth, redirectToApp]);

  useEffect(() => {
    if (!signupTicket || oauthError || signupLoadedRef.current) return;
    signupLoadedRef.current = true;

    void (async () => {
      try {
        const res = await apiFetch(
          `/api/v1/auth/oauth/signup-preview?${new URLSearchParams({ ticket: signupTicket })}`,
        );
        const profileEmail = res?.data?.email ?? "";
        const profileName = res?.data?.name ?? "";
        setEmail(profileEmail);
        setUsername(suggestUsernameFromDisplayName(profileName));
        setPhase("signup");
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Sign-up link expired";
        setError(message);
        setPhase("error");
      }
    })();
  }, [signupTicket, oauthError]);

  useEffect(() => {
    if (phase !== "signup" || !username) {
      setUsernameStatus("idle");
      return;
    }
    if (!USERNAME_RE.test(username)) {
      setUsernameStatus("invalid");
      return;
    }

    setUsernameStatus("checking");
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await apiFetch(
            `/api/v1/auth/username-available?${new URLSearchParams({ username })}`,
          );
          setUsernameStatus(res?.data?.available ? "available" : "taken");
        } catch {
          setUsernameStatus("idle");
        }
      })();
    }, 400);

    return () => clearTimeout(timer);
  }, [phase, username]);

  async function handleSignupSubmit(e) {
    e.preventDefault();
    if (!signupTicket || !USERNAME_RE.test(username) || usernameStatus === "taken") return;
    setSubmitPending(true);
    setError("");
    try {
      await completeOAuthRegister(signupTicket, username);
      redirectToApp();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not create your account";
      setError(message);
    } finally {
      setSubmitPending(false);
    }
  }

  if (phase === "error") {
    return (
      <OAuthFullScreenShell title="Sign-in failed" subtitle={error}>
        <div className="mb-6 text-5xl" aria-hidden>
          !
        </div>
        <Link
          href={`/login?next=${encodeURIComponent(nextPath)}`}
          className="mt-6 inline-block rounded-[var(--radius-lg)] bg-primary px-6 py-3 font-bold text-white"
        >
          Back to sign in
        </Link>
      </OAuthFullScreenShell>
    );
  }

  if (phase === "signup") {
    return (
      <OAuthFullScreenShell title="Choose your username" subtitle="Pick a unique name for the Playground">
        <form
          onSubmit={(e) => void handleSignupSubmit(e)}
          className="mt-8 w-full max-w-md rounded-[var(--radius-2xl)] bg-background p-8 text-left shadow-[var(--shadow-md)] ring-2 ring-muted-bright/40"
        >
          {error ? (
            <div
              className="mb-4 rounded-[var(--radius-lg)] bg-error/10 border border-error/40 px-4 py-3 text-sm font-bold text-error"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div className="mb-4">
            <label className="block text-sm font-bold text-foreground mb-2">Email</label>
            <input
              type="email"
              value={email}
              readOnly
              className="w-full px-4 py-3 rounded-[var(--radius-lg)] bg-muted-bright/30 border-2 border-muted-bright/50 text-foreground/70 cursor-not-allowed"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-foreground mb-2">Username</label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              required
              minLength={3}
              maxLength={32}
              value={username}
              onChange={(e) => setUsername(e.target.value.trim())}
              className="w-full px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--input-bg)] border-2 border-[var(--input-border)] text-foreground outline-none focus:border-primary"
            />
            <p className="mt-1 text-xs text-foreground/50">
              {usernameStatus === "checking" && "Checking availability…"}
              {usernameStatus === "available" && "Username is available"}
              {usernameStatus === "taken" && "Username is already taken"}
              {usernameStatus === "invalid" && "3–32 characters: letters, numbers, underscore, hyphen"}
              {usernameStatus === "idle" && "Letters, numbers, underscore, or hyphen"}
            </p>
          </div>

          <motion.button
            type="submit"
            disabled={
              submitPending ||
              !USERNAME_RE.test(username) ||
              usernameStatus === "taken" ||
              usernameStatus === "checking"
            }
            className="w-full px-6 py-4 rounded-[var(--radius-lg)] bg-primary text-white font-extrabold disabled:opacity-60"
          >
            {submitPending ? "Creating account…" : "Continue"}
          </motion.button>
        </form>
      </OAuthFullScreenShell>
    );
  }

  if (!oauthTicket && !signupTicket && !oauthError) {
    return (
      <OAuthFullScreenShell title="Invalid sign-in link" subtitle="Start again from the sign-in page.">
        <Link
          href="/login"
          className="mt-6 inline-block rounded-[var(--radius-lg)] bg-primary px-6 py-3 font-bold text-white"
        >
          Go to sign in
        </Link>
      </OAuthFullScreenShell>
    );
  }

  return <OAuthFullScreenShell title="Completing sign-in…" subtitle="Please wait while we set up your session." />;
}

export default function GoogleCompletePage() {
  return (
    <Suspense
      fallback={
        <OAuthFullScreenShell title="Completing sign-in…" subtitle="Please wait…" />
      }
    >
      <GoogleCompleteContent />
    </Suspense>
  );
}
