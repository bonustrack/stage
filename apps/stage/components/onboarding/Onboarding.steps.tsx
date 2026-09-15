
import { Title } from '@stage-labs/kit/react-native/title';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Col, Row } from '../layout';

interface StepAction {
  label: string;
  variant: 'solid' | 'soft' | 'ghost';
  disabled: boolean;
  onPress: () => void;
}

function OnboardingStepView({ dark, title, centered, caption, captionSize, topPadding, actions }: {
  dark: boolean; title?: string; centered?: boolean; caption?: string;
  captionSize?: 'sm' | 'md'; topPadding?: number; actions: StepAction[];
}): React.ReactElement {
  return (
    <Col flex={1} justify="between">
      <Col gap={10} padding={{ top: topPadding ?? 8 }} align={centered === true ? 'center' : undefined}>
        {title === undefined ? null : (
          <Title level={centered === true ? 1 : 2} style={centered === true ? { textAlign: 'center' } : undefined}>{title}</Title>
        )}
        {caption === undefined ? null : <Text value={caption} size={captionSize ?? 'sm'} color="secondary" />}
      </Col>
      <Col gap={10}>
        {actions.map((action) => (
          <Button
            key={action.label}
            label={action.label}
            block
            size="lg"
            color="primary"
            variant={action.variant}
            disabled={action.disabled}
            dark={dark}
            onPress={action.onPress}
          />
        ))}
      </Col>
    </Col>
  );
}

export function WelcomeStep({ dark, busy, onCreate, onImport }: {
  dark: boolean; busy: boolean; onCreate: () => void; onImport: () => void;
}): React.ReactElement {
  return (
    <Col gap={16}>
      <Button label="Create new wallet" block size="lg" color="primary" variant="solid" disabled={busy} dark={dark} onPress={onCreate} />
      <Row justify="center" gap={4}>
        <Text value="Or" size="md" color="secondary" />
        <Pressable onPress={onImport} disabled={busy} hitSlop={8}>
          <Text value="import wallet" size="md" color="link" weight="semibold" />
        </Pressable>
      </Row>
    </Col>
  );
}

export function PasskeyStep({ dark, busy, onAdd, onSkip }: {
  dark: boolean; busy: boolean; onAdd: () => void; onSkip: () => void;
}): React.ReactElement {
  return (
    <OnboardingStepView
      dark={dark}
      title="Add a passkey"
      caption={
        'Add a passkey so this device can approve transactions without your ' +
        'recovery phrase. You will only be asked for it when you sign. You can ' +
        'add one later.'
      }
      actions={[
        { label: 'Add a passkey', variant: 'solid', disabled: busy, onPress: onAdd },
        { label: 'Skip for now', variant: 'ghost', disabled: busy, onPress: onSkip },
      ]}
    />
  );
}
