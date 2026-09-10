import type { AlertButton } from 'react-native';
import { Dialog } from '@stage-labs/kit/react-native/dialog';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import { Col, Row } from '../layout';
import { dismissAlert, useAlertRequest, type AlertRequest } from '../../lib/alertHost';
import { useBlockRadius, useEffectiveColorScheme, usePalette } from '../../lib/theme';

const PANEL_WIDTH = 360;

function buttonColor(button: AlertButton): 'danger' | 'primary' {
  return button.style === 'destructive' ? 'danger' : 'primary';
}

function buttonVariant(button: AlertButton): 'ghost' | 'solid' {
  return button.style === 'cancel' ? 'ghost' : 'solid';
}

function AlertButtons({ request, dark }: { request: AlertRequest; dark: boolean }): React.ReactElement {
  const press = (button: AlertButton): void => {
    dismissAlert();
    button.onPress?.();
  };
  return (
    <Row gap={8} justify="end" wrap padding={{ top: 8 }}>
      {request.buttons.map((button, i) => (
        <Button
          key={`${button.text ?? 'button'}-${i}`}
          label={button.text ?? 'OK'}
          size="md"
          color={buttonColor(button)}
          variant={buttonVariant(button)}
          dark={dark}
          onPress={() => { press(button); }}
        />
      ))}
    </Row>
  );
}

export function AlertHost(): React.ReactElement | null {
  const request = useAlertRequest();
  const dark = useEffectiveColorScheme() === 'dark';
  const { bg, border } = usePalette();
  const radius = useBlockRadius();
  if (request === null) return null;
  const cancel = request.buttons.find((b) => b.style === 'cancel');
  const onClose = (): void => {
    dismissAlert();
    cancel?.onPress?.();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      side="center"
      animationType="fade"
      panelBackground={bg}
      panelBorderColor={border}
      panelRadius={Math.round(radius * 1.4)}
      panelPadding={{ x: 20, y: 18 }}
    >
      <Col gap={8} style={{ width: PANEL_WIDTH, maxWidth: '100%' }}>
        <Title level={3}>{request.title}</Title>
        {request.message !== undefined && request.message !== '' ? (
          <Text size="md" role="secondary">{request.message}</Text>
        ) : null}
        <AlertButtons request={request} dark={dark} />
      </Col>
    </Dialog>
  );
}
