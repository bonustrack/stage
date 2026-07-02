import type { Color, WidgetRoot } from '@stage-labs/kit/kit';
import { basicRoot } from '../primitives';
import { screenHeader } from '../chrome/screenHeader';

export interface ProposalsHeaderColors {
  backColor: Color;
  surface: Color;
  borderColor: Color;
  safeTop: number;
}

export function proposalsHeaderNode(colors: ProposalsHeaderColors): WidgetRoot {
  return basicRoot(
    screenHeader({
      title: 'Pending requests',
      titleStyle: { kind: 'title', size: 'sm' },
      backColor: colors.backColor,
      safeTop: colors.safeTop,
      surface: colors.surface,
      borderColor: colors.borderColor,
    }),
  );
}

export function proposalsEmptyLabel(loading: boolean): string {
  return loading ? 'Loading requests…' : 'No pending requests';
}

export function proposalsPositionLabel(position: number, total: number): string {
  return `${position} of ${total}`;
}
