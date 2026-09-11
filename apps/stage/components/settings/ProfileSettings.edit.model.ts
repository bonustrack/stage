export const DISPLAY_NAME_MAX = 64;
export const DESCRIPTION_MAX = 280;

export interface ProfileDraft { displayName: string; description: string }

export interface ProfileCurrent { displayName?: string; description?: string }

export function draftFrom(current: ProfileCurrent): ProfileDraft {
  return { displayName: current.displayName ?? '', description: current.description ?? '' };
}

export function draftProblem(draft: ProfileDraft): string | null {
  if (draft.displayName.trim().length > DISPLAY_NAME_MAX) return `Name is limited to ${DISPLAY_NAME_MAX} characters.`;
  if (draft.description.trim().length > DESCRIPTION_MAX) return `About is limited to ${DESCRIPTION_MAX} characters.`;
  if (/[\r\n]/.test(draft.displayName)) return 'Name cannot span several lines.';
  return null;
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
