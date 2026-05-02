import mongoose from 'mongoose';
import { UserStats } from '../models/UserStats.js';
import { CAH_MAX_ROUNDS_LIMIT } from '../games/cah/constants.js';

/** Minimum completed CAH matches to appear on the CAH leaderboard. */
export const CAH_LEADERBOARD_MIN_GAMES = 4;
export const GLOBAL_LEADERBOARD_MIN_GAMES = 5;
export const HANGMAN_LEADERBOARD_MIN_GAMES = 5;
const HANGMAN_CREDIBILITY_GAMES = 20;
const HANGMAN_MAX_WRONG_BASELINE = 7;

export function computeGlobalScore(doc) {
  const typingSkill = Math.min((doc.typing_bestWpm || 0) / 150, 1) * 100;
  const accuracySkill = doc.typing_weightedAccuracy || 0;
  const npatSkill = Math.min((doc.npat_averageScore || 0) / 35, 1) * 100;
  const tabooSkill = doc.taboo_score || 0;
  const cahSkill = doc.cah_score || 0;
  const hangmanSkill = doc.hangman_skill || 0;
  const totalGames =
    (doc.typing_totalGames || 0) +
    (doc.npat_totalGames || 0) +
    (doc.taboo_gamesPlayed || 0) +
    (doc.cah_gamesPlayed || 0) +
    (doc.hangman_totalGames || 0);
  const activityScore = Math.min(totalGames / 100, 1) * 100;
  const consistencyScore = Math.min((doc.activeDaysLast30 || 0) / 20, 1) * 100;
  return (
    typingSkill * 0.22 +
    accuracySkill * 0.14 +
    npatSkill * 0.16 +
    tabooSkill * 0.14 +
    cahSkill * 0.14 +
    hangmanSkill * 0.2 +
    activityScore * 0.1 +
    consistencyScore * 0.04
  );
}

function clamp(min, v, max) {
  return Math.max(min, Math.min(v, max));
}

function computeTabooDerived(updated) {
  const gamesPlayed = updated.taboo_gamesPlayed || 0;
  const gamesWon = updated.taboo_gamesWon || 0;
  const speakerRounds = updated.taboo_speakerRounds || 0;
  const correctGuessesAsSpeaker = updated.taboo_correctGuessesAsSpeaker || 0;
  const tabooViolations = updated.taboo_tabooViolations || 0;
  const guessesMade = updated.taboo_guessesMade || 0;
  const correctGuesses = updated.taboo_correctGuesses || 0;
  const recentPerformanceRaw = updated.taboo_recentPerformanceScore || 0;

  const winRate = gamesPlayed > 0 ? (gamesWon / gamesPlayed) * 100 : 0;
  const speakerSuccessRate = speakerRounds > 0 ? (correctGuessesAsSpeaker / speakerRounds) * 100 : 0;
  const guessAccuracy = guessesMade > 0 ? (correctGuesses / guessesMade) * 100 : 0;
  const avgGuessesPerRound = speakerRounds > 0 ? correctGuessesAsSpeaker / speakerRounds : 0;

  const normalizedVolume = clamp(0, (Math.log10(gamesPlayed + 1) / Math.log10(51)) * 100, 100);
  const normalizedAvgGuesses = clamp(0, (avgGuessesPerRound / 6) * 100, 100);
  const normalizedRecent = clamp(0, recentPerformanceRaw, 100);
  const violationPenalty = clamp(0, tabooViolations * 2.5, 30);
  const lowQualityGuessPenalty = guessesMade > 15 && guessAccuracy < 25 ? 8 : 0;

  const score = clamp(
    0,
    speakerSuccessRate * 0.28 +
      guessAccuracy * 0.26 +
      winRate * 0.22 +
      normalizedAvgGuesses * 0.09 +
      normalizedVolume * 0.08 +
      normalizedRecent * 0.07 -
      violationPenalty -
      lowQualityGuessPenalty,
    100,
  );

  return {
    taboo_winRate: Math.round(winRate * 100) / 100,
    taboo_speakerSuccessRate: Math.round(speakerSuccessRate * 100) / 100,
    taboo_guessAccuracy: Math.round(guessAccuracy * 100) / 100,
    taboo_avgGuessesPerRound: Math.round(avgGuessesPerRound * 100) / 100,
    taboo_score: Math.round(score * 100) / 100,
  };
}

export function computeCahDerived(updated) {
  const gamesPlayed = updated.cah_gamesPlayed || 0;
  const roundsPlayed = updated.cah_roundsPlayed || 0;
  const roundWins = updated.cah_roundWins || 0;
  const winRate = roundsPlayed > 0 ? (roundWins / roundsPlayed) * 100 : 0;
  const avgRoundWinsPerGame = gamesPlayed > 0 ? roundWins / gamesPlayed : 0;
  const efficiencyComponent = clamp(0, (avgRoundWinsPerGame / CAH_MAX_ROUNDS_LIMIT) * 100, 100);
  const volumeComponent = clamp(0, (Math.log10(gamesPlayed + 1) / Math.log10(51)) * 100, 100);
  const score = clamp(0, winRate * 0.45 + efficiencyComponent * 0.35 + volumeComponent * 0.2, 100);
  return {
    cah_winRate: Math.round(winRate * 100) / 100,
    cah_avgRoundWinsPerGame: Math.round(avgRoundWinsPerGame * 100) / 100,
    cah_score: Math.round(score * 100) / 100,
  };
}

export function computeHangmanDerived(updated) {
  const totalGames = updated.hangman_totalGames || 0;
  const totalWins = updated.hangman_totalWins || 0;
  const correctGuesses = updated.hangman_correctGuesses || 0;
  const wrongGuesses = updated.hangman_wrongGuesses || 0;
  const totalGuesses = updated.hangman_totalGuesses || correctGuesses + wrongGuesses;
  const fastFinishes = updated.hangman_fastFinishes || 0;
  const activeDaysLast30 = updated.hangman_activeDaysLast30 || 0;

  const rawWinRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;
  const rawAccuracy = totalGuesses > 0 ? (correctGuesses / totalGuesses) * 100 : 0;
  const avgGuessesPerGame = totalGames > 0 ? totalGuesses / totalGames : 0;
  const avgMistakesPerGame = totalGames > 0 ? wrongGuesses / totalGames : 0;
  const fastFinishRate = totalGames > 0 ? (fastFinishes / totalGames) * 100 : 0;

  const credibility = clamp(0, totalGames / HANGMAN_CREDIBILITY_GAMES, 1);
  const winRateScore = rawWinRate * credibility + 50 * (1 - credibility);
  const accuracyScore = rawAccuracy * credibility + 60 * (1 - credibility);
  const efficiencyScore = clamp(0, 100 * (1 - avgMistakesPerGame / HANGMAN_MAX_WRONG_BASELINE), 100);
  const consistencyScore = clamp(0, (activeDaysLast30 / 20) * 100, 100);
  const skill = clamp(
    0,
    winRateScore * 0.4 + accuracyScore * 0.3 + efficiencyScore * 0.2 + consistencyScore * 0.1,
    100,
  );

  return {
    hangman_winRate: Math.round(rawWinRate * 100) / 100,
    hangman_accuracy: Math.round(rawAccuracy * 100) / 100,
    hangman_avgGuessesPerGame: Math.round(avgGuessesPerGame * 100) / 100,
    hangman_avgMistakesPerGame: Math.round(avgMistakesPerGame * 100) / 100,
    hangman_fastFinishRate: Math.round(fastFinishRate * 100) / 100,
    hangman_skill: Math.round(skill * 100) / 100,
  };
}

function toUserOid(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) return null;
  return userId instanceof mongoose.Types.ObjectId ? userId : new mongoose.Types.ObjectId(String(userId));
}

export const userStatsRepository = {
  /**
   * After a typing attempt: atomically increment counters, set max values,
   * then recompute derived fields.
   */
  async recordTypingAttempt({
    userId,
    username,
    correctChars,
    incorrectChars,
    extraChars,
    elapsedMs,
    wpm,
    accuracy,
    rank,
  }) {
    const totalChars = correctChars + incorrectChars + extraChars;
    const incFields = {
      typing_totalGames: 1,
      typing_totalCorrectChars: correctChars,
      typing_totalCharsTyped: totalChars,
      typing_totalElapsedMs: elapsedMs,
    };
    if (rank === 1) incFields.typing_multiWins = 1;

    const updated = await UserStats.findOneAndUpdate(
      { userId },
      {
        $inc: incFields,
        $max: { typing_bestWpm: wpm, typing_bestAccuracy: accuracy },
        $set: { lastPlayedAt: new Date(), username },
      },
      { upsert: true, new: true, lean: true },
    );

    const newTotalChars = updated.typing_totalCharsTyped || 1;
    const weightedAcc =
      newTotalChars > 0
        ? Math.round(((updated.typing_totalCorrectChars || 0) / newTotalChars) * 10000) / 100
        : 0;

    const withDerived = { ...updated, typing_weightedAccuracy: weightedAcc };
    const globalScore = Math.round(computeGlobalScore(withDerived) * 100) / 100;

    await UserStats.updateOne(
      { userId },
      { $set: { typing_weightedAccuracy: weightedAcc, global_score: globalScore } },
    );
  },

  /**
   * After an NPAT game: atomically increment counters, then recompute derived fields.
   */
  async recordNpatResult({ userId, username, totalScore, isWin }) {
    const incFields = {
      npat_totalGames: 1,
      npat_totalScore: totalScore,
    };
    if (isWin) incFields.npat_wins = 1;

    const updated = await UserStats.findOneAndUpdate(
      { userId },
      {
        $inc: incFields,
        $set: { lastPlayedAt: new Date(), username },
      },
      { upsert: true, new: true, lean: true },
    );

    const games = updated.npat_totalGames || 1;
    const avgScore = Math.round(((updated.npat_totalScore || 0) / games) * 100) / 100;
    const winRate = Math.round(((updated.npat_wins || 0) / games) * 10000) / 100;

    const withDerived = { ...updated, npat_averageScore: avgScore, npat_winRate: winRate };
    const globalScore = Math.round(computeGlobalScore(withDerived) * 100) / 100;

    await UserStats.updateOne(
      { userId },
      { $set: { npat_averageScore: avgScore, npat_winRate: winRate, global_score: globalScore } },
    );
  },

  async recordTabooResult({
    userId,
    username,
    won,
    speakerRounds,
    correctGuessesAsSpeaker,
    tabooViolations,
    guessesMade,
    correctGuesses,
    recentPerformanceScore,
  }) {
    const updated = await UserStats.findOneAndUpdate(
      { userId },
      {
        $inc: {
          taboo_gamesPlayed: 1,
          taboo_gamesWon: won ? 1 : 0,
          taboo_speakerRounds: speakerRounds,
          taboo_correctGuessesAsSpeaker: correctGuessesAsSpeaker,
          taboo_tabooViolations: tabooViolations,
          taboo_guessesMade: guessesMade,
          taboo_correctGuesses: correctGuesses,
        },
        $set: {
          lastPlayedAt: new Date(),
          username,
          taboo_recentPerformanceScore: clamp(0, recentPerformanceScore, 100),
        },
      },
      { upsert: true, new: true, lean: true },
    );

    const tabooDerived = computeTabooDerived(updated);
    const withDerived = { ...updated, ...tabooDerived };
    const globalScore = Math.round(computeGlobalScore(withDerived) * 100) / 100;

    await UserStats.updateOne(
      { userId },
      { $set: { ...tabooDerived, global_score: globalScore } },
    );
  },

  async applyCahSubmitterRound({ userId, username, won }) {
    const oid = toUserOid(userId);
    if (!oid) return;
    const updated = await UserStats.findOneAndUpdate(
      { userId: oid },
      {
        $inc: { cah_roundsPlayed: 1, cah_roundWins: won ? 1 : 0 },
        $set: { lastPlayedAt: new Date(), username },
      },
      { upsert: true, new: true, lean: true },
    );
    const cahDerived = computeCahDerived(updated);
    const globalScore = Math.round(computeGlobalScore({ ...updated, ...cahDerived }) * 100) / 100;
    await UserStats.updateOne({ userId: oid }, { $set: { ...cahDerived, global_score: globalScore } });
  },

  async applyCahJudgeRound({ userId, username }) {
    const oid = toUserOid(userId);
    if (!oid) return;
    const updated = await UserStats.findOneAndUpdate(
      { userId: oid },
      {
        $inc: { cah_roundsJudged: 1 },
        $set: { lastPlayedAt: new Date(), username },
      },
      { upsert: true, new: true, lean: true },
    );
    const cahDerived = computeCahDerived(updated);
    const globalScore = Math.round(computeGlobalScore({ ...updated, ...cahDerived }) * 100) / 100;
    await UserStats.updateOne({ userId: oid }, { $set: { ...cahDerived, global_score: globalScore } });
  },

  async applyCahGameCompleted({ userId, username }) {
    const oid = toUserOid(userId);
    if (!oid) return;
    const updated = await UserStats.findOneAndUpdate(
      { userId: oid },
      {
        $inc: { cah_gamesPlayed: 1 },
        $set: { lastPlayedAt: new Date(), username },
      },
      { upsert: true, new: true, lean: true },
    );
    const cahDerived = computeCahDerived(updated);
    const globalScore = Math.round(computeGlobalScore({ ...updated, ...cahDerived }) * 100) / 100;
    await UserStats.updateOne({ userId: oid }, { $set: { ...cahDerived, global_score: globalScore } });
  },

  async recordHangmanGameResult({
    userId,
    username,
    won,
    correctGuesses,
    wrongGuesses,
    totalGuesses,
    fastFinish,
    modeWeight = 1,
  }) {
    const oid = toUserOid(userId);
    if (!oid) return;
    const safeModeWeight = clamp(0.25, Number(modeWeight) || 1, 1);
    const updated = await UserStats.findOneAndUpdate(
      { userId: oid },
      {
        $inc: {
          hangman_totalGames: safeModeWeight,
          hangman_totalWins: won ? safeModeWeight : 0,
          hangman_correctGuesses: Math.max(0, Number(correctGuesses) || 0) * safeModeWeight,
          hangman_wrongGuesses: Math.max(0, Number(wrongGuesses) || 0) * safeModeWeight,
          hangman_totalGuesses:
            Math.max(0, Number(totalGuesses) || Math.max(0, Number(correctGuesses) || 0) + Math.max(0, Number(wrongGuesses) || 0)) *
            safeModeWeight,
          hangman_fastFinishes: fastFinish ? safeModeWeight : 0,
        },
        $set: { lastPlayedAt: new Date(), username },
      },
      { upsert: true, new: true, lean: true },
    );
    const hangmanDerived = computeHangmanDerived(updated);
    const globalScore = Math.round(computeGlobalScore({ ...updated, ...hangmanDerived }) * 100) / 100;
    await UserStats.updateOne({ userId: oid }, { $set: { ...hangmanDerived, global_score: globalScore } });
  },

  /**
   * Leaderboard query with pagination + minimum game threshold.
   * @param {{ sortField: string, minGamesField: string, minGames: number, page: number, limit: number, sort?: Record<string, 1|-1> }} opts
   */
  async leaderboard({ sortField, minGamesField, minGames, page, limit, sort }) {
    const filter = { [minGamesField]: { $gte: minGames } };
    const skip = (page - 1) * limit;
    const sortObj = sort ?? { [sortField]: -1, lastPlayedAt: -1 };
    const [entries, total] = await Promise.all([
      UserStats.find(filter).sort(sortObj).skip(skip).limit(limit).lean(),
      UserStats.countDocuments(filter),
    ]);
    return { entries, total, page };
  },

  async leaderboardGlobal({ page, limit }) {
    const skip = (page - 1) * limit;
    const filter = {
      $expr: {
        $gte: [
          {
            $add: [
              { $ifNull: ['$typing_totalGames', 0] },
              { $ifNull: ['$npat_totalGames', 0] },
              { $ifNull: ['$taboo_gamesPlayed', 0] },
              { $ifNull: ['$cah_gamesPlayed', 0] },
              { $ifNull: ['$hangman_totalGames', 0] },
            ],
          },
          GLOBAL_LEADERBOARD_MIN_GAMES,
        ],
      },
    };
    const [entries, total] = await Promise.all([
      UserStats.find(filter).sort({ global_score: -1, lastPlayedAt: -1 }).skip(skip).limit(limit).lean(),
      UserStats.countDocuments(filter),
    ]);
    return { entries, total, page };
  },

  /**
   * Compute a user's rank for a given field by counting how many users score higher.
   */
  async rankFor({ userId, sortField, minGamesField, minGames }) {
    const doc = await UserStats.findOne({ userId }).lean();
    if (!doc || (doc[minGamesField] ?? 0) < minGames) return null;
    const myValue = doc[sortField] ?? 0;
    const above = await UserStats.countDocuments({
      [minGamesField]: { $gte: minGames },
      [sortField]: { $gt: myValue },
    });
    return above + 1;
  },

  /**
   * @param {string} userId
   */
  findByUserId(userId) {
    return UserStats.findOne({ userId }).lean();
  },

  /**
   * @param {import('mongoose').Types.ObjectId} userOid
   * @param {number} activeDays
   */
  async updateActiveDaysAndGlobalScore(
    userOid,
    activeDays,
    tabooActiveDays = 0,
    hangmanActiveDays = 0,
    hangmanGamesPlayedLast30 = 0,
  ) {
    const doc = await UserStats.findOneAndUpdate(
      { userId: userOid },
      {
        $set: {
          activeDaysLast30: activeDays,
          taboo_activeDaysLast30: tabooActiveDays,
          hangman_activeDaysLast30: hangmanActiveDays,
          hangman_gamesPlayedLast30: hangmanGamesPlayedLast30,
        },
      },
      { new: true, lean: true },
    );
    if (!doc) return;
    const tabooRecentPerformanceScore = clamp(
      0,
      (doc.taboo_score || 0) * 0.7 + Math.min((tabooActiveDays / 10) * 100, 100) * 0.3,
      100,
    );
    const tabooRecentRounded = Math.round(tabooRecentPerformanceScore * 100) / 100;
    const tabooDerived = computeTabooDerived({
      ...doc,
      taboo_recentPerformanceScore: tabooRecentRounded,
    });
    const hangmanDerived = computeHangmanDerived({
      ...doc,
      hangman_activeDaysLast30: hangmanActiveDays,
    });
    const globalScore = Math.round(
      computeGlobalScore({
        ...doc,
        ...tabooDerived,
        ...hangmanDerived,
        taboo_recentPerformanceScore: tabooRecentRounded,
      }) * 100,
    ) / 100;
    await UserStats.updateOne({
      userId: userOid,
    }, {
      $set: {
        ...tabooDerived,
        ...hangmanDerived,
        global_score: globalScore,
      },
    });
  },

  /**
   * Recompute global_rank for all users. Assigns consecutive ranks sorted by global_score desc.
   */
  async recomputeGlobalRanks() {
    const totalGamesThreshold = GLOBAL_LEADERBOARD_MIN_GAMES;
    const users = await UserStats.find({
      $expr: {
        $gte: [
          {
            $add: [
              { $ifNull: ['$typing_totalGames', 0] },
              { $ifNull: ['$npat_totalGames', 0] },
              { $ifNull: ['$taboo_gamesPlayed', 0] },
              { $ifNull: ['$cah_gamesPlayed', 0] },
              { $ifNull: ['$hangman_totalGames', 0] },
            ],
          },
          totalGamesThreshold,
        ],
      },
    })
      .sort({ global_score: -1, lastPlayedAt: -1 })
      .select('_id')
      .lean();

    if (users.length === 0) return;

    const ops = users.map((u, i) => ({
      updateOne: {
        filter: { _id: u._id },
        update: { $set: { global_rank: i + 1 } },
      },
    }));
    await UserStats.bulkWrite(ops, { ordered: false });

    await UserStats.updateMany(
      {
        $expr: {
          $lt: [
            {
              $add: [
                { $ifNull: ['$typing_totalGames', 0] },
                { $ifNull: ['$npat_totalGames', 0] },
                { $ifNull: ['$taboo_gamesPlayed', 0] },
                { $ifNull: ['$cah_gamesPlayed', 0] },
              ],
            },
            totalGamesThreshold,
          ],
        },
      },
      { $set: { global_rank: null } },
    );
  },

  async recomputeHangmanRanks() {
    const users = await UserStats.find({ hangman_totalGames: { $gte: HANGMAN_LEADERBOARD_MIN_GAMES } })
      .sort({ hangman_skill: -1, hangman_accuracy: -1, hangman_totalWins: -1, lastPlayedAt: -1 })
      .select('_id')
      .lean();
    if (users.length > 0) {
      await UserStats.bulkWrite(
        users.map((u, i) => ({
          updateOne: {
            filter: { _id: u._id },
            update: { $set: { hangman_rank: i + 1 } },
          },
        })),
        { ordered: false },
      );
    }
    await UserStats.updateMany(
      { hangman_totalGames: { $lt: HANGMAN_LEADERBOARD_MIN_GAMES } },
      { $set: { hangman_rank: null } },
    );
  },

  /** Get all user IDs for daily cron iteration. */
  async allUserIds() {
    const docs = await UserStats.find({}).select('userId').lean();
    return docs.map((d) => d.userId);
  },
};
