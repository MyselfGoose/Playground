/**
 * @param {import('pino').Logger | undefined} log
 * @param {unknown} body
 */
function logGithubError(log, body) {
  if (log) {
    log.warn({ github: body, event: 'github_api_error' }, 'github_api_error');
  } else {
    console.warn('[github]', body);
  }
}

/**
 * Create a GitHub issue; retries with fewer labels on 422 (unknown labels).
 *
 * @param {{
 *   token: string,
 *   owner: string,
 *   repo: string,
 *   title: string,
 *   body: string,
 *   labelSets: string[][],
 *   log?: import('pino').Logger,
 * }} params
 * @returns {Promise<{ number: number, html_url: string }>}
 */
export async function createGithubIssueWithLabelFallback({
  token,
  owner,
  repo,
  title,
  body,
  labelSets,
  log,
}) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`;

  let lastStatus = 0;
  let lastJson = null;

  for (let i = 0; i < labelSets.length; i += 1) {
    const labels = labelSets[i];
    const payload = { title, body, ...(labels.length > 0 ? { labels } : {}) };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    /** @type {unknown} */
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
    }

    if (res.ok && json && typeof json === 'object' && json !== null) {
      const num = 'number' in json ? json.number : undefined;
      const htmlUrl = 'html_url' in json ? json.html_url : undefined;
      if (typeof num === 'number' && typeof htmlUrl === 'string') {
        return { number: num, html_url: htmlUrl };
      }
    }

    lastStatus = res.status;
    lastJson = json;

    if (res.status === 422 && i < labelSets.length - 1) {
      logGithubError(log, { status: res.status, attempt: i + 1, labelsTried: labels, message: json });
      continue;
    }

    break;
  }

  const err = new Error(`GitHub API failed (${lastStatus})`);
  Object.assign(err, { status: lastStatus, githubBody: lastJson });
  throw err;
}

/**
 * @param {{
 *   token: string,
 *   owner: string,
 *   repo: string,
 *   page?: number,
 *   perPage?: number,
 *   state?: 'open' | 'closed' | 'all',
 *   log?: import('pino').Logger,
 * }} params
 */
export async function listGithubIssues({
  token,
  owner,
  repo,
  page = 1,
  perPage = 30,
  state = 'open',
  log,
}) {
  const params = new URLSearchParams({
    state,
    page: String(Math.max(1, page)),
    per_page: String(Math.max(1, Math.min(100, perPage))),
    sort: 'created',
    direction: 'desc',
  });
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?${params}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  const text = await res.text();
  /** @type {unknown} */
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }

  if (!res.ok) {
    logGithubError(log, { status: res.status, json });
    const err = new Error(`GitHub API failed (${res.status})`);
    Object.assign(err, { status: res.status, githubBody: json });
    throw err;
  }

  if (!Array.isArray(json)) {
    return { issues: [], page, perPage };
  }

  const issues = json
    .filter((item) => item && typeof item === 'object' && !('pull_request' in item && item.pull_request))
    .map((item) => ({
      number: item.number,
      title: item.title,
      state: item.state,
      htmlUrl: item.html_url,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      labels: Array.isArray(item.labels)
        ? item.labels.map((l) => (typeof l === 'string' ? l : l?.name)).filter(Boolean)
        : [],
    }));

  return { issues, page, perPage };
}
