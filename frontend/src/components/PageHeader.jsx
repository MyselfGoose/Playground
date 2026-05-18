"use client";

import { getGameById } from "../lib/games.js";

/**
 * @param {{
 *   eyebrow?: string;
 *   title?: string;
 *   description?: string;
 *   gameId?: string;
 *   align?: "left" | "center";
 *   className?: string;
 * }} props
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  gameId,
  align = "center",
  className = "",
}) {
  const game = gameId ? getGameById(gameId) : null;
  const resolvedTitle = title ?? game?.title ?? "";
  const resolvedDescription = description ?? game?.description;
  const emoji = game?.emoji;

  const alignClass = align === "center" ? "text-center mx-auto" : "text-left";
  const descriptionAlign = align === "center" ? "mx-auto" : "";

  return (
    <div className={`max-w-5xl ${alignClass} ${className}`}>
      {eyebrow ? (
        <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted">
          {eyebrow}
        </p>
      ) : null}
      {emoji ? (
        <div className="mb-4 text-5xl sm:text-6xl" aria-hidden>
          {emoji}
        </div>
      ) : null}
      {resolvedTitle ? (
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter text-foreground mb-4">
          {resolvedTitle}
        </h1>
      ) : null}
      {resolvedDescription ? (
        <p className={`text-lg sm:text-xl text-foreground/70 max-w-2xl ${descriptionAlign}`}>
          {resolvedDescription}
        </p>
      ) : null}
    </div>
  );
}
