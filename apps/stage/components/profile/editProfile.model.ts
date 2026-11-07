import type { ProfileText } from './profileText.model';

interface ProfileCurrent {
  displayName?: string;
  description?: string;
}

export function draftFrom(current: ProfileCurrent): ProfileText {
  return { displayName: current.displayName ?? '', description: current.description ?? '' };
}

export function changedFields(current: ProfileCurrent, draft: ProfileText): ProfileCurrent {
  const out: ProfileCurrent = {};
  const name = draft.displayName.trim();
  const about = draft.description.trim();
  if (name !== (current.displayName ?? '')) out.displayName = name;
  if (about !== (current.description ?? '')) out.description = about;
  return out;
}

export function hasChanges(current: ProfileCurrent, draft: ProfileText, imagePicked: boolean): boolean {
  return imagePicked || Object.keys(changedFields(current, draft)).length > 0;
}
