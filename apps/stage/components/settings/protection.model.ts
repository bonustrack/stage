export type ProtectionStepId = 'phrase' | 'key';

export interface ProtectionStep {
  id: ProtectionStepId;
  label: string;
  done: boolean;
  doneText: string;
  action: string;
}

export interface ProtectionInput {
  isSmart: boolean;
  backedUp: boolean | null;
  canExportKey: boolean;
}

export function protectionSteps(input: ProtectionInput): ProtectionStep[] {
  if (!input.isSmart) {
    return input.canExportKey
      ? [{ id: 'key', label: 'Private key saved', done: false, doneText: 'Saved', action: 'Export' }]
      : [];
  }
  return [
    { id: 'phrase', label: 'Recovery phrase backed up', done: input.backedUp === true, doneText: 'Done', action: 'Back up' },
  ];
}

export function protectionTitle(steps: readonly ProtectionStep[]): string {
  const done = steps.filter((s) => s.done).length;
  if (steps.length === 0) return 'Your account';
  if (done === steps.length) return 'Your account is protected';
  return `${done} of ${steps.length} steps to protect your account`;
}
