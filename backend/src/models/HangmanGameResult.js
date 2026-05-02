import mongoose from 'mongoose';

/** Persists finished Hangman sessions when `HANGMAN_PERSIST_STATS` is enabled (leaderboard prep). */
const hangmanGameResultSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    username: { type: String, default: '' },
    mode: { type: String, enum: ['solo', 'multi'], required: true },
    source: { type: String, enum: ['solo_client', 'multiplayer_server'], default: 'multiplayer_server' },
    won: { type: Boolean, required: true },
    wrongGuesses: { type: Number, default: 0 },
    correctGuesses: { type: Number, default: 0 },
    lettersFirst: { type: Number, default: 0 },
    durationMs: { type: Number, default: null },
    totalGuesses: { type: Number, default: 0 },
    roundsPlayed: { type: Number, default: 0 },
    fastFinish: { type: Boolean, default: false },
    placement: { type: Number, default: null },
    playerCount: { type: Number, default: 1 },
    score: { type: Number, default: 0 },
    gameSessionId: { type: String, default: null },
    modeWeight: { type: Number, default: 1 },
    suspicious: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    finishedAt: { type: Date, default: Date.now },
    roomCode: { type: String, default: null },
  },
  { timestamps: false },
);

hangmanGameResultSchema.index({ gameSessionId: 1, userId: 1 }, { unique: true, sparse: true });
hangmanGameResultSchema.index({ userId: 1, finishedAt: -1 });
hangmanGameResultSchema.index({ mode: 1, finishedAt: -1 });
hangmanGameResultSchema.index({ finishedAt: -1 });

export const HangmanGameResult =
  mongoose.models.HangmanGameResult ?? mongoose.model('HangmanGameResult', hangmanGameResultSchema);
