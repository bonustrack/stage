import type { Stage } from './flow';

export type SetupRetry = 'restart' | 'messaging' | 'passkey';

export interface SetupErr { message: string; accountId?: string; retry: SetupRetry }

export type StageState = 'done' | 'active' | 'pending';

export const STAGE_LABELS: Record<Stage, string> = {
  wallet: 'Creating your wallet',
  passkey: 'Adding your passkey',
  messaging: 'Setting up secure messaging',
  profile: 'Saving your profile',
  history: 'Syncing your message history',
  finishing: 'Finishing up',
};

const STAGE_HINTS: Record<Stage, string> = {
  wallet: 'This only takes a moment.',
  passkey: 'Confirm with your device to secure this wallet with a passkey.',
  messaging: 'Registering your encrypted inbox. This can take up to a minute on first launch.',
  profile: 'Claiming your name and writing your profile onchain. Stage pays the fees.',
  history: 'Asking your other device for your messages. Open Stage there on this account. If it takes longer, we continue in the background and show progress on the home screen.',
  finishing: 'Almost there.',
};

const MESSAGING_RETRY_HINT =
  'Your wallet is ready, but secure messaging did not finish setting up. Try again. Your wallet and recovery phrase are safe.';

export interface SetupPlan { passkey?: boolean; profile?: boolean; history?: boolean }

export function setupStages(plan: SetupPlan): Stage[] {
  return [
    'wallet',
    ...(plan.passkey === true ? ['passkey' as const] : []),
    'messaging',
    ...(plan.profile === true ? ['profile' as const] : []),
    ...(plan.history === true ? ['history' as const] : []),
    'finishing',
  ];
}

export function stageState(stage: Stage, current: Stage, stages: Stage[]): StageState {
  const position = stages.indexOf(stage);
  const currentPosition = stages.indexOf(current);
  if (position < currentPosition) return 'done';
  return position === currentPosition ? 'active' : 'pending';
}

export function setupTitle(stage: Stage, err: SetupErr | null): string {
  if (err === null) return STAGE_LABELS[stage];
  return err.retry === 'passkey' ? 'Passkey not added' : 'Setup needs another try';
}

export function setupHint(stage: Stage, err: SetupErr | null): string {
  if (err === null) return STAGE_HINTS[stage];
  if (err.retry === 'messaging') return MESSAGING_RETRY_HINT;
  if (err.retry === 'passkey') return `${err.message} Try again to secure this wallet with a passkey, or start over.`;
  return `We could not finish setting up. ${err.message}`;
}
