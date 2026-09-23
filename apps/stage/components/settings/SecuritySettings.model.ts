export type SecurityRowKey =
  | 'backupPhrase'
  | 'enablePasskey'
  | 'passkeyLink'
  | 'recoveryKey'
  | 'removePasskey'
  | 'exportKey'
  | 'linkDevice'
  | 'removeAccount';

export interface SecurityRowsInput {
  isSmart: boolean;
  backedUp: boolean | null;
  enablePasskey: boolean;
  removePasskey: boolean;
  canExportKey: boolean;
  keyRevealed: boolean;
  canLinkDevice: boolean;
}

export type PasskeyActionKind = 'enable' | 'remove';

export const BACKUP_PHRASE_COPY = {
  label: 'Back up recovery phrase',
  description: 'Back up your recovery phrase so you can recover this wallet if you lose your device. You can do this anytime.',
  revealed: 'Write these words down in order and keep them somewhere safe. Anyone with this phrase controls your wallet.',
  saved: 'Recovery phrase backed up',
  missing: 'No recovery phrase on this device.',
  unreadable: 'Could not read recovery phrase',
} as const;

export function securityRows(input: SecurityRowsInput): SecurityRowKey[] {
  const rows: SecurityRowKey[] = [];
  if (input.isSmart && input.backedUp === false) rows.push('backupPhrase');
  if (input.enablePasskey) rows.push('enablePasskey');
  if (input.isSmart) rows.push('passkeyLink', 'recoveryKey');
  if (input.removePasskey) rows.push('removePasskey');
  if (input.canExportKey && !input.keyRevealed) rows.push('exportKey');
  if (input.canLinkDevice) rows.push('linkDevice');
  rows.push('removeAccount');
  return rows;
}

export function passkeyActionLabel(kind: PasskeyActionKind, busy: boolean): string {
  if (kind === 'enable') return busy ? 'Enabling passkey…' : 'Enable passkey for signing';
  return busy ? 'Removing passkey…' : 'Remove passkey';
}
