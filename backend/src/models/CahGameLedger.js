import mongoose from 'mongoose';

/** Idempotent marker: one document per completed CAH match session. */
const cahGameLedgerSchema = new mongoose.Schema(
  {
    gameSessionId: { type: String, required: true, unique: true },
    occurredAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export const CahGameLedger =
  mongoose.models.CahGameLedger ?? mongoose.model('CahGameLedger', cahGameLedgerSchema);
