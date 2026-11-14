import type { Stage } from './flow';
import { WALLET_ENABLED } from '../../lib/features';

export type SetupRetry = 'restart' | 'messaging' | 'create';

export interface SetupErr {
  message: string;
  accountId?: string;
  retry: SetupRetry;
}

export type StageState = 'done' | 'active' | 'pending';

export type SetupLinkKind = 'startOver';

const STAGE_LABELS: Record<Exclude<Stage, 'wallet'>, string> = {
  messaging: 'Setting up secure messaging',
  profile: 'Saving your profile',
  history: 'Syncing your message history',
  finishing: 'Finishing up',
};

const SETUP_TITLE = { create: 'Creating your account', restore: 'Restoring your account' } as const;

function keyNoun(wallet: boolean): string {
  return wallet ? 'wallet' : 'account key';
}

export interface SetupPlan {
  restore?: boolean;
  profile?: boolean;
  history?: boolean;
}

export function stageLabel(stage: Stage, plan: SetupPlan, wallet = WALLET_ENABLED): string {
  if (stage !== 'wallet') return STAGE_LABELS[stage];
  return `${plan.restore === true ? 'Restoring' : 'Creating'} your ${keyNoun(wallet)}`;
}

export function setupStages(plan: SetupPlan): Stage[] {
  return [
    'wallet',
    'messaging',
    ...(plan.profile === true ? ['profile' as const] : []),
    ...(plan.history === true ? ['history' as const] : []),
    'finishing',
  ];
}

export function setupLinks(err: SetupErr | null): SetupLinkKind[] {
  if (err === null || err.retry !== 'restart') return [];
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
  return 'Setup needs another try';
}

export function setupHint(err: SetupErr | null, wallet = WALLET_ENABLED): string {
  const noun = wallet ? 'wallet' : 'account';
  if (err === null) return `This only takes a moment while your ${noun}, messaging and profile are set up.`;
  if (err.retry === 'messaging') {
    return `Your ${noun} is ready, but secure messaging did not finish setting up. Try again. Your ${noun} and recovery phrase are safe.`;
  }
  if (err.retry === 'create') return `${err.message} Try again to continue the same setup. A saved ${noun} will not be replaced.`;
  return `We could not finish setting up. ${err.message}`;
}
