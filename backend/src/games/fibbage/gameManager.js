import crypto from 'node:crypto';
import { normalizeAnswer, isTooCloseToTruth } from './normalizeAnswer.js';
import {
  FIBBAGE_MIN_PLAYERS,
  FIBBAGE_MAX_PLAYERS,
  FIBBAGE_DEFAULT_ROUND_COUNT,
  FIBBAGE_DEFAULT_WRITING_SECONDS,
  FIBBAGE_DEFAULT_VOTING_SECONDS,
  FIBBAGE_STARTING_MS,
  FIBBAGE_PROMPT_REVEAL_MS,
  FIBBAGE_SCORING_MS,
  FIBBAGE_BETWEEN_ROUNDS_MS,
  FIBBAGE_REVEAL_VOTES_SUMMARY_MS,
  FIBBAGE_REVEAL_PER_LIE_MS,
  FIBBAGE_REVEAL_TRUTH_MS,
  FIBBAGE_REVEAL_COMPLETE_MS,
  FIBBAGE_POINTS_FOOL,
  FIBBAGE_POINTS_TRUTH,
  FIBBAGE_POINTS_SOLO_TRUTH,
  FIBBAGE_FINAL_ROUND_MULTIPLIER,
  FIBBAGE_LIE_MIN_LENGTH,
  FIBBAGE_LIE_MAX_LENGTH,
} from './constants.js';
import { activePlayersInRoom } from '../../realtime/playerPresence.js';

class FibbageError extends Error {
  constructor(message, code = 'FIBBAGE_ERROR') {
    super(message);
    this.code = code;
  }
}

function nowMs() {
  return Date.now();
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function generateAnswerId() {
  return crypto.randomBytes(6).toString('hex');
}

function emptySessionStat() {
  return { liesSubmitted: 0, foolsEarned: 0, truthsFound: 0, soloTruths: 0 };
}

function ensureSessionStat(game, userId) {
  if (!game.sessionStats[userId]) {
    game.sessionStats[userId] = emptySessionStat();
  }
  return game.sessionStats[userId];
}

/**
 * Create initial room settings with defaults applied.
 * @param {Record<string, unknown>} [input]
 */
export function normalizeSettings(input = {}) {
  const roundCount = Number(input.roundCount ?? FIBBAGE_DEFAULT_ROUND_COUNT);
  const writingSeconds = Number(input.writingSeconds ?? FIBBAGE_DEFAULT_WRITING_SECONDS);
  const votingSeconds = Number(input.votingSeconds ?? FIBBAGE_DEFAULT_VOTING_SECONDS);
  const categoryMode = input.categoryMode === 'single' ? 'single' : 'all';
  const categoryIds = Array.isArray(input.categoryIds)
    ? [...new Set(input.categoryIds.map((c) => String(c).trim()).filter(Boolean))]
    : [];

  return {
    roundCount: Math.max(3, Math.min(10, Number.isFinite(roundCount) ? roundCount : FIBBAGE_DEFAULT_ROUND_COUNT)),
    writingSeconds: Math.max(45, Math.min(120, Number.isFinite(writingSeconds) ? writingSeconds : FIBBAGE_DEFAULT_WRITING_SECONDS)),
    votingSeconds: Math.max(30, Math.min(90, Number.isFinite(votingSeconds) ? votingSeconds : FIBBAGE_DEFAULT_VOTING_SECONDS)),
    categoryMode,
    categoryIds,
  };
}

/**
 * Initialize the game state for a new game session.
 * @param {object} room
 * @param {{ id: string, text: string, answer: string, category: string }} prompt
 */
export function initGame(room, prompt) {
  const activePlayers = activePlayersInRoom(room);
  if (activePlayers.length < FIBBAGE_MIN_PLAYERS) {
    throw new FibbageError(`Need at least ${FIBBAGE_MIN_PLAYERS} players`, 'NOT_ENOUGH_PLAYERS');
  }

  const now = nowMs();
  room.game = {
    gameSessionId: crypto.randomUUID(),
    status: 'starting',
    round: 1,
    roundMultiplier: room.settings.roundCount === 1 ? FIBBAGE_FINAL_ROUND_MULTIPLIER : 1,
    phaseEndsAt: now + FIBBAGE_STARTING_MS,
    prompt: {
      id: prompt.id,
      text: prompt.text,
      answer: prompt.answer,
      category: prompt.category,
    },
    submissions: new Map(),
    answers: [],
    votes: new Map(),
    reveal: null,
    roundScores: null,
    sessionStats: {},
  };

  room.usedPromptIds.add(prompt.id);
}

/**
 * Start a new round (round > 1).
 * @param {object} room
 * @param {{ id: string, text: string, answer: string, category: string }} prompt
 */
export function initRound(room, prompt) {
  const game = room.game;
  if (!game) throw new FibbageError('No game in progress', 'NO_GAME');

  const now = nowMs();
  game.round += 1;
  game.roundMultiplier = game.round === room.settings.roundCount ? FIBBAGE_FINAL_ROUND_MULTIPLIER : 1;
  game.status = 'starting';
  game.phaseEndsAt = now + FIBBAGE_STARTING_MS;
  game.prompt = {
    id: prompt.id,
    text: prompt.text,
    answer: prompt.answer,
    category: prompt.category,
  };
  game.submissions = new Map();
  game.answers = [];
  game.votes = new Map();
  game.reveal = null;
  game.roundScores = null;

  room.usedPromptIds.add(prompt.id);
}

/**
 * Check and advance phase if the current phase timer has expired.
 * Returns a reason string if a transition occurred, null otherwise.
 *
 * @param {object} room
 * @param {number} now
 * @param {() => Promise<{id:string,text:string,answer:string,category:string}|null>} fetchPrompt
 * @returns {Promise<string|null>}
 */
export async function advancePhaseIfExpired(room, now, fetchPrompt) {
  const game = room.game;
  if (!game || !game.phaseEndsAt || now < game.phaseEndsAt) return null;

  switch (game.status) {
    case 'starting':
      game.status = 'prompt_reveal';
      game.phaseEndsAt = now + FIBBAGE_PROMPT_REVEAL_MS;
      return 'prompt_reveal';

    case 'prompt_reveal':
      game.status = 'writing';
      game.phaseEndsAt = now + room.settings.writingSeconds * 1000;
      return 'writing_started';

    case 'writing':
      return enterVotingOrSkip(room, now);

    case 'voting':
      return enterRevealing(room, now);

    case 'revealing':
      return advanceReveal(room, now);

    case 'scoring':
      if (game.round >= room.settings.roundCount) {
        game.status = 'finished';
        game.phaseEndsAt = null;
        return 'game_finished';
      }
      game.status = 'between_rounds';
      game.phaseEndsAt = now + FIBBAGE_BETWEEN_ROUNDS_MS;
      return 'between_rounds';

    case 'between_rounds': {
      const prompt = await fetchPrompt();
      if (!prompt) {
        game.status = 'finished';
        game.phaseEndsAt = null;
        return 'game_finished';
      }
      initRound(room, prompt);
      return 'new_round';
    }

    default:
      return null;
  }
}

/**
 * Submit a lie for the current round.
 * @param {object} room
 * @param {string} userId
 * @param {string} text
 */
export function submitLie(room, userId, text) {
  const game = room.game;
  if (!game) throw new FibbageError('No game in progress', 'NO_GAME');
  if (game.status !== 'writing') throw new FibbageError('Not in writing phase', 'INVALID_PHASE');

  const player = room.players.find((p) => p.userId === userId);
  if (!player) throw new FibbageError('Player not found', 'PLAYER_NOT_FOUND');
  if (game.submissions.has(userId)) {
    throw new FibbageError('Already submitted a lie', 'ALREADY_SUBMITTED');
  }

  const trimmed = String(text).trim();
  if (trimmed.length < FIBBAGE_LIE_MIN_LENGTH) {
    throw new FibbageError(`Lie must be at least ${FIBBAGE_LIE_MIN_LENGTH} characters`, 'LIE_TOO_SHORT');
  }
  if (trimmed.length > FIBBAGE_LIE_MAX_LENGTH) {
    throw new FibbageError(`Lie must be at most ${FIBBAGE_LIE_MAX_LENGTH} characters`, 'LIE_TOO_LONG');
  }

  if (isTooCloseToTruth(trimmed, game.prompt.answer)) {
    throw new FibbageError('Your answer is too close to the truth', 'TOO_CLOSE_TO_TRUTH');
  }

  const normalized = normalizeAnswer(trimmed);
  for (const [existingUserId, sub] of game.submissions) {
    if (existingUserId !== userId && sub.normalized === normalized) {
      throw new FibbageError('Another player already submitted that answer', 'DUPLICATE_LIE');
    }
  }

  game.submissions.set(userId, {
    text: trimmed,
    normalized,
    submittedAt: nowMs(),
  });
}

/**
 * Cast a vote for an answer.
 * @param {object} room
 * @param {string} userId
 * @param {string} answerId
 */
export function castVote(room, userId, answerId) {
  const game = room.game;
  if (!game) throw new FibbageError('No game in progress', 'NO_GAME');
  if (game.status !== 'voting') throw new FibbageError('Not in voting phase', 'INVALID_PHASE');

  const player = room.players.find((p) => p.userId === userId);
  if (!player) throw new FibbageError('Player not found', 'PLAYER_NOT_FOUND');

  const answer = game.answers.find((a) => a.answerId === answerId);
  if (!answer) throw new FibbageError('Invalid answer', 'INVALID_ANSWER');

  if (answer.authorUserId === userId) {
    throw new FibbageError('Cannot vote for your own submission', 'SELF_VOTE');
  }
  if (game.votes.has(userId)) {
    throw new FibbageError('Already cast a vote', 'ALREADY_VOTED');
  }

  game.votes.set(userId, answerId);
}

/**
 * Build the answers array from submissions + truth for the voting phase.
 */
function buildAnswers(game) {
  const answers = [];

  for (const [authorUserId, sub] of game.submissions) {
    answers.push({
      answerId: generateAnswerId(),
      text: sub.text,
      authorUserId,
      isTruth: false,
    });
  }

  answers.push({
    answerId: generateAnswerId(),
    text: game.prompt.answer,
    authorUserId: null,
    isTruth: true,
  });

  return shuffle(answers);
}

/**
 * Transition from writing to voting (or skip voting if no submissions).
 */
function enterVotingOrSkip(room, now) {
  const game = room.game;

  if (game.submissions.size === 0) {
    return enterRevealing(room, now);
  }

  game.answers = buildAnswers(game);
  game.status = 'voting';
  game.phaseEndsAt = now + room.settings.votingSeconds * 1000;
  return 'voting_started';
}

/**
 * Transition into the revealing phase. Compute round scores.
 */
function enterRevealing(room, now) {
  const game = room.game;

  if (game.answers.length === 0) {
    game.answers = buildAnswers(game);
  }

  computeRoundScores(room);

  game.status = 'revealing';
  game.reveal = {
    step: 'votes_summary',
    lieIndex: 0,
    phaseEndsAt: now + FIBBAGE_REVEAL_VOTES_SUMMARY_MS,
  };
  game.phaseEndsAt = null;
  return 'revealing_started';
}

/**
 * Advance writing phase when all active players have submitted.
 * @param {object} room
 * @param {number} now
 * @returns {string|null}
 */
export function finalizeWritingIfReady(room, now) {
  const game = room.game;
  if (!game || game.status !== 'writing') return null;

  const activeIds = activePlayersInRoom(room).map((p) => p.userId);
  if (activeIds.length === 0) return null;
  if (!activeIds.every((id) => game.submissions.has(id))) return null;

  return enterVotingOrSkip(room, now);
}

/**
 * Advance voting phase when all active players have voted.
 * @param {object} room
 * @param {number} now
 * @returns {string|null}
 */
export function finalizeVotingIfReady(room, now) {
  const game = room.game;
  if (!game || game.status !== 'voting') return null;

  const activeIds = activePlayersInRoom(room).map((p) => p.userId);
  if (activeIds.length === 0) return null;
  if (!activeIds.every((id) => game.votes.has(id))) return null;

  return enterRevealing(room, now);
}

/**
 * Advance reveal sub-steps when the current reveal timer has expired.
 * @param {object} room
 * @param {number} now
 * @returns {string|null}
 */
export function advanceRevealIfExpired(room, now) {
  const game = room.game;
  if (!game || game.status !== 'revealing') return null;
  return advanceReveal(room, now);
}

/**
 * Advance reveal sub-steps.
 */
function advanceReveal(room, now) {
  const game = room.game;
  const reveal = game.reveal;
  if (!reveal || now < reveal.phaseEndsAt) return null;

  switch (reveal.step) {
    case 'votes_summary': {
      const lies = game.answers.filter((a) => !a.isTruth);
      if (lies.length === 0) {
        reveal.step = 'truth';
        reveal.phaseEndsAt = now + FIBBAGE_REVEAL_TRUTH_MS;
      } else {
        reveal.step = 'per_lie';
        reveal.lieIndex = 0;
        reveal.phaseEndsAt = now + FIBBAGE_REVEAL_PER_LIE_MS;
      }
      return 'reveal_step';
    }

    case 'per_lie': {
      const lies = game.answers.filter((a) => !a.isTruth);
      if (reveal.lieIndex < lies.length - 1) {
        reveal.lieIndex += 1;
        reveal.phaseEndsAt = now + FIBBAGE_REVEAL_PER_LIE_MS;
        return 'reveal_step';
      }
      reveal.step = 'truth';
      reveal.phaseEndsAt = now + FIBBAGE_REVEAL_TRUTH_MS;
      return 'reveal_step';
    }

    case 'truth':
      reveal.step = 'complete';
      reveal.phaseEndsAt = now + FIBBAGE_REVEAL_COMPLETE_MS;
      return 'reveal_step';

    case 'complete':
      game.status = 'scoring';
      game.phaseEndsAt = now + FIBBAGE_SCORING_MS;
      game.reveal = null;
      return 'scoring_started';

    default:
      return null;
  }
}

/**
 * Compute round scores for all players.
 */
function computeRoundScores(room) {
  const game = room.game;
  const multiplier = game.roundMultiplier;
  /** @type {Record<string, { fooled: Array<{voterUserId: string, points: number}>, truthPick: { correct: boolean, solo: boolean, points: number }, totalRoundPoints: number }>} */
  const scores = {};

  for (const player of room.players) {
    scores[player.userId] = {
      fooled: [],
      truthPick: { correct: false, solo: false, points: 0 },
      totalRoundPoints: 0,
    };
  }

  const truthAnswer = game.answers.find((a) => a.isTruth);
  const truthVoterIds = [];

  for (const [voterId, answerId] of game.votes) {
    const answer = game.answers.find((a) => a.answerId === answerId);
    if (!answer) continue;

    if (answer.isTruth) {
      truthVoterIds.push(voterId);
    } else if (answer.authorUserId && scores[answer.authorUserId]) {
      const foolPoints = FIBBAGE_POINTS_FOOL * multiplier;
      scores[answer.authorUserId].fooled.push({ voterUserId: voterId, points: foolPoints });
      scores[answer.authorUserId].totalRoundPoints += foolPoints;
      const authorPlayer = room.players.find((p) => p.userId === answer.authorUserId);
      if (authorPlayer) authorPlayer.score += foolPoints;
    }
  }

  const isSolo = truthVoterIds.length === 1;
  for (const voterId of truthVoterIds) {
    if (!scores[voterId]) continue;
    const truthPoints = FIBBAGE_POINTS_TRUTH * multiplier;
    const soloPoints = isSolo ? FIBBAGE_POINTS_SOLO_TRUTH * multiplier : 0;
    const total = truthPoints + soloPoints;
    scores[voterId].truthPick = { correct: true, solo: isSolo, points: total };
    scores[voterId].totalRoundPoints += total;
    const player = room.players.find((p) => p.userId === voterId);
    if (player) player.score += total;
  }

  game.roundScores = scores;

  for (const [authorUserId] of game.submissions) {
    ensureSessionStat(game, authorUserId).liesSubmitted += 1;
  }

  for (const [userId, roundScore] of Object.entries(scores)) {
    const stat = ensureSessionStat(game, userId);
    stat.foolsEarned += roundScore.fooled?.length ?? 0;
    if (roundScore.truthPick?.correct) {
      stat.truthsFound += 1;
      if (roundScore.truthPick.solo) stat.soloTruths += 1;
    }
  }
}

/**
 * Build a leak-proof snapshot of the room for a specific viewer.
 * The truth answer MUST NOT be visible during writing or voting.
 *
 * @param {object} room
 * @param {string} viewerUserId
 * @returns {object}
 */
export function snapshotFor(room, viewerUserId) {
  const game = room.game;
  const base = {
    code: room.code,
    hostUserId: room.hostUserId,
    stateVersion: room.stateVersion,
    settings: { ...room.settings },
    players: room.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      avatarUrl: p.avatarUrl ?? null,
      avatarEmoji: p.avatarEmoji ?? null,
      ready: p.ready,
      connected: p.presenceStatus === 'connected',
      score: p.score,
    })),
    game: null,
    permissions: buildPermissions(room, viewerUserId),
  };

  if (!game) return base;

  const safeGame = {
    gameSessionId: game.gameSessionId,
    status: game.status,
    round: game.round,
    roundMultiplier: game.roundMultiplier,
    phaseEndsAt: game.phaseEndsAt,
    prompt: {
      id: game.prompt.id,
      text: game.prompt.text,
      category: game.prompt.category,
    },
    submissionCount: game.submissions.size,
    answerCount: game.answers.length,
    voteCount: game.votes.size,
    reveal: null,
    roundScores: null,
    answers: null,
  };

  switch (game.status) {
    case 'starting':
    case 'prompt_reveal':
      break;

    case 'writing': {
      const submittedUserIds = [...game.submissions.keys()];
      safeGame.submittedUserIds = submittedUserIds;
      break;
    }

    case 'voting': {
      safeGame.answers = game.answers.map((a) => ({
        answerId: a.answerId,
        text: a.text,
        authorUserId: null,
        isTruth: false,
      }));

      const viewerSubmission = game.submissions.get(viewerUserId);
      if (viewerSubmission) {
        const viewerAnswer = game.answers.find(
          (a) => !a.isTruth && a.authorUserId === viewerUserId,
        );
        if (viewerAnswer) {
          base.permissions.ownAnswerId = viewerAnswer.answerId;
        }
      }

      const votedUserIds = [...game.votes.keys()];
      safeGame.votedUserIds = votedUserIds;
      safeGame.viewerVote = game.votes.get(viewerUserId) ?? null;
      break;
    }

    case 'revealing': {
      const reveal = game.reveal;
      safeGame.reveal = reveal
        ? { step: reveal.step, lieIndex: reveal.lieIndex, phaseEndsAt: reveal.phaseEndsAt }
        : null;
      safeGame.roundScores = game.roundScores;
      safeGame.answers = buildRevealAnswers(game, reveal);
      safeGame.viewerVote = game.votes.get(viewerUserId) ?? null;
      break;
    }

    case 'scoring':
    case 'between_rounds': {
      safeGame.roundScores = game.roundScores;
      safeGame.answers = game.answers.map((a) => ({
        answerId: a.answerId,
        text: a.text,
        authorUserId: a.authorUserId,
        isTruth: a.isTruth,
        voters: getVotersForAnswer(game, a.answerId),
      }));
      safeGame.viewerVote = game.votes.get(viewerUserId) ?? null;
      break;
    }

    case 'finished': {
      safeGame.roundScores = game.roundScores;
      safeGame.answers = game.answers.map((a) => ({
        answerId: a.answerId,
        text: a.text,
        authorUserId: a.authorUserId,
        isTruth: a.isTruth,
        voters: getVotersForAnswer(game, a.answerId),
      }));
      safeGame.viewerVote = game.votes.get(viewerUserId) ?? null;
      break;
    }
  }

  base.game = safeGame;
  return base;
}

/**
 * Build the answers array for the reveal phase, progressively exposing authors.
 */
function buildRevealAnswers(game, reveal) {
  if (!reveal) {
    return game.answers.map((a) => ({
      answerId: a.answerId,
      text: a.text,
      authorUserId: null,
      isTruth: false,
    }));
  }

  const lies = game.answers.filter((a) => !a.isTruth);

  return game.answers.map((a) => {
    const voteCount = getVotersForAnswer(game, a.answerId).length;

    if (a.isTruth) {
      const showTruth = reveal.step === 'truth' || reveal.step === 'complete';
      return {
        answerId: a.answerId,
        text: a.text,
        authorUserId: null,
        isTruth: showTruth,
        voteCount,
        voters: showTruth ? getVotersForAnswer(game, a.answerId) : [],
      };
    }

    const lieIdx = lies.indexOf(a);
    const isRevealed =
      reveal.step === 'truth' ||
      reveal.step === 'complete' ||
      (reveal.step === 'per_lie' && lieIdx <= reveal.lieIndex);

    return {
      answerId: a.answerId,
      text: a.text,
      authorUserId: isRevealed ? a.authorUserId : null,
      isTruth: false,
      voteCount,
      voters: isRevealed ? getVotersForAnswer(game, a.answerId) : [],
    };
  });
}

/**
 * Get the list of user IDs who voted for a specific answer.
 */
function getVotersForAnswer(game, answerId) {
  const voters = [];
  for (const [userId, votedId] of game.votes) {
    if (votedId === answerId) voters.push(userId);
  }
  return voters;
}

/**
 * Build viewer-specific permissions object.
 */
function buildPermissions(room, viewerUserId) {
  const game = room.game;
  const isHost = room.hostUserId === viewerUserId;
  const player = room.players.find((p) => p.userId === viewerUserId);

  if (!game) {
    return {
      canStartGame: isHost,
      canSubmitLie: false,
      canVote: false,
      ownSubmissionLocked: false,
      ownAnswerId: null,
    };
  }

  const hasSubmitted = game.submissions.has(viewerUserId);
  const hasVoted = game.votes.has(viewerUserId);

  return {
    canStartGame: isHost && game.status === 'finished',
    canSubmitLie: game.status === 'writing' && Boolean(player) && !hasSubmitted,
    canVote: game.status === 'voting' && Boolean(player) && !hasVoted,
    ownSubmissionLocked: hasSubmitted,
    ownAnswerId: null,
  };
}

/**
 * Get winners (highest score) after game finishes.
 * @param {object} room
 * @returns {Array<{userId: string, username: string, score: number}>}
 */
export function getWinners(room) {
  if (!room.players.length) return [];
  const maxScore = Math.max(...room.players.map((p) => p.score));
  return room.players
    .filter((p) => p.score === maxScore)
    .map((p) => ({ userId: p.userId, username: p.username, score: p.score }));
}

/**
 * Get per-player game result data for stats persistence.
 * @param {object} room
 */
export function getGameResults(room) {
  const game = room.game;
  if (!game) return [];
  const winners = getWinners(room);
  const winnerIds = new Set(winners.map((w) => w.userId));

  return room.players.map((p) => ({
    userId: p.userId,
    username: p.username,
    score: p.score,
    won: winnerIds.has(p.userId),
  }));
}
