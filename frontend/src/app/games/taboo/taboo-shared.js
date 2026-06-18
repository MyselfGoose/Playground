"use client";

export function normalizeCode(code) {
  return String(code ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

/** @param {string} base @param {string | null | undefined} code */
export function tabooPath(base, code) {
  const normalized = code ? normalizeCode(code) : "";
  return normalized ? `${base}?code=${normalized}` : base;
}

export function buildPlayerRecapRows(players, history) {
  const rows = new Map();
  for (const p of players || []) {
    rows.set(p.id, { id: p.id, name: p.name, team: p.team, correct: 0, close: 0, wrong: 0, skips: 0, taboos: 0 });
  }
  for (const entry of history || []) {
    if (!entry.playerId || !rows.has(entry.playerId)) continue;
    const row = rows.get(entry.playerId);
    if (entry.action === "submit_guess" && entry.matched) row.correct += 1;
    else if (entry.action === "submit_guess") row.wrong += 1;
    else if (entry.action === "close_guess") row.close += 1;
    else if (entry.action === "skip_card") row.skips += 1;
    else if (entry.action === "taboo_called") row.taboos += 1;
  }
  return [...rows.values()].sort((a, b) => b.correct - a.correct);
}

/** @param {{ scores?: { A?: number, B?: number } }} game */
export function tabooWinnerBannerTitle(game) {
  const scoreA = game?.scores?.A ?? 0;
  const scoreB = game?.scores?.B ?? 0;
  if (scoreA > scoreB) return "Team Alpha wins!";
  if (scoreB > scoreA) return "Team Beta wins!";
  return "It's a tie!";
}

/** @param {{ scores?: { A?: number, B?: number } }} game */
export function tabooWinnerBannerSubtitle(game) {
  const scoreA = game?.scores?.A ?? 0;
  const scoreB = game?.scores?.B ?? 0;
  return `Final score ${scoreA} – ${scoreB}`;
}
