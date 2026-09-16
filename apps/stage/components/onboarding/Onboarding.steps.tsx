import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Col } from '../layout';
import { usePalette } from '../../lib/theme';
import { OnboardingCard, SkipLink } from './OnboardingCard';
import { passkeyStepCopy, type PasskeyStepCopy } from './Onboarding.steps.model';
import type { PasskeyMode } from './flow';

function passkeyLink(copy: PasskeyStepCopy, error: string | null, busy: boolean, onSkip: () => void, onStartOver: () => void): React.ReactElement | undefined {
  if (error !== null) return <SkipLink label="Start over" disabled={busy} onPress={onStartOver} />;
  return copy.skippable ? <SkipLink disabled={busy} onPress={onSkip} /> : undefined;
}

export function PasskeyStep({ dark, busy, mode, error, onAdd, onSkip, onStartOver }: {
  dark: boolean; busy: boolean; mode: PasskeyMode; error: string | null;
  onAdd: () => void; onSkip: () => void; onStartOver: () => void;
}): React.ReactElement {
  const pal = usePalette();
  const copy = passkeyStepCopy(mode, error);
  const footer = (
    <Button label={copy.action} block pill size="lg" color="primary" variant="solid" disabled={busy} dark={dark} onPress={onAdd} />
  );
  return (
    <OnboardingCard title={copy.title} footer={footer} after={passkeyLink(copy, error, busy, onSkip, onStartOver)}>
      <Col align="center" padding={{ top: 8 }}>
        <Icon name="fingerPrint" size={56} color={pal.link} />
      </Col>
      <Text size="4xl" color="link" textAlign="center" style={{ paddingVertical: 12 }} value={copy.body} />
    </OnboardingCard>
  );
}
