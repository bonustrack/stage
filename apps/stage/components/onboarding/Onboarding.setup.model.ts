import type { PasskeyMode, Stage } from './flow';

export type SetupRetry = 'restart' | 'messaging' | 'passkey';

export interface SetupErr { message: string; accountId?: string; retry: SetupRetry }

export type StageState = 'done' | 'active' | 'pending';

const STAGE_LABELS: Record<Stage, string> = {
  wallet: 'Creating your wallet',
  passkey: 'Adding your passkey',
  messaging: 'Setting up secure messaging',
  profile: 'Saving your profile',
  history: 'Syncing your message history',
  finishing: 'Finishing up',
};

const RESTORE_WALLET_LABEL = 'Restoring your wallet';
const VERIFY_PASSKEY_LABEL = 'Confirming your passkey';
const VERIFY_PASSKEY_HINT = 'Confirm the passkey that protects this wallet with your device.';

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

export interface SetupPlan { restore?: boolean; passkey?: PasskeyMode; profile?: boolean; history?: boolean }

export function stageLabel(stage: Stage, plan: SetupPlan): string {
  if (stage === 'wallet' && plan.restore === true) return RESTORE_WALLET_LABEL;
  if (stage === 'passkey' && plan.passkey === 'verify') return VERIFY_PASSKEY_LABEL;
  return STAGE_LABELS[stage];
}

export function setupStages(plan: SetupPlan): Stage[] {
  return [
    'wallet',
    ...(plan.passkey === undefined ? [] : ['passkey' as const]),
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

export function setupTitle(stage: Stage, err: SetupErr | null, plan: SetupPlan = {}): string {
  if (err === null) return stageLabel(stage, plan);
  if (err.retry !== 'passkey') return 'Setup needs another try';
  return plan.passkey === 'verify' ? 'Passkey not confirmed' : 'Passkey not added';
}

export function setupHint(stage: Stage, err: SetupErr | null, plan: SetupPlan = {}): string {
  if (err === null) return stage === 'passkey' && plan.passkey === 'verify' ? VERIFY_PASSKEY_HINT : STAGE_HINTS[stage];
  if (err.retry === 'messaging') return MESSAGING_RETRY_HINT;
  if (err.retry === 'passkey') {
    const next = plan.passkey === 'verify' ? 'confirm the passkey' : 'secure this wallet with a passkey';
    return `${err.message} Try again to ${next}, or start over.`;
  }
  return `We could not finish setting up. ${err.message}`;
}
