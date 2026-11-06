import type { ProfileText } from './profileText.model';

export type ProfileDraft = ProfileText;

export interface ProfileCurrent {
  displayName?: string;
  description?: string;
}

export function draftFrom(current: ProfileCurrent): ProfileDraft {
  return { displayName: current.displayName ?? '', description: current.description ?? '' };
}

export function changedFields(current: ProfileCurrent, draft: ProfileDraft): { displayName?: string; description?: string } {
  const out: { displayName?: string; description?: string } = {};
  const name = draft.displayName.trim();
  const about = draft.description.trim();
  if (name !== (current.displayName ?? '')) out.displayName = name;
  if (about !== (current.description ?? '')) out.description = about;
  return out;
}

export function hasChanges(current: ProfileCurrent, draft: ProfileDraft, imagePicked: boolean): boolean {
  return imagePicked || Object.keys(changedFields(current, draft)).length > 0;
}
