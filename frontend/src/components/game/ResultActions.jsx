"use client";

import Link from "next/link";
import { Button } from "../Button.jsx";

/**
 * @param {{
 *   playAgainLabel?: string;
 *   playAgainHref?: string;
 *   onPlayAgain?: () => void;
 *   playAgainDisabled?: boolean;
 *   secondaryLabel?: string;
 *   secondaryHref?: string;
 *   onSecondary?: () => void;
 *   secondaryDisabled?: boolean;
 *   leaderboardHref?: string;
 *   profileHref?: string;
 *   showProfileLink?: boolean;
 *   className?: string;
 *   linkClassName?: string;
 * }} props
 */
export function ResultActions({
  playAgainLabel = "Play again",
  playAgainHref,
  onPlayAgain,
  playAgainDisabled = false,
  secondaryLabel,
  secondaryHref,
  onSecondary,
  secondaryDisabled = false,
  leaderboardHref = "/leaderboard",
  profileHref = "/profile",
  showProfileLink = true,
  className = "",
  linkClassName = "text-[var(--tt-accent)] hover:underline",
}) {
  const hasSecondary = Boolean(secondaryLabel && (secondaryHref || onSecondary));

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
        {playAgainHref ? (
          <Link href={playAgainHref} className="flex-1 sm:max-w-[12rem]">
            <Button type="button" variant="primary" className="w-full">
              {playAgainLabel}
            </Button>
          </Link>
        ) : onPlayAgain ? (
          <Button
            type="button"
            variant="primary"
            className="flex-1 sm:max-w-[12rem]"
            disabled={playAgainDisabled}
            onClick={onPlayAgain}
          >
            {playAgainLabel}
          </Button>
        ) : null}

        {hasSecondary ? (
          secondaryHref ? (
            <Link href={secondaryHref} className="flex-1 sm:max-w-[12rem]">
              <Button type="button" variant="secondary" className="w-full">
                {secondaryLabel}
              </Button>
            </Link>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="flex-1 sm:max-w-[12rem]"
              disabled={secondaryDisabled}
              onClick={onSecondary}
            >
              {secondaryLabel}
            </Button>
          )
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-semibold">
        <Link href={leaderboardHref} className={linkClassName}>
          View leaderboard
        </Link>
        {showProfileLink ? (
          <Link href={profileHref} className={linkClassName}>
            Your profile
          </Link>
        ) : null}
      </div>
    </div>
  );
}
