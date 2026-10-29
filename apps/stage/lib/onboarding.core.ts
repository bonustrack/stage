import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { errorMessage } from '@stage-labs/client/errors';
import {
  parsePendingSetup,
  samePreparedAccount,
  type PendingSetup,
  type ProfileProgress,
  type ProfileSetup,
} from '@stage-labs/client/profile/setup';
import { ignored } from './errorPolicy';

export class AccountSetupError extends Error {
  constructor(
    readonly stage: PendingSetup['stage'],
    readonly accountId: string | undefined,
    cause: unknown,
  ) {
    super(errorMessage(cause));
    this.name = 'AccountSetupError';
  }
}

export interface OnboardingDeps {
  read: () => Promise<PendingSetup | null>;
  write: (pending: PendingSetup) => Promise<void>;
  clear: () => Promise<void>;
  preserveImage: (profile: ProfileSetup) => Promise<ProfileSetup>;
  create: (onPrepared: (account: AccountRecord) => Promise<void>) => Promise<AccountRecord>;
  resume: (account: NonNullable<PendingSetup['account']>) => Promise<AccountRecord>;
  messaging: (accountId: string) => Promise<void>;
  profile: (
    account: AccountRecord,
    profile: ProfileSetup,
    progress: ProfileProgress,
    checkpoint: (progress: ProfileProgress) => Promise<void>,
  ) => Promise<void>;
}

interface Attempt {
  started: boolean;
  requested?: ProfileSetup;
  pending: PendingSetup | null;
  stored?: PendingSetup | null;
  unconfirmed?: boolean;
}
function setupFailure(attempt: Attempt, cause: unknown): AccountSetupError {
  return new AccountSetupError(attempt.pending?.stage ?? 'wallet', attempt.pending?.account?.id, cause);
}
export interface EditableProfile {
  profile: ProfileSetup;
  labelLocked: boolean;
}

function assertBoundAccount(attempt: Attempt, pending: PendingSetup | null): void {
  if (attempt.pending?.account !== undefined && pending?.account?.id !== attempt.pending.account.id)
    throw new Error('The saved setup changed. Nothing else was changed.');
}

async function readAttempt(deps: OnboardingDeps, attempt: Attempt): Promise<PendingSetup | null> {
  const raw = await deps.read();
  const stored = raw === null ? null : parsePendingSetup(JSON.stringify(raw));
  if (attempt.unconfirmed && JSON.stringify(stored) !== JSON.stringify(attempt.pending)) {
    if (JSON.stringify(stored) === JSON.stringify(attempt.stored ?? null)) return attempt.pending;
    throw new Error('The saved setup changed. Nothing else was changed.');
  }
  const pending = stored ?? attempt.pending;
  assertBoundAccount(attempt, pending);
  attempt.stored = stored;
  attempt.unconfirmed = false;
  return pending;
}

async function persist(deps: OnboardingDeps, attempt: Attempt, pending: PendingSetup): Promise<void> {
  const validated = parsePendingSetup(JSON.stringify(pending));
  attempt.pending = validated;
  attempt.unconfirmed = true;
  await deps.write(validated);
  attempt.stored = validated;
  attempt.unconfirmed = false;
}

type StageChange = (stage: PendingSetup['stage']) => void;
async function prepareAttempt(deps: OnboardingDeps, attempt: Attempt, resuming: boolean): Promise<PendingSetup> {
  let pending = await readAttempt(deps, attempt);
  if (pending === null) {
    if (resuming && !attempt.started) throw new Error('No saved setup was found. Return to account setup to continue.');
    const profile = attempt.requested === undefined ? undefined : await deps.preserveImage(attempt.requested);
    pending = { version: 1, stage: 'wallet', ...(profile === undefined ? {} : { profile }) };
  }
  await persist(deps, attempt, pending);
  return pending;
}
async function openPreparedAccount(deps: OnboardingDeps, attempt: Attempt, pending: PendingSetup): Promise<AccountRecord> {
  if (pending.account !== undefined) return deps.resume(pending.account);
  return deps.create(async (account) => {
    await persist(deps, attempt, parsePendingSetup(JSON.stringify({ ...pending, account })));
  });
}
async function saveRequestedProfile(
  deps: OnboardingDeps,
  attempt: Attempt,
  pending: PendingSetup,
  record: AccountRecord,
  onStage?: StageChange,
): Promise<void> {
  const profile = pending.profile;
  if (profile === undefined) return;
  let state: PendingSetup = { ...pending, stage: 'profile' };
  onStage?.('profile');
  await persist(deps, attempt, state);
  await deps.profile(record, profile, state.progress ?? {}, async (progress) => {
    state = { ...state, progress };
    await persist(deps, attempt, state);
  });
}
async function continueSetup(deps: OnboardingDeps, attempt: Attempt, resuming: boolean, onStage?: StageChange): Promise<void> {
  try {
    const pending = await prepareAttempt(deps, attempt, resuming);
    onStage?.('wallet');
    const record = await openPreparedAccount(deps, attempt, pending);
    const state = attempt.pending;
    if (state === null || state.account === undefined || !samePreparedAccount(state.account, record))
      throw new Error('The prepared wallet was not saved. Nothing else was changed.');
    onStage?.('messaging');
    await persist(deps, attempt, { ...state, stage: 'messaging' });
    await deps.messaging(record.id);
    await saveRequestedProfile(deps, attempt, state, record, onStage);
    await deps.clear();
    attempt.started = false;
    attempt.requested = undefined;
    attempt.pending = null;
    attempt.stored = null;
    attempt.unconfirmed = false;
  } catch (e) {
    throw setupFailure(attempt, e);
  }
}

async function editableProfile(deps: OnboardingDeps, attempt: Attempt): Promise<EditableProfile> {
  const pending = await readAttempt(deps, attempt);
  const progress = pending?.progress ?? {};
  if (progress.submitting === true || (progress.transactions ?? []).length > 0)
    throw new Error('Check the pending profile save before changing your profile.');
  const profile = pending?.profile ?? attempt.requested;
  if (profile === undefined) throw new Error('No requested profile was found. Try again to check the saved setup.');
  return { profile, labelLocked: progress.claiming === true || progress.claimed === true };
}

async function editProfile(deps: OnboardingDeps, attempt: Attempt, profile: ProfileSetup): Promise<void> {
  const previous = await editableProfile(deps, attempt);
  if (previous.labelLocked && previous.profile.label !== profile.label)
    throw new Error('Continue with the username already being registered for this wallet.');
  const pending = (await readAttempt(deps, attempt)) ?? { version: 1, stage: 'wallet' };
  const preserved = await deps.preserveImage(profile);
  const { avatar, ...progress } = pending.progress ?? {};
  const sameImage = previous.profile.image?.uri === preserved.image?.uri;
  const next = {
    ...pending,
    profile: preserved,
    ...(pending.account === undefined ? {} : { progress: { ...progress, ...(sameImage && avatar !== undefined ? { avatar } : {}) } }),
  };
  await persist(deps, attempt, next);
  attempt.requested = preserved;
  attempt.started = true;
}

export function makeOnboarding(deps: OnboardingDeps): {
  run: (profile?: ProfileSetup, onStage?: (stage: PendingSetup['stage']) => void) => Promise<void>;
  resume: (onStage?: (stage: PendingSetup['stage']) => void) => Promise<void>;
  editableProfile: () => Promise<EditableProfile>;
  editProfile: (profile: ProfileSetup) => Promise<void>;
} {
  let inFlight: Promise<void> | null = null;
  const attempt: Attempt = { started: false, pending: null };
  const start = (resuming: boolean, onStage?: (stage: PendingSetup['stage']) => void): Promise<void> => {
    if (inFlight) return inFlight;
    const pending = continueSetup(deps, attempt, resuming, onStage);
    inFlight = pending;
    void pending
      .finally(() => {
        if (inFlight === pending) inFlight = null;
      })
      .catch(ignored(undefined, 'cleanup'));
    return pending;
  };
  return {
    run: (profile, onStage) => {
      if (!inFlight) {
        attempt.requested = profile;
        attempt.started = true;
      }
      return start(false, onStage);
    },
    resume: (onStage) => start(true, onStage),
    editableProfile: () => editableProfile(deps, attempt),
    editProfile: async (profile) => {
      try {
        if (inFlight) throw new Error('Wait for the current setup to finish before editing.');
        await editProfile(deps, attempt, profile);
      } catch (e) {
        throw setupFailure(attempt, e);
      }
    },
  };
}
