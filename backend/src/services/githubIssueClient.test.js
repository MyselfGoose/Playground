import test from 'node:test';
import assert from 'node:assert/strict';
import { createGithubIssueWithLabelFallback } from './githubIssueClient.js';

test('createGithubIssueWithLabelFallback succeeds on first attempt', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: init.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify({ number: 42, html_url: 'https://github.com/o/r/issues/42' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const out = await createGithubIssueWithLabelFallback({
    token: 't',
    owner: 'o',
    repo: 'r',
    title: 'T',
    body: 'B',
    labelSets: [['feedback', 'bug'], ['feedback'], []],
  });

  assert.equal(out.number, 42);
  assert.equal(out.html_url, 'https://github.com/o/r/issues/42');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body.labels, ['feedback', 'bug']);

  delete globalThis.fetch;
});

test('createGithubIssueWithLabelFallback retries on 422 then succeeds', async () => {
  let n = 0;
  globalThis.fetch = async () => {
    n += 1;
    if (n === 1) {
      return new Response(JSON.stringify({ message: 'Validation Failed', errors: [{ resource: 'Label' }] }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ number: 7, html_url: 'https://gh/7' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const out = await createGithubIssueWithLabelFallback({
    token: 't',
    owner: 'o',
    repo: 'r',
    title: 'T',
    body: 'B',
    labelSets: [['missing'], ['feedback']],
  });

  assert.equal(out.number, 7);
  assert.equal(n, 2);

  delete globalThis.fetch;
});
