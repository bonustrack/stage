
import { Linking } from 'react-native';

import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box } from './layout';
import { previewLinkOf } from '../lib/previewLinkDetect';
import { usePalette, useBlockRadius } from '../lib/theme';

export function PreviewLinkCard({ url }: {
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
