import { AppState } from 'react-native';

export function isAppInFront(): boolean {
  return AppState.currentState === 'active';
}

export function subscribeAppInFront(onChange: () => void): () => void {
  const sub = AppState.addEventListener('change', onChange);
  return () => { sub.remove(); };
}
