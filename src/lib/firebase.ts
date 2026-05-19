import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const isPlaceholder = !firebaseConfig || firebaseConfig.projectId === 'placeholder' || !firebaseConfig.apiKey || firebaseConfig.apiKey === 'placeholder';

let app;
if (!isPlaceholder) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  } catch (e) {
    console.error("Firebase initialization failed:", e);
  }
}

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)') : null;
export { isPlaceholder };

// Drive OAuth Provider
export const driveProvider = new GoogleAuthProvider();
driveProvider.addScope('https://www.googleapis.com/auth/drive.file');
driveProvider.addScope('https://www.googleapis.com/auth/drive.readonly');

// Access token caching
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const getAccessToken = () => cachedAccessToken;

export const loginWithGoogleDrive = async () => {
  if (!auth) throw new Error('Firebase Auth ignored (no app)');
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, driveProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    return result;
  } catch (error) {
    console.error('Drive Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Listen for auth state changes to clear cached token
if (auth) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedAccessToken = null;
    }
  });
}
