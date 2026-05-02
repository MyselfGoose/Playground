import mongoose from 'mongoose';

/** Idempotent marker: one document per (gameSessionId, roundIndex). */
const cahRoundLedgerSchema = new mongoose.Schema(
  {
    gameSessionId: { type: String, required: true, index: true },
    roundIndex: { type: Number, required: true },
    roomCode: { type: String, default: '' },
    occurredAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

cahRoundLedgerSchema.index({ gameSessionId: 1, roundIndex: 1 }, { unique: true });

export const CahRoundLedger =
  mongoose.models.CahRoundLedger ?? mongoose.model('CahRoundLedger', cahRoundLedgerSchema);
