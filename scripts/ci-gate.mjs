import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const DEFAULTS = {
  repository: 'bonustrack/stage',
  request: fetch,
  sleep: delay,
  log: console.log,
  attempts: 241,
  interval: 30_000,
};

export function checkedCommit(expected, actual) {
  if (!/^[0-9a-f]{40}$/.test(expected ?? '') || expected !== actual) {
    throw new Error('The requested deployment commit does not match the checkout');
  }
  return actual;
}

export function pollingAttempts(minutes = '120') {
  const duration = Number(minutes);
  if (!Number.isInteger(duration) || duration < 1 || duration > 180) {
    throw new Error('CI_WAIT_MINUTES must be an integer from 1 to 180');
  }
  return duration * 2 + 1;
}

export function sourceRun(runs, { sha, branch, repository }) {
  if (!Array.isArray(runs)) throw new Error('GitHub returned no workflow run list');
  return runs
    .filter((run) => run.head_sha === sha
      && run.head_branch === branch
      && run.head_repository?.full_name === repository
      && run.path === '.github/workflows/ci.yml'
      && ['push', 'workflow_dispatch'].includes(run.event))
    .sort((left, right) => right.id - left.id)[0];
}

function sourceUrl({ sha, branch, repository }) {
  if (!/^[0-9a-f]{40}$/.test(sha ?? '') || !branch
    || !/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9_.-]*$/i.test(repository)) {
    throw new Error('An exact commit, branch and repository are required');
  }
  const url = new URL(`https://api.github.com/repos/${repository}/actions/workflows/ci.yml/runs`);
  url.searchParams.set('head_sha', sha);
  url.searchParams.set('branch', branch);
  url.searchParams.set('per_page', '100');
  return url;
}

async function readSourceRun(url, settings) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'stage-ci-gate' };
  if (settings.token) headers.Authorization = `Bearer ${settings.token}`;
  const response = await settings.request(url, { headers, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`GitHub CI lookup failed with HTTP ${response.status}`);
  const data = await response.json();
  return sourceRun(data.workflow_runs, settings);
}

function sourcePassed(run, sha) {
  if (run?.status !== 'completed') return false;
  if (run.conclusion !== 'success') {
    throw new Error(`CI ${run.id} ended with ${run.conclusion}; refusing to publish ${sha}`);
  }
  return true;
}

export async function waitForSourceCi(options) {
  const settings = { ...DEFAULTS, ...options };
  const url = sourceUrl(settings);
  for (let attempt = 0; attempt < settings.attempts; attempt += 1) {
    const run = await readSourceRun(url, settings);
    if (sourcePassed(run, settings.sha)) {
      settings.log(`CI ${run.id} passed for ${settings.sha}`);
      return run;
    }
    if (attempt + 1 < settings.attempts) {
      settings.log(`Waiting for source CI of ${settings.sha} (${attempt + 1}/${settings.attempts})`);
      await settings.sleep(settings.interval);
    }
  }
  throw new Error(`No successful source CI for ${settings.sha} before the deployment deadline`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const expected = process.argv[2] ?? process.env.GITHUB_SHA ?? process.env.COMMIT_REF;
  const branch = process.argv[3] ?? process.env.GITHUB_REF_NAME ?? process.env.BRANCH;
  const actual = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  await waitForSourceCi({
    sha: checkedCommit(expected, actual),
    branch,
    token: process.env.GH_TOKEN,
    attempts: pollingAttempts(process.env.CI_WAIT_MINUTES),
  });
}
