// screens/HomeScreen.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 30,
    textAlign: 'right',
  },
  button: {
    backgroundColor: theme.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    marginBottom: 16,
    width: 220,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'right',
  },
});

export default function HomeScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ברוך הבא לאפליקציית הטיפוס 🧗‍♀️</Text>
      
      <TouchableOpacity style={[styles.button, { backgroundColor: theme.buttonPrimary }]} onPress={() => navigation.navigate('WallMapScreen')}>
        <Text style={styles.buttonText}>מפת הקיר 🧗</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, { backgroundColor: theme.buttonSecondary }]} onPress={() => navigation.navigate('ProfileScreen')}>
        <Text style={styles.buttonText}>הפרופיל שלי 👤</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, { backgroundColor: theme.buttonTertiary }]} onPress={() => navigation.navigate('LeaderboardScreen')}>
        <Text style={styles.buttonText}>לוחות מובילים 🏆</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, { backgroundColor: '#E91E63' }]} onPress={() => navigation.navigate('SprayWallScreen')}>
        <Text style={styles.buttonText}>ספריי וול 🎯</Text>
      </TouchableOpacity>
    </View>
  );
}

