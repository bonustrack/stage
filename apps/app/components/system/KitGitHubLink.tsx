/** A tappable row that opens the @metro-labs/kit package on GitHub. Lives at
 *  the top of the Kit page so the design-system source is one tap away. */

import { Linking, Pressable } from 'react-native';
import { Box, Row } from '../layout';
import { Icon } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';

const KIT_GITHUB_URL = 'https://github.com/bonustrack/metro/tree/main/packages/kit';

export function KitGitHubLink({ dark, head, sub, border, rowBg }: {
  dark: boolean; head: string; sub: string; border: string; rowBg: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={() => { void Linking.openURL(KIT_GITHUB_URL); }}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Box
        style={{
          marginHorizontal: 16, marginTop: 16, paddingVertical: 14, paddingHorizontal: 14,
          borderRadius: 12, borderWidth: 1, borderColor: border, backgroundColor: rowBg,
        }}
      >
        <Row gap={12} style={{ alignItems: 'center' }}>
          <Icon name="code" size={22} color={head} />
          <Box style={{ flex: 1 }}>
            <Text style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Semibold' }}>
              View @metro-labs/kit on GitHub
            </Text>
            <Text dark={dark} color={sub} variant="caption" weight="medium"
              style={{ marginTop: 2 }}>
              bonustrack/metro · packages/kit
            </Text>
          </Box>
          <Icon name="externalLink" size={18} color={sub} />
        </Row>
      </Box>
    </Pressable>
  );
}
