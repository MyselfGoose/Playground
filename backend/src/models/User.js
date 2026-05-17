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
