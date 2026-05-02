import mongoose from 'mongoose';

/** Persists finished Hangman sessions when `HANGMAN_PERSIST_STATS` is enabled (leaderboard prep). */
const hangmanGameResultSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    username: { type: String, default: '' },
    mode: { type: String, enum: ['solo', 'multi'], required: true },
    won: { type: Boolean, required: true },
    wrongGuesses: { type: Number, default: 0 },
    correctGuesses: { type: Number, default: 0 },
    lettersFirst: { type: Number, default: 0 },
    durationMs: { type: Number, default: null },
    finishedAt: { type: Date, default: Date.now },
    roomCode: { type: String, default: null },
  },
  { timestamps: false },
);

hangmanGameResultSchema.index({ finishedAt: -1 });

export const HangmanGameResult =
  mongoose.models.HangmanGameResult ?? mongoose.model('HangmanGameResult', hangmanGameResultSchema);
