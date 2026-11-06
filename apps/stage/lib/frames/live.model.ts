import type { NodeProblem, NodeResult } from '@stage-labs/client/nodes/protocol';
import { frameContentSchema, type FrameContent } from '@stage-labs/client/xmtp/frame.schema';
import { frameRenders } from './frame.model';
import type { FrameApplied } from './frameSession';

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

export interface LivePreview {
  url: string;
  host: string;
  frame: FrameContent;
  state: LiveState;
}

const PROBLEM_TEXT: Readonly<Record<LiveProblem, string>> = {
  blocked: 'Link blocked',
  unreachable: 'Not reachable',
  timeout: 'Timed out',
  status: 'Node error',
  'too-large': 'Reply too large',
  invalid: 'Not a widget',
  empty: 'No widget yet',
};

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
