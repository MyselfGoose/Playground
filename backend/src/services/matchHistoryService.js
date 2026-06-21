import { typingAttemptRepository } from '../repositories/typingAttemptRepository.js';
import { npatResultRepository } from '../repositories/npatResultRepository.js';

/**
 * @param {Record<string, unknown>} doc
 */
export function mapTypingAttemptToMatch(doc) {
  const finishedAt = doc.finishedAt instanceof Date ? doc.finishedAt.toISOString() : String(doc.finishedAt ?? '');
  return {
    game: 'typing-race',
    placement: doc.rank != null ? Number(doc.rank) : null,
    finishedAt,
    roomCode: doc.roomCode != null ? String(doc.roomCode) : null,
    summary: {
      mode: doc.mode,
      wpm: doc.wpm ?? 0,
      accuracy: doc.accuracy ?? 0,
      playerCount: doc.playerCount ?? 1,
      dnf: Boolean(doc.dnf),
    },
  };
}

/**
 * @param {Record<string, unknown>} doc
 */
export function mapNpatResultToMatch(doc) {
  const finishedAt = doc.finishedAt instanceof Date ? doc.finishedAt.toISOString() : String(doc.finishedAt ?? '');
  const outcome = String(doc.outcome ?? '');
  let placement = null;
  if (outcome === 'win') placement = 1;
  else if (outcome === 'solo') placement = 1;

  return {
    game: 'npat',
    placement,
    finishedAt,
    roomCode: doc.roomCode != null ? String(doc.roomCode) : null,
    summary: {
      mode: doc.mode,
      totalScore: doc.totalScore ?? 0,
      averageScore: doc.averageScore ?? 0,
      outcome,
      playerCount: doc.playerCount ?? 1,
    },
  };
}

/**
 * @param {Record<string, unknown>} doc
 */
export function mapTabooResultToMatch(doc) {
  const finishedAt = doc.finishedAt instanceof Date ? doc.finishedAt.toISOString() : String(doc.finishedAt ?? '');
  return {
    game: 'taboo',
    placement: doc.won ? 1 : null,
    finishedAt,
    roomCode: doc.roomCode != null ? String(doc.roomCode) : null,
    summary: {
      mode: doc.mode,
      team: doc.team,
      won: Boolean(doc.won),
      speakerRounds: doc.speakerRounds ?? 0,
      correctGuesses: doc.correctGuesses ?? 0,
    },
  };
}

/**
 * @param {Record<string, unknown>} doc
 */
export function mapHangmanResultToMatch(doc) {
  const finishedAt = doc.finishedAt instanceof Date ? doc.finishedAt.toISOString() : String(doc.finishedAt ?? '');
  return {
    game: 'hangman',
    placement: doc.placement != null ? Number(doc.placement) : (doc.won ? 1 : null),
    finishedAt,
    roomCode: doc.roomCode != null ? String(doc.roomCode) : null,
    summary: {
      mode: doc.mode,
      won: Boolean(doc.won),
      wrongGuesses: doc.wrongGuesses ?? 0,
      correctGuesses: doc.correctGuesses ?? 0,
      playerCount: doc.playerCount ?? 1,
      score: doc.score ?? 0,
    },
  };
}

/**
 * @param {Record<string, unknown>} doc
 */
export function mapCahActivityToMatch(doc) {
  const finishedAt = doc.occurredAt instanceof Date ? doc.occurredAt.toISOString() : String(doc.occurredAt ?? '');
  return {
    game: 'cah',
    placement: null,
    finishedAt,
    roomCode: null,
    summary: {
      activity: true,
    },
  };
}

/**
 * @param {Array<{ finishedAt: string }>} matches
 * @param {number} limit
 */
export function mergeAndSortMatches(matches, limit) {
  return [...matches]
    .sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime())
    .slice(0, limit);
}

/**
 * @param {string} userId
 * @param {{ limit?: number }} [opts]
 */
export async function getMatchHistoryForUser(userId, { limit = 10 } = {}) {
  const capped = Math.max(1, Math.min(50, Number(limit) || 10));
  const fetchLimit = capped;

  const [typingRows, npatRows] = await Promise.all([
    typingAttemptRepository.findByUser(userId, { limit: fetchLimit }),
    npatResultRepository.findByUser(userId, { limit: fetchLimit }),
  ]);

  const matches = mergeAndSortMatches(
    [
      ...typingRows.map((row) => mapTypingAttemptToMatch(row)),
      ...npatRows.map((row) => mapNpatResultToMatch(row)),
    ],
    capped,
  );

  return { matches };
}
