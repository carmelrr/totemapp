import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
} from "react-native";
import { THEME_COLORS } from "@/constants/colors";

interface AddRouteScreenProps {
  route: {
    params?: {
      initialCoords?: {
        x: number;
        y: number;
      };
    };
  };
  navigation: any;
}

const AddRouteScreen: React.FC<AddRouteScreenProps> = ({
  route,
  navigation,
}) => {
  const [grade, setGrade] = useState("");
  const [color, setColor] = useState("");
  const initialCoords = route.params?.initialCoords;

  const handleSave = () => {
    if (grade && color && initialCoords) {
      // Here you would typically save the route to your database
      Alert.alert("הצלחה", "הקו נשמר בהצלחה", [
        {
          text: "אישור",
          onPress: () => navigation.goBack(),
        },
      ]);
    } else {
      Alert.alert("שגיאה", "נא למלא את כל השדות");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>הוספת קו חדש</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>דרגת קושי</Text>
          <TextInput
            style={styles.input}
            value={grade}
            onChangeText={setGrade}
            placeholder="הכנס דרגת קושי (V0-V16)"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>צבע</Text>
          <TextInput
            style={styles.input}
            value={color}
            onChangeText={setColor}
            placeholder="הכנס צבע הקו"
            placeholderTextColor="#999"
          />
        </View>

        {initialCoords && (
          <View style={styles.coordsContainer}>
            <Text style={styles.coordsText}>
              נקודת התחלה: ({initialCoords.x}, {initialCoords.y})
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>שמור קו</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: THEME_COLORS.text,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: THEME_COLORS.primary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: THEME_COLORS.text,
  },
  input: {
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: THEME_COLORS.surface,
    color: THEME_COLORS.text,
  },
  coordsContainer: {
    padding: 12,
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 8,
    marginBottom: 20,
  },
  coordsText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
  },
  saveButton: {
    backgroundColor: THEME_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default AddRouteScreen;
