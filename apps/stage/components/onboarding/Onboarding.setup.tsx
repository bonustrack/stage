import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Box, Col, Row } from '../layout';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { OnboardingCard, SkipLink } from './OnboardingCard';
import type { HistoryControls } from './useSetupRunner';
import { DANGER, usePalette } from '../../lib/theme';
import type { Stage } from './flow';
import {
  setupHint, setupLinks, setupStages, setupTitle, stageLabel, stageState,
  type SetupErr, type SetupLinkKind, type SetupPlan, type StageState,
} from './Onboarding.setup.model';
import { IconCheckmark1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCheckmark1';
import { IconCircleX } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCircleX';
import { useEffect, useState } from 'react';
import { historySyncDeadline, historySyncProblem, useHistorySyncPhase } from '../../lib/history';
import { historySyncIsActive, historySyncPhaseLabel, timeLeftLabel } from '../../lib/history.model';

const CONTINUE_HINT = 'You can also continue without it and sync later from Settings > Devices and history.';

function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => { setNow(Date.now()); }, 1_000);
    return (): void => { clearInterval(id); };
  }, [running]);
  return now;
}

function useHistoryStepHint(active: boolean, stalled: boolean): string | null {
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

const ROW_HEIGHT = 40;
const ROW_ICON = 16;

function StageIndicator({ state, failed }: { state: StageState; failed: boolean }): React.ReactElement {
  const pal = usePalette();
  if (state === 'done') return <Glyph icon={IconCheckmark1} size={ROW_ICON} color={pal.success} />;
  if (state === 'active' && failed) return <Glyph icon={IconCircleX} size={ROW_ICON} color={DANGER} />;
  if (state === 'active') return <Spinner size={ROW_ICON} color={pal.link} />;
  return <Box width={6} height={6} radius="full" background={pal.sub} margin={{ x: 5 }} />;
}

function StageRow({ label, state, failed }: {
  label: string; state: StageState; failed: boolean;
}): React.ReactElement {
  const pal = usePalette();
  return (
    <Row align="center" gap={8} height={ROW_HEIGHT} padding={{ x: 16 }}>
      <Box width={ROW_ICON} align="center">
        <StageIndicator state={state} failed={failed} />
      </Box>
      <Text size="lg" color={state === 'pending' ? pal.sub : pal.link}>{label}</Text>
    </Row>
  );
}

function SetupActions({ dark, busy, setupErr, onRetry, history }: {
  dark: boolean; busy: boolean; setupErr: SetupErr | null; onRetry: () => void; history: HistoryControls;
}): React.ReactElement | null {
  if (setupErr === null) {
    return history.stalled ? <Button dark={dark} size="lg" fullWidth pill color="primary" variant="solid" label="Try again" onPress={history.retry} /> : null;
  }
  return <Button dark={dark} size="lg" fullWidth pill color="primary" variant="solid" label="Try again" disabled={busy} onPress={onRetry} />;
}

const SETUP_LINK_LABELS: Record<SetupLinkKind, string> = { startOver: 'Start over' };

function SetupLink({ busy, setupErr, onBack, history }: {
  busy: boolean; setupErr: SetupErr | null; onBack: () => void; history: HistoryControls;
}): React.ReactElement | null {
  if (setupErr === null && history.stalled) return <SkipLink label="Continue without history" onPress={history.continueWithout} />;
  if (setupErr === null) return null;
  const links = setupLinks(setupErr);
  if (links.length === 0) return null;
  return (
    <Col gap={16}>
      {links.map((kind) => (
        <SkipLink key={kind} label={SETUP_LINK_LABELS[kind]} disabled={busy} onPress={onBack} />
      ))}
    </Col>
  );
}

export function SetupStep({ dark, busy, stage, setupErr, plan, onRetry, onBack, history }: {
  dark: boolean; busy: boolean; stage: Stage; setupErr: SetupErr | null; plan: SetupPlan;
  onRetry: () => void; onBack: () => void; history: HistoryControls;
}): React.ReactElement {
  const stages = setupStages(plan);
  const historyHint = useHistoryStepHint(stage === 'history' && setupErr === null, history.stalled);
  const actions = SetupActions({ dark, busy, setupErr, onRetry, history });
  const link = SetupLink({ busy, setupErr, onBack, history });
  return (
    <OnboardingCard title={setupTitle(setupErr, plan)} about={historyHint ?? setupHint(setupErr)} footer={actions} after={link}>
      <Col width="100%">
        {stages.map((s) => (
          <StageRow key={s} label={stageLabel(s, plan)} state={stageState(s, stage, stages)} failed={setupErr !== null || (history.stalled && s === 'history')} />
        ))}
      </Col>
    </OnboardingCard>
  );
}
