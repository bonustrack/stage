import type { ColNode, WidgetNode } from '@stage-labs/kit/chatkit';
import { DANGER_COLOR, SUCCESS_COLOR } from '../colors';
import { caption, col, icon, row, text } from '../primitives';

export type StepState = 'done' | 'active' | 'pending' | 'error';

export interface StepperStep {
  label: string;
  state: StepState;
  hint?: string;
}

export interface StepperParams {
  steps: StepperStep[];
  gap?: number;
}

const STATE_ICON: Record<StepState, string> = {
  done: 'check-circle',
  active: 'clock',
  pending: 'circle',
  error: 'x-circle',
};

function stepIcon(state: StepState): WidgetNode {
  if (state === 'done') return icon(STATE_ICON.done, { color: SUCCESS_COLOR, size: 'sm' });
  if (state === 'error') return icon(STATE_ICON.error, { color: DANGER_COLOR, size: 'sm' });
  if (state === 'active') return icon(STATE_ICON.active, { color: 'link', size: 'sm' });
  return icon(STATE_ICON.pending, { color: 'secondary', size: 'sm' });
}

function stepLabelColor(state: StepState): 'link' | 'text' | 'secondary' | typeof DANGER_COLOR {
  if (state === 'done') return 'link';
  if (state === 'error') return DANGER_COLOR;
  if (state === 'active') return 'text';
  return 'secondary';
}

function stepNode(step: StepperStep): WidgetNode {
  const head = row(
    [stepIcon(step.state), text(step.label, { weight: 'semibold', size: 'md', color: stepLabelColor(step.state) })],
    { align: 'center', gap: 10 },
  );
  if (step.hint === undefined) return head;
  return col([head, caption(step.hint, { color: 'secondary' })], { gap: 2 });
}

export function stepper(params: StepperParams): ColNode {
  return col(params.steps.map(stepNode), { gap: params.gap ?? 12 });
}
