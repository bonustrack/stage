import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Box, Col, Row } from '../layout';
import { Spinner } from '../Spinner';
import { OnboardingCard, SkipLink } from './OnboardingCard';
import { DANGER, usePalette } from '../../lib/theme';
import type { Stage } from './flow';
import {
  setupHint, setupStages, setupTitle, stageLabel, stageState,
  type SetupErr, type SetupPlan, type StageState,
} from './Onboarding.setup.model';

const ROW_HEIGHT = 40;
const ROW_ICON = 16;

function StageIndicator({ state, failed }: { state: StageState; failed: boolean }): React.ReactElement {
  const pal = usePalette();
  if (state === 'done') return <Icon name="check" size={ROW_ICON} color={pal.success} />;
  if (state === 'active' && failed) return <Icon name="xCircle" size={ROW_ICON} color={DANGER} />;
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

function SetupActions({ dark, busy, setupErr, onRetry }: {
  dark: boolean; busy: boolean; setupErr: SetupErr | null; onRetry: () => void;
}): React.ReactElement | null {
  if (setupErr === null) return null;
  return <Button dark={dark} size="lg" fullWidth pill color="primary" variant="solid" label="Try again" disabled={busy} onPress={onRetry} />;
}

function SetupLink({ busy, stage, setupErr, onBack, onSkipHistory }: {
  busy: boolean; stage: Stage; setupErr: SetupErr | null; onBack: () => void; onSkipHistory: () => void;
}): React.ReactElement | null {
  if (setupErr !== null) {
    return setupErr.retry === 'messaging' ? null : <SkipLink label="Start over" disabled={busy} onPress={onBack} />;
  }
  return stage === 'history' ? <SkipLink onPress={onSkipHistory} /> : null;
}

export function SetupStep({ dark, busy, stage, setupErr, plan, onRetry, onBack, onSkipHistory }: {
  dark: boolean; busy: boolean; stage: Stage; setupErr: SetupErr | null; plan: SetupPlan;
  onRetry: () => void; onBack: () => void; onSkipHistory: () => void;
}): React.ReactElement {
  const stages = setupStages(plan);
  const actions = SetupActions({ dark, busy, setupErr, onRetry });
  const link = SetupLink({ busy, stage, setupErr, onBack, onSkipHistory });
  return (
    <OnboardingCard title={setupTitle(setupErr, plan)} about={setupHint(setupErr, plan)} footer={actions} after={link}>
      <Col width="100%">
        {stages.map((s) => (
          <StageRow key={s} label={stageLabel(s, plan)} state={stageState(s, stage, stages)} failed={setupErr !== null} />
        ))}
      </Col>
    </OnboardingCard>
  );
}
