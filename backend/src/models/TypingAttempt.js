import mongoose from 'mongoose';

const typingAttemptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    mode: { type: String, enum: ['solo', 'multi'], required: true },
    roomCode: { type: String, default: null },
    passageLength: { type: Number, required: true },
    correctChars: { type: Number, required: true },
    incorrectChars: { type: Number, required: true },
    extraChars: { type: Number, required: true },
    wpm: { type: Number, required: true },
    rawWpm: { type: Number, required: true },
    accuracy: { type: Number, required: true },
    errorCount: { type: Number, required: true },
    elapsedMs: { type: Number, required: true },
    rank: { type: Number, default: null },
    playerCount: { type: Number, default: 1 },
    dnf: { type: Boolean, default: false },
    suspicious: { type: Boolean, default: false },
    finishedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

typingAttemptSchema.index({ userId: 1, finishedAt: -1 });
typingAttemptSchema.index({ wpm: -1, finishedAt: -1 });
typingAttemptSchema.index({ accuracy: -1, finishedAt: -1 });
typingAttemptSchema.index({ userId: 1, wpm: -1 });

export const TypingAttempt =
  mongoose.models.TypingAttempt ?? mongoose.model('TypingAttempt', typingAttemptSchema);
