import type { OnchainProfileSource } from '@stage-labs/client/identity/onchainProfile';

export interface ProfileState {
  address: string | null;
  name?: string;
  source?: OnchainProfileSource;
}

export interface ProfileView {
  title: string;
  explanation: string;
  canChangePicture: boolean;
  manageLabel: string | null;
  claimVisible: boolean;
}

export function profileView(state: ProfileState): ProfileView {
  if (!state.address) {
    return { title: '', explanation: 'No active account.', canChangePicture: false, manageLabel: null, claimVisible: false };
  }
  if (state.source === 'basename' && state.name) {
    return {
      title: state.name,
      explanation: 'Your name and picture come from your Basename on Base. Anyone who messages you sees them, in Stage and in other apps.',
      canChangePicture: true,
      manageLabel: 'Manage on base.org',
      claimVisible: false,
    };
  }
  return {
    title: state.name ?? '',
    explanation: 'Stage shows names and pictures from Basenames. Claim one with this wallet, set it as primary, and it appears here and for everyone you chat with.',
    canChangePicture: false,
    manageLabel: null,
    claimVisible: true,
  };
}
