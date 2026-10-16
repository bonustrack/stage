import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PROJECT = '1707f2db-c2b8-4c91-9341-27b1d57d355f';
const BUILD = 'ac994393-c282-492b-a35f-aa0bafca9380';
const FILE = 'android-recording-54.yml';
const BRANCH = 'refs/heads/ci/android-recording-54-20261016';
const TERMINAL = new Set(['SUCCESS', 'FAILURE', 'CANCELED']);
const ownSha = process.env.GITHUB_SHA;
const token = process.env.EXPO_TOKEN;
const work = path.resolve('apps/stage');
const root = path.join(process.env.RUNNER_TEMP, 'stage-eas-recording-54');
mkdirSync(root, { mode: 0o700 });
const forwarded = new Set();
let runId;
let canceled = false;
let mutationIssued = false;
let deadline;
let watchdog;

function safeMessage(value) {
  const text = token ? String(value).replaceAll(token, '[redacted]') : String(value);
  return text.replace(/https?:\/\/[^\s"']+/g, '[URL removed]').slice(0, 600);
}

async function query(document, variables) {
  const response = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: document, variables }),
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error('Expo API HTTP ' + response.status);
  const data = await response.json();
  if (data.errors?.length) throw new Error(safeMessage(data.errors[0].message));
  return data.data;
}

function cli(args, timeout = 90000) {
  const result = spawnSync('bunx', ['eas-cli@25.1.1', ...args], {
    cwd: work, env: process.env, encoding: 'utf8', timeout, maxBuffer: 10 * 1024 * 1024,
  });
  return { code: result.status, output: result.stdout ?? '', error: result.stderr ?? '' };
}

async function runs() {
  const data = await query('query DemoRuns($id:String!){app{byId(appId:$id){workflowRunsPaginated(first:10){edges{node{id status gitCommitHash createdAt workflow{fileName}}}}}}}', { id: PROJECT });
  return data.app.byId.workflowRunsPaginated.edges.map(edge => edge.node);
}

async function cancel() {
  if (!runId || canceled) return;
  canceled = true;
  const result = cli(['workflow:cancel', runId, '--non-interactive'], 60000);
  console.log(JSON.stringify({ cancelRequested: true, runId, cliExitCode: result.code }));
}

async function forwardFrames(urls) {
  for (const url of urls) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !['expo.dev', 'expo.io', 'googleapis.com', 'eas-build.cloud'].some(host => parsed.hostname === host || parsed.hostname.endsWith('.' + host))) {
      throw new Error('Unrecognized EAS log storage host');
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'error' });
    if (!response.ok) throw new Error('EAS log retrieval HTTP ' + response.status);
    const text = await response.text();
    if (text.length > 50 * 1024 * 1024) throw new Error('EAS log exceeds transfer bound');
    const candidates = [text];
    for (const line of text.split('\n')) {
      try {
        const item = JSON.parse(line);
        if (item && typeof item.msg === 'string') candidates.push(item.msg);
        if (item && typeof item.message === 'string') candidates.push(item.message);
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
    }
    for (const candidate of candidates) {
      const pattern = /STAGE_SEALED ([A-Za-z0-9]{1,44}) (\{"type":"stage-private-evidence-v1"[^\n]+\})/g;
      for (const match of candidate.matchAll(pattern)) {
        let frame;
        try { frame = JSON.parse(match[2]); } catch (error) { if (error instanceof SyntaxError) continue; throw error; }
        if (Object.keys(frame).sort().join(',') !== 'count,data,index,sha256,type' || frame.type !== 'stage-private-evidence-v1' || !/^[a-f0-9]{64}$/.test(frame.sha256) || !Number.isInteger(frame.index) || !Number.isInteger(frame.count) || frame.count < 1 || frame.count > 8193 || frame.index < 0 || frame.index >= frame.count || !/^[A-Za-z0-9+/=]+$/.test(frame.data) || frame.data.length > 5464) throw new Error('Invalid sealed output frame');
        const hash = createHash('sha256').update(match[1] + match[2]).digest('hex');
        if (!forwarded.has(hash)) {
          forwarded.add(hash);
          const output = 'STAGE_SEALED ' + match[1] + ' ' + JSON.stringify(frame);
          console.log(output);
          if (frame.count <= 33) console.log('::notice title=Stage sealed ' + match[1] + '::' + JSON.stringify(frame));
        }
      }
    }
  }
}

async function state() {
  const data = await query('query DemoRun($id:ID!){workflowRuns{byId(workflowRunId:$id){id status gitCommitHash durationSeconds jobs{id key type status turtleJobRun{id startedAt endedAt maxRunTimeSeconds resourceClassDisplayName logFileUrls artifacts{id name} }}}}}', { id: runId });
  const item = data.workflowRuns.byId;
  if (item.gitCommitHash && item.gitCommitHash !== ownSha) throw new Error('EAS source revision mismatch');
  for (const job of item.jobs) {
    if (job.type !== 'CUSTOM') throw new Error('Unexpected EAS job type');
    if (job.turtleJobRun?.artifacts?.length) throw new Error('Unexpected persistent EAS artifact');
    await forwardFrames(job.turtleJobRun?.logFileUrls ?? []);
  }
  return { runId: item.id, status: item.status, durationSeconds: item.durationSeconds, jobs: item.jobs.map(job => ({ id: job.id, key: job.key, type: job.type, status: job.status, runtime: job.turtleJobRun ? { id: job.turtleJobRun.id, startedAt: job.turtleJobRun.startedAt, endedAt: job.turtleJobRun.endedAt, resourceClass: job.turtleJobRun.resourceClassDisplayName, providerMaxSeconds: job.turtleJobRun.maxRunTimeSeconds, artifactCount: job.turtleJobRun.artifacts.length } : null })) };
}

async function main() {
  if (!token || process.env.GITHUB_REF !== BRANCH || !/^[a-f0-9]{40}$/.test(ownSha ?? '')) throw new Error('Approved launcher context unavailable');
  const data = await query('query DemoExisting($appId:String!,$buildId:ID!,$date:DateTime!){app{byId(appId:$appId){id fullName githubRepository{metadata{githubRepoOwnerName githubRepoName}} githubRepositorySettings{baseDirectory} ownerAccount{name isDisabled subscription{name status planId} usageMetrics{byBillingPeriod(date:$date,service:BUILDS){planMetrics{serviceMetric metricType value limit jobTypeBreakdown{workflows}}}}}}} builds{byId(buildId:$buildId){id status platform appVersion appBuildVersion gitCommitHash buildProfile app{id}}}}', { appId: PROJECT, buildId: BUILD, date: new Date().toISOString() });
  const app = data.app.byId;
  const repository = app.githubRepository?.metadata;
  const base = app.githubRepositorySettings?.baseDirectory?.replace(/^\.\//, '').replace(/\/$/, '');
  const build = data.builds.byId;
  const receipt = { projectId: app.id, account: app.ownerAccount.name, accountDisabled: app.ownerAccount.isDisabled, subscription: app.ownerAccount.subscription, usage: app.ownerAccount.usageMetrics.byBillingPeriod.planMetrics, gitConnectionPresent: Boolean(repository), repository: repository ? repository.githubRepoOwnerName + '/' + repository.githubRepoName : null, baseDirectory: base ?? null, buildId: build.id, buildStatus: build.status, appVersion: build.appVersion, versionCode: build.appBuildVersion, noArchiveUploaded: true, newAppBuild: false, maximumAttemptSeconds: 2640, listedMediumUsdPerMinute: 0.02, guaranteedBillingCap: false };
  console.log(JSON.stringify({ existingAccountPreflight: receipt }));
  if (app.id !== PROJECT || app.ownerAccount.name !== 'bonustrack' || app.ownerAccount.isDisabled) throw new Error('Existing EAS project/account unavailable');
  if (!repository || repository.githubRepoOwnerName !== 'bonustrack' || repository.githubRepoName !== 'stage') throw new Error('Existing EAS GitHub repository connection is unavailable; no connection changes performed');
  if (base !== 'apps/stage') throw new Error('Existing EAS Git repository base directory does not match apps/stage; no settings changes performed');
  if (build.id !== BUILD || build.app.id !== PROJECT || build.status !== 'FINISHED' || build.platform !== 'ANDROID' || build.appVersion !== '0.1.5' || String(build.appBuildVersion) !== '54' || build.gitCommitHash !== '9e12e49dff62718d9155ef43bd091cbde746b978' || build.buildProfile !== 'production-prod') throw new Error('Existing candidate54 metadata mismatch');
  if ((await runs()).some(item => item.workflow.fileName === FILE && !TERMINAL.has(item.status))) throw new Error('An existing recording attempt is not terminal; no duplicate start');
  deadline = Date.now() + 2640 * 1000;
  mutationIssued = true;
  console.log(JSON.stringify({ singleLaunchIssued: true, sourceSha: ownSha, workflow: FILE, worker: 'linux-medium-nested-virtualization', noLocalArchiveUpload: true }));
  const launch = cli(['workflow:run', '.eas/workflows/' + FILE, '--ref', ownSha, '--json', '--non-interactive', '--no-wait', '--input', 'deadline=' + Math.floor((deadline - 30000) / 1000)], 180000);
  if (launch.code === 0) {
    try { runId = JSON.parse(launch.output.trim()).id; } catch (error) { if (!(error instanceof SyntaxError)) throw error; }
  }
  if (!runId) {
    const matches = (await runs()).filter(item => item.workflow.fileName === FILE && item.gitCommitHash === ownSha);
    if (matches.length === 1) runId = matches[0].id;
    else throw new Error('Single EAS launch outcome unresolved; no retry. CLI status ' + launch.code + ': ' + safeMessage(launch.error));
  }
  if (!/^[a-f0-9-]{36}$/.test(runId)) throw new Error('Invalid EAS run identifier');
  writeFileSync(path.join(root, 'run-id'), runId, { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ easRunId: runId, url: 'https://expo.dev/accounts/bonustrack/projects/metro/workflows/' + runId }));
  watchdog = setTimeout(() => { void cancel(); }, Math.max(1, deadline - Date.now() - 90000));
  let previous;
  while (Date.now() < deadline) {
    const value = await state();
    const encoded = JSON.stringify(value);
    if (encoded !== previous) { console.log(encoded); previous = encoded; }
    if (TERMINAL.has(value.status)) {
      console.log(JSON.stringify({ terminal: value.status, runId, mutationCount: 1, rawArtifactsPublished: false }));
      return value.status === 'SUCCESS' ? 0 : 2;
    }
    await new Promise(resolve => setTimeout(resolve, 20000));
  }
  await cancel();
  const value = await state();
  console.log(JSON.stringify({ boundedAttemptStopped: TERMINAL.has(value.status), remoteOutcomeUncertain: !TERMINAL.has(value.status), ...value }));
  return 2;
}

process.on('SIGTERM', async () => { await cancel(); process.exit(2); });
try {
  process.exitCode = await main();
} catch (error) {
  await cancel();
  let remoteStatus;
  if (runId) {
    try {
      const data = await query('query DemoTerminal($id:ID!){workflowRuns{byId(workflowRunId:$id){id status durationSeconds}}}', { id: runId });
      remoteStatus = data.workflowRuns.byId.status;
    } catch {
      remoteStatus = null;
    }
  }
  console.log(JSON.stringify({ blocker: safeMessage(error.message), mutationIssued, runId: runId ?? null, remoteStatus: remoteStatus ?? null, remoteTerminalVerified: TERMINAL.has(remoteStatus), noRetry: true, recordingVerified: false }));
  process.exitCode = 2;
} finally {
  if (watchdog) clearTimeout(watchdog);
}
