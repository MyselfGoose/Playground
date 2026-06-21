"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { resolveAvatarDisplay } from "../lib/profile/resolveAvatarDisplay.js";

const sizes = {
  sm: { box: "h-9 w-9", text: "text-xs", emoji: "text-xl" },
  md: { box: "h-12 w-12", text: "text-base", emoji: "text-2xl" },
  lg: { box: "h-28 w-28 sm:h-32 sm:w-32", text: "text-3xl sm:text-4xl", emoji: "text-5xl sm:text-6xl" },
};

const gradients = [
  "from-primary to-accent-pink",
  "from-accent-purple to-accent-pink",
  "from-accent-mint to-accent-sky",
  "from-accent-lemon to-primary",
  "from-accent-sky to-accent-purple",
];

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function hashName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash) % gradients.length;
}

/**
 * @param {{
 *   username: string,
 *   src?: string | null,
 *   emoji?: string | null,
 *   avatarUrl?: string | null,
 *   avatarEmoji?: string | null,
 *   size?: 'sm' | 'md' | 'lg',
 *   className?: string,
 * }} props
 */
export function Avatar({
  username,
  src,
  emoji,
  avatarUrl,
  avatarEmoji,
  size = "md",
  className = "",
}) {
  const s = sizes[size] ?? sizes.md;
  const label = initials(username);
  const gradientIndex = hashName(username || "");
  const gradient = gradients[gradientIndex];
  const display = resolveAvatarDisplay({ src, emoji, avatarUrl, avatarEmoji });
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(display.src) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [display.src]);

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br ${gradient} ring-2 ring-white/40 shadow-[var(--shadow-md)] ${s.box} ${className}`}
      aria-hidden={showImage || display.emoji ? undefined : true}
    >
      {display.emoji ? (
        <span className={`select-none leading-none ${s.emoji}`} aria-hidden>
          {display.emoji}
        </span>
      ) : showImage && display.src ? (
        <Image
          src={display.src}
          alt=""
          width={128}
          height={128}
          className="h-full w-full object-cover"
          unoptimized
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className={`font-extrabold text-white ${s.text}`}>{label}</span>
      )}
    </div>
  );
}
