import type { GestureResponderEvent } from 'react-native';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { HoverTooltip } from './HoverTooltip';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';

const CENTERED = { alignSelf: 'center' } as const;

export function RoundIconButton({ icon, label, loading, background, onPress }: {
  icon: CentralIcon; label: string; loading?: boolean; background?: string;
  onPress: (event: GestureResponderEvent) => void;
}): React.ReactElement {
  const { link: head } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  return (
    <HoverTooltip label={label} placement="below">
      <Button
        uniform pill color="secondary" variant="solid" dark={dark} loading={loading} tintBg={background} tintPressedBg={background} style={background ? { ...CENTERED, borderColor: background } : CENTERED}
        accessibilityLabel={label}
        iconStart={<Glyph icon={icon} size={20} color={head}/>}
        onPress={onPress}
      />
    </HoverTooltip>
  );
}
