import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// Replace these values with your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyD5DWRFHyVtj6IlP92DKd3TZgO_si6SMDA",
  authDomain: "totemapp-f1774.firebaseapp.com",
  projectId: "totemapp-f1774",
  storageBucket: "totemapp-f1774.firebasestorage.app",
  messagingSenderId: "576792302412",
  appId: "1:576792302412:web:c25024acf86b1e498bf5e9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth: use initializeAuth *once* per app
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

const db = getFirestore(app);

export { auth, db };
