import { useEffect, useState } from 'react';
import { Title } from '@stage-labs/kit/react-native/title';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Box, Col, Row } from '../layout';
import { Spinner } from '../Spinner';
import { DANGER, usePalette } from '../../lib/theme';
import type { Stage } from './flow';
import {
  STAGE_LABELS, setupHint, setupProgress, setupStages, setupTitle, stageState,
  type SetupErr, type StageState,
} from './Onboarding.setup.model';

type Pal = ReturnType<typeof usePalette>;

const CONTENT_MAX_WIDTH = 460;
const TICK_MS = 1_000;

function useStageElapsed(stage: Stage): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    setElapsed(0);
    const timer = setInterval(() => { setElapsed(Date.now() - started); }, TICK_MS);
    return () => { clearInterval(timer); };
  }, [stage]);
  return elapsed;
}

function ProgressBar({ value, pal }: { value: number; pal: Pal }): React.ReactElement {
  const pct = `${Math.round(value * 100)}%`;
  return (
    <Box width="100%" height={6} radius="full" background={pal.border} style={{ overflow: 'hidden' }}>
      <Box width={pct} height={6} radius="full" background={pal.primary} />
    </Box>
  );
}

function StageIndicator({ state, pal }: { state: StageState; pal: Pal }): React.ReactElement {
  if (state === 'done') return <Icon name="check" size={20} color={pal.primary} />;
  if (state === 'active') return <Spinner size={18} color={pal.primary} />;
  return <Box width={8} height={8} radius="full" background={pal.border} margin={{ x: 6 }} />;
}

function StageRow({ stage, state, pal }: { stage: Stage; state: StageState; pal: Pal }): React.ReactElement {
  const color = state === 'pending' ? pal.sub : pal.text;
  return (
    <Row align="center" gap={12}>
      <Box width={20} align="center">
        <StageIndicator state={state} pal={pal} />
      </Box>
      <Text size="xl" color={color} weight={state === 'active' ? 'semibold' : 'normal'}>{STAGE_LABELS[stage]}</Text>
    </Row>
  );
}

function SetupActions({ dark, busy, stage, setupErr, onRetry, onBack, onSkipHistory }: {
  dark: boolean; busy: boolean; stage: Stage; setupErr: SetupErr | null;
  onRetry: () => void; onBack: () => void; onSkipHistory: () => void;
}): React.ReactElement | null {
  if (setupErr !== null) {
    return (
      <Col gap={10} width="100%" padding={{ top: 8 }}>
        <Button dark={dark} size="lg" fullWidth color="primary" variant="solid" label="Try again" disabled={busy} onPress={onRetry} />
        {setupErr.accountId === undefined ? (
          <Button dark={dark} variant="ghost" size="lg" fullWidth color="primary" label="Back" disabled={busy} onPress={onBack} />
        ) : null}
      </Col>
    );
  }
  if (stage !== 'history') return null;
  return (
    <Box padding={{ top: 8 }}>
      <Button dark={dark} variant="ghost" size="lg" color="primary" label="Skip for now" onPress={onSkipHistory} />
    </Box>
  );
}

export function SetupStep({ pal, dark, busy, stage, setupErr, withHistory, onRetry, onBack, onSkipHistory }: {
  pal: Pal; dark: boolean; busy: boolean; stage: Stage; setupErr: SetupErr | null; withHistory: boolean;
  onRetry: () => void; onBack: () => void; onSkipHistory: () => void;
}): React.ReactElement {
  const stages = setupStages(withHistory);
  const elapsed = useStageElapsed(stage);
  const progress = setupProgress(stage, stages, elapsed);
  return (
    <Col flex={1} align="center" justify="center">
      <Col gap={20} align="center" width="100%" maxWidth={CONTENT_MAX_WIDTH}>
        {setupErr === null
          ? <Spinner size={36} color={pal.primary} />
          : <Icon name="exclamationCircle" size={40} color={DANGER} />}
        <Title level={1} color={pal.text} style={{ textAlign: 'center' }}>{setupTitle(stage, setupErr)}</Title>
        <Text size="lg" color={pal.sub} textAlign="center">{setupHint(stage, setupErr)}</Text>
        {setupErr === null ? <ProgressBar value={progress} pal={pal} /> : null}
        <Col gap={14} width="100%" padding={{ top: 8 }}>
          {stages.map((s) => (
            <StageRow key={s} stage={s} state={stageState(s, stage, stages)} pal={pal} />
          ))}
        </Col>
        <SetupActions
          dark={dark} busy={busy} stage={stage} setupErr={setupErr}
          onRetry={onRetry} onBack={onBack} onSkipHistory={onSkipHistory}
        />
      </Col>
    </Col>
  );
}
