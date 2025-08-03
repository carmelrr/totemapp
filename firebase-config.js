import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDCClgfCWH9megeAsPydnR9MknrbSV2ToM",
  authDomain: "totemapp-464009.firebaseapp.com",
  projectId: "totemapp-464009",
  storageBucket: "totemapp-464009.firebasestorage.app",
  messagingSenderId: "720872675049",
  appId: "1:720872675049:web:410665ffdf49999f07c278",
  measurementId: "G-2T1NVDPG50"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with proper React Native persistence
let auth;
try {
  // Check if we're in React Native environment
  const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
  
  if (isReactNative) {
    // Import React Native specific modules dynamically
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const { getReactNativePersistence } = require('firebase/auth');
    
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } else {
    // For web or Node.js environments
    auth = getAuth(app);
  }
} catch (error) {
  console.warn('Auth initialization failed, using fallback:', error.message);
  // Fallback to default auth
  try {
    auth = getAuth(app);
  } catch (fallbackError) {
    console.error('Fallback auth initialization also failed:', fallbackError);
    throw fallbackError;
  }
}

const db = getFirestore(app);
const storage = getStorage(app);

// Don't initialize Analytics in React Native environment
const analytics = null;

export { auth, db, storage, analytics };
