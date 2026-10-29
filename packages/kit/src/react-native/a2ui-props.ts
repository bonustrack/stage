import type { AccessibilityProps, ViewStyle } from 'react-native';
import type { ValidationResult } from '../a2ui/protocol';

export type A2uiLive = 'off' | 'polite' | 'assertive';

export interface A2uiAccessibility {
  label?: string;
  description?: string;
  live?: A2uiLive;
  hidden?: boolean;
}

export interface A2uiCommonProps {
  weight?: number;
  accessibility?: A2uiAccessibility;
}

const LIVE: Record<A2uiLive, AccessibilityProps['accessibilityLiveRegion']> = { off: 'none', polite: 'polite', assertive: 'assertive' };

export function accessibilityProps(accessibility: A2uiAccessibility | undefined): AccessibilityProps {
  if (accessibility === undefined) return {};
  const out: AccessibilityProps = {};
  if (accessibility.label !== undefined) out.accessibilityLabel = accessibility.label;
  if (accessibility.description !== undefined) out.accessibilityHint = accessibility.description;
  if (accessibility.live !== undefined) out.accessibilityLiveRegion = LIVE[accessibility.live];
  if (accessibility.hidden === true) {
    out.accessibilityElementsHidden = true;
    out.importantForAccessibility = 'no-hide-descendants';
    out['aria-hidden'] = true;
  }
  return out;
}

export function weightStyle(weight: number | undefined): ViewStyle | undefined {
  return weight === undefined ? undefined : { flex: weight };
}

export function failingChecks(checks: readonly ValidationResult[] | undefined): boolean {
  return checks?.some((check) => !check.valid && (check.severity ?? 'error') === 'error') === true;
}

export function firstCheckMessage(checks: readonly ValidationResult[] | undefined): string | undefined {
  return checks?.find((check) => !check.valid)?.message;
}
