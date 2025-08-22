// קובץ בדיקת חיבור Firebase
// הפעל את זה כדי לוודא שהחיבור לפרויקט החדש עובד

import { auth, db, storage } from './firebase-config.js';
import { signInAnonymously } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

async function testFirebaseConnection() {
  console.log('🔄 בודק חיבור Firebase...');
  
  try {
    // בדיקת חיבור Authentication
    console.log('📝 בודק Authentication...');
    const userCredential = await signInAnonymously(auth);
    console.log('✅ Authentication עובד! User:', userCredential.user.uid);
    
    // בדיקת חיבור Firestore
    console.log('📝 בודק Firestore...');
    const testDoc = doc(db, 'test', 'connection');
    await setDoc(testDoc, {
      message: 'Firebase connection test',
      timestamp: new Date(),
      projectId: 'totemapp-464009'
    });
    
    const docSnap = await getDoc(testDoc);
    if (docSnap.exists()) {
      console.log('✅ Firestore עובד!', docSnap.data());
    }
    
    // בדיקת חיבור Storage
    console.log('📝 בודק Storage...');
    const testText = 'Test file content';
    const testBlob = new Blob([testText], { type: 'text/plain' });
    const storageRef = ref(storage, 'test/connection-test.txt');
    
    await uploadBytes(storageRef, testBlob);
    const downloadURL = await getDownloadURL(storageRef);
    console.log('✅ Storage עובד! URL:', downloadURL);
    
    console.log('🎉 כל השירותים עובדים בהצלחה!');
    console.log('Project ID:', 'totemapp-464009');
    console.log('האפליקציה מוכנה לשימוש');
    
  } catch (error) {
    console.error('❌ שגיאה בבדיקת החיבור:', error);
    console.log('💡 ודא ש:');
    console.log('   1. הקונפיגורציה נכונה');
    console.log('   2. חוקי Firestore ו-Storage מעודכנים');
    console.log('   3. השירותים מופעלים ב-Firebase Console');
  }
}

// הפעל בדיקה
if (typeof window !== 'undefined') {
  // בדפדפן
  testFirebaseConnection();
} else {
  // ב-Node.js
  console.log('השתמש בקוד זה בדפדפן או ב-React Native');
}

export { testFirebaseConnection };
