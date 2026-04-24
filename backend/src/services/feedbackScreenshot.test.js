import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeFeedbackScreenshot, detectImageMimeFromBuffer } from './feedbackScreenshot.js';

const PNG_1x1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('detectImageMimeFromBuffer recognizes png', () => {
  const buf = Buffer.from(PNG_1x1, 'base64');
  assert.equal(detectImageMimeFromBuffer(buf), 'image/png');
});

test('decodeFeedbackScreenshot accepts png base64', () => {
  const out = decodeFeedbackScreenshot({ mime: 'image/png', data: PNG_1x1 }, 50_000);
  assert.equal(out.ok, true);
  if (out.ok) {
    assert.equal(out.mime, 'image/png');
    assert.equal(out.ext, 'png');
    assert.ok(out.buffer.length > 0);
  }
});

test('decodeFeedbackScreenshot accepts data URL prefix', () => {
  const out = decodeFeedbackScreenshot(
    { mime: 'image/png', data: `data:image/png;base64,${PNG_1x1}` },
    50_000,
  );
  assert.equal(out.ok, true);
});

test('decodeFeedbackScreenshot rejects mime mismatch vs magic bytes', () => {
  const out = decodeFeedbackScreenshot({ mime: 'image/jpeg', data: PNG_1x1 }, 50_000);
  assert.equal(out.ok, false);
});

test('decodeFeedbackScreenshot rejects oversize', () => {
  const out = decodeFeedbackScreenshot({ mime: 'image/png', data: PNG_1x1 }, 10);
  assert.equal(out.ok, false);
});
