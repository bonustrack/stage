import type { NodeProblem, NodeResult, NodeUrlProblem } from '@stage-labs/client/nodes/protocol';
import { NODES_HOST } from '@stage-labs/client/nodes/hosting';
import { ownNodeUrl, type PublishProblem } from '@stage-labs/client/nodes/publish';
import { frameContentSchema, type FrameContent } from '@stage-labs/client/xmtp/frame.schema';
import type { FrameApplied } from '../../lib/frameSession';
import type { LiveSource } from '@stage-labs/client/xmtp/readState';
import { frameRenders } from '../frame/frame.model';

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

export interface LivePreview {
  url: string;
  host: string;
  frame: FrameContent;
  state: LiveState;
}

export const NODE_DELETE_FAILED = {
  title: 'Could not delete the node',
  message: 'Remove the widget anyway? The node then stays online.',
  confirmLabel: 'Remove',
  destructive: true,
};

const HOSTED_NODE_NOTE = 'That code does not see your account. Images it shows load from their own sites, which see your IP address.';

export function liveConfirmOf(host: string): { title: string; message: string; confirmLabel: string } {
  const message =
    host === NODES_HOST
      ? `It runs code a Stage user put on ${host}, every minute while your Dashboard is open. ${HOSTED_NODE_NOTE}`
      : `It loads from ${host} every minute while your Dashboard is open. That site sees your IP address, not your account.`;
  return { title: 'Add a live widget?', message, confirmLabel: 'Add' };
}

function failed(prev: LiveState, problem: LiveProblem, status: number | null = null): LiveState {
  return { ...prev, problem, status, failures: prev.failures + 1 };
}

function fresh(frame: FrameContent, now: number): LiveState {
  return { frame, at: now, problem: null, status: null, failures: 0 };
}

function settled(prev: LiveState, step: FrameApplied, now: number): LiveState {
  if (prev.frame === null) return failed(prev, 'empty');
  if (step.kind === 'invalid') return failed(prev, 'invalid');
  return fresh(step.kind === 'frame' ? step.frame : prev.frame, now);
}

export function liveStateAfter(prev: LiveState, result: NodeResult, now: number, applied: FrameApplied = { kind: 'invalid' }): LiveState {
  if (!result.ok) return failed(prev, result.problem, result.status ?? null);
  const { reply } = result;
  if (reply.kind === 'frame') return frameRenders(reply.frame) ? fresh(reply.frame, now) : failed(prev, 'invalid');
  if (reply.kind === 'streamed' && reply.load) return applied.kind === 'frame' ? fresh(applied.frame, now) : failed(prev, 'invalid');
  return settled(prev, reply.kind === 'unchanged' ? reply : applied, now);
}

export function livePreviewOf(node: { url: string; host: string }, result: NodeResult, now: number): LivePreview | string {
  const state = liveStateAfter(EMPTY_LIVE, result, now);
  const problem = liveProblemText(state);
  if (problem !== null || state.frame === null) return `Could not load it: ${(problem ?? 'no widget').toLowerCase()}`;
  return { url: node.url, host: node.host, frame: state.frame, state };
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

function snapshotJson(raw: string | null): { frame?: unknown; at?: unknown } {
  try {
    return (JSON.parse(raw ?? 'null') ?? {}) as { frame?: unknown; at?: unknown };
  } catch {
    return {};
  }
}

export function liveSnapshotOf(raw: string | null): LiveState {
  const { frame, at } = snapshotJson(raw);
  const parsed = frameContentSchema.safeParse(frame);
  return typeof at === 'number' && parsed.success && frameRenders(parsed.data) ? { ...EMPTY_LIVE, frame: parsed.data, at } : EMPTY_LIVE;
}

export function liveSnapshotJson(state: LiveState): string | null {
  return state.frame === null || state.at === null ? null : JSON.stringify({ frame: state.frame, at: state.at });
}
