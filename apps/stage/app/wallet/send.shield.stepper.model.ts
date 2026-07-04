export type StepState = 'done' | 'active' | 'pending' | 'error';

export interface StepperStep {
  label: string;
  state: StepState;
  hint?: string;
}

export type ShieldStage = 'idle' | 'submitting' | 'confirming' | 'scanning' | 'done' | 'error';

const STEP_LABELS: readonly (readonly [ShieldStage, string])[] = [
  ['submitting', 'Submitting transaction'],
  ['confirming', 'Confirming on-chain'],
  ['scanning', 'Scanning into private balance'],
  ['done', 'Shielded'],
];

const STAGE_ORDER: ShieldStage[] = ['submitting', 'confirming', 'scanning', 'done'];

function stageIndex(stage: ShieldStage): number {
  return stage === 'idle' || stage === 'error' ? -1 : STAGE_ORDER.indexOf(stage);
}

function stepState(idx: number, cur: number, stage: ShieldStage, errorAt: number): StepState {
  if (stage === 'error') return idx < errorAt ? 'done' : idx === errorAt ? 'error' : 'pending';
  if (stage === 'done') return 'done';
  if (idx < cur) return 'done';
  if (idx === cur) return 'active';
  return 'pending';
}

export function shieldStepperSteps(stage: ShieldStage, errorAt: number): StepperStep[] {
  const cur = stageIndex(stage);
  return STEP_LABELS.map(([id, label]) => {
    const idx = STAGE_ORDER.indexOf(id);
    const state = stepState(idx, cur, stage, errorAt);
    const hint = state === 'active' && id === 'scanning'
      ? 'This can take a few minutes…' : undefined;
    return { label, state, hint };
  });
}
