import mongoose from 'mongoose';

const userStatsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    username: { type: String, required: true },

    typing_totalGames: { type: Number, default: 0 },
    typing_bestWpm: { type: Number, default: 0 },
    typing_bestAccuracy: { type: Number, default: 0 },
    typing_totalCorrectChars: { type: Number, default: 0 },
    typing_totalCharsTyped: { type: Number, default: 0 },
    typing_weightedAccuracy: { type: Number, default: 0 },
    typing_totalElapsedMs: { type: Number, default: 0 },
    typing_multiWins: { type: Number, default: 0 },

    npat_totalGames: { type: Number, default: 0 },
    npat_totalScore: { type: Number, default: 0 },
    npat_averageScore: { type: Number, default: 0 },
    npat_wins: { type: Number, default: 0 },
    npat_winRate: { type: Number, default: 0 },

    global_score: { type: Number, default: 0 },
    global_rank: { type: Number, default: null },

    lastPlayedAt: { type: Date, default: null },
    activeDaysLast30: { type: Number, default: 0 },
  },
  { timestamps: true },
);

userStatsSchema.index({ userId: 1 }, { unique: true });
userStatsSchema.index({ typing_bestWpm: -1 });
userStatsSchema.index({ typing_weightedAccuracy: -1 });
userStatsSchema.index({ npat_averageScore: -1 });
userStatsSchema.index({ global_score: -1 });

export const UserStats =
  mongoose.models.UserStats ?? mongoose.model('UserStats', userStatsSchema);
