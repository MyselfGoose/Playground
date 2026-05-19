"use client";

import { Button } from "../Button.jsx";

/**
 * @param {{
 *   ready: boolean,
 *   onToggle: () => void,
 *   disabled?: boolean,
 *   pending?: boolean,
 *   className?: string,
 * }} props
 */
export function ReadyButton({
  ready,
  onToggle,
  disabled = false,
  pending = false,
  className = "",
}) {
  const isDisabled = disabled || pending;

  return (
    <Button
      variant={ready ? "secondary" : "primary"}
      className={`w-full rounded-full py-3.5 text-base font-black ${className}`}
      disabled={isDisabled}
      onClick={onToggle}
      aria-busy={pending}
    >
      {pending ? "Updating…" : ready ? "Unready" : "Ready up"}
    </Button>
  );
}
