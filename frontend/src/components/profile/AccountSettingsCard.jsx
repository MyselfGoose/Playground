"use client";

import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api.js";
import { useUser } from "../../lib/context/UserContext.jsx";
import { useUsernameAvailability, USERNAME_RE } from "../../hooks/useUsernameAvailability.js";
import { Button } from "../Button.jsx";
import { Input } from "../ui/index.js";
import { Card } from "../ui/Card.jsx";
import { AvatarEditorModal } from "./avatar/AvatarEditorModal.jsx";
import { AvatarEditButton } from "./avatar/AvatarEditButton.jsx";
import { Avatar } from "../Avatar.jsx";

/**
 * @param {{ className?: string; avatarOpen?: boolean; onAvatarOpenChange?: (open: boolean) => void }} props
 */
export function AccountSettingsCard({ className = "", avatarOpen: avatarOpenProp, onAvatarOpenChange }) {
  const { user, updateProfile, uploadAvatar, setAvatarEmoji, removeAvatar } = useUser();
  const [username, setUsername] = useState(user?.username ?? "");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [pending, setPending] = useState(false);
  const [avatarOpenInternal, setAvatarOpenInternal] = useState(false);
  const avatarOpen = avatarOpenProp ?? avatarOpenInternal;
  const setAvatarOpen = onAvatarOpenChange ?? setAvatarOpenInternal;

  const { status, isValid } = useUsernameAvailability(username, user?.username, user?.id);

  useEffect(() => {
    if (user?.username) setUsername(user.username);
  }, [user?.username]);

  if (!user) return null;

  const usernameChanged = username.trim() !== user.username;
  const canSaveUsername = usernameChanged && isValid && !pending;

  async function handleSaveUsername(e) {
    e.preventDefault();
    if (!canSaveUsername) return;
    setPending(true);
    setSaveError("");
    setSaveMessage("");
    try {
      await updateProfile({ username: username.trim() });
      setSaveMessage("Username updated.");
    } catch (err) {
      setSaveError(
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Could not update username",
      );
    } finally {
      setPending(false);
    }
  }

  const statusHint = {
    idle: null,
    checking: "Checking availability…",
    available: "Username is available",
    taken: "Username is already taken",
    invalid: "3–32 characters: letters, numbers, underscore, hyphen",
    unchanged: "This is your current username",
  }[status];

  const statusColor =
    status === "available"
      ? "text-accent-mint"
      : status === "taken" || status === "invalid"
        ? "text-error"
        : "text-foreground/55";

  const hasAvatar = Boolean(user.avatarUrl || user.avatarEmoji);

  return (
    <>
      <Card variant="elevated" className={`p-6 sm:p-8 ${className}`} id="account-settings">
        <h2 className="text-xl font-extrabold text-foreground">Account settings</h2>
        <p className="mt-1 text-sm text-foreground/60">Update how you appear across the Playground.</p>

        <div className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar
                username={user.username}
                avatarUrl={user.avatarUrl}
                avatarEmoji={user.avatarEmoji}
                size="lg"
              />
              <AvatarEditButton onClick={() => setAvatarOpen(true)} />
            </div>
            <button
              type="button"
              onClick={() => setAvatarOpen(true)}
              className="text-sm font-bold text-primary transition-opacity hover:opacity-80"
            >
              Change picture
            </button>
          </div>

          <form onSubmit={(e) => void handleSaveUsername(e)} className="min-w-0 flex-1 space-y-4">
            <div>
              <Input
                label="Username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setSaveMessage("");
                  setSaveError("");
                }}
                minLength={3}
                maxLength={32}
                pattern={USERNAME_RE.source}
                required
              />
              {statusHint ? <p className={`mt-2 text-xs font-bold ${statusColor}`}>{statusHint}</p> : null}
            </div>

            {saveError ? (
              <p className="text-sm font-bold text-error" role="alert">
                {saveError}
              </p>
            ) : null}
            {saveMessage ? <p className="text-sm font-bold text-accent-mint">{saveMessage}</p> : null}

            <Button type="submit" disabled={!canSaveUsername}>
              {pending ? "Saving…" : "Save username"}
            </Button>
          </form>
        </div>
      </Card>

      <AvatarEditorModal
        open={avatarOpen}
        onClose={() => setAvatarOpen(false)}
        username={user.username}
        onUpload={uploadAvatar}
        onEmoji={setAvatarEmoji}
        onRemove={removeAvatar}
        hasAvatar={hasAvatar}
      />
    </>
  );
}
