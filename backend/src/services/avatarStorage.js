import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {import('../config/env.js').Env} env
 */
export function createAvatarStorage(env) {
  const driver = env.AVATAR_STORAGE_DRIVER;
  const localDir = path.isAbsolute(env.AVATAR_LOCAL_DIR)
    ? env.AVATAR_LOCAL_DIR
    : path.join(__dirname, '..', '..', env.AVATAR_LOCAL_DIR);

  /** @type {S3Client | null} */
  let s3Client = null;
  if (driver === 's3') {
    s3Client = new S3Client({
      region: env.AVATAR_S3_REGION,
      endpoint: env.AVATAR_S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: env.AVATAR_S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: env.AVATAR_S3_SECRET_ACCESS_KEY ?? '',
      },
      forcePathStyle: Boolean(env.AVATAR_S3_FORCE_PATH_STYLE),
    });
  }

  /**
   * @param {string} userId
   */
  function avatarKey(userId) {
    return `${userId}.webp`;
  }

  /**
   * @param {string} userId
   */
  function localFilePath(userId) {
    return path.join(localDir, avatarKey(userId));
  }

  /**
   * @param {string} userId
   */
  function publicUrlFor(userId) {
    const key = avatarKey(userId);
    if (driver === 's3') {
      const base = (env.AVATAR_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
      if (base) return `${base}/${key}`;
      return `https://${env.AVATAR_S3_BUCKET}.s3.${env.AVATAR_S3_REGION}.amazonaws.com/${key}`;
    }
    const base = (env.AVATAR_PUBLIC_BASE_URL ?? `http://localhost:${env.PORT}/api/v1/users/avatars`).replace(
      /\/+$/,
      '',
    );
    return `${base}/${key}`;
  }

  return {
    driver,

    /**
     * @param {string} userId
     * @param {Buffer} buffer
     */
    async save(userId, buffer) {
      const key = avatarKey(userId);
      if (driver === 's3') {
        if (!s3Client || !env.AVATAR_S3_BUCKET) {
          throw new Error('S3 avatar storage is not configured');
        }
        await s3Client.send(
          new PutObjectCommand({
            Bucket: env.AVATAR_S3_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=3600',
          }),
        );
        return publicUrlFor(userId);
      }

      await mkdir(localDir, { recursive: true });
      await writeFile(localFilePath(userId), buffer);
      return publicUrlFor(userId);
    },

    /**
     * @param {string | null | undefined} avatarUrl
     */
    async deleteByUrl(avatarUrl) {
      if (!avatarUrl || typeof avatarUrl !== 'string') return;
      const trimmed = avatarUrl.trim();
      if (!trimmed) return;

      if (driver === 's3') {
        const key = trimmed.split('/').pop();
        if (!key || !key.endsWith('.webp') || !s3Client || !env.AVATAR_S3_BUCKET) return;
        try {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: env.AVATAR_S3_BUCKET,
              Key: key,
            }),
          );
        } catch {
          /* best effort */
        }
        return;
      }

      const key = trimmed.split('/').pop();
      if (!key || !key.endsWith('.webp')) return;
      const filePath = path.join(localDir, key);
      if (!filePath.startsWith(localDir)) return;
      try {
        await unlink(filePath);
      } catch {
        /* file may not exist */
      }
    },

    /**
     * @param {string} userId
     */
    localFilePath(userId) {
      return localFilePath(userId);
    },

    /**
     * @param {string} filename
     */
    resolveLocalFile(filename) {
      const safe = path.basename(filename);
      if (!safe.endsWith('.webp')) return null;
      const filePath = path.join(localDir, safe);
      if (!filePath.startsWith(localDir)) return null;
      return filePath;
    },
  };
}
