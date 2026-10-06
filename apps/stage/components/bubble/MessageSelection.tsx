import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { Col, Row } from '../layout';
import { FormField } from '../FormField';

export function MessageSelection({ text, fg, input, onClose }: {
  text: string; fg: string; input: boolean; onClose: () => void;
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => { listener.remove(); };
  }, [onClose]);
  return (
    <Col gap={8}>
      <Row align="center" justify="between" gap={8}>
        <Text size="sm" color="secondary" selectable={false} style={{ flex: 1 }}>Touch and hold text to select</Text>
        <Button label="Done" accessibilityLabel="Done selecting text" color="secondary" variant="ghost" dark={dark} onPress={onClose} />
      </Row>
      {input ? (
        <FormField value={text} onChangeText={() => undefined} multiline rows={1}
          inputProps={{ readOnly: true, showSoftInputOnFocus: false, accessibilityLabel: 'Message text', scrollEnabled: false }} />
      ) : (
        <Text size="lg" color={fg} selectable style={{ lineHeight: 23 }}>{text}</Text>
      )}
    </Col>
  );
}
