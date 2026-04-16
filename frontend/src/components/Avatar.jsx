"use client";

import Image from "next/image";

const sizes = {
  sm: { box: "h-9 w-9", text: "text-sm" },
  md: { box: "h-12 w-12", text: "text-lg" },
  lg: { box: "h-28 w-28 sm:h-32 sm:w-32", text: "text-3xl sm:text-4xl" },
};

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function Avatar({ username, src, size = "md", className = "" }) {
  const s = sizes[size] ?? sizes.md;
  const label = initials(username);

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-accent/30 to-accent-2/40 ring-2 ring-white/80 shadow-[var(--shadow-card)] ${s.box} ${className}`}
      aria-hidden={src ? undefined : true}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          width={128}
          height={128}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : (
        <span className={`font-extrabold text-ink ${s.text}`}>{label}</span>
      )}
    </div>
  );
}
