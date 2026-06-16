import mongoose from 'mongoose';

const FRIENDSHIP_STATUSES = ['pending', 'accepted', 'declined', 'cancelled'];

const friendshipSchema = new mongoose.Schema(
  {
    requesterId: {
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
    status: {
      type: String,
      enum: FRIENDSHIP_STATUSES,
      required: true,
      default: 'pending',
      index: true,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

friendshipSchema.index({ requesterId: 1, recipientId: 1 }, { unique: true });
friendshipSchema.index({ recipientId: 1, status: 1 });
friendshipSchema.index({ requesterId: 1, status: 1 });
friendshipSchema.index({ status: 1, requesterId: 1, recipientId: 1 });

friendshipSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Friendship = mongoose.models.Friendship ?? mongoose.model('Friendship', friendshipSchema);
export { FRIENDSHIP_STATUSES };
