"use client";

import { Pencil } from "lucide-react";

/**
 * @param {{ onClick: () => void, label?: string }} props
 */
export function AvatarEditButton({ onClick, label = "Edit profile picture" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary text-white shadow-[var(--shadow-md)] transition-transform hover:scale-105"
      aria-label={label}
    >
      <Pencil className="h-4 w-4" aria-hidden />
    </button>
  );
}
