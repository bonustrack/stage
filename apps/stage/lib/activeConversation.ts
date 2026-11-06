import { AppState } from 'react-native';
import { setActiveConversation as setNativeActiveConversation } from '../modules/stage-pill';
import { setActiveConvId } from './xmtp.state.core';

function setActiveConversation(convId: string | null): void {
  setNativeActiveConversation(convId);
  setActiveConvId(convId);
}

export function showConversation(convId: string): () => void {
  const id = convId.toLowerCase();
  setActiveConversation(id);
  const sub = AppState.addEventListener('change', (state) => {
    setActiveConversation(state === 'active' ? id : null);
  });
  return () => {
    sub.remove();
    setActiveConversation(null);
  };
}
