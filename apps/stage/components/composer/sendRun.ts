import { rememberLocalAttachments } from '../../lib/localAttachmentCache';
import { uploadAttachments, xmtpSendMultiRemoteAttachment } from '../../lib/xmtp.attachments';
import { xmtpReply, xmtpSendText } from '../../lib/xmtp.messages';
import { fileInputs, planSendSteps, unsentDraft, type SendStep } from './send.model';
import type { ComposerState } from './state';
import type { Attachment, PostHooks } from './types';

let seq = 0;
export const mintLocalId = (): string => `tmp_${Date.now()}_${(seq++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export type DraftArgs = Pick<PostHooks, 'setErr' | 'onOptimistic' | 'onSent'> &
  Pick<ComposerState, 'text' | 'pending' | 'setPending' | 'setText'> & {
    replyingTo?: { id: string };
    onClearReply?: () => void;
    onRestoreReply?: () => void;
  };

type StepOutcome = { id: string } | { error: string };

interface StepRun {
  step: SendStep;
  outcome: Promise<StepOutcome>;
}

interface SendOptions {
  assertCurrent?: () => void;
  beforeSend?: () => Promise<void>;
  previewUri?: (uri: string) => string;
}

export interface StartedSend {
  text: string;
  pending: Attachment[];
  replyTo?: string;
  runs: StepRun[];
}

async function runStep(step: SendStep, previewUri?: (uri: string) => string): Promise<StepOutcome> {
  try {
    const previews = step.attachments.map((at) => ({ uri: previewUri?.(at.url) ?? at.url, mime: at.mime }));
    const id = await step.run((uploaded) => {
      rememberLocalAttachments(step.localId, previews, uploaded);
    });
    if (previews.length > 0) rememberLocalAttachments(id, previews);
    return { id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

function runInOrder(steps: SendStep[], previewUri?: (uri: string) => string): StepRun[] {
  let previous: Promise<StepOutcome | null> = Promise.resolve(null);
  return steps.map((step) => {
    const outcome = previous.then((before) => (before !== null && 'error' in before ? before : runStep(step, previewUri)));
    previous = outcome;
    return { step, outcome };
  });
}

export function startSend(line: string, text: string, pending: Attachment[], replyTo?: string, options: SendOptions = {}): StartedSend {
  options.assertCurrent?.();
  const senders = { text: xmtpSendText, reply: xmtpReply, attachments: xmtpSendMultiRemoteAttachment };
  const steps = planSendSteps(line, text, pending, replyTo, senders, mintLocalId, options.assertCurrent, options.beforeSend);
  uploadAttachments(fileInputs(steps.flatMap((step) => step.attachments)));
  return { text, pending, replyTo, runs: runInOrder(steps, options.previewUri) };
}

export function showSend(a: DraftArgs, started: StartedSend): void {
  started.runs.forEach(({ step }, i) =>
    a.onOptimistic?.({
      localId: step.localId,
      text: step.text,
      attachments: step.attachments,
      replyTo: i === 0 ? started.replyTo : undefined,
    }),
  );
  a.setText('');
  a.setPending([]);
  a.onClearReply?.();
  a.setErr(null);
}

async function settle(a: DraftArgs, runs: StepRun[]): Promise<SendStep[]> {
  const unsent: SendStep[] = [];
  for (const { step, outcome } of runs) {
    const result = await outcome;
    if ('id' in result) {
      a.onSent?.(step.localId, undefined, result.id);
      continue;
    }
    if (unsent.length === 0) a.setErr(result.error);
    a.onSent?.(step.localId, result.error);
    unsent.push(step);
  }
  return unsent;
}

export async function finishSend(
  a: DraftArgs,
  started: StartedSend,
  current: () => Pick<ComposerState, 'text' | 'pending'>,
): Promise<void> {
  const unsent = await settle(a, started.runs);
  const draft = current();
  if (unsent.length > 0 && draft.text.trim().length === 0 && draft.pending.length === 0) {
    const kept = unsentDraft(started.text, started.pending, unsent);
    a.setText(kept.text);
    a.setPending(kept.pending);
    if (started.replyTo !== undefined && unsent[0] === started.runs[0]?.step) a.onRestoreReply?.();
  }
}
