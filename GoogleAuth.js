// GoogleAuth.js
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useEffect } from 'react';
import { Button } from 'react-native';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth } from './firebase-config';

// מאפשר ל-WebBrowser לסיים אוטומטית את ה-Auth Session (סגירת החלון) לאחר ההפניה חזרה:
WebBrowser.maybeCompleteAuthSession();

export default function GoogleLoginButton() {
  // יצירת בקשת OAuth באמצעות ה-Hook של expo-auth-session
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: '720872675049-lpr4j4qvprtk8g19l36tr5qla8ebs33l.apps.googleusercontent.com',
    iosClientId: '720872675049-e0du1dtbe53puak85sr4da6c8i0gjhak.apps.googleusercontent.com',
    androidClientId: '720872675049-ubhok243tvh36cut4ptchnubsckulj04.apps.googleusercontent.com',
    scopes: ['openid', 'email', 'profile'],
    responseType: 'id_token'
  });

  // אפקט: יופעל ברגע שיש תגובה (response) מניסיון ההתחברות
  useEffect(() => {
    if (response?.type === 'success') {
      // שליפת ה-ID token מתוך הפרמטרים שהתקבלו
      const { id_token } = response.params;
      // יצירת אישור קרדנציאל של Firebase מתוך ה-ID token של Google
      const credential = GoogleAuthProvider.credential(id_token);
      // התחברות המשתמש ל-Firebase באמצעות הקרדנציאל
      signInWithCredential(auth, credential)
        .catch((error) => {
          console.log('Firebase sign-in error:', error);
        });
    }
  }, [response]);

  // רינדור כפתור התחברות (מנוטרל אם הבקשה עדיין נטענת)
  return (
    <Button
      title="Sign in with Google"
      disabled={!request}
      onPress={() => promptAsync()}
    />
  );
}
