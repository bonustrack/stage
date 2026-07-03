import { useMemo } from 'react';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import { basicRoot, stepper, type StepperStep } from '@stage-labs/views';
import { Col } from '../../components/layout';

interface Pal { sub: string; head: string; link: string }

export type ShieldStage = 'idle' | 'submitting' | 'confirming' | 'scanning' | 'done' | 'error';

const STEPS: readonly (readonly [ShieldStage, string])[] = [
  ['submitting', 'Submitting transaction'],
  ['confirming', 'Confirming on-chain'],
  ['scanning', 'Scanning into private balance'],
  ['done', 'Shielded'],
];
const ORDER: ShieldStage[] = ['submitting', 'confirming', 'scanning', 'done'];

function stageIndex(s: ShieldStage): number {
  return s === 'idle' || s === 'error' ? -1 : ORDER.indexOf(s);
}

function stepState(
  idx: number, cur: number, stage: ShieldStage, errorAt: number,
): StepperStep['state'] {
  if (stage === 'error') return idx < errorAt ? 'done' : idx === errorAt ? 'error' : 'pending';
  if (stage === 'done') return 'done';
  if (idx < cur) return 'done';
  if (idx === cur) return 'active';
  return 'pending';
}

export function ShieldStepper({ stage, errorAt = 0 }: {
  stage: ShieldStage; pal: Pal; errorAt?: number;
}): React.ReactElement | null {
  const node = useMemo(() => {
    const cur = stageIndex(stage);
    const steps: StepperStep[] = STEPS.map(([id, label]) => {
      const idx = ORDER.indexOf(id);
      const state = stepState(idx, cur, stage, errorAt);
      const hint = state === 'active' && id === 'scanning'
        ? 'This can take a few minutes…' : undefined;
      return { label, state, hint } satisfies StepperStep;
    });
    return basicRoot(stepper({ steps }));
  }, [stage, errorAt]);
  if (stage === 'idle') return null;
  return (
    <Col padding={{ x: 4, top: 4 }}>
      <ViewHost node={node} />
    </Col>
  );
}
