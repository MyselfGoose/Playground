import mongoose from 'mongoose';

/** Per-user timestamps for CAH play days (cron activeDaysLast30). */
const cahActivityEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    occurredAt: { type: Date, required: true, index: true },
  },
  { timestamps: false },
);

cahActivityEventSchema.index({ userId: 1, occurredAt: -1 });

export const CahActivityEvent =
  mongoose.models.CahActivityEvent ?? mongoose.model('CahActivityEvent', cahActivityEventSchema);
