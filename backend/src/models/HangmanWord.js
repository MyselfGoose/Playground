import mongoose from 'mongoose';

const hangmanWordSchema = new mongoose.Schema(
  {
    datasetVersion: { type: String, required: true, index: true },
    word: { type: String, required: true },
    length: { type: Number, required: true, index: true },
    difficulty: { type: Number, default: 3, min: 1, max: 5 },
    category: { type: String, default: null },
    locale: { type: String, default: 'en' },
  },
  { timestamps: true },
);

hangmanWordSchema.index({ datasetVersion: 1, word: 1 }, { unique: true });
hangmanWordSchema.index({ datasetVersion: 1, difficulty: 1, length: 1 });

export const HangmanWord =
  mongoose.models.HangmanWord ?? mongoose.model('HangmanWord', hangmanWordSchema);
