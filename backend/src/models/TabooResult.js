import mongoose from 'mongoose';

const tabooResultSchema = new mongoose.Schema(
  {
    gameId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    roomCode: { type: String, required: true },
    mode: { type: String, enum: ['team'], required: true, default: 'team' },
    team: { type: String, enum: ['A', 'B'], required: true },
    won: { type: Boolean, required: true },
    speakerRounds: { type: Number, required: true, default: 0 },
    correctGuessesAsSpeaker: { type: Number, required: true, default: 0 },
    tabooViolations: { type: Number, required: true, default: 0 },
    guessesMade: { type: Number, required: true, default: 0 },
    correctGuesses: { type: Number, required: true, default: 0 },
    finishedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

tabooResultSchema.index({ userId: 1, finishedAt: -1 });
tabooResultSchema.index({ gameId: 1, userId: 1 }, { unique: true });
tabooResultSchema.index({ won: -1, finishedAt: -1 });

export const TabooResult =
  mongoose.models.TabooResult ?? mongoose.model('TabooResult', tabooResultSchema);
