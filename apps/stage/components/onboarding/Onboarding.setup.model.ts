import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';
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

const SETUP_TITLE = { create: 'Creating your account', restore: 'Restoring your account', signIn: 'Signing you in' } as const;

function keyNoun(wallet: boolean): string {
  return wallet ? 'wallet' : 'account key';
}

export interface SetupPlan {
  restore?: boolean;
  profile?: boolean;
  history?: boolean;
  signIn?: PrivyLoginMethod;
}

const SIGN_IN_LABELS: Record<PrivyLoginMethod, string> = {
  google: 'Signing in with Google',
  microsoft: 'Signing in with Microsoft',
  github: 'Signing in with GitHub',
  wallet: 'Connecting your wallet',
};

export function stageLabel(stage: Stage, plan: SetupPlan, wallet = WALLET_ENABLED): string {
  if (stage !== 'wallet') return STAGE_LABELS[stage];
  if (plan.signIn !== undefined) return SIGN_IN_LABELS[plan.signIn];
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
  if (err !== null) return 'Setup needs another try';
  if (plan.signIn !== undefined) return SETUP_TITLE.signIn;
  return plan.restore === true ? SETUP_TITLE.restore : SETUP_TITLE.create;
}

const SIGN_IN_HINT = 'This only takes a moment while your account and messaging are set up.';
const WALLET_SIGN_IN_HINT = 'Approve the requests in your wallet. Stage asks for a few signatures to set up messaging on this device.';

function progressHint(plan: SetupPlan, noun: string): string {
  if (plan.signIn === undefined) return `This only takes a moment while your ${noun}, messaging and profile are set up.`;
  return plan.signIn === 'wallet' ? WALLET_SIGN_IN_HINT : SIGN_IN_HINT;
}

export function setupHint(err: SetupErr | null, wallet = WALLET_ENABLED, plan: SetupPlan = {}): string {
  const noun = wallet ? 'wallet' : 'account';
  if (err === null) return progressHint(plan, noun);
  if (err.retry === 'messaging' && plan.signIn !== undefined) {
    return 'You are signed in, but secure messaging did not finish setting up. Try again.';
  }
  if (err.retry === 'messaging') {
    return `Your ${noun} is ready, but secure messaging did not finish setting up. Try again. Your ${noun} and recovery phrase are safe.`;
  }
  if (err.retry === 'create') return `${err.message} Try again to continue the same setup. A saved ${noun} will not be replaced.`;
  return `We could not finish setting up. ${err.message}`;
}
