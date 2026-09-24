import { useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { Box, viewportFill } from '../layout';
import { usePalette, withAlpha } from '../../lib/theme';
import { AppModal } from '../AppModal';
import { AboutDetails } from './AboutPage';
import { buildMeta } from '../../lib/githubRepo';
import { isFreshBuild } from '../../lib/buildInfo.model';

const ABOVE_ALL_CHROME = 100;
const DOT = 8;

export function BuildInfoDot(): React.ReactElement {
  const { text, primary } = usePalette();
  const insets = useSafeAreaInsets();
  const fresh = isFreshBuild(buildMeta().commitTime, Date.now());
  const [open, setOpen] = useState(false);
  return (
    <Box pointerEvents="box-none" style={viewportFill(ABOVE_ALL_CHROME)}>
      <Box pointerEvents="box-none" style={{ position: 'absolute', left: 10, bottom: insets.bottom + 10 }}>
        <Pressable
          accessibilityRole="button" accessibilityLabel="About this build" hitSlop={10}
          onPress={() => { setOpen(true); }}
          style={{ padding: 6 }}
        >
          <Box size={DOT} radius="full" background={fresh ? primary : withAlpha(text, 0.32)} />
        </Pressable>
      </Box>
      <AppModal visible={open} onClose={() => { setOpen(false); }}>
        <AboutDetails />
      </AppModal>
    </Box>
  );
}
