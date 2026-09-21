import type { AlertButton } from 'react-native';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import { Box, Col, Row } from '../layout';
import { AppModal } from '../AppModal';
import { dismissAlert, useAlertRequest, type AlertRequest } from '../../lib/alertHost';
import { useEffectiveColorScheme } from '../../lib/theme';

function buttonColor(button: AlertButton): 'danger' | 'primary' | 'secondary' {
  if (button.style === 'cancel') return 'secondary';
  return button.style === 'destructive' ? 'danger' : 'primary';
}

function buttonVariant(button: AlertButton): 'soft' | 'solid' {
  return button.style === 'cancel' ? 'soft' : 'solid';
}

function orderedButtons(request: AlertRequest): AlertButton[] {
  const cancel = request.buttons.filter((b) => b.style === 'cancel');
  const rest = request.buttons.filter((b) => b.style !== 'cancel');
  return [...cancel, ...rest];
}

function AlertButtons({ request, dark }: { request: AlertRequest; dark: boolean }): React.ReactElement {
  const press = (button: AlertButton): void => {
    dismissAlert();
    button.onPress?.();
  };
  const buttons = orderedButtons(request);
  const sideBySide = buttons.length === 2;
  const items = buttons.map((button, i) => (
    <Box key={`${button.text ?? 'button'}-${i}`} flex={sideBySide ? 1 : undefined}>
      <Button
        label={button.text ?? 'OK'}
        size="lg"
        fullWidth
        color={buttonColor(button)}
        variant={buttonVariant(button)}
        dark={dark}
        onPress={() => { press(button); }}
      />
    </Box>
  ));
  return sideBySide
    ? <Row gap={10} padding={{ top: 8 }}>{items}</Row>
    : <Col gap={10} padding={{ top: 8 }}>{items}</Col>;
}

export function AlertHost(): React.ReactElement | null {
  const request = useAlertRequest();
  const dark = useEffectiveColorScheme() === 'dark';
  if (request === null) return null;
  const cancel = request.buttons.find((b) => b.style === 'cancel');
  const onClose = (): void => {
    dismissAlert();
    cancel?.onPress?.();
  };
  return (
    <AppModal visible onClose={onClose}>
      <Col gap={8}>
        <Title level={2}>{request.title}</Title>
        {request.message !== undefined && request.message !== '' ? (
          <Text size="4xl" style={{ paddingVertical: 12 }}>{request.message}</Text>
        ) : null}
        <AlertButtons request={request} dark={dark} />
      </Col>
    </AppModal>
  );
}
