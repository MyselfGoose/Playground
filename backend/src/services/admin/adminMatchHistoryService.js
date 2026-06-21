import {
  mapTypingAttemptToMatch,
  mapNpatResultToMatch,
  mapTabooResultToMatch,
  mapHangmanResultToMatch,
  mapCahActivityToMatch,
  mergeAndSortMatches,
} from '../matchHistoryService.js';
import { typingAttemptRepository } from '../../repositories/typingAttemptRepository.js';
import { npatResultRepository } from '../../repositories/npatResultRepository.js';
import { tabooResultRepository } from '../../repositories/tabooResultRepository.js';
import { hangmanGameResultRepository } from '../../repositories/hangmanGameResultRepository.js';
import { cahLeaderboardLedgerRepository } from '../../repositories/cahLeaderboardLedgerRepository.js';

const GAME_FILTERS = new Set(['all', 'typing-race', 'npat', 'taboo', 'hangman', 'cah']);

/**
 * @param {string} userId
 * @param {{ limit?: number, skip?: number, game?: string }} [opts]
 */
export async function getAdminMatchHistoryForUser(userId, { limit = 25, skip = 0, game = 'all' } = {}) {
  const capped = Math.max(1, Math.min(100, Number(limit) || 25));
  const gameFilter = GAME_FILTERS.has(game) ? game : 'all';
  const fetchLimit = capped + skip;

  const loaders = [];

  if (gameFilter === 'all' || gameFilter === 'typing-race') {
    loaders.push(
      typingAttemptRepository.findByUser(userId, { limit: fetchLimit }).then((rows) =>
        rows.map((row) => mapTypingAttemptToMatch(row)),
      ),
    );
  }
  if (gameFilter === 'all' || gameFilter === 'npat') {
    loaders.push(
      npatResultRepository.findByUser(userId, { limit: fetchLimit }).then((rows) =>
        rows.map((row) => mapNpatResultToMatch(row)),
      ),
    );
  }
  if (gameFilter === 'all' || gameFilter === 'taboo') {
    loaders.push(
      tabooResultRepository.findByUser(userId, { limit: fetchLimit }).then((rows) =>
        rows.map((row) => mapTabooResultToMatch(row)),
      ),
    );
  }
  if (gameFilter === 'all' || gameFilter === 'hangman') {
    loaders.push(
      hangmanGameResultRepository.findByUser(userId, { limit: fetchLimit }).then((rows) =>
        rows.map((row) => mapHangmanResultToMatch(row)),
      ),
    );
  }
  if (gameFilter === 'all' || gameFilter === 'cah') {
    loaders.push(
      cahLeaderboardLedgerRepository.findByUser(userId, { limit: fetchLimit }).then((rows) =>
        rows.map((row) => mapCahActivityToMatch(row)),
      ),
    );
  }

  const chunks = await Promise.all(loaders);
  const merged = mergeAndSortMatches(chunks.flat(), capped + skip);
  const page = merged.slice(skip, skip + capped);

  return { matches: page, limit: capped, skip, game: gameFilter };
}
