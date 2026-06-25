import type { ColNode, ThemeColor } from '@stage-labs/kit/kit';
import view from './stepper.json';
import { buildView } from '../buildView';
import { DANGER_COLOR, SUCCESS_COLOR } from '../colors';

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

function stepIconColor(state: StepState): ThemeColor | string {
  if (state === 'done') return SUCCESS_COLOR;
  if (state === 'error') return DANGER_COLOR;
  if (state === 'active') return 'link';
  return 'secondary';
}

function stepLabelColor(state: StepState): ThemeColor | string {
  if (state === 'done') return 'link';
  if (state === 'error') return DANGER_COLOR;
  if (state === 'active') return 'text';
  return 'secondary';
}

export function stepper(params: StepperParams): ColNode {
  const steps = params.steps.map((step) => ({
    label: step.label,
    icon: STATE_ICON[step.state],
    iconColor: stepIconColor(step.state),
    labelColor: stepLabelColor(step.state),
    hint: step.hint,
    useHead: step.hint === undefined || undefined,
    useCol: step.hint !== undefined || undefined,
    useSpinner: step.state === 'active' || undefined,
    useIcon: step.state !== 'active' || undefined,
  }));
  return (buildView(view, { steps, gap: params.gap ?? 12 }) as ColNode);
}
