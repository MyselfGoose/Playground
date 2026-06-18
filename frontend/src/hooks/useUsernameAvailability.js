"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api.js";

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,32}$/;

/** @typedef {'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'unchanged'} UsernameAvailabilityStatus */

/**
 * @param {string} username
 * @param {string | null | undefined} currentUsername
 * @param {string | null | undefined} excludeUserId
 */
export function useUsernameAvailability(username, currentUsername, excludeUserId) {
  const [status, setStatus] = useState(/** @type {UsernameAvailabilityStatus} */ ("idle"));

  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed) {
      setStatus("idle");
      return;
    }
    if (currentUsername && trimmed === currentUsername) {
      setStatus("unchanged");
      return;
    }
    if (!USERNAME_RE.test(trimmed)) {
      setStatus("invalid");
      return;
    }

    setStatus("checking");
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams({ username: trimmed });
          if (excludeUserId) params.set("excludeUserId", excludeUserId);
          const res = await apiFetch(`/api/v1/auth/username-available?${params}`);
          setStatus(res?.data?.available ? "available" : "taken");
        } catch {
          setStatus("idle");
        }
      })();
    }, 400);

    return () => clearTimeout(timer);
  }, [username, currentUsername, excludeUserId]);

  return { status, isValid: status === "available" };
}

export { USERNAME_RE };
