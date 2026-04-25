import { typingAttemptRepository } from '../repositories/typingAttemptRepository.js';
import { npatResultRepository } from '../repositories/npatResultRepository.js';
import { userStatsRepository } from '../repositories/userStatsRepository.js';

const WPM_HARD_CAP = 300;
const MIN_ELAPSED_RATIO = 60_000 / (25 * 5);

/**
 * Validate and persist a typing attempt, then update UserStats.
 *
 * @param {{
 *   userId: string,
 *   username: string,
 *   mode: 'solo' | 'multi',
 *   roomCode?: string | null,
 *   passageLength: number,
 *   correctChars: number,
 *   incorrectChars: number,
 *   extraChars: number,
 *   wpm: number,
 *   rawWpm: number,
 *   elapsedMs: number,
 *   rank?: number | null,
 *   playerCount?: number,
 *   dnf?: boolean,
 * }} params
 * @param {import('pino').Logger} [log]
 */
export async function persistTypingAttempt(params, log) {
  const {
    userId, username, mode, roomCode = null, passageLength,
    correctChars, incorrectChars, extraChars, wpm, rawWpm, elapsedMs,
    rank = null, playerCount = 1, dnf = false,
  } = params;

  const totalChars = correctChars + incorrectChars + extraChars;
  const accuracy = totalChars > 0 ? Math.round((correctChars / totalChars) * 10000) / 100 : 0;
  const errorCount = incorrectChars + extraChars;

  let suspicious = false;
  if (correctChars > passageLength + 10) suspicious = true;
  if (wpm > WPM_HARD_CAP) suspicious = true;
  /** Time mode sends a long buffer; only typed chars matter for a plausible minimum duration. */
  const charsForTiming = Math.min(passageLength, Math.max(1, totalChars));
  if (elapsedMs > 0) {
    const minExpectedMs = (charsForTiming / (WPM_HARD_CAP * 5)) * 60_000;
    if (elapsedMs < minExpectedMs * 0.5) suspicious = true;
  }

  const cappedWpm = Math.min(wpm, WPM_HARD_CAP);
  const doc = {
    userId,
    username,
    mode,
    roomCode,
    passageLength,
    correctChars,
    incorrectChars,
    extraChars,
    wpm: cappedWpm,
    rawWpm: Math.min(rawWpm, WPM_HARD_CAP + 50),
    accuracy,
    errorCount,
    elapsedMs,
    rank,
    playerCount,
    dnf,
    suspicious,
    finishedAt: new Date(),
  };

  try {
    await typingAttemptRepository.create(doc);
  } catch (err) {
    log?.warn({ err, userId, event: 'typing_attempt_persist_failed' }, 'leaderboard');
    return;
  }

  if (dnf || suspicious) return;

  try {
    await userStatsRepository.recordTypingAttempt({
      userId,
      username,
      correctChars,
      incorrectChars,
      extraChars,
      elapsedMs,
      wpm: cappedWpm,
      accuracy,
      rank,
    });
  } catch (err) {
    log?.warn({ err, userId, event: 'user_stats_typing_update_failed' }, 'leaderboard');
  }
}

/**
 * Extract per-player results from a finished NPAT game and persist.
 *
 * @param {{
 *   code: string,
 *   mode: 'solo' | 'team',
 *   players: Map<string, { userId: string, username: string, teamId?: string }> | Array<{ userId: string, username: string, teamId?: string }>,
 *   results: { rounds: Array<Record<string, unknown>> },
 *   logger: import('pino').Logger,
 * }} params
 */
export async function persistNpatResults({ code, mode, players, results, logger }) {
  const playerList = players instanceof Map ? [...players.values()] : players;
  if (!playerList.length || !results?.rounds?.length) return;

  const scoreTotals = new Map();
  for (const p of playerList) {
    scoreTotals.set(p.userId, { total: 0, rounds: 0, username: p.username, teamId: p.teamId });
  }

  for (const round of results.rounds) {
    const ev = round.evaluation;
    if (!ev || typeof ev !== 'object') continue;
    const evalResults = Array.isArray(ev.results) ? ev.results : [];
    for (const row of evalResults) {
      const pid = row.playerId ?? row.player_id;
      const score = typeof row.totalScore === 'number' ? row.totalScore : 0;
      if (!pid) continue;
      const existing = scoreTotals.get(pid);
      if (existing) {
        existing.total += score;
        existing.rounds += 1;
      } else {
        scoreTotals.set(pid, { total: score, rounds: 1, username: `Player-${String(pid).slice(-4)}`, teamId: '' });
      }
    }
  }

  let maxScore = -1;
  let maxCount = 0;
  for (const [, data] of scoreTotals) {
    if (data.total > maxScore) {
      maxScore = data.total;
      maxCount = 1;
    } else if (data.total === maxScore) {
      maxCount += 1;
    }
  }

  const now = new Date();
  const playerCount = scoreTotals.size;
  const npatDocs = [];

  for (const [uid, data] of scoreTotals) {
    if (data.rounds === 0) continue;
    let outcome = 'solo';
    if (playerCount > 1) {
      if (maxCount > 1 && data.total === maxScore) outcome = 'draw';
      else if (data.total === maxScore) outcome = 'win';
      else outcome = 'loss';
    }

    npatDocs.push({
      userId: uid,
      username: data.username,
      roomCode: code,
      mode,
      roundsPlayed: data.rounds,
      totalScore: data.total,
      averageScore: data.rounds > 0 ? Math.round((data.total / data.rounds) * 100) / 100 : 0,
      outcome,
      playerCount,
      finishedAt: now,
    });
  }

  try {
    if (npatDocs.length > 0) {
      await npatResultRepository.insertMany(npatDocs);
    }
  } catch (err) {
    logger.warn({ err, code, event: 'npat_result_persist_failed' }, 'leaderboard');
  }

  for (const doc of npatDocs) {
    try {
      await userStatsRepository.recordNpatResult({
        userId: doc.userId,
        username: doc.username,
        totalScore: doc.totalScore,
        isWin: doc.outcome === 'win',
      });
    } catch (err) {
      logger.warn({ err, userId: doc.userId, event: 'user_stats_npat_update_failed' }, 'leaderboard');
    }
  }
}
