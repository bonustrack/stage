import type { Stage } from './flow';

export interface SetupErr { message: string; accountId?: string }

export type StageState = 'done' | 'active' | 'pending';

export const STAGE_LABELS: Record<Stage, string> = {
  wallet: 'Creating your wallet',
  messaging: 'Setting up secure messaging',
  history: 'Syncing your message history',
  finishing: 'Finishing up',
};

const STAGE_HINTS: Record<Stage, string> = {
  wallet: 'This only takes a moment.',
  messaging: 'Registering your encrypted inbox. This can take up to a minute on first launch.',
  history: 'Your other device is sending its messages. Open Stage there on this account and keep it in the foreground. You can skip and let it finish in the background.',
  finishing: 'Almost there.',
};

const EXPECTED_MS: Record<Stage, number> = {
  wallet: 4_000,
  messaging: 30_000,
  history: 120_000,
  finishing: 1_500,
};

const MESSAGING_RETRY_HINT =
  'Your wallet is ready, but secure messaging did not finish setting up. Try again. Your wallet and recovery phrase are safe.';

export function setupStages(withHistory: boolean): Stage[] {
  return withHistory
    ? ['wallet', 'messaging', 'history', 'finishing']
    : ['wallet', 'messaging', 'finishing'];
}

export function setupProgress(stage: Stage, stages: Stage[], elapsedMs: number): number {
  const index = stages.indexOf(stage);
  if (index < 0) return 0;
  const fraction = Math.min(1, Math.max(0, elapsedMs) / EXPECTED_MS[stage]);
  return Math.min(1, (index + 0.1 + 0.8 * fraction) / stages.length);
}

export function stageState(stage: Stage, current: Stage, stages: Stage[]): StageState {
  const position = stages.indexOf(stage);
  const currentPosition = stages.indexOf(current);
  if (position < currentPosition) return 'done';
  return position === currentPosition ? 'active' : 'pending';
}

export function setupTitle(stage: Stage, err: SetupErr | null): string {
  return err === null ? STAGE_LABELS[stage] : 'Setup needs another try';
}

export function setupHint(stage: Stage, err: SetupErr | null): string {
  if (err === null) return STAGE_HINTS[stage];
  return err.accountId !== undefined ? MESSAGING_RETRY_HINT : `We could not finish setting up. ${err.message}`;
}
