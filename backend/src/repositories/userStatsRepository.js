import mongoose from 'mongoose';
import { UserStats } from '../models/UserStats.js';

function computeGlobalScore(doc) {
  const typingSkill = Math.min(doc.typing_bestWpm / 150, 1) * 100;
  const accuracySkill = doc.typing_weightedAccuracy || 0;
  const npatSkill = Math.min(doc.npat_averageScore / 35, 1) * 100;
  const tabooSkill = doc.taboo_score || 0;
  const totalGames = (doc.typing_totalGames || 0) + (doc.npat_totalGames || 0) + (doc.taboo_gamesPlayed || 0);
  const activityScore = Math.min(totalGames / 100, 1) * 100;
  const consistencyScore = Math.min((doc.activeDaysLast30 || 0) / 20, 1) * 100;
  return (
    typingSkill * 0.24 +
    accuracySkill * 0.16 +
    npatSkill * 0.2 +
    tabooSkill * 0.2 +
    activityScore * 0.15 +
    consistencyScore * 0.05
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

  /**
   * Leaderboard query with pagination + minimum game threshold.
   * @param {{ sortField: string, minGamesField: string, minGames: number, page: number, limit: number }} opts
   */
  async leaderboard({ sortField, minGamesField, minGames, page, limit }) {
    const filter = { [minGamesField]: { $gte: minGames } };
    const skip = (page - 1) * limit;
    const [entries, total] = await Promise.all([
      UserStats.find(filter)
        .sort({ [sortField]: -1, lastPlayedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
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
  async updateActiveDaysAndGlobalScore(userOid, activeDays, tabooActiveDays = 0) {
    const doc = await UserStats.findOneAndUpdate(
      { userId: userOid },
      { $set: { activeDaysLast30: activeDays, taboo_activeDaysLast30: tabooActiveDays } },
      { new: true, lean: true },
    );
    if (!doc) return;
    const tabooRecentPerformanceScore = clamp(
      0,
      (doc.taboo_score || 0) * 0.7 + Math.min((tabooActiveDays / 10) * 100, 100) * 0.3,
      100,
    );
    const tabooDerived = {
      ...computeTabooDerived(doc),
      taboo_recentPerformanceScore: Math.round(tabooRecentPerformanceScore * 100) / 100,
    };
    const globalScore = Math.round(computeGlobalScore({ ...doc, ...tabooDerived }) * 100) / 100;
    await UserStats.updateOne({ userId: userOid }, { $set: { ...tabooDerived, global_score: globalScore } });
  },

  /**
   * Recompute global_rank for all users. Assigns consecutive ranks sorted by global_score desc.
   */
  async recomputeGlobalRanks() {
    const totalGamesThreshold = 5;
    const users = await UserStats.find({
      $expr: {
        $gte: [
          { $add: ['$typing_totalGames', '$npat_totalGames', '$taboo_gamesPlayed'] },
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
            { $add: ['$typing_totalGames', '$npat_totalGames', '$taboo_gamesPlayed'] },
            totalGamesThreshold,
          ],
        },
      },
      { $set: { global_rank: null } },
    );
  },

  /** Get all user IDs for daily cron iteration. */
  async allUserIds() {
    const docs = await UserStats.find({}).select('userId').lean();
    return docs.map((d) => d.userId);
  },
};
