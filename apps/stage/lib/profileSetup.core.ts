import { PROFILE_TEXT_KEYS } from '@stage-labs/client/identity/onchainProfile';
import type { ProfileImage, ProfileProgress, ProfileSetup } from '@stage-labs/client/profile/setup';
import type { Hex } from 'viem';

export class ProfileNameTakenError extends Error {
  constructor() { super('That username was just taken. Edit your profile to choose another.'); this.name = 'ProfileNameTakenError'; }
}
export interface ProfileSetupDeps {
  upload: (image: ProfileImage) => Promise<string>;
  inspect: (label: string, records: Record<string, string>) => Promise<{ owned: boolean; ready: boolean }>;
  claim: (label: string) => Promise<unknown>;
  send: (label: string, records: Record<string, string>) => Promise<Hex>;
  confirm: (hash: Hex) => Promise<boolean>;
  assertCurrent: () => void;
}
type Checkpoint = (next: ProfileProgress) => Promise<void>;
function textRecords(profile: ProfileSetup, avatar: string | undefined): Record<string, string> {
  return {
    ...(profile.displayName === undefined ? {} : { [PROFILE_TEXT_KEYS.displayName]: profile.displayName }),
    ...(profile.description === undefined ? {} : { [PROFILE_TEXT_KEYS.description]: profile.description }),
    ...(avatar === undefined ? {} : { [PROFILE_TEXT_KEYS.avatar]: avatar }),
  };
}
function assertKnownSubmission(progress: ProfileProgress): void {
  if (progress.submitting === true && (progress.transactions ?? []).length === 0) throw new Error('A profile save may still be pending. Try again to check it. No second transaction will be sent.');
}
async function claimName(deps: ProfileSetupDeps, profile: ProfileSetup, records: Record<string, string>, progress: ProfileProgress, checkpoint: Checkpoint): Promise<void> {
  await checkpoint({ ...progress, claiming: true });
  try { await deps.claim(profile.label); } catch (e) {
    if (e instanceof ProfileNameTakenError) await checkpoint({ ...progress, claiming: false });
    throw e;
  }
  deps.assertCurrent();
  const inspected = await deps.inspect(profile.label, records);
  deps.assertCurrent();
  if (!inspected.owned) throw new Error('Your username is not confirmed yet. Try again to check it.');
}
async function confirmProfile(deps: ProfileSetupDeps, profile: ProfileSetup, records: Record<string, string>, progress: ProfileProgress, checkpoint: Checkpoint): Promise<void> {
  for (const hash of progress.transactions ?? []) {
    const success = await deps.confirm(hash);
    deps.assertCurrent();
    if (!success) {
      await checkpoint({ ...progress, submitting: false, transactions: [] });
      throw new Error('The profile transaction reverted. Try again to save your profile.');
    }
  }
  const verified = await deps.inspect(profile.label, records);
  deps.assertCurrent();
  if (!verified.ready) throw new Error('Your profile records are not confirmed yet. Try again to check them.');
}

export async function runProfileSetup(deps: ProfileSetupDeps, profile: ProfileSetup, initial: ProfileProgress, save: Checkpoint): Promise<void> {
  let progress = initial;
  const checkpoint: Checkpoint = async (next) => {
    deps.assertCurrent(); await save(next); deps.assertCurrent(); progress = next;
  };
  deps.assertCurrent();
  if (profile.image !== undefined && progress.avatar === undefined) await checkpoint({ ...progress, avatar: await deps.upload(profile.image) });
  const records = textRecords(profile, progress.avatar);
  const inspected = await deps.inspect(profile.label, records);
  deps.assertCurrent();
  if (inspected.ready) return;
  assertKnownSubmission(progress);
  if (!inspected.owned) await claimName(deps, profile, records, progress, checkpoint);
  if (progress.claimed !== true) await checkpoint({ ...progress, claiming: false, claimed: true });
  if ((progress.transactions ?? []).length === 0) {
    await checkpoint({ ...progress, submitting: true });
    const hash = await deps.send(profile.label, records);
    await checkpoint({ ...progress, transactions: [hash] });
  }
  await confirmProfile(deps, profile, records, progress, checkpoint);
}
