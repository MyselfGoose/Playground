"use client";

/**
 * @param {Array<{ username?: string }>} waitingFor
 */
export function waitingForLabel(waitingFor) {
  if (waitingFor.length === 0) return null;
  if (waitingFor.length === 1) {
    return `Waiting for ${waitingFor[0].username ?? "player"}…`;
  }
  return `Waiting for ${waitingFor.length} players…`;
}
