/** Friendly card for an Expo dev-client PR-preview deep link found in a message
 *  body (`metro://expo-development-client/?url=https://u.expo.dev/<proj>/group/<id>`).
 *  Matches the github / metro-channel card look exactly: 1px theme border, rounded
 *  (block radius), transparent fill, Calibre, palette tokens. Tappable -> opens the
 *  deep link via `Linking.openURL`, which launches the matching dev-client build.
 *  Detection is done by the caller via `previewLinkOf`. */

import { Linking, Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Box, Row } from './layout';
import { previewLinkOf } from '../lib/previewLinkDetect';
import { usePalette, useBlockRadius } from '../lib/theme';

export function PreviewLinkCard({ url }: {
  /** `dark` is accepted for call-site symmetry but unused - colors come from the
   *  live palette tokens (same convention as GitHubLinkCard / ChannelCard). */
  url: string; dark?: boolean;
}): React.ReactElement | null {
  const ref = previewLinkOf(url);
  const pal = usePalette();
  const blockRadius = useBlockRadius();
  if (!ref) return null;

  const fg = pal.link;
  const subColor = pal.text;
  const border = pal.border;

  return (
    <Pressable onPress={() => void Linking.openURL(ref.url)}>
      <Box radius={blockRadius} style={{ borderWidth: 1, borderColor: border, backgroundColor: 'transparent', paddingHorizontal: 12, paddingVertical: 10 }}>
        <Row align="center" justify="start">
          <Icon name="play" size={18} color={fg} />
          <Box style={{ marginLeft: 8, flexShrink: 1 }}>
            <Text style={{ color: fg, fontSize: 19, fontFamily: 'Calibre-Semibold' }}>
              Open preview build
            </Text>
            <Text style={{ color: subColor, fontSize: 16, lineHeight: 21, fontFamily: 'Calibre-Medium', marginTop: 2 }}>
              EAS Update · {ref.shortGroup}
            </Text>
          </Box>
        </Row>
      </Box>
    </Pressable>
  );
}
