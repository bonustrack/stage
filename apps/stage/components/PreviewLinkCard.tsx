
import { Caption } from '@stage-labs/kit/react-native/caption';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { Col } from './layout';
import { capabilities } from '../lib/capabilities';
import { previewLinkOf } from '../lib/previewLinkDetect';

export function PreviewLinkCard({ url }: {
  url: string; dark?: boolean;
}): React.ReactElement | null {
  const dark = useKitScheme() === 'dark';
  const ref = previewLinkOf(url);
  if (!ref) return null;

  const targetUrl = ref.url;
  return (
    <ListViewItem dark={dark} onPress={() => { capabilities.openUrl(targetUrl); }}>
      <Col radius="lg">
        <Col gap={2} padding={{ x: 12, y: 10 }}>
          <Text value="Open preview build" weight="semibold" truncate />
          <Caption value={`EAS Update · ${ref.shortGroup}`} color="secondary" maxLines={2} />
        </Col>
      </Col>
    </ListViewItem>
  );
}
