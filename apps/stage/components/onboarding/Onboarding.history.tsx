import { errorMessage } from '@stage-labs/client/errors';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Button } from '@stage-labs/kit/react-native/button';
import { Col } from '../layout';
import { SkipLink } from './OnboardingCard';
import { PinSheet } from '../settings/HistorySyncSection';
import { historySyncDeadline, useHistorySyncPhase } from '../../lib/historySync';
import { historySyncIsActive, historySyncPhaseLabel, timeLeftLabel } from '../../lib/historySync.model';
import type { HistoryControls } from './useSetupRunner';

const CONTINUE_HINT = 'You can also continue without it and sync later from Settings > Messenger.';

function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => { setNow(Date.now()); }, 1_000);
    return (): void => { clearInterval(id); };
  }, [running]);
  return now;
}

export function useHistoryStepHint(active: boolean, stalled: boolean): string | null {
  const phase = useHistorySyncPhase();
  const counting = active && !stalled && historySyncIsActive(phase);
  const now = useNow(counting);
  if (!active) return null;
  const label = historySyncPhaseLabel(phase);
  const deadline = historySyncDeadline();
  if (counting && label !== null && deadline !== null) return `${label} ${timeLeftLabel(deadline - now)}`;
  if (!stalled) return label;
  return label === null ? CONTINUE_HINT : `${label} ${CONTINUE_HINT}`;
}

export function HistoryStalledActions({ dark, history }: {
  dark: boolean; history: HistoryControls;
}): React.ReactElement {
  const [pinOpen, setPinOpen] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const onPin = (pin: string): void => {
    if (pinBusy) return;
    setPinBusy(true);
    history.receivePin(pin)
      .then(() => { setPinOpen(false); })
      .catch((e: unknown) => { Alert.alert('Could not import history', errorMessage(e)); })
      .finally(() => { setPinBusy(false); });
  };
  return (
    <Col gap={10} width="100%">
      <Button dark={dark} size="lg" fullWidth pill color="primary" variant="solid" label="Try again" onPress={history.retry} />
      <Button dark={dark} size="lg" fullWidth pill color="secondary" variant="solid"
        label="Enter a PIN from my other device" onPress={() => { setPinOpen(true); }} />
      <PinSheet visible={pinOpen} busy={pinBusy} onClose={() => { setPinOpen(false); }} onSubmit={onPin} />
    </Col>
  );
}

export function ContinueWithoutHistoryLink({ history }: { history: HistoryControls }): React.ReactElement {
  return <SkipLink label="Continue without history" onPress={history.continueWithout} />;
}
