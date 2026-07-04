import { resolveIconName } from '@stage-labs/kit/icons';
import type { Scheme } from '@stage-labs/kit/tokens';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { resolveColorToken } from '@stage-labs/kit/tokens';
import { DANGER_COLOR, SUCCESS_COLOR } from '../../lib/uiColors';
import {
  shieldStepperSteps,
  type ShieldStage, type StepState, type StepperStep,
} from './send.shield.stepper.model';
import { Box, Col, Row } from '../../components/layout';

export type { ShieldStage };

interface Pal { sub: string; head: string; link: string }

const STATE_ICON: Record<StepState, string> = {
  done: 'check-circle',
  active: 'clock',
  pending: 'circle',
  error: 'x-circle',
};

function stepIconColor(state: StepState, scheme: Scheme): string {
  if (state === 'done') return SUCCESS_COLOR[scheme];
  if (state === 'error') return DANGER_COLOR[scheme];
  if (state === 'active') return resolveColorToken('link', scheme);
  return resolveColorToken('secondary', scheme);
}

function stepLabelColor(state: StepState, scheme: Scheme): string {
  if (state === 'done') return resolveColorToken('link', scheme);
  if (state === 'error') return DANGER_COLOR[scheme];
  if (state === 'active') return resolveColorToken('text', scheme);
  return resolveColorToken('secondary', scheme);
}

function StepIcon({ state, scheme }: {
  state: StepState; scheme: Scheme;
}): React.ReactElement | null {
  const color = stepIconColor(state, scheme);
  if (state === 'active') return <Spinner size={14} color={color} />;
  const name = resolveIconName(STATE_ICON[state]);
  if (name === undefined) return null;
  return <Icon name={name} size={16} color={color} dark={scheme === 'dark'} />;
}

function StepRow({ step, scheme }: {
  step: StepperStep; scheme: Scheme;
}): React.ReactElement {
  const head = (
    <Row align="center" gap={10}>
      <Box width={18} height={18} align="center" justify="center">
        <StepIcon state={step.state} scheme={scheme} />
      </Box>
      <Text
        value={step.label}
        weight="semibold"
        size="md"
        color={stepLabelColor(step.state, scheme)}
      />
    </Row>
  );
  if (step.hint === undefined) return head;
  return (
    <Col gap={2}>
      {head}
      <Caption value={step.hint} color="secondary" textAlign="start" />
    </Col>
  );
}

export function ShieldStepper({ stage, errorAt = 0 }: {
  stage: ShieldStage; pal: Pal; errorAt?: number;
}): React.ReactElement | null {
  const scheme = useKitScheme();
  if (stage === 'idle') return null;
  return (
    <Col padding={{ x: 4, top: 4 }}>
      <Col gap={12}>
        {shieldStepperSteps(stage, errorAt).map((step) => (
          <StepRow key={step.label} step={step} scheme={scheme} />
        ))}
      </Col>
    </Col>
  );
}
