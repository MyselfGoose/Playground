import mongoose from 'mongoose';

const cahBlackCardSchema = new mongoose.Schema(
  {
    sourceId: { type: Number, required: true },
    text: { type: String, required: true, trim: true },
    rawText: { type: String, required: true },
    pick: { type: Number, required: true, min: 1 },
    pack: { type: String, required: true, trim: true },
    datasetVersion: { type: String, required: true, trim: true },
    textHash: { type: String, required: true, trim: true },
  },
  { timestamps: true, collection: 'cah_black_cards' },
);

cahBlackCardSchema.index({ datasetVersion: 1, sourceId: 1 }, { unique: true });
cahBlackCardSchema.index({ pack: 1 });
cahBlackCardSchema.index({ pick: 1 });
cahBlackCardSchema.index({ textHash: 1 });
cahBlackCardSchema.index({ pack: 1, pick: 1 });

export const CahBlackCard =
  mongoose.models.CahBlackCard ?? mongoose.model('CahBlackCard', cahBlackCardSchema);
