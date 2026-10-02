
import { Caption } from '@stage-labs/kit/react-native/caption';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { schemePalette } from '@stage-labs/kit/tokens';
import { Col } from './layout';
import { bubbleLinkProps } from './bubble/linkProps';
import { openInBubbleLink } from '../lib/safeOpenLink';
import { previewLinkOf } from '../lib/cardLinks';

export function PreviewLinkCard({ url }: { url: string }): React.ReactElement | null {
  const dark = useKitScheme() === 'dark';
  const ref = previewLinkOf(url);
  if (!ref) return null;

  const pressedBg = schemePalette(dark).pressed;
  return (
    <Pressable {...bubbleLinkProps(ref.url, openInBubbleLink)} style={({ pressed }) => (pressed ? { backgroundColor: pressedBg } : undefined)}>
      <ListViewItem dark={dark}>
        <Col radius="lg">
          <Col gap={2} padding={{ x: 12, y: 10 }}>
            <Text size="2xs" value="Open preview build" weight="semibold" truncate />
            <Caption value={`EAS Update · ${ref.shortGroup}`} color="secondary" maxLines={2} />
          </Col>
        </Col>
      </ListViewItem>
    </Pressable>
  );
}
