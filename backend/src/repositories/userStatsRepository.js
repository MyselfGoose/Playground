import mongoose from 'mongoose';
import { UserStats } from '../models/UserStats.js';

function computeGlobalScore(doc) {
  const typingSkill = Math.min(doc.typing_bestWpm / 150, 1) * 100;
  const accuracySkill = doc.typing_weightedAccuracy || 0;
  const npatSkill = Math.min(doc.npat_averageScore / 35, 1) * 100;
  const totalGames = (doc.typing_totalGames || 0) + (doc.npat_totalGames || 0);
  const activityScore = Math.min(totalGames / 100, 1) * 100;
  const consistencyScore = Math.min((doc.activeDaysLast30 || 0) / 20, 1) * 100;
  return (
    typingSkill * 0.3 +
    accuracySkill * 0.2 +
    npatSkill * 0.25 +
    activityScore * 0.15 +
    consistencyScore * 0.1
  );
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
  async updateActiveDaysAndGlobalScore(userOid, activeDays) {
    const doc = await UserStats.findOneAndUpdate(
      { userId: userOid },
      { $set: { activeDaysLast30: activeDays } },
      { new: true, lean: true },
    );
    if (!doc) return;
    const globalScore = Math.round(computeGlobalScore(doc) * 100) / 100;
    await UserStats.updateOne({ userId: userOid }, { $set: { global_score: globalScore } });
  },

  /**
   * Recompute global_rank for all users. Assigns consecutive ranks sorted by global_score desc.
   */
  async recomputeGlobalRanks() {
    const totalGamesThreshold = 5;
    const users = await UserStats.find({
      $expr: {
        $gte: [
          { $add: ['$typing_totalGames', '$npat_totalGames'] },
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
            { $add: ['$typing_totalGames', '$npat_totalGames'] },
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
