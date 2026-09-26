import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Box, Col, Row } from '../layout';
import { Spinner } from '../Spinner';
import { OnboardingCard, SkipLink } from './OnboardingCard';
import {
  ContinueWithoutHistoryLink, EnterCodeWhileWaitingLink, HistoryStalledActions, useHistoryStepHint,
} from './Onboarding.history';
import type { HistoryControls } from './useSetupRunner';
import { DANGER, usePalette } from '../../lib/theme';
import type { Stage } from './flow';
import {
  setupHint, setupLinks, setupStages, setupTitle, stageLabel, stageState,
  type SetupErr, type SetupLinkKind, type SetupPlan, type StageState,
} from './Onboarding.setup.model';
import { IconCheckmark1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCheckmark1';
import { IconCircleX } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCircleX';

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
      <Text size="3xl" color={state === 'pending' ? pal.sub : pal.link}>{label}</Text>
    </Row>
  );
}

function SetupActions({ dark, busy, setupErr, onRetry, history }: {
  dark: boolean; busy: boolean; setupErr: SetupErr | null; onRetry: () => void; history: HistoryControls;
}): React.ReactElement | null {
  if (setupErr === null) return history.stalled ? <HistoryStalledActions dark={dark} history={history} /> : null;
  return <Button dark={dark} size="lg" fullWidth pill color="primary" variant="solid" label="Try again" disabled={busy} onPress={onRetry} />;
}

const SETUP_LINK_LABELS: Record<SetupLinkKind, string> = { skipPasskey: 'Continue without passkey', startOver: 'Start over' };

function SetupLink({ busy, setupErr, onBack, onSkipPasskey, history, waiting }: {
  busy: boolean; setupErr: SetupErr | null; onBack: () => void; onSkipPasskey: () => void; history: HistoryControls; waiting: boolean;
}): React.ReactElement | null {
  if (setupErr === null && history.stalled) return <ContinueWithoutHistoryLink history={history} />;
  if (setupErr === null) return waiting ? <EnterCodeWhileWaitingLink history={history} /> : null;
  const links = setupLinks(setupErr);
  if (links.length === 0) return null;
  return (
    <Col gap={16}>
      {links.map((kind) => (
        <SkipLink key={kind} label={SETUP_LINK_LABELS[kind]} disabled={busy} onPress={kind === 'skipPasskey' ? onSkipPasskey : onBack} />
      ))}
    </Col>
  );
}

export function SetupStep({ dark, busy, stage, setupErr, plan, onRetry, onBack, onSkipPasskey, history }: {
  dark: boolean; busy: boolean; stage: Stage; setupErr: SetupErr | null; plan: SetupPlan;
  onRetry: () => void; onBack: () => void; onSkipPasskey: () => void; history: HistoryControls;
}): React.ReactElement {
  const stages = setupStages(plan);
  const historyHint = useHistoryStepHint(stage === 'history' && setupErr === null, history.stalled);
  const actions = SetupActions({ dark, busy, setupErr, onRetry, history });
  const link = SetupLink({ busy, setupErr, onBack, onSkipPasskey, history, waiting: stage === 'history' });
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
