/** Friendly card for an Expo dev-client PR-preview deep link found in a message
 *  body (`metro://expo-development-client/?url=https://u.expo.dev/<proj>/group/<id>`).
 *  Matches the github / metro-channel card look exactly: 1px theme border, rounded
 *  (block radius), transparent fill, Calibre, palette tokens. Tappable -> opens the
 *  deep link via `Linking.openURL`, which launches the matching dev-client build.
 *  Detection is done by the caller via `previewLinkOf`. */

import { Linking } from 'react-native';

import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Box } from './layout';
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
      <Box padding={{ x: 12, y: 10 }} radius={blockRadius} style={{ borderWidth: 1, borderColor: border, backgroundColor: 'transparent' }}>
        <Text weight="semibold" size="4xl" color={fg}>
          Open preview build
        </Text>
        <Text size="md" color={subColor} style={{ lineHeight: 21, marginTop: 2 }}>
          EAS Update · {ref.shortGroup}
        </Text>
      </Box>
    </Pressable>
  );
}
