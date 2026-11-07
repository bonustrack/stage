import type { NodeResult, NodeUrlProblem } from '@stage-labs/client/nodes/protocol';
import { NODE_CODE_MAX_BYTES } from '@stage-labs/client/nodes/hosting';
import { ownNodeUrl, type PublishProblem } from '@stage-labs/client/nodes/publish';
import type { LiveSource } from '@stage-labs/client/xmtp/sync/dashboard';
import { EMPTY_LIVE, liveProblemText, liveStateAfter, type LivePreview, type LiveState } from '../../lib/frames/live.model';

export const NODE_URL_HINTS: Readonly<Record<NodeUrlProblem, string>> = {
  invalid: 'Enter a full link, like https://example.com/widget',
  insecure: 'Only https links work',
  credentials: 'Links with a user name or password are not allowed',
  local: 'Local and private addresses are blocked',
};

const PUBLISH_PROBLEM_TEXT: Readonly<Record<PublishProblem, string>> = {
  'too-large': `The code is over ${NODE_CODE_MAX_BYTES / 1024} KB`,
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

export const NODE_DELETE_FAILED = {
  title: 'Could not delete the node',
  message: 'Remove the widget anyway? The node then stays online.',
  confirmLabel: 'Remove',
  destructive: true,
};

export function livePreviewOf(node: { url: string; host: string }, result: NodeResult, now: number): LivePreview | string {
  const state = liveStateAfter(EMPTY_LIVE, result, now);
  const problem = liveProblemText(state);
  if (problem !== null || state.frame === null) return `Could not load it: ${(problem ?? 'no widget').toLowerCase()}`;
  return { url: node.url, host: node.host, frame: state.frame, state };
}

export function liveStatusText(state: LiveState | undefined, timeOf: (ms: number) => string): string | null {
  const problem = state === undefined ? null : liveProblemText(state);
  if (state === undefined || problem === null) return null;
  return state.at === null ? problem : `${problem} · ${timeOf(state.at)}`;
}
