import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getAuth, initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

let firebaseApp;
let auth;
let db;

if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);

  auth = initializeAuth(firebaseApp, {
    persistence: indexedDBLocalPersistence
  });

  db = initializeFirestore(firebaseApp, {
    experimentalForceLongPolling: true,
    cacheSizeBytes: 1048576
  });
} else {
  firebaseApp = getApps()[0];
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
}

export { firebaseApp, auth, db, firebaseConfig };
