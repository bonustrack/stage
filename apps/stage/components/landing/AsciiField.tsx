import { Text } from '@stage-labs/kit/react-native/text';
import { Box } from '../layout';
import { ASCII, HERO_BLACK } from './Landing.model';
import { useAsciiArt } from './useAsciiArt';

export function AsciiField({ width, height }: { width: number; height: number }): React.ReactElement {
  const art = useAsciiArt(width, height);
  return (
    <Box
      align="center" justify="center" pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, width, height, overflow: 'hidden' }}
    >
      <Text
        variant="mono" color={HERO_BLACK}
        style={{ fontSize: ASCII.size, lineHeight: ASCII.lineHeight, letterSpacing: ASCII.letterSpacing }}
      >
        {art}
      </Text>
    </Box>
  );
}
