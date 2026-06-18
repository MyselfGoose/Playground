"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Theme } from "emoji-picker-react";
import { Button } from "../../Button.jsx";
import { Avatar } from "../../Avatar.jsx";
import { useTheme } from "../../../lib/theme/ThemeContext.jsx";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

/**
 * @param {{
 *   username: string,
 *   onCancel: () => void,
 *   onApply: (emoji: string) => Promise<void>,
 * }} props
 */
export function EmojiPickerStep({ username, onCancel, onApply }) {
  const { isDark } = useTheme();
  const [selected, setSelected] = useState(/** @type {string | null} */ (null));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleApply() {
    if (!selected) {
      setError("Choose an emoji first.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await onApply(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save emoji");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="px-5 py-5 sm:px-6">
      <div className="mb-4 flex flex-col items-center gap-3">
        <Avatar username={username} emoji={selected ?? undefined} size="lg" />
        <p className="text-sm text-foreground/60">Preview</p>
      </div>

      <div className="emoji-picker-shell overflow-hidden rounded-[var(--radius-xl)] border border-muted-bright/30 bg-muted-bright/20">
        <EmojiPicker
          theme={isDark ? Theme.DARK : Theme.LIGHT}
          onEmojiClick={(data) => {
            setSelected(data.emoji);
            setError("");
          }}
          width="100%"
          height={360}
          previewConfig={{ showPreview: false }}
          searchPlaceholder="Search emoji…"
        />
      </div>

      {error ? <p className="mt-3 text-sm font-bold text-error">{error}</p> : null}

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void handleApply()} disabled={pending || !selected}>
          {pending ? "Applying…" : "Apply"}
        </Button>
      </div>
    </div>
  );
}
