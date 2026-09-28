import type { ReactNode } from 'react';
import { Box, PAGE_GUTTER } from './layout';
import { OverlayHeader } from './chrome/OverlayHeader';
import { RoundOverflowMenu, type OverflowMenuItem } from './MenuRows';
import { capabilities } from '../lib/capabilities';
import { usePalette } from '../lib/theme';

export const PROFILE_AVATAR_SIZE = 88;

const COVER_HEIGHT = 156;
const SHEET_RADIUS = 18;
const SHEET = { borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS, overflow: 'visible' } as const;
const AVATAR_SLOT = { marginTop: -PROFILE_AVATAR_SIZE * 0.8, zIndex: 1 } as const;

export function ProfileCoverBar({ insetTop, trailing }: { insetTop: number; trailing?: ReactNode }): React.ReactElement {
  const { link } = usePalette();
  return <OverlayHeader onBack={() => { capabilities.back(); }} backColor={link} safeTop={insetTop} trailing={trailing} />;
}

export function ProfileCover({ insetTop, avatar, children, centered = false }: {
  insetTop: number; avatar: ReactNode; children: ReactNode; centered?: boolean;
}): React.ReactElement {
  const { border } = usePalette();
  return (
    <>
      <Box height={COVER_HEIGHT + insetTop} background={border}/>
      <Box surface="surface" margin={{ top: -SHEET_RADIUS }} style={SHEET}>
        <Box padding={{ x: PAGE_GUTTER }} align={centered ? 'center' : 'start'}>
          <Box style={AVATAR_SLOT}>{avatar}</Box>
        </Box>
        {children}
      </Box>
    </>
  );
}

export function ProfileCoverMenu({ items, onSelect, loading }: {
  items: OverflowMenuItem[];
  onSelect: (id: string) => void; loading?: boolean;
}): React.ReactElement {
  const { bg } = usePalette();
  return <RoundOverflowMenu items={items} onSelect={onSelect} loading={loading} background={bg} />;
}
