"use client";

import { getGameById } from "../lib/games.js";

const sizeStyles = {
  sm: {
    emoji: "text-3xl sm:text-4xl",
    title: "text-title font-black tracking-tighter",
    description: "text-body-fluid",
    wrapper: "max-w-3xl",
    margin: "mb-2",
  },
  md: {
    emoji: "text-4xl sm:text-5xl",
    title: "text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter",
    description: "text-base sm:text-lg",
    wrapper: "max-w-5xl",
    margin: "mb-3",
  },
  lg: {
    emoji: "text-5xl sm:text-6xl",
    title: "text-display font-black tracking-tighter",
    description: "text-lg sm:text-xl",
    wrapper: "max-w-5xl",
    margin: "mb-4",
  },
};

/**
 * @param {{
 *   eyebrow?: string;
 *   title?: string;
 *   description?: string;
 *   gameId?: string;
 *   align?: "left" | "center";
 *   size?: "sm" | "md" | "lg";
 *   className?: string;
 * }} props
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  gameId,
  align = "center",
  size = "lg",
  className = "",
}) {
  const game = gameId ? getGameById(gameId) : null;
  const resolvedTitle = title ?? game?.title ?? "";
  const resolvedDescription = description ?? game?.description;
  const emoji = game?.emoji;
  const styles = sizeStyles[size] ?? sizeStyles.lg;

  const alignClass = align === "center" ? "text-center mx-auto" : "text-left";
  const descriptionAlign = align === "center" ? "mx-auto" : "";

  return (
    <div className={`${styles.wrapper} ${alignClass} ${className}`}>
      {eyebrow ? (
        <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted">
          {eyebrow}
        </p>
      ) : null}
      {emoji ? (
        <div className={`${styles.margin} ${styles.emoji}`} aria-hidden>
          {emoji}
        </div>
      ) : null}
      {resolvedTitle ? (
        <h1 className={`${styles.title} text-foreground ${styles.margin}`}>
          {resolvedTitle}
        </h1>
      ) : null}
      {resolvedDescription ? (
        <p
          className={`${styles.description} text-foreground/70 max-w-2xl ${descriptionAlign}`}
        >
          {resolvedDescription}
        </p>
      ) : null}
    </div>
  );
}
