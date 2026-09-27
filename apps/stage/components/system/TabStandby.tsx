import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col, PAGE_GUTTER, viewportFill } from '../layout';
import { useEffectiveColorScheme } from '../../lib/theme';
import { takeOverTab } from '../../lib/tabLock';

export function TabStandby(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  return (
    <Col surface="surface" align="center" justify="center" gap={16} padding={{ x: PAGE_GUTTER }} style={viewportFill()}>
      <Col align="center" gap={8}>
        <Text value="Stage is open in another tab" weight="semibold" size="2xl" textAlign="center"/>
        <Text role="secondary" textAlign="center" value="Stage runs in one tab at a time. Click Use here to use it in this tab."/>
      </Col>
      <Button label="Use here" size="lg" pill color="primary" variant="solid" dark={dark}
        style={{ alignSelf: 'center' }} onPress={takeOverTab}/>
    </Col>
  );
}
