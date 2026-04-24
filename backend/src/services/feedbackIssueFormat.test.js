import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFeedbackIssueBody,
  buildFeedbackIssueTitle,
  feedbackLabelsForType,
} from './feedbackIssueFormat.js';

test('buildFeedbackIssueTitle prefixes type', () => {
  assert.equal(buildFeedbackIssueTitle({ type: 'bug', title: 'Crash' }), '[Bug] Crash');
});

test('feedbackLabelsForType maps enums', () => {
  assert.deepEqual(feedbackLabelsForType('bug'), ['feedback', 'bug']);
  assert.deepEqual(feedbackLabelsForType('feature'), ['feedback', 'enhancement']);
  assert.deepEqual(feedbackLabelsForType('ui'), ['feedback', 'ui']);
  assert.deepEqual(feedbackLabelsForType('general'), ['feedback']);
});

test('buildFeedbackIssueBody includes sections', () => {
  const md = buildFeedbackIssueBody({
    type: 'general',
    title: 'x',
    description: 'Hello world',
    contactEmail: null,
    client: { path: '/p', userAgent: 'UA' },
    serverSubmittedAtIso: '2020-01-01T00:00:00.000Z',
    user: { id: 'u1', username: 'alice' },
  });
  assert.match(md, /## Description/);
  assert.match(md, /Hello world/);
  assert.match(md, /alice/);
  assert.match(md, /`u1`/);
});

test('buildFeedbackIssueBody anonymous when no user', () => {
  const md = buildFeedbackIssueBody({
    type: 'general',
    title: 'x',
    description: 'Hello world',
    contactEmail: null,
    client: {},
    serverSubmittedAtIso: '2020-01-01T00:00:00.000Z',
    user: null,
  });
  assert.match(md, /anonymous/);
});

test('buildFeedbackIssueBody embeds screenshot markdown', () => {
  const md = buildFeedbackIssueBody({
    type: 'bug',
    title: 'x',
    description: 'Hello world',
    contactEmail: null,
    client: {},
    serverSubmittedAtIso: '2020-01-01T00:00:00.000Z',
    user: null,
    screenshotMarkdown: '![x](https://example.com/a.png)',
  });
  assert.match(md, /## Screenshot/);
  assert.match(md, /https:\/\/example\.com\/a\.png/);
});
