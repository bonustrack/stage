import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { Box, viewportFill } from '../layout';
import { usePalette, withAlpha } from '../../lib/theme';
import { capabilities } from '../../lib/capabilities';
import { buildMeta } from '../../lib/githubRepo';
import { isFreshBuild } from '../../lib/buildInfo.model';

const ABOVE_ALL_CHROME = 100;
const DOT = 8;

export function BuildInfoDot(): React.ReactElement {
  const { text, primary } = usePalette();
  const insets = useSafeAreaInsets();
  const fresh = isFreshBuild(buildMeta().commitTime, Date.now());
  return (
    <Box pointerEvents="box-none" style={viewportFill(ABOVE_ALL_CHROME)}>
      <Box pointerEvents="box-none" style={{ position: 'absolute', left: 10, bottom: insets.bottom + 10 }}>
        <Pressable
          accessibilityRole="button" accessibilityLabel="About this build" hitSlop={10}
          onPress={() => { capabilities.navigate('/settings/about'); }}
          style={{ padding: 6 }}
        >
          <Box size={DOT} radius="full" background={fresh ? primary : withAlpha(text, 0.32)} />
        </Pressable>
      </Box>
    </Box>
  );
}
