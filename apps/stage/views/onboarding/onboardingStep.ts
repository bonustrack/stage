import type { ColNode, ControlVariant, WidgetNode } from '@stage-labs/kit/kit';
import { compact, compactList } from '../node';
import { ONBOARDING_ACTION_PRESS } from '../actions';

export interface OnboardingAction {
  id: string;
  label: string;
  variant?: ControlVariant;
  disabled?: boolean;
}

export interface OnboardingStepParams {
  title: string;
  caption?: string;
  imageUri?: string;
  actions?: OnboardingAction[];
  topPadding?: number;
  captionSize?: 'sm' | 'md';
  actionPressType?: string;
}

export function onboardingStep(params: OnboardingStepParams): ColNode {
  const actionPressType = params.actionPressType ?? ONBOARDING_ACTION_PRESS;
  const actions = params.actions ?? [];
  const topChildren = compactList<WidgetNode>([
    params.imageUri !== undefined
      ? { type: 'Image', src: params.imageUri, size: 96, radius: 'lg' }
      : undefined,
    { type: 'Title', value: params.title },
    params.caption !== undefined
      ? {
          type: 'Text',
          value: params.caption,
          size: params.captionSize ?? 'sm',
          color: 'secondary',
        }
      : undefined,
  ]);
  const children: WidgetNode[] = [
    {
      type: 'Col',
      gap: 10,
      padding: { top: params.topPadding ?? 8 },
      children: topChildren,
    },
  ];
  if (actions.length > 0) {
    children.push({
      type: 'Col',
      gap: 10,
      children: actions.map((action) =>
        compact({
          type: 'Button' as const,
          label: action.label,
          block: true,
          size: 'lg' as const,
          variant: action.variant ?? 'solid',
          disabled: action.disabled === true ? true : undefined,
          onClickAction: { type: actionPressType, payload: { id: action.id } },
        }),
      ),
    });
  }
  return { type: 'Col', flex: 1, justify: 'between', children };
}
