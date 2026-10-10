import { parseFrameDoc } from '@stage-labs/kit/frame';
import type { NodeProblem, NodeResult, NodeUrlProblem } from '@stage-labs/client/nodes/protocol';
import { ownNodeUrl, type PublishProblem } from '@stage-labs/client/nodes/publish';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import type { LiveSource } from '@stage-labs/client/xmtp/readState';
import { frameContentSchema } from '@stage-labs/client/xmtp/frame.schema';
import { frameInputOf } from '../frame/frame.model';

export const LIVE_REFRESH_MS = 60_000;
const LIVE_MAX_BACKOFF_MS = 5 * 60_000;

export type LiveProblem = NodeProblem | 'empty';

export interface LiveState {
  frame: FrameContent | null;
  at: number | null;
  problem: LiveProblem | null;
  status: number | null;
  failures: number;
}

export const EMPTY_LIVE: LiveState = { frame: null, at: null, problem: null, status: null, failures: 0 };

const PROBLEM_TEXT: Readonly<Record<LiveProblem, string>> = {
  blocked: 'Link blocked',
  unreachable: 'Not reachable',
  timeout: 'Timed out',
  status: 'Node error',
  'too-large': 'Reply too large',
  invalid: 'Not a widget',
  empty: 'No widget yet',
};

export const NODE_URL_HINTS: Readonly<Record<NodeUrlProblem, string>> = {
  invalid: 'Enter a full link, like https://example.com/widget',
  insecure: 'Only https links work',
  credentials: 'Links with a user name or password are not allowed',
  local: 'Local and private addresses are blocked',
};

const PUBLISH_PROBLEM_TEXT: Readonly<Record<PublishProblem, string>> = {
  'too-large': 'The code is over 64 KB',
  refused: 'The code was refused',
  busy: 'Too many tries, wait a minute',
  full: 'Stage hosts no more nodes for now',
  'not-ready': 'Node hosting is not set up yet',
  unreachable: 'Could not reach Stage, check your connection',
  failed: 'Could not publish it, try again',
};

export function publishProblemText(problem: PublishProblem, detail?: string): string {
  return problem === 'refused' && detail !== undefined ? `Code error: ${detail}` : PUBLISH_PROBLEM_TEXT[problem];
}

export function ownsHostedNode(source: LiveSource): boolean {
  return ownNodeUrl(source.key) === source.url;
}

export interface LivePreview { url: string; host: string; frame: FrameContent; state: LiveState }

export function livePreviewOf(url: string, host: string, state: LiveState): LivePreview | string {
  const problem = liveProblemText(state);
  if (problem !== null || state.frame === null) return `Could not load it: ${(problem ?? 'no widget').toLowerCase()}`;
  return { url, host, frame: state.frame, state };
}

export function liveConfirmOf(host: string): { title: string; message: string; confirmLabel: string } {
  return {
    title: 'Add a live widget?',
    message: `It loads from ${host} every minute while your Dashboard is open. That site sees your IP address, not your account.`,
    confirmLabel: 'Add',
  };
}

function renders(frame: FrameContent): boolean {
  return parseFrameDoc(frameInputOf(frame)).ok;
}

function failed(prev: LiveState, problem: LiveProblem, status: number | null = null): LiveState {
  return { ...prev, problem, status, failures: prev.failures + 1 };
}

export function liveStateAfter(prev: LiveState, result: NodeResult, now: number): LiveState {
  if (!result.ok) return failed(prev, result.problem, result.status ?? null);
  const { reply } = result;
  if (reply.kind === 'unchanged') return prev.frame === null ? failed(prev, 'empty') : { ...prev, at: now, problem: null, status: null, failures: 0 };
  if (!renders(reply.frame)) return failed(prev, 'invalid');
  return { frame: reply.frame, at: now, problem: null, status: null, failures: 0 };
}

export function liveRefreshDelay(state: LiveState | undefined): number {
  return Math.min(LIVE_REFRESH_MS * 2 ** (state?.failures ?? 0), LIVE_MAX_BACKOFF_MS);
}

export function liveRefetchInterval(active: boolean, state: LiveState | undefined): number | false {
  return active ? liveRefreshDelay(state) : false;
}

export function liveProblemText(state: Pick<LiveState, 'problem' | 'status'>): string | null {
  if (state.problem === null) return null;
  const text = PROBLEM_TEXT[state.problem];
  return state.status === null ? text : `${text} ${state.status}`;
}

export function liveStatusText(state: LiveState | undefined, timeOf: (ms: number) => string): string | null {
  const problem = state === undefined ? null : liveProblemText(state);
  if (state === undefined || problem === null) return null;
  return state.at === null ? problem : `${problem} · ${timeOf(state.at)}`;
}

function snapshotJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function liveSnapshotOf(raw: string | null): LiveState {
  const json = raw === null ? null : snapshotJson(raw);
  if (typeof json !== 'object' || json === null) return EMPTY_LIVE;
  const { frame, at } = json as { frame?: unknown; at?: unknown };
  const parsed = frameContentSchema.safeParse(frame);
  if (!parsed.success || typeof at !== 'number' || !renders(parsed.data)) return EMPTY_LIVE;
  return { ...EMPTY_LIVE, frame: parsed.data, at };
}

export function liveSnapshotJson(state: LiveState): string | null {
  return state.frame === null || state.at === null ? null : JSON.stringify({ frame: state.frame, at: state.at });
}
