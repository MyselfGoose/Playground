"use client";

import Image from "next/image";

const sizes = {
  sm: { box: "h-9 w-9", text: "text-xs" },
  md: { box: "h-12 w-12", text: "text-base" },
  lg: { box: "h-28 w-28 sm:h-32 sm:w-32", text: "text-3xl sm:text-4xl" },
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
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash) % gradients.length;
}

export function Avatar({ username, src, size = "md", className = "" }) {
  const s = sizes[size] ?? sizes.md;
  const label = initials(username);
  const gradientIndex = hashName(username || "");
  const gradient = gradients[gradientIndex];

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br ${gradient} ring-2 ring-white/40 shadow-[var(--shadow-md)] ${s.box} ${className}`}
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
        <span className={`font-extrabold text-white ${s.text}`}>{label}</span>
      )}
    </div>
  );
}
