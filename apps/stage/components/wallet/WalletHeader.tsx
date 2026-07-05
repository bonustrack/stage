
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { capabilities } from '../../lib/capabilities';
import { usePalette } from '../../lib/theme';
import { ScreenHeader } from '../chrome/ScreenHeader';

export function WalletHeader({ title, backTone = 'text', truncate, padBottom }: {
  title: string;
  backTone?: 'text' | 'link';
  truncate?: boolean;
  padBottom?: number;
}): React.ReactElement {
  const { text: fg, link: head, border, toolbarBg } = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <ScreenHeader
      title={title}
      titleStyle={{
        kind: 'text',
        size: 'xl',
        weight: 'semibold',
        color: head,
        truncate,
        maxLines: truncate === true ? 1 : undefined,
      }}
      onBack={() => {
        capabilities.back();
      }}
      backColor={backTone === 'link' ? head : fg}
      safeTop={insets.top}
      padBottom={padBottom}
      surface={toolbarBg}
      borderColor={border}
    />
  );
}
