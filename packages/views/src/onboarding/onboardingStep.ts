import type { ColNode, ControlVariant } from '@stage-labs/kit/kit';
import view from './onboardingStep.json';
import { buildView } from '../buildView';
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
  const actions = (params.actions ?? []).map((action) => ({
    id: action.id,
    label: action.label,
    variant: action.variant ?? 'solid',
    disabled: action.disabled === true ? true : undefined,
  }));
  return buildView(view, {
    title: params.title,
    caption: params.caption,
    imageUri: params.imageUri,
    topPadding: params.topPadding ?? 8,
    captionSize: params.captionSize ?? 'sm',
    actions,
    hasActions: actions.length > 0 ? true : undefined,
    actionPressType: params.actionPressType ?? ONBOARDING_ACTION_PRESS,
  }) as ColNode;
}
