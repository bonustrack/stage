import type { ColNode, ThemeColor, WidgetNode } from '@stage-labs/kit/kit';
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
  const children = params.steps.map((step): WidgetNode => {
    const iconColor = stepIconColor(step.state);
    const labelColor = stepLabelColor(step.state);
    const icon: WidgetNode =
      step.state === 'active'
        ? { type: 'Spinner', size: 14, color: iconColor }
        : { type: 'Icon', name: STATE_ICON[step.state], color: iconColor, size: 'sm' };
    const head: WidgetNode = {
      type: 'Row',
      align: 'center',
      gap: 10,
      children: [
        {
          type: 'Box',
          width: 18,
          height: 18,
          align: 'center',
          justify: 'center',
          children: [icon],
        },
        {
          type: 'Text',
          value: step.label,
          weight: 'semibold',
          size: 'md',
          color: labelColor,
        },
      ],
    };
    if (step.hint === undefined) return head;
    return {
      type: 'Col',
      gap: 2,
      children: [
        head,
        { type: 'Caption', value: step.hint, color: 'secondary', textAlign: 'start' },
      ],
    };
  });
  return { type: 'Col', gap: params.gap ?? 12, children };
}
