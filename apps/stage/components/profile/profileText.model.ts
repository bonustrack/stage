const DISPLAY_NAME_MAX = 64;
const DESCRIPTION_MAX = 280;

export interface ProfileText {
  displayName: string;
  description: string;
}

export function profileTextProblem(text: ProfileText): string | null {
  if (text.displayName.trim().length > DISPLAY_NAME_MAX) return `Name is limited to ${DISPLAY_NAME_MAX} characters.`;
  if (/[\r\n]/.test(text.displayName)) return 'Name cannot span several lines.';
  if (text.description.trim().length > DESCRIPTION_MAX) return `About is limited to ${DESCRIPTION_MAX} characters.`;
  return null;
}
