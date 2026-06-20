/**
 * @file PreviewLinkCard: a tappable card for an Expo dev-client PR-preview deep link found in a message body, opening the matching dev-client build.
 */

import { Linking } from 'react-native';

import { Pressable } from '@stage-labs/kit/pressable';
import { Text } from '@stage-labs/kit/text';
import { Box } from './layout';
import { previewLinkOf } from '../lib/previewLinkDetect';
import { usePalette, useBlockRadius } from '../lib/theme';

/** Renders a rich preview card for a detected link URL. */
export function PreviewLinkCard({ url }: {
  /** `dark` is accepted for call-site symmetry but unused - colors come from the live palette tokens (same convention as GitHubLinkCard / ChannelCard). */
  url: string; dark?: boolean;
}): React.ReactElement | null {
  const ref = previewLinkOf(url);
  const pal = usePalette();
  const blockRadius = useBlockRadius();
  if (!ref) return null;

  const subColor = pal.text;
  const border = pal.border;

  return (
    <Pressable onPress={() => void Linking.openURL(ref.url)}>
      <Box background={'transparent'} padding={{ x: 12, y: 10 }} radius={blockRadius} style={{ borderWidth: 1, borderColor: border }}>
        <Text weight="semibold" size="4xl">
          Open preview build
        </Text>
        <Text size="md" color={subColor} style={{ lineHeight: 21, marginTop: 2 }}>
          EAS Update · {ref.shortGroup}
        </Text>
      </Box>
    </Pressable>
  );
}
