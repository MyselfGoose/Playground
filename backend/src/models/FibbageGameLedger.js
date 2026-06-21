import mongoose from 'mongoose';

/** Idempotent marker: one document per completed Fibbage match session. */
const fibbageGameLedgerSchema = new mongoose.Schema(
  {
    gameSessionId: { type: String, required: true, unique: true },
    occurredAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export const FibbageGameLedger =
  mongoose.models.FibbageGameLedger ?? mongoose.model('FibbageGameLedger', fibbageGameLedgerSchema);
