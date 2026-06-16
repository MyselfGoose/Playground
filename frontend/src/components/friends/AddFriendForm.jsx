"use client";

import { useState } from "react";
import { ApiError } from "../../lib/api.js";
import { useFriends } from "../../lib/friends/FriendsContext.jsx";
import { Button } from "../Button.jsx";

/**
 * @param {{ className?: string }} props
 */
export function AddFriendForm({ className = "" }) {
  const { sendRequest } = useFriends();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await sendRequest(trimmed);
      setUsername("");
      setSuccess(result?.autoAccepted ? "You're now friends!" : "Friend request sent.");
    } catch (err) {
      setError(err instanceof ApiError ? err.user_message || err.message : "Could not send request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className={`space-y-2 rounded-xl border border-foreground/10 bg-muted-bright/20 p-2.5 ${className}`}
    >
      <label className="block text-[10px] font-black uppercase tracking-wide text-foreground/55">
        Add friend by username
      </label>
      <div className="flex gap-2">
        <input
          className="h-9 min-w-0 flex-1 rounded-lg border border-foreground/15 bg-background px-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/30"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          autoComplete="off"
          maxLength={32}
        />
        <Button
          type="submit"
          variant="primary"
          className="h-9 shrink-0 px-3 py-0 text-xs"
          disabled={busy || !username.trim()}
        >
          {busy ? "…" : "Add"}
        </Button>
      </div>
      {error ? <p className="text-xs font-semibold text-error">{error}</p> : null}
      {success ? <p className="text-xs font-semibold text-accent-mint">{success}</p> : null}
    </form>
  );
}
