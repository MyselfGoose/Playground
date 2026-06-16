import mongoose from 'mongoose';

const GAME_INVITE_STATUSES = ['pending', 'accepted', 'declined', 'cancelled', 'expired'];

const gameInviteSchema = new mongoose.Schema(
  {
    inviterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    gameSlug: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    roomCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: GAME_INVITE_STATUSES,
      required: true,
      default: 'pending',
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

gameInviteSchema.index({ recipientId: 1, status: 1, createdAt: -1 });
gameInviteSchema.index(
  { recipientId: 1, gameSlug: 1, roomCode: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);
gameInviteSchema.index({ inviterId: 1, gameSlug: 1, roomCode: 1, status: 1 });
gameInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

gameInviteSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const GameInvite =
  mongoose.models.GameInvite ?? mongoose.model('GameInvite', gameInviteSchema);
export { GAME_INVITE_STATUSES };
