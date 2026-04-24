import { randomUUID } from 'node:crypto';

const MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/**
 * @param {Buffer} buf
 * @returns {'image/png' | 'image/jpeg' | 'image/webp' | null}
 */
export function detectImageMimeFromBuffer(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/**
 * @param {{ mime?: string, data?: string } | null | undefined} raw
 * @param {number} maxBytes
 * @returns {{ ok: true, buffer: Buffer, mime: string, ext: string } | { ok: false, message: string }}
 */
export function decodeFeedbackScreenshot(raw, maxBytes) {
  if (raw == null) return { ok: false, message: 'missing screenshot' };
  const dataIn = typeof raw.data === 'string' ? raw.data.trim() : '';
  if (!dataIn) return { ok: false, message: 'missing screenshot' };

  const base64 = dataIn.replace(/^data:image\/\w+;base64,/i, '').replace(/\s/g, '');
  let buf;
  try {
    buf = Buffer.from(base64, 'base64');
  } catch {
    return { ok: false, message: 'invalid screenshot encoding' };
  }
  if (buf.length === 0) return { ok: false, message: 'empty screenshot' };
  if (buf.length > maxBytes) {
    return { ok: false, message: `screenshot too large (max ${Math.round(maxBytes / 1024)} KB)` };
  }

  const detected = detectImageMimeFromBuffer(buf);
  if (!detected) return { ok: false, message: 'unsupported image type (use PNG, JPEG, or WebP)' };

  const declared = typeof raw.mime === 'string' ? raw.mime.toLowerCase().trim() : '';
  if (declared && ['image/png', 'image/jpeg', 'image/webp'].includes(declared) && declared !== detected) {
    return { ok: false, message: 'image type does not match file contents' };
  }

  const ext = MIME_EXT[detected];
  return { ok: true, buffer: buf, mime: detected, ext };
}

/**
 * @param {{ token: string, owner: string, repo: string, log?: import('pino').Logger }} params
 */
export async function getRepoDefaultBranch({ token, owner, repo, log }) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  const text = await res.text();
  /** @type {Record<string, unknown>} */
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = {};
    }
  }
  if (!res.ok) {
    log?.warn({ status: res.status, json, event: 'github_repo_meta_failed' }, 'github_repo_meta_failed');
    return 'main';
  }
  const b = json.default_branch;
  return typeof b === 'string' && b.length > 0 ? b : 'main';
}

/**
 * Create a new file in the repo; returns download_url for embedding in Markdown.
 *
 * @param {{
 *   token: string,
 *   owner: string,
 *   repo: string,
 *   branch: string,
 *   path: string,
 *   message: string,
 *   buffer: Buffer,
 *   log?: import('pino').Logger,
 * }} params
 * @returns {Promise<string>}
 */
export async function uploadRepoBinaryFile({ token, owner, repo, branch, path, message, buffer, log }) {
  const encodedPath = path
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;

  const content = buffer.toString('base64');
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content,
      branch,
    }),
  });

  const text = await res.text();
  /** @type {Record<string, unknown>} */
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 500) };
    }
  }

  if (!res.ok) {
    log?.warn({ status: res.status, json, path, event: 'github_contents_put_failed' }, 'github_contents_put_failed');
    const err = new Error(`GitHub contents API failed (${res.status})`);
    Object.assign(err, { status: res.status, githubBody: json });
    throw err;
  }

  const contentObj = json.content;
  const downloadUrl =
    contentObj && typeof contentObj === 'object' && contentObj !== null && 'download_url' in contentObj
      ? contentObj.download_url
      : null;
  if (typeof downloadUrl !== 'string' || !downloadUrl.startsWith('http')) {
    log?.warn({ json, event: 'github_contents_missing_download_url' }, 'github_contents_missing_download_url');
    throw new Error('GitHub response missing download_url');
  }
  return downloadUrl;
}

/**
 * @param {{
 *   token: string,
 *   owner: string,
 *   repo: string,
 *   basePath: string,
 *   buffer: Buffer,
 *   ext: string,
 *   log?: import('pino').Logger,
 * }} params
 * @returns {Promise<string>} Raw / download URL for markdown image
 */
export async function uploadFeedbackScreenshotToRepo({ token, owner, repo, basePath, buffer, ext, log }) {
  const branch = await getRepoDefaultBranch({ token, owner, repo, log });
  const id = randomUUID();
  const safeBase = basePath.replace(/^\/+|\/+$/g, '');
  const path = `${safeBase}/${id}.${ext}`;
  const message = `chore(feedback): screenshot upload ${id}`;
  return uploadRepoBinaryFile({
    token,
    owner,
    repo,
    branch,
    path,
    message,
    buffer,
    log,
  });
}
