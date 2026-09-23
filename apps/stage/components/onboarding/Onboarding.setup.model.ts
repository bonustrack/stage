import type { Stage } from './flow';

export type SetupRetry = 'restart' | 'messaging' | 'passkey';

export interface SetupErr { message: string; accountId?: string; retry: SetupRetry }

export type StageState = 'done' | 'active' | 'pending';

export type SetupLinkKind = 'skipPasskey' | 'startOver';

const STAGE_LABELS: Record<Stage, string> = {
  wallet: 'Creating your wallet',
  passkey: 'Adding your passkey',
  messaging: 'Setting up secure messaging',
  profile: 'Saving your profile',
  history: 'Syncing your message history',
  finishing: 'Finishing up',
};

const RESTORE_WALLET_LABEL = 'Restoring your wallet';


const SETUP_TITLE = { create: 'Creating your account', restore: 'Restoring your account' } as const;
const SETUP_HINT = 'This only takes a moment while your wallet, messaging and profile are set up.';

const MESSAGING_RETRY_HINT =
  'Your wallet is ready, but secure messaging did not finish setting up. Try again. Your wallet and recovery phrase are safe.';

export interface SetupPlan { restore?: boolean; passkey?: 'add'; profile?: boolean; history?: boolean }

export function stageLabel(stage: Stage, plan: SetupPlan): string {
  if (stage === 'wallet' && plan.restore === true) return RESTORE_WALLET_LABEL;
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

export function setupLinks(err: SetupErr | null): SetupLinkKind[] {
  if (err === null || err.retry === 'messaging') return [];
  if (err.retry === 'passkey' && err.accountId !== undefined) return ['skipPasskey', 'startOver'];
  return ['startOver'];
}

export function stageState(stage: Stage, current: Stage, stages: Stage[]): StageState {
  const position = stages.indexOf(stage);
  const currentPosition = stages.indexOf(current);
  if (position < currentPosition) return 'done';
  return position === currentPosition ? 'active' : 'pending';
}

export function setupTitle(err: SetupErr | null, plan: SetupPlan = {}): string {
  if (err === null) return plan.restore === true ? SETUP_TITLE.restore : SETUP_TITLE.create;
  return err.retry === 'passkey' ? 'Passkey not added' : 'Setup needs another try';
}

export function setupHint(err: SetupErr | null): string {
  if (err === null) return SETUP_HINT;
  if (err.retry === 'messaging') return MESSAGING_RETRY_HINT;
  if (err.retry === 'passkey') {
    return `${err.message} Try again, continue without a passkey (you can enable one later in Settings, Security), or start over.`;
  }
  return `We could not finish setting up. ${err.message}`;
}
