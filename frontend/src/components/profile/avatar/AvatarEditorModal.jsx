"use client";

import { useState } from "react";
import { Modal } from "../../ui/Modal.jsx";
import { ImageCropStep } from "./ImageCropStep.jsx";
import { EmojiPickerStep } from "./EmojiPickerStep.jsx";
import { ApiError } from "../../../lib/api.js";

/** @typedef {'upload' | 'emoji'} AvatarEditorTab */

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   username: string,
 *   onUpload: (payload: { mime: string, data: string }) => Promise<unknown>,
 *   onEmoji: (emoji: string) => Promise<unknown>,
 *   onRemove?: () => Promise<unknown>,
 *   hasAvatar?: boolean,
 * }} props
 */
export function AvatarEditorModal({
  open,
  onClose,
  username,
  onUpload,
  onEmoji,
  onRemove,
  hasAvatar = false,
}) {
  const [tab, setTab] = useState(/** @type {AvatarEditorTab} */ ("upload"));
  const [removing, setRemoving] = useState(false);

  async function handleUpload(payload) {
    try {
      await onUpload(payload);
      onClose();
    } catch (err) {
      throw new ApiError(
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Upload failed",
        { status: err instanceof ApiError ? err.status : 500 },
      );
    }
  }

  async function handleEmoji(emoji) {
    try {
      await onEmoji(emoji);
      onClose();
    } catch (err) {
      throw new ApiError(
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Could not save emoji",
        { status: err instanceof ApiError ? err.status : 500 },
      );
    }
  }

  async function handleRemove() {
    if (!onRemove) return;
    setRemoving(true);
    try {
      await onRemove();
      onClose();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit profile picture"
      description="Upload a photo or pick an emoji"
      size="lg"
      panelClassName="max-w-xl"
    >
      <div className="border-b border-muted-bright/20 px-5 sm:px-6">
        <div className="flex gap-2 py-3">
          {(["upload", "emoji"]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(/** @type {AvatarEditorTab} */ (key))}
              className={`rounded-[var(--radius-lg)] px-4 py-2 text-sm font-bold transition-colors ${
                tab === key
                  ? "bg-primary text-white"
                  : "bg-muted-bright/20 text-foreground/70 hover:bg-muted-bright/35"
              }`}
            >
              {key === "upload" ? "Upload" : "Emoji"}
            </button>
          ))}
        </div>
      </div>

      {tab === "upload" ? (
        <ImageCropStep onCancel={onClose} onApply={handleUpload} />
      ) : (
        <EmojiPickerStep username={username} onCancel={onClose} onApply={handleEmoji} />
      )}

      {hasAvatar && onRemove ? (
        <div className="border-t border-muted-bright/20 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => void handleRemove()}
            disabled={removing}
            className="text-sm font-bold text-error transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {removing ? "Removing…" : "Remove profile picture"}
          </button>
        </div>
      ) : null}
    </Modal>
  );
}
