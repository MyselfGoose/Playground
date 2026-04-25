import mongoose from 'mongoose';

const npatResultSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    roomCode: { type: String, required: true },
    mode: { type: String, enum: ['solo', 'team'], required: true },
    roundsPlayed: { type: Number, required: true },
    totalScore: { type: Number, required: true },
    averageScore: { type: Number, required: true },
    outcome: { type: String, enum: ['win', 'loss', 'draw', 'solo'], required: true },
    playerCount: { type: Number, required: true },
    finishedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

npatResultSchema.index({ userId: 1, finishedAt: -1 });
npatResultSchema.index({ averageScore: -1, finishedAt: -1 });
npatResultSchema.index({ userId: 1, averageScore: -1 });

export const NpatResult =
  mongoose.models.NpatResult ?? mongoose.model('NpatResult', npatResultSchema);
