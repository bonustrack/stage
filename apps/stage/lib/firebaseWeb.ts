export const FIREBASE_WEB_CONFIG = {
  apiKey: '',
  projectId: 'metro-e47f6',
  messagingSenderId: '163881755635',
  appId: '',
};

export const VAPID_PUBLIC_KEY = '';

export function firebaseWebConfigured(): boolean {
  return FIREBASE_WEB_CONFIG.apiKey !== '' && FIREBASE_WEB_CONFIG.appId !== '' && VAPID_PUBLIC_KEY !== '';
}
