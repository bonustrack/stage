interface FirebaseWebConfig {
  apiKey: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidPublicKey: string;
}

export const FIREBASE_WEB_CONFIG: FirebaseWebConfig = {
  apiKey: 'AIzaSyB4fgyCH8R6izxGcstYiWG9BUT81mIOzs0',
  projectId: 'metro-e47f6',
  messagingSenderId: '163881755635',
  appId: '1:163881755635:web:9fc29ae9da09f64c7da886',
  vapidPublicKey: 'BG18y5MY0MOeRCixSZYeGGxHRZJyREjfONqSenNxjiVGQCaLWWYJZa4qcpLkmjZrByPFAiUAEly5HXfW7xb0Va8',
};

export function firebaseWebConfigured(): boolean {
  return Object.values(FIREBASE_WEB_CONFIG).every((value) => value !== '');
}
