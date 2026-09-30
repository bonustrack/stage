export type SecurityRowKey = 'backupPhrase' | 'showPhrase' | 'exportKey';

export interface SecurityRowsInput {
  isSmart: boolean;
  backedUp: boolean | null;
  canExportKey: boolean;
  keyRevealed: boolean;
}

export const BACKUP_PHRASE_COPY = {
  label: 'Back up recovery phrase',
  description: 'Back up your recovery phrase so you can recover this wallet if you lose your device. You can do this anytime.',
  revealed: 'Write these words down in order and keep them somewhere safe. Anyone with this phrase controls your wallet.',
  saved: 'Recovery phrase backed up',
  missing: 'No recovery phrase on this device.',
  unreadable: 'Could not read recovery phrase',
} as const;

export const SHOW_PHRASE_COPY = {
  label: 'Show recovery phrase',
  description: 'View the words that restore this wallet.',
  revealed: 'Anyone with this phrase controls your wallet. It hides again after a minute.',
  confirmTitle: 'Show recovery phrase?',
  confirmMessage: 'Anyone who sees it controls your wallet. Make sure nobody is watching your screen.',
  confirmLabel: 'Show',
} as const;

export type PhraseRowMode = 'backup' | 'show';

export type PhrasePanelAction = 'hide' | 'saved';

export const SHOWN_PHRASE_TIMEOUT_MS = 60_000;

export function phraseRowCopy(mode: PhraseRowMode): { label: string; description: string; revealed: string } {
  return mode === 'backup' ? BACKUP_PHRASE_COPY : SHOW_PHRASE_COPY;
}

export function phrasePanelActions(mode: PhraseRowMode): PhrasePanelAction[] {
  return mode === 'backup' ? ['hide', 'saved'] : ['hide'];
}

export function securityRows(input: SecurityRowsInput): SecurityRowKey[] {
  const rows: SecurityRowKey[] = [];
  if (input.isSmart && input.backedUp === false) rows.push('backupPhrase');
  if (input.isSmart && input.backedUp === true) rows.push('showPhrase');
  if (input.canExportKey && !input.keyRevealed) rows.push('exportKey');
  return rows;
}
