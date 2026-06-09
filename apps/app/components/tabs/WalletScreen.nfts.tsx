/** Wallet NFT grid view — extracted from WalletScreen.parts for lint
 *  line-budget. Rendering identical. */

import { Linking } from 'react-native';

import { Pressable } from '@metro-labs/kit/pressable';
import { Image } from '@metro-labs/kit/image';
import { Spinner } from '../Spinner';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Col, Row, Box } from '../layout';
import { type Nft } from '../../lib/opensea';
import { DANGER } from '../../lib/theme';

/** NFT grid view — 2-column grid of the account's NFTs from OpenSea. Shows a
 *  spinner while loading, an error line on failure, an empty state when the
 *  account holds nothing, else a grid of image cells (remote https image_url,
 *  placeholder when missing) tappable to the NFT's OpenSea page. */
export function NftsView({
  status, nfts, head, sub, border,
}: {
  status: 'idle' | 'loading' | 'ready' | 'error';
  nfts: Nft[] | null;
  head: string; sub: string; border: string;
}): React.ReactElement {
  if (status === 'loading' || status === 'idle') {
    return (
      <Col mx={16} py={40} align="center">
        <Spinner size={28} color={head} />
      </Col>
    );
  }
  if (status === 'error') {
    return (
      <Col mx={16} py={40} align="center">
        <Text size="md" style={{ color: DANGER, fontFamily: 'Calibre-Medium' }}>
          Failed to load NFTs.
        </Text>
      </Col>
    );
  }
  if (!nfts || nfts.length === 0) {
    return (
      <Col mx={16} py={40} align="center">
        <Text size="md" style={{ color: sub, fontFamily: 'Calibre-Medium' }}>
          There are no NFTs in this wallet.
        </Text>
      </Col>
    );
  }
  return (
    <Row mx={16} mt={6} style={{ flexWrap: 'wrap' }}>
      {nfts.map(nft => (
        <Box key={`${nft.chainId}:${nft.id}`} style={{ width: '50%' }}>
          <Pressable
            onPress={() => { if (nft.openseaUrl) void Linking.openURL(nft.openseaUrl); }}
            style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.7 : 1 })}
          >
            {nft.image ? (
              <Image
                src={nft.image}
                fit="cover"
                style={{ width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: border }}
              />
            ) : (
              <Box
                style={{
                  width: '100%', aspectRatio: 1, borderRadius: 12,
                  backgroundColor: border, alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon name="photo" size={28} color={sub} />
              </Box>
            )}
            <Text size="md"
              numberOfLines={1}
              style={{ color: head, fontFamily: 'Calibre-Semibold', marginTop: 6 }}
            >
              {nft.title}
            </Text>
            {nft.collection ? (
              <Text size="sm" numberOfLines={1} style={{ color: sub, fontFamily: 'Calibre-Medium' }}>
                {nft.collection}
              </Text>
            ) : null}
          </Pressable>
        </Box>
      ))}
    </Row>
  );
}
