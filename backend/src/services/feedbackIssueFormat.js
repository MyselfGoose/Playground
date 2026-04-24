/** @typedef {'bug' | 'feature' | 'ui' | 'general'} FeedbackType */

const TYPE_DISPLAY = {
  bug: 'Bug',
  feature: 'Feature',
  ui: 'UI/UX',
  general: 'General',
};

const TYPE_LABELS = {
  bug: ['feedback', 'bug'],
  feature: ['feedback', 'enhancement'],
  ui: ['feedback', 'ui'],
  general: ['feedback'],
};

/**
 * @param {FeedbackType} type
 */
export function feedbackTypeDisplay(type) {
  return TYPE_DISPLAY[type] ?? type;
}

/**
 * GitHub label names to request for this feedback type (must exist on repo, or API falls back).
 * @param {FeedbackType} type
 */
export function feedbackLabelsForType(type) {
  return TYPE_LABELS[type] ?? ['feedback'];
}

/**
 * @param {{
 *   type: FeedbackType,
 *   title: string,
 *   description: string,
 *   contactEmail: string | null,
 *   client: Record<string, string | undefined>,
 *   serverSubmittedAtIso: string,
 *   user: { id: string, username: string } | null,
 * }} params
 */
export function buildFeedbackIssueTitle({ type, title }) {
  const label = feedbackTypeDisplay(type);
  return `[${label}] ${title}`;
}

/**
 * @param {{
 *   type: FeedbackType,
 *   title: string,
 *   description: string,
 *   contactEmail: string | null,
 *   client: Record<string, string | undefined>,
 *   serverSubmittedAtIso: string,
 *   user: { id: string, username: string } | null,
 *   screenshotMarkdown?: string | null,
 * }} params
 */
export function buildFeedbackIssueBody({
  type,
  description,
  contactEmail,
  client,
  serverSubmittedAtIso,
  user,
  screenshotMarkdown = null,
}) {
  const path = client.path ?? '—';
  const fullUrl = client.url ?? '—';
  const ua = client.userAgent ?? '—';
  const platform = client.platform ?? '—';
  const referrer = client.referrer ?? '—';
  const userLine = user ? `id: \`${user.id}\`, username: \`${user.username}\`` : 'anonymous';

  return [
    '## Description',
    '',
    description,
    '',
    '## Feedback type',
    '',
    feedbackTypeDisplay(type),
    '',
    '## User context',
    '',
    `- Page path: \`${path}\``,
    `- Full URL: ${fullUrl}`,
    `- Account: ${userLine}`,
    `- Server received (UTC): \`${serverSubmittedAtIso}\``,
    '',
    '## Environment',
    '',
    `- User-Agent: \`${ua}\``,
    `- Platform: \`${platform}\``,
    `- Referrer: ${referrer}`,
    '',
    '## Contact',
    '',
    contactEmail ?? 'not provided',
    '',
    '## Screenshot',
    '',
    screenshotMarkdown && screenshotMarkdown.trim().length > 0
      ? screenshotMarkdown.trim()
      : 'Not attached.',
    '',
  ].join('\n');
}
