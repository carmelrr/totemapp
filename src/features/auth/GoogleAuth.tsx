import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase-config';
import Constants from 'expo-constants';

export default function GoogleLoginButton() {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: Constants.expoConfig.extra.expoClientId,
    iosClientId: Constants.expoConfig.extra.iosClientId,
    androidClientId: Constants.expoConfig.extra.androidClientId,
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      
      signInWithCredential(auth, credential)
        .then((result) => {
          Alert.alert('הצלחה', `ברוך הבא ${result.user.displayName}!`);
        })
        .catch((error) => {
          Alert.alert('שגיאה', 'נכשל בהתחברות: ' + error.message);
        });
    } else if (response?.type === 'error') {
      Alert.alert('שגיאה', 'נכשל בהתחברות Google');
    }
  }, [response]);

  const handleGoogleLogin = async () => {
    try {
      await promptAsync();
    } catch (error) {
      Alert.alert('שגיאה', 'נכשל בפתיחת Google Login: ' + error.message);
    }
  };

  return (
    <TouchableOpacity 
      style={styles.googleButton} 
      onPress={handleGoogleLogin}
      disabled={!request}
    >
      <Text style={styles.googleButtonText}>🚀 התחברות עם Google</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  googleButton: {
    backgroundColor: '#db4437',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  googleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
    textAlign: 'right',
  },
});