import { Button } from '@stage-labs/kit/react-native/button';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { usePalette } from '../../lib/theme';
import { OnboardingCard, SkipLink } from './OnboardingCard';
import { passkeyStepCopy, type PasskeyStepCopy } from './Onboarding.steps.model';
import type { PasskeyMode } from './flow';

function startOverLink(error: string | null, busy: boolean, onStartOver: () => void): React.ReactElement | undefined {
  return error === null ? undefined : <SkipLink label="Start over" disabled={busy} onPress={onStartOver} />;
}

export function PasskeyStep({ dark, busy, mode, error, onAdd, onStartOver }: {
  dark: boolean; busy: boolean; mode: PasskeyMode; error: string | null;
  onAdd: () => void; onStartOver: () => void;
}): React.ReactElement {
  const pal = usePalette();
  const copy: PasskeyStepCopy = passkeyStepCopy(mode, error);
  const footer = (
    <Button label={copy.action} block pill size="lg" color="primary" variant="solid" disabled={busy} dark={dark} onPress={onAdd}
      iconStart={<Icon name="fingerPrint" size={20} color={pal.bg} />} />
  );
  return <OnboardingCard title={copy.title} about={copy.body} footer={footer} after={startOverLink(error, busy, onStartOver)} />;
}
