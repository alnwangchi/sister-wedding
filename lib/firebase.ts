import { getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDMpEzsxzTeupB6ej_hJm8yoCtRhF4tzK8',
  authDomain: 'sister-wedding-ee2cf.firebaseapp.com',
  projectId: 'sister-wedding-ee2cf',
  storageBucket: 'sister-wedding-ee2cf.firebasestorage.app',
  messagingSenderId: '429201602855',
  appId: '1:429201602855:web:2e8436a6ca97117b7b5102',
};

export function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every(Boolean);
}

export function getFirebaseDb() {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase 環境變數尚未設定完成。');
  }

  const app = getApps()[0] ?? initializeApp(firebaseConfig);

  return getFirestore(app);
}
