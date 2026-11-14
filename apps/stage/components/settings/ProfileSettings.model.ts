import type { OnchainProfileSource } from '@stage-labs/client/identity/onchainProfile';
import { WALLET_ENABLED } from '../../lib/features';

export interface ProfileState {
  address: string | null;
  name?: string;
  source?: OnchainProfileSource;
}

export interface ProfileView {
  title: string;
  explanation: string;
  canChangePicture: boolean;
  claimVisible: boolean;
}

export function profileView(state: ProfileState, wallet = WALLET_ENABLED): ProfileView {
  if (!state.address) {
    return { title: '', explanation: 'No active account.', canChangePicture: false, claimVisible: false };
  }
  if (state.source === 'basename' && state.name) {
    const stageName = state.name.toLowerCase().endsWith('.stage.base.eth');
    return {
      title: state.name,
      explanation: stageName
        ? `Your Stage username. Anyone who messages you sees it and your picture, in Stage${wallet ? ' and in other Base apps' : ''}.`
        : 'Your name and picture come from your Basename on Base. Anyone who messages you sees them, in Stage and in other apps.',
      canChangePicture: true,
      claimVisible: false,
    };
  }
  return { title: state.name ?? '', explanation: '', canChangePicture: false, claimVisible: true };
}
