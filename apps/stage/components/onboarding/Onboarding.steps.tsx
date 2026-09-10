
import { Title } from '@stage-labs/kit/react-native/title';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Col } from '../layout';
import { usePalette } from '../../lib/theme';

type Pal = ReturnType<typeof usePalette>;

interface StepAction {
  label: string;
  variant: 'solid' | 'soft' | 'ghost';
  disabled: boolean;
  onPress: () => void;
}

function OnboardingStepView({ dark, title, centered, caption, captionSize, topPadding, actions }: {
  dark: boolean; title: string; centered?: boolean; caption?: string;
  captionSize?: 'sm' | 'md'; topPadding?: number; actions: StepAction[];
}): React.ReactElement {
  return (
    <Col flex={1} justify="between">
      <Col gap={10} padding={{ top: topPadding ?? 8 }} align={centered === true ? 'center' : undefined}>
        <Title level={centered === true ? 1 : 2} style={centered === true ? { textAlign: 'center' } : undefined}>{title}</Title>
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

export function WelcomeStep({ dark, busy, onCreate, onRestore, onImport }: {
  pal: Pal; dark: boolean; busy: boolean; onCreate: () => void; onRestore: () => void; onImport: () => void;
}): React.ReactElement {
  return (
    <OnboardingStepView
      dark={dark}
      title="Stage"
      centered
      topPadding={8}
      actions={[
        { label: 'Create new wallet', variant: 'solid', disabled: busy, onPress: onCreate },
        { label: 'I have a recovery phrase', variant: 'soft', disabled: busy, onPress: onRestore },
        { label: 'Import from another device', variant: 'ghost', disabled: busy, onPress: onImport },
      ]}
    />
  );
}

export function PasskeyStep({ dark, busy, onAdd, onSkip }: {
  pal: Pal; dark: boolean; busy: boolean; onAdd: () => void; onSkip: () => void;
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
