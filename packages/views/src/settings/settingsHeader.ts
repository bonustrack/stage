import type { BasicNode, Color } from '@stage-labs/kit/kit';
import { basicRoot } from '../primitives';
import { screenHeader } from '../chrome/screenHeader';

export interface SettingsHeaderParams {
  title: string;
  backColor: Color;
  titleColor?: Color;
  surface?: Color;
  borderColor?: Color;
  safeTop?: number;
}

export function settingsHeader(params: SettingsHeaderParams): BasicNode {
  return basicRoot(
    screenHeader({
      title: params.title,
      titleStyle: { kind: 'title', size: 'sm', color: params.titleColor },
      backColor: params.backColor,
      safeTop: params.safeTop,
      surface: params.surface,
      borderColor: params.borderColor,
    }),
  );
}
