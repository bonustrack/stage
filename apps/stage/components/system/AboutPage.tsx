
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col, WEB_EDGE_CONTENT_WIDE, WEB_STACK_SCROLL, WEB_STACK_CONTENT_PAD } from '../layout';
import { usePalette } from '../../lib/theme';
import { StackHeader } from '../chrome/StackHeader';
import { AboutPanel } from './AboutPanel';

export function AboutPage(): React.ReactElement {
  const { text: fg, link: head, border } = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="About"/>
      <ScrollView style={WEB_STACK_SCROLL} contentContainerStyle={[{ paddingBottom: 32 + insets.bottom }, WEB_EDGE_CONTENT_WIDE, WEB_STACK_CONTENT_PAD]}>
        <AboutPanel head={head} sub={fg} border={border}/>
      </ScrollView>
    </Col>
  );
}
