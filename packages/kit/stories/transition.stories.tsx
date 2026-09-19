import { useState } from 'react';
import type { Story } from '../gallery/story';
import { Transition } from '../src/react-native/transition';
import { Button } from '../src/react-native/button';
import { Box, Col, Row } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { SWATCHES, useDark } from './_controls';

export default { title: 'Transition' };

export const Controls: Story = () => {
  const dark = useDark();
  const [items, setItems] = useState([0, 1, 2]);
  return (
    <Col gap={12}>
      <Row gap={8}>
        <Button dark={dark} label="Add" onPress={() => { setItems((xs) => [...xs, (xs.at(-1) ?? -1) + 1]); }} />
        <Button dark={dark} label="Remove" variant="soft" onPress={() => { setItems((xs) => xs.slice(0, -1)); }} />
      </Row>
      <Row gap={8} wrap>
        {items.map((i) => (
          <Transition key={i}>
            <Box padding={16} background={SWATCHES[i % SWATCHES.length]} radius="md"><Text color="#fff">{i}</Text></Box>
          </Transition>
        ))}
      </Row>
    </Col>
  );
};
