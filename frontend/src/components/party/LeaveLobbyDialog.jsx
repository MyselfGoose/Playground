"use client";

import { Button } from "../Button.jsx";
import { Modal } from "../ui/Modal.jsx";

/**
 * @param {{
 *   open: boolean,
 *   title?: string,
 *   description?: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   leaving?: boolean,
 *   onConfirm: () => void | Promise<void>,
 *   onCancel: () => void,
 * }} props
 */
export function LeaveLobbyDialog({
  open,
  title = "Leave lobby?",
  description = "You'll be removed from this lobby and need the room code to rejoin.",
  confirmLabel = "Leave",
  cancelLabel = "Cancel",
  leaving = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      onClose={leaving ? undefined : onCancel}
      title={title}
      description={description}
      closeOnBackdrop={!leaving}
      showCloseButton={!leaving}
      size="sm"
    >
      <div className="flex flex-wrap justify-end gap-3 px-5 pb-5 sm:px-6 sm:pb-6">
        <Button variant="ghost" onClick={onCancel} disabled={leaving}>
          {cancelLabel}
        </Button>
        <Button
          variant="primary"
          className="bg-error hover:brightness-95 focus-visible:outline-error"
          onClick={() => void onConfirm()}
          disabled={leaving}
        >
          {leaving ? "Leaving…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
