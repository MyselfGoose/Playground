import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 32,
      match: /^[a-zA-Z0-9_-]+$/,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      index: true,
    },
    passwordHash: {
      type: String,
      select: false,
      required() {
        return !this.googleId;
      },
    },
    googleId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
      index: true,
    },
    authProviders: {
      type: [String],
      default: ['local'],
      validate: [
        (v) =>
          Array.isArray(v) &&
          v.length > 0 &&
          v.every((p) => typeof p === 'string' && (p === 'local' || p === 'google')),
        'auth_providers_invalid',
      ],
    },
    avatarUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
    },
    avatarEmoji: {
      type: String,
      trim: true,
      maxlength: 32,
    },
    usernameChangedAt: {
      type: Date,
    },
    avatarUpdatedAt: {
      type: Date,
    },
    roles: {
      type: [String],
      default: ['user'],
      validate: [(v) => Array.isArray(v) && v.length > 0 && v.every((r) => typeof r === 'string' && r.length > 0), 'roles_invalid'],
    },
    lastLoginAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    moderation: {
      status: {
        type: String,
        enum: ['none', 'suspended', 'banned'],
        default: 'none',
      },
      reason: { type: String, default: '', maxlength: 2000 },
      expiresAt: { type: Date, default: null },
      internalNotes: { type: String, default: '', maxlength: 5000 },
      updatedAt: { type: Date, default: null },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

userSchema.set('toObject', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.models.User ?? mongoose.model('User', userSchema);
