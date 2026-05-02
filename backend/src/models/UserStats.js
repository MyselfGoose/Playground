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

    taboo_gamesPlayed: { type: Number, default: 0 },
    taboo_gamesWon: { type: Number, default: 0 },
    taboo_winRate: { type: Number, default: 0 },
    taboo_speakerRounds: { type: Number, default: 0 },
    taboo_correctGuessesAsSpeaker: { type: Number, default: 0 },
    taboo_tabooViolations: { type: Number, default: 0 },
    taboo_avgGuessesPerRound: { type: Number, default: 0 },
    taboo_speakerSuccessRate: { type: Number, default: 0 },
    taboo_guessesMade: { type: Number, default: 0 },
    taboo_correctGuesses: { type: Number, default: 0 },
    taboo_guessAccuracy: { type: Number, default: 0 },
    taboo_activeDaysLast30: { type: Number, default: 0 },
    taboo_recentPerformanceScore: { type: Number, default: 0 },
    taboo_score: { type: Number, default: 0 },

    cah_gamesPlayed: { type: Number, default: 0 },
    cah_roundsPlayed: { type: Number, default: 0 },
    cah_roundWins: { type: Number, default: 0 },
    cah_roundsJudged: { type: Number, default: 0 },
    cah_winRate: { type: Number, default: 0 },
    cah_avgRoundWinsPerGame: { type: Number, default: 0 },
    cah_score: { type: Number, default: 0 },

    hangman_totalGames: { type: Number, default: 0 },
    hangman_totalWins: { type: Number, default: 0 },
    hangman_winRate: { type: Number, default: 0 },
    hangman_correctGuesses: { type: Number, default: 0 },
    hangman_wrongGuesses: { type: Number, default: 0 },
    hangman_totalGuesses: { type: Number, default: 0 },
    hangman_accuracy: { type: Number, default: 0 },
    hangman_avgGuessesPerGame: { type: Number, default: 0 },
    hangman_avgMistakesPerGame: { type: Number, default: 0 },
    hangman_fastFinishes: { type: Number, default: 0 },
    hangman_fastFinishRate: { type: Number, default: 0 },
    hangman_gamesPlayedLast30: { type: Number, default: 0 },
    hangman_activeDaysLast30: { type: Number, default: 0 },
    hangman_skill: { type: Number, default: 0 },
    hangman_rank: { type: Number, default: null },

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
userStatsSchema.index({ taboo_score: -1 });
userStatsSchema.index({ taboo_recentPerformanceScore: -1 });
userStatsSchema.index({ cah_score: -1 });
userStatsSchema.index({ cah_roundWins: -1 });
userStatsSchema.index({ hangman_skill: -1 });
userStatsSchema.index({ hangman_rank: 1, hangman_skill: -1 });
userStatsSchema.index({ hangman_winRate: -1 });
userStatsSchema.index({ global_score: -1 });

export const UserStats =
  mongoose.models.UserStats ?? mongoose.model('UserStats', userStatsSchema);
