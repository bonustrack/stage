
import { Linking } from 'react-native';

import { Pressable } from '@stage-labs/kit/pressable';
import { Image } from '@stage-labs/kit/image';
import { Spinner } from '../Spinner';
import { Text } from '@stage-labs/kit/text';
import { Icon } from '@stage-labs/kit/icon';
import { Col, Row, Box } from '../layout';
import { type Nft } from '../../lib/opensea';
import { DANGER } from '../../lib/theme';

export function NftsView({
  status, nfts, head, sub, border,
}: {
  status: 'idle' | 'loading' | 'ready' | 'error';
  nfts: Nft[] | null;
  head: string; sub: string; border: string;
}): React.ReactElement {
  if (status === 'loading' || status === 'idle') {
    return (
      <Col padding={{ y: 40 }} margin={{ x: 16 }} align="center">
        <Spinner size={28} color={head}/>
      </Col>
    );
  }
  if (status === 'error') {
    return (
      <Col padding={{ y: 40 }} margin={{ x: 16 }} align="center">
        <Text size="md" color={DANGER}>
          Failed to load NFTs.
        </Text>
      </Col>
    );
  }
  if (!nfts || nfts.length === 0) {
    return (
      <Col padding={{ y: 40 }} margin={{ x: 16 }} align="center">
        <Text size="md" color={sub}>
          There are no NFTs in this wallet.
        </Text>
      </Col>
    );
  }
  return (
    <Row margin={{ x: 16, top: 6 }} style={{ flexWrap: 'wrap' }}>
      {nfts.map(nft => (
        <Box width={'50%'} key={`${nft.chainId}:${nft.id}`}>
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
              <Box width={'100%'} aspectRatio={1} radius="lg" background={border}
                align="center" justify="center" 
>
                <Icon name="photo" size={28} color={sub}/>
              </Box>
            )}
            <Text weight="semibold" size="md"
              numberOfLines={1} color={head} style={{ marginTop: 6 }}>
              {nft.title}
            </Text>
            {nft.collection ? (
              <Text size="xs" numberOfLines={1} color={sub}>
                {nft.collection}
              </Text>
            ) : null}
          </Pressable>
        </Box>
      ))}
    </Row>
  );
}
