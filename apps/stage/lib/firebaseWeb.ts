import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

interface FirebaseWebConfig {
  apiKey: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidPublicKey: string;
}

const FIREBASE_WEB_CONFIG: FirebaseWebConfig = {
  apiKey: 'AIzaSyB4fgyCH8R6izxGcstYiWG9BUT81mIOzs0',
  projectId: 'metro-e47f6',
  messagingSenderId: '163881755635',
  appId: '1:163881755635:web:9fc29ae9da09f64c7da886',
  vapidPublicKey: 'BG18y5MY0MOeRCixSZYeGGxHRZJyREjfONqSenNxjiVGQCaLWWYJZa4qcpLkmjZrByPFAiUAEly5HXfW7xb0Va8',
};

const PUSH_SERVICE_WORKER_PATH = '/push-sw.js';

export async function firebasePushToken(): Promise<string> {
  if (!(await isSupported())) throw new Error('this browser does not support web push');
  const registration = await navigator.serviceWorker.register(PUSH_SERVICE_WORKER_PATH);
  await navigator.serviceWorker.ready;
  const app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_WEB_CONFIG);
  return getToken(getMessaging(app), {
    vapidKey: FIREBASE_WEB_CONFIG.vapidPublicKey, serviceWorkerRegistration: registration,
  });
}
