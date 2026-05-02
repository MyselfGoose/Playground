import mongoose from 'mongoose';

const hangmanRoundResultSchema = new mongoose.Schema(
  {
    gameSessionId: { type: String, required: true },
    roundNumber: { type: Number, required: true },
    roomCode: { type: String, default: null },
    setterUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    setterUsername: { type: String, default: '' },
    winnerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    winnerUsername: { type: String, default: '' },
    outcome: { type: String, enum: ['won', 'lost', 'aborted'], required: true },
    wrongGuesses: { type: Number, default: 0 },
    maxWrongGuesses: { type: Number, default: 0 },
    distinctCorrectLetters: { type: Number, default: 0 },
    participantCount: { type: Number, default: 0 },
    lettersFirstByUser: { type: Map, of: Number, default: {} },
    finishedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

hangmanRoundResultSchema.index({ gameSessionId: 1, roundNumber: 1 }, { unique: true });
hangmanRoundResultSchema.index({ setterUserId: 1, finishedAt: -1 });
hangmanRoundResultSchema.index({ winnerUserId: 1, finishedAt: -1 });

export const HangmanRoundResult =
  mongoose.models.HangmanRoundResult ?? mongoose.model('HangmanRoundResult', hangmanRoundResultSchema);
