import { typingAttemptRepository } from '../repositories/typingAttemptRepository.js';
import { npatResultRepository } from '../repositories/npatResultRepository.js';
import { tabooResultRepository } from '../repositories/tabooResultRepository.js';
import { cahLeaderboardLedgerRepository } from '../repositories/cahLeaderboardLedgerRepository.js';
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

function buildTabooTurnWindows(history) {
  const starts = history.filter((e) => e.action === 'turn_started');
  const endings = new Set(['turn_ended', 'turn_timeout', 'turn_aborted_disconnected', 'turn_skipped_disconnected']);
  return starts.map((start, i) => {
    const startAt = Number(start.at || 0);
    const nextStartAt = Number(starts[i + 1]?.at || Number.MAX_SAFE_INTEGER);
    const ending = history.find((e) => Number(e.at || 0) >= startAt && Number(e.at || 0) < nextStartAt && endings.has(e.action));
    return {
      speakerId: start.playerId,
      speakerName: start.playerName,
      team: start.team,
      startAt,
      endAt: Number(ending?.at || nextStartAt),
    };
  });
}

/**
 * @param {{
 *   code: string,
 *   game: { status?: string, endedAt?: number|null, scores?: {A:number,B:number}, history?: Array<Record<string, unknown>> },
 *   players: Array<{ userId: string, username: string, team: 'A'|'B', connected?: boolean }>,
 *   logger: import('pino').Logger,
 * }} params
 */
export async function persistTabooResults({ code, game, players, logger }) {
  if (!game || game.status !== 'finished') return;
  if (!Array.isArray(players) || players.length < 2) return;
  const history = Array.isArray(game.history) ? game.history : [];
  if (!history.length) return;

  const gameId = `${code}:${String(game.endedAt ?? 0)}`;
  const turns = buildTabooTurnWindows(history);
  if (!turns.length) return;
  const validTeams = new Set(players.map((p) => p.team));
  if (!validTeams.has('A') || !validTeams.has('B')) return;

  const scores = game.scores || { A: 0, B: 0 };
  const winnerTeam = scores.A === scores.B ? null : scores.A > scores.B ? 'A' : 'B';
  const finishedAt = new Date(Number(game.endedAt || Date.now()));

  const perPlayer = new Map(
    players.map((p) => [
      p.userId,
      {
        userId: p.userId,
        username: p.username,
        team: p.team,
        speakerRounds: 0,
        correctGuessesAsSpeaker: 0,
        tabooViolations: 0,
        guessesMade: 0,
        correctGuesses: 0,
      },
    ]),
  );

  for (const entry of history) {
    const action = String(entry.action || '');
    const pid = String(entry.playerId || '');
    if (action === 'submit_guess' && perPlayer.has(pid)) {
      const row = perPlayer.get(pid);
      row.guessesMade += 1;
      if (entry.matched === true) row.correctGuesses += 1;
    }
  }

  for (const turn of turns) {
    const row = perPlayer.get(String(turn.speakerId || ''));
    if (!row) continue;
    row.speakerRounds += 1;
    const inTurn = history.filter((e) => Number(e.at || 0) >= turn.startAt && Number(e.at || 0) <= turn.endAt);
    row.correctGuessesAsSpeaker += inTurn.filter((e) => e.action === 'submit_guess' && e.matched === true).length;
    row.tabooViolations += inTurn.filter((e) => e.action === 'taboo_called' && e.penalizedTeam === turn.team).length;
  }

  const docs = [];
  for (const row of perPlayer.values()) {
    const won = winnerTeam ? row.team === winnerTeam : false;
    const speakerSuccessRate = row.speakerRounds > 0 ? (row.correctGuessesAsSpeaker / row.speakerRounds) * 100 : 0;
    const guessAccuracy = row.guessesMade > 0 ? (row.correctGuesses / row.guessesMade) * 100 : 0;
    const recentPerformanceScore = Math.max(
      0,
      Math.min(
        100,
        speakerSuccessRate * 0.45 + guessAccuracy * 0.35 + (won ? 20 : 0) - row.tabooViolations * 8,
      ),
    );
    docs.push({
      gameId,
      userId: row.userId,
      username: row.username,
      roomCode: code,
      mode: 'team',
      team: row.team,
      won,
      speakerRounds: row.speakerRounds,
      correctGuessesAsSpeaker: row.correctGuessesAsSpeaker,
      tabooViolations: row.tabooViolations,
      guessesMade: row.guessesMade,
      correctGuesses: row.correctGuesses,
      finishedAt,
      recentPerformanceScore,
    });
  }

  try {
    await tabooResultRepository.insertMany(
      docs.map((d) => ({
        gameId: d.gameId,
        userId: d.userId,
        username: d.username,
        roomCode: d.roomCode,
        mode: d.mode,
        team: d.team,
        won: d.won,
        speakerRounds: d.speakerRounds,
        correctGuessesAsSpeaker: d.correctGuessesAsSpeaker,
        tabooViolations: d.tabooViolations,
        guessesMade: d.guessesMade,
        correctGuesses: d.correctGuesses,
        finishedAt: d.finishedAt,
      })),
    );
  } catch (err) {
    logger.warn({ err, code, event: 'taboo_result_persist_failed' }, 'leaderboard');
  }

  for (const d of docs) {
    try {
      await userStatsRepository.recordTabooResult({
        userId: d.userId,
        username: d.username,
        won: d.won,
        speakerRounds: d.speakerRounds,
        correctGuessesAsSpeaker: d.correctGuessesAsSpeaker,
        tabooViolations: d.tabooViolations,
        guessesMade: d.guessesMade,
        correctGuesses: d.correctGuesses,
        recentPerformanceScore: d.recentPerformanceScore,
      });
    } catch (err) {
      logger.warn({ err, userId: d.userId, event: 'user_stats_taboo_update_failed' }, 'leaderboard');
    }
  }
}

/**
 * Persist CAH round outcome after judge picks a winner (idempotent per session + round index).
 * @param {Record<string, unknown>} room
 * @param {import('pino').Logger | undefined} log
 */
export async function persistCahRoundResult(room, log) {
  const game = room?.game;
  if (!game?.gameSessionId || game.status !== 'revealing') return;
  const gameSessionId = String(game.gameSessionId);
  const roundIndex = Number(game.roundIndex);
  if (!Number.isFinite(roundIndex)) return;

  let inserted = false;
  try {
    inserted = await cahLeaderboardLedgerRepository.tryInsertRoundLedger({
      gameSessionId,
      roundIndex,
      roomCode: room.code ?? '',
    });
  } catch (err) {
    log?.warn({ err, event: 'cah_round_ledger_failed' }, 'leaderboard');
    return;
  }
  if (!inserted) return;

  const winnerUserId = game.winnerUserId ? String(game.winnerUserId) : '';
  const judgeUserId = game.judgeUserId ? String(game.judgeUserId) : '';
  const submissions = Array.isArray(game.submissions) ? game.submissions : [];
  const submitterIds = [...new Set(submissions.map((s) => String(s.userId || '')).filter(Boolean))];

  try {
    await cahLeaderboardLedgerRepository.insertActivityForUsers(
      [...submitterIds, judgeUserId].filter(Boolean),
    );
  } catch (err) {
    log?.warn({ err, event: 'cah_activity_insert_failed' }, 'leaderboard');
  }

  const usernameById = new Map(
    (Array.isArray(room.players) ? room.players : []).map((p) => [String(p.userId), String(p.username ?? 'Player')]),
  );

  for (const uid of submitterIds) {
    try {
      await userStatsRepository.applyCahSubmitterRound({
        userId: uid,
        username: usernameById.get(uid) ?? 'Player',
        won: Boolean(winnerUserId && uid === winnerUserId),
      });
    } catch (err) {
      log?.warn({ err, userId: uid, event: 'cah_submitter_stats_failed' }, 'leaderboard');
    }
  }

  if (judgeUserId) {
    try {
      await userStatsRepository.applyCahJudgeRound({
        userId: judgeUserId,
        username: usernameById.get(judgeUserId) ?? 'Player',
      });
    } catch (err) {
      log?.warn({ err, userId: judgeUserId, event: 'cah_judge_stats_failed' }, 'leaderboard');
    }
  }
}

/**
 * Persist completed CAH match (increments games played once per participant).
 * @param {Record<string, unknown>} room
 * @param {import('pino').Logger | undefined} log
 */
export async function persistCahGameResult(room, log) {
  const game = room?.game;
  if (!game?.gameSessionId || game.status !== 'finished') return;
  const gameSessionId = String(game.gameSessionId);

  let inserted = false;
  try {
    inserted = await cahLeaderboardLedgerRepository.tryInsertGameLedger({ gameSessionId });
  } catch (err) {
    log?.warn({ err, event: 'cah_game_ledger_failed' }, 'leaderboard');
    return;
  }
  if (!inserted) return;

  const players = Array.isArray(room.players) ? room.players : [];
  for (const p of players) {
    const uid = String(p.userId || '');
    if (!uid) continue;
    try {
      await userStatsRepository.applyCahGameCompleted({
        userId: uid,
        username: String(p.username ?? 'Player'),
      });
    } catch (err) {
      log?.warn({ err, userId: uid, event: 'cah_game_completed_stats_failed' }, 'leaderboard');
    }
  }
}
