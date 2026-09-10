import type { AlertButton } from 'react-native';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import { Col } from '../layout';
import { AppModal } from '../AppModal';
import { dismissAlert, useAlertRequest, type AlertRequest } from '../../lib/alertHost';
import { useEffectiveColorScheme } from '../../lib/theme';

function buttonColor(button: AlertButton): 'danger' | 'primary' {
  return button.style === 'destructive' ? 'danger' : 'primary';
}

function buttonVariant(button: AlertButton): 'ghost' | 'solid' {
  return button.style === 'cancel' ? 'ghost' : 'solid';
}

function orderedButtons(request: AlertRequest): AlertButton[] {
  const cancel = request.buttons.filter((b) => b.style === 'cancel');
  const rest = request.buttons.filter((b) => b.style !== 'cancel');
  return [...rest, ...cancel];
}

function AlertButtons({ request, dark }: { request: AlertRequest; dark: boolean }): React.ReactElement {
  const press = (button: AlertButton): void => {
    dismissAlert();
    button.onPress?.();
  };
  return (
    <Col gap={10} padding={{ top: 8 }}>
      {orderedButtons(request).map((button, i) => (
        <Button
          key={`${button.text ?? 'button'}-${i}`}
          label={button.text ?? 'OK'}
          size="lg"
          fullWidth
          color={buttonColor(button)}
          variant={buttonVariant(button)}
          dark={dark}
          onPress={() => { press(button); }}
        />
      ))}
    </Col>
  );
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
        <Title level={3}>{request.title}</Title>
        {request.message !== undefined && request.message !== '' ? (
          <Text size="md" role="secondary">{request.message}</Text>
        ) : null}
        <AlertButtons request={request} dark={dark} />
      </Col>
    </AppModal>
  );
}
