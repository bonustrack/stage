import type { ReactNode } from 'react';
import { GesturePressable } from '@stage-labs/kit/react-native/gesture-pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { Title } from '@stage-labs/kit/react-native/title';
import { resolveColorToken } from '@stage-labs/kit/tokens';
import { Row, STICKY_TOP, PAGE_GUTTER } from '../layout';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { capabilities } from '../../lib/capabilities';
import { usePalette } from '../../lib/theme';
import { HoverTint } from '../hover';
import { TOPNAV_HEIGHT } from '../Topnav';
import { IconArrowLeft } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowLeft';

const BACK_PAD = { padding: 4 } as const;
const TITLE_SHRINK = { flexShrink: 1 } as const;

function BackButton({ onBack, backTo, backColor }: {
  onBack?: () => void;
  backTo?: string;
  backColor: string;
}): React.ReactElement {
  const scheme = useKitScheme();
  const { link } = usePalette();
  const press = onBack ?? (() => {
    if (backTo === undefined) capabilities.back();
    else capabilities.backTo(backTo);
  });
  return (
    <GesturePressable onPress={press} hitSlop={8}>
      <HoverTint style={BACK_PAD}>
        {(hovered) => (
          <Glyph
            icon={IconArrowLeft}
            size={24}
            color={hovered ? link : resolveColorToken(backColor, scheme)}
            dark={scheme === 'dark'}
          />
        )}
      </HoverTint>
    </GesturePressable>
  );
}

function HeaderTitle({ title, wallet, color }: { title: string; wallet: boolean; color: string }): React.ReactElement | null {
  if (title === '') return null;
  if (wallet) return <Text text={title} size="sm" fontWeight="semibold" color={color} />;
  return <Title size="sm" color={color} style={TITLE_SHRINK}>{title}</Title>;
}

export function StackHeader({ title, trailing, backTo, onBack, wallet = false, back }: {
  title: string;
  trailing?: ReactNode;
  backTo?: string;
  onBack?: () => void;
  wallet?: boolean;
  back?: boolean;
}): React.ReactElement {
  const scheme = useKitScheme();
  const { text: fg, link: head, border, toolbarBg: surface } = usePalette();
  const top = useSafeAreaInsets().top;
  return (
    <Row
      align="center"
      justify={title === '' ? 'spaceBetween' : undefined}
      gap={8}
      minHeight={wallet ? undefined : TOPNAV_HEIGHT + top}
      background={surface}
      border={{ bottom: { width: 1, color: resolveColorToken(border, scheme) } }}
      style={STICKY_TOP}
      padding={{ x: PAGE_GUTTER, top: (wallet ? 8 : 0) + top, bottom: wallet ? 10 : 0 }}
    >
      {back === false ? null : <BackButton onBack={onBack} backTo={backTo} backColor={fg} />}
      <HeaderTitle title={title} wallet={wallet} color={head} />
      {trailing}
    </Row>
  );
}
