import { Button } from '@stage-labs/kit/react-native/button';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { usePalette } from '../../lib/theme';
import { Col } from '../layout';
import { OnboardingCard, SkipLink } from './OnboardingCard';
import { passkeyStepCopy, type PasskeyStepCopy } from './Onboarding.steps.model';
import type { PasskeyMode } from './flow';

function StepLinks({ copy, error, busy, onSkip, onStartOver }: {
  copy: PasskeyStepCopy; error: string | null; busy: boolean; onSkip: () => void; onStartOver: () => void;
}): React.ReactElement | undefined {
  const skip = copy.skip === null ? null : <SkipLink label={copy.skip} disabled={busy} onPress={onSkip} />;
  const startOver = error === null ? null : <SkipLink label="Start over" disabled={busy} onPress={onStartOver} />;
  if (skip === null && startOver === null) return undefined;
  return <Col gap={16}>{skip}{startOver}</Col>;
}

export function PasskeyStep({ dark, busy, mode, error, onAdd, onSkip, onStartOver }: {
  dark: boolean; busy: boolean; mode: PasskeyMode; error: string | null;
  onAdd: () => void; onSkip: () => void; onStartOver: () => void;
}): React.ReactElement {
  const pal = usePalette();
  const copy = passkeyStepCopy(mode, error);
  const footer = (
    <Button label={copy.action} block pill size="lg" color="primary" variant="solid" disabled={busy} dark={dark} onPress={onAdd}
      iconStart={<Icon name="fingerPrint" size={20} color={pal.bg} />} />
  );
  const links = StepLinks({ copy, error, busy, onSkip, onStartOver });
  return <OnboardingCard title={copy.title} about={copy.body} footer={footer} after={links} />;
}
