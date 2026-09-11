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
    const stageName = state.name.toLowerCase().endsWith('.stage.base.eth');
    return {
      title: state.name,
      explanation: stageName
        ? 'Your free Stage name. Anyone who messages you sees it and your picture, in Stage and in other Base apps.'
        : 'Your name and picture come from your Basename on Base. Anyone who messages you sees them, in Stage and in other apps.',
      canChangePicture: true,
      manageLabel: stageName ? null : 'Manage on base.org',
      claimVisible: false,
    };
  }
  return {
    title: state.name ?? '',
    explanation: 'Claim a free Stage name below, or use a Basename you already own by setting it as primary on base.org.',
    canChangePicture: false,
    manageLabel: null,
    claimVisible: true,
  };
}
