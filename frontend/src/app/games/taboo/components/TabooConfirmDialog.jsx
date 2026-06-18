"use client";

import { TabooButton } from "../ui/index.js";
import { TabooModal } from "../ui/TabooModal.jsx";

/**
 * @param {{
 *   open: boolean,
 *   title: string,
 *   description: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   variant?: "primary" | "danger",
 *   onConfirm: () => void | Promise<void>,
 *   onCancel: () => void,
 *   loading?: boolean,
 * }} props
 */
export function TabooConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
  loading = false,
}) {
  return (
    <TabooModal open={open} onClose={loading ? undefined : onCancel} title={title} description={description} closeOnBackdrop={!loading}>
      <div className="taboo-modal-panel p-6">
        <h2 className="mb-1 text-lg font-bold text-taboo-text">{title}</h2>
        <p className="mb-5 text-sm text-taboo-text-muted">{description}</p>
        <div className="flex gap-2">
          <TabooButton variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </TabooButton>
          <TabooButton
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={() => void onConfirm()}
            disabled={loading}
          >
            {loading ? "Leaving…" : confirmLabel}
          </TabooButton>
        </div>
      </div>
    </TabooModal>
  );
}
