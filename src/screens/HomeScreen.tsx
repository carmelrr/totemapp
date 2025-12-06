// screens/HomeScreen.js
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/features/theme/ThemeContext";

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
      backgroundColor: theme.background,
    },
    title: {
      fontSize: 26,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 30,
      textAlign: "right",
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
      color: "#fff",
      fontSize: 18,
      textAlign: "right",
    },
  });

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const handleNavigation = (screenName) => {
    console.log(`🖱️ Navigating to: ${screenName}`);
    try {
      navigation.navigate(screenName);
    } catch (error) {
      console.error(`❌ Navigation error: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ברוך הבא לאפליקציית הטיפוס 🧗‍♀️</Text>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#22c55e" }]}
        onPress={() => handleNavigation("RoutesMap")}
        activeOpacity={0.7}
        delayPressIn={0}
        delayPressOut={100}
      >
        <Text style={styles.buttonText}>מפת המסלולים 🗺️</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.buttonSecondary }]}
        onPress={() => handleNavigation("ProfileScreen")}
        activeOpacity={0.7}
        delayPressIn={0}
        delayPressOut={100}
      >
        <Text style={styles.buttonText}>הפרופיל שלי 👤</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.buttonTertiary }]}
        onPress={() => handleNavigation("LeaderboardScreen")}
        activeOpacity={0.7}
        delayPressIn={0}
        delayPressOut={100}
      >
        <Text style={styles.buttonText}>לוח שיאים 🏆</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#8E4EC6" }]}
        onPress={() => handleNavigation("SprayWall")}
        activeOpacity={0.7}
        delayPressIn={0}
        delayPressOut={100}
      >
        <Text style={styles.buttonText}>Spray Wall 🧗‍♂️</Text>
      </TouchableOpacity>
    </View>
  );
}
