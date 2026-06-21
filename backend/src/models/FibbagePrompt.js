import mongoose from 'mongoose';

const fibbagePromptSchema = new mongoose.Schema(
  {
    sourceId: { type: String, required: true, unique: true },
    datasetVersion: { type: String, required: true, default: 'fibbage-v1' },
    text: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String, required: true },
    difficulty: { type: Number, default: 2, min: 1, max: 3 },
    textHash: { type: String, required: true },
    locale: { type: String, default: 'en' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

fibbagePromptSchema.index({ datasetVersion: 1, active: 1, category: 1 });
fibbagePromptSchema.index({ textHash: 1 });

export const FibbagePrompt =
  mongoose.models.FibbagePrompt ?? mongoose.model('FibbagePrompt', fibbagePromptSchema);
