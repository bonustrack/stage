export interface LegalSection {
  heading: string;
  paragraphs: readonly string[];
}

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: readonly LegalSection[];
}

export const LEGAL_ENTITY = 'Stage Labs';

export const LEGAL_CONTACT = 'admin@stage.box';

export const TERMS_URL = 'https://stage.box/terms';

export const PRIVACY_URL = 'https://stage.box/privacy';

export const TERMS_ROUTE = '/terms';

export const PRIVACY_ROUTE = '/privacy';

export const DELETION_ROUTE = '/delete-account';

export const TERMS_NOTICE = {
  lead: 'By continuing, you agree to the ',
  terms: 'Terms of Use',
  middle: ' and ',
  privacy: 'Privacy Policy',
  tail: '.',
} as const;

export function updatedLabel(doc: LegalDoc): string {
  return `Last updated ${doc.updated}`;
}

export function legalPlainText(doc: LegalDoc): string {
  return [doc.title, updatedLabel(doc), doc.intro, ...doc.sections.flatMap((s) => [s.heading, ...s.paragraphs])].join('\n\n');
}
