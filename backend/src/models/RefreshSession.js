import mongoose from 'mongoose';

const refreshSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** Public session id embedded in refresh JWT (opaque UUID). */
    jti: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      index: true,
    },
    replacedByJti: {
      type: String,
    },
    userAgent: {
      type: String,
      maxlength: 256,
    },
    createdFromIp: {
      type: String,
      maxlength: 45,
    },
  },
  { timestamps: true },
);

refreshSessionSchema.index({ userId: 1, revokedAt: 1 });
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshSession =
  mongoose.models.RefreshSession ?? mongoose.model('RefreshSession', refreshSessionSchema);
