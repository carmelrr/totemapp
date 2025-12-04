// src/components/spray/WallForm.tsx
// Form component for adding a new wall

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

interface WallFormProps {
  onSubmit: (data: {
    name: string;
    width: number;
    height: number;
    isPublic: boolean;
    imageUri: string;
  }) => Promise<void>;
  loading?: boolean;
}

export const WallForm: React.FC<WallFormProps> = ({
  onSubmit,
  loading = false,
}) => {
  const [name, setName] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert("שגיאה", "יש לאשר גישה לגלריה");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    // Validate inputs
    if (!name.trim()) {
      Alert.alert("שגיאה", "יש להזין שם לקיר");
      return;
    }
    if (!width || isNaN(parseFloat(width))) {
      Alert.alert("שגיאה", "יש להזין רוחב תקין");
      return;
    }
    if (!height || isNaN(parseFloat(height))) {
      Alert.alert("שגיאה", "יש להזין גובה תקין");
      return;
    }
    if (!imageUri) {
      Alert.alert("שגיאה", "יש לבחור תמונה לקיר");
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        width: parseFloat(width),
        height: parseFloat(height),
        isPublic,
        imageUri,
      });
    } catch (error: any) {
      Alert.alert("שגיאה", error.message || "הוספת הקיר נכשלה");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Image Picker */}
      <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>📷</Text>
            <Text style={styles.imagePlaceholderLabel}>בחר תמונת קיר</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Wall Name */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>שם הקיר</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="הזן שם לקיר"
          placeholderTextColor="#666"
        />
      </View>

      {/* Dimensions */}
      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>רוחב (מ')</Text>
          <TextInput
            style={styles.input}
            value={width}
            onChangeText={setWidth}
            placeholder="5"
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>גובה (מ')</Text>
          <TextInput
            style={styles.input}
            value={height}
            onChangeText={setHeight}
            placeholder="4"
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* Public/Private Toggle */}
      <View style={styles.switchRow}>
        <Text style={styles.label}>קיר ציבורי</Text>
        <Switch
          value={isPublic}
          onValueChange={setIsPublic}
          trackColor={{ false: "#444", true: "#8E4EC6" }}
          thumbColor={isPublic ? "#fff" : "#888"}
        />
      </View>
      <Text style={styles.hint}>
        {isPublic ? "הקיר יהיה גלוי לכל המשתמשים" : "הקיר יהיה פרטי"}
      </Text>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>הוסף קיר</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  content: {
    padding: 16,
  },
  imagePicker: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
    backgroundColor: "#2a2a2a",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#444",
    borderStyle: "dashed",
    borderRadius: 12,
  },
  imagePlaceholderText: {
    fontSize: 48,
  },
  imagePlaceholderLabel: {
    color: "#888",
    marginTop: 8,
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#444",
  },
  row: {
    flexDirection: "row",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  hint: {
    color: "#666",
    fontSize: 12,
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: "#8E4EC6",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default WallForm;
