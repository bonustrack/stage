import type { AlertButton } from 'react-native';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { AppModal } from '../AppModal';
import { dismissAlert, useAlertRequest, type AlertRequest } from '../../lib/alertHost';
import { useEffectiveColorScheme } from '../../lib/theme';
import { Column, Row } from '../layout';

function buttonColor(button: AlertButton): 'danger' | 'primary' | 'secondary' {
  if (button.style === 'cancel') return 'secondary';
  return button.style === 'destructive' ? 'danger' : 'primary';
}

function AlertButtons({ request, dark }: { request: AlertRequest; dark: boolean }): React.ReactElement {
  const press = (button: AlertButton): void => {
    dismissAlert();
    button.onPress?.();
  };
  const buttons = [...request.buttons.filter((b) => b.style === 'cancel'), ...request.buttons.filter((b) => b.style !== 'cancel')];
  const sideBySide = buttons.length === 2;
  const items = buttons.map((button, i) => (
    <Column key={`${button.text ?? 'button'}-${i}`} weight={sideBySide ? 1 : undefined}>
      <Button
        label={button.text ?? 'OK'}
        size="lg"
        fullWidth
        color={buttonColor(button)}
        variant={button.style === 'cancel' ? 'soft' : 'solid'}
        dark={dark}
        onPress={() => { press(button); }}
      />
    </Column>
  ));
  return sideBySide
    ? <Row gap={10} padding={{ top: 8 }}>{items}</Row>
    : <Column gap={10} padding={{ top: 8 }}>{items}</Column>;
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
    <AppModal visible onClose={onClose} title={request.title}>
      <Column gap={8}>
        {request.message !== undefined && request.message !== '' ? (
          <Text size="xl" style={{ paddingVertical: 12 }}>{request.message}</Text>
        ) : null}
        <AlertButtons request={request} dark={dark} />
      </Column>
    </AppModal>
  );
}
