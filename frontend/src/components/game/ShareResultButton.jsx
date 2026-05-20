"use client";

import { useCallback, useMemo } from "react";
import { Share2 } from "lucide-react";
import { Button } from "../Button.jsx";

/**
 * Share game result via Web Share API (no image generation yet).
 *
 * @param {{
 *   gameLabel: string,
 *   className?: string,
 * }} props
 */
export function ShareResultButton({ gameLabel, className = "" }) {
  const shareText = useMemo(
    () => `I played ${gameLabel} on Playground`,
    [gameLabel],
  );

  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const shareResult = useCallback(async () => {
    if (!canShare) return;
    const url = typeof window !== "undefined" ? window.location.href : undefined;
    try {
      await navigator.share({
        title: "Playground",
        text: shareText,
        ...(url ? { url } : {}),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }, [canShare, shareText]);

  if (!canShare) return null;

  return (
    <Button
      type="button"
      variant="secondary"
      className={className}
      onClick={() => void shareResult()}
    >
      <Share2 className="mr-2 inline h-4 w-4" aria-hidden />
      Share result
    </Button>
  );
}
