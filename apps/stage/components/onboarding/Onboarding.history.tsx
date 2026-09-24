import { useEffect, useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Col } from '../layout';
import { SkipLink } from './OnboardingCard';
import { ReceiveCodeSheet } from '../settings/HistoryTransferSheets';
import { historySyncDeadline, historySyncProblem, useHistorySyncPhase } from '../../lib/historySync';
import { historySyncIsActive, historySyncPhaseLabel, timeLeftLabel } from '../../lib/historySync.model';
import type { HistoryControls } from './useSetupRunner';

const CONTINUE_HINT = 'You can also continue without it and sync later from Settings > Messenger.';
const ENTER_CODE = 'Enter a code from my other device';
const ENTER_CODE_WHILE_WAITING = 'Or enter a code from your other device';

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
  const label = historySyncPhaseLabel(phase, historySyncProblem());
  const deadline = historySyncDeadline();
  if (counting && label !== null && deadline !== null) return `${label} ${timeLeftLabel(deadline - now)}`;
  if (!stalled) return label;
  return label === null ? CONTINUE_HINT : `${label} ${CONTINUE_HINT}`;
}

export function HistoryStalledActions({ dark, history }: {
  dark: boolean; history: HistoryControls;
}): React.ReactElement {
  const [codeOpen, setCodeOpen] = useState(false);
  return (
    <Col gap={10} width="100%">
      <Button dark={dark} size="lg" fullWidth pill color="primary" variant="solid" label="Try again" onPress={history.retry} />
      <Button dark={dark} size="lg" fullWidth pill color="secondary" variant="solid"
        label={ENTER_CODE} onPress={() => { setCodeOpen(true); }} />
      <ReceiveCodeSheet visible={codeOpen} onClose={() => { setCodeOpen(false); }} onReceive={history.receiveCode} />
    </Col>
  );
}

export function EnterCodeWhileWaitingLink({ history }: { history: HistoryControls }): React.ReactElement {
  const [codeOpen, setCodeOpen] = useState(false);
  return (
    <>
      <SkipLink label={ENTER_CODE_WHILE_WAITING} onPress={() => { setCodeOpen(true); }} />
      <ReceiveCodeSheet visible={codeOpen} onClose={() => { setCodeOpen(false); }} onReceive={history.receiveCode} />
    </>
  );
}

export function ContinueWithoutHistoryLink({ history }: { history: HistoryControls }): React.ReactElement {
  return <SkipLink label="Continue without history" onPress={history.continueWithout} />;
}
