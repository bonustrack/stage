
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { capabilities } from '../../lib/capabilities';
import { usePalette } from '../../lib/theme';
import { ScreenHeader } from './ScreenHeader';

export function StackHeader({ title, trailing }: {
  title: string;
  trailing?: ReactNode;
}): React.ReactElement {
  const { text: fg, link: head, border, toolbarBg } = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <ScreenHeader
      title={title}
      titleStyle={{ kind: 'title', size: 'sm', color: head }}
      onBack={() => {
        capabilities.back();
      }}
      backColor={fg}
      safeTop={insets.top}
      surface={toolbarBg}
      borderColor={border}
      trailing={trailing}
    />
  );
}
