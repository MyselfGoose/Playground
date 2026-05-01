import mongoose from 'mongoose';

const cahWhiteCardSchema = new mongoose.Schema(
  {
    sourceId: { type: Number, required: true },
    text: { type: String, required: true, trim: true },
    rawText: { type: String, required: true },
    pack: { type: String, required: true, trim: true },
    datasetVersion: { type: String, required: true, trim: true },
    textHash: { type: String, required: true, trim: true },
  },
  { timestamps: true, collection: 'cah_white_cards' },
);

cahWhiteCardSchema.index({ datasetVersion: 1, sourceId: 1 }, { unique: true });
cahWhiteCardSchema.index({ pack: 1 });
cahWhiteCardSchema.index({ textHash: 1 });

export const CahWhiteCard =
  mongoose.models.CahWhiteCard ?? mongoose.model('CahWhiteCard', cahWhiteCardSchema);
