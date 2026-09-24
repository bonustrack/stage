
import { memo } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { tokenRowModel } from './model';
import { Box, Row } from '../../layout';
import { type AssetRow } from '@stage-labs/client/wallet/assets';
import { TokenAvatar } from './tokenAvatar';
import { TokenRowBody } from '../TokenRowView';

import { fmtUsd, splitUsd, fmtBalance } from '@stage-labs/client/wallet/format';
export { fmtUsd, splitUsd, fmtBalance };

interface Palette { head: string; sub: string; border: string; bg: string; card: string; }

export const TokenRow = memo(function TokenRow({ r, border, bg, onPress }: { r: AssetRow; onPress?: () => void } & Omit<Palette, 'card'>): React.ReactElement {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Row padding={{ y: 14 }} align="center" gap={12}>
        <TokenAvatar logoUrl={r.logoUrl} chainId={r.chainId} bg={bg} border={border} />
        <Box flex={1}>
          <TokenRowBody
            {...tokenRowModel(r, { fmtUsd, fmtBalance })}
            showAvatar={false}
            trailingChevron={false}
          />
        </Box>
      </Row>
    </Pressable>
  );
});
