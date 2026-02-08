// src/components/spray/WallForm.tsx
// Form component for adding a new wall

import React, { useState, useMemo } from "react";
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
import { useLanguage } from "@/features/language";
import { useTheme, lightTheme } from "@/features/theme/ThemeContext";

type Theme = typeof lightTheme;

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
  const { t } = useLanguage();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  const [name, setName] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(t.common.error, t.spray.cameraPermissionRequired);
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
      Alert.alert(t.common.error, t.spray.mustEnterName);
      return;
    }
    if (!width || isNaN(parseFloat(width))) {
      Alert.alert(t.common.error, t.errors.saveFailed);
      return;
    }
    if (!height || isNaN(parseFloat(height))) {
      Alert.alert(t.common.error, t.errors.saveFailed);
      return;
    }
    if (!imageUri) {
      Alert.alert(t.common.error, t.spray.selectWall);
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
      Alert.alert(t.common.error, error.message || t.spray.failedToAddWall);
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
            <Text style={styles.imagePlaceholderLabel}>{t.wall.selectPhoto}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Wall Name */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t.wall.wallName}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t.wall.wallNamePlaceholder}
          placeholderTextColor="#666"
        />
      </View>

      {/* Dimensions */}
      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>{t.wall.widthMeters}</Text>
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
          <Text style={styles.label}>{t.wall.heightMeters}</Text>
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
        <Text style={styles.label}>{t.wall.publicWall}</Text>
        <Switch
          value={isPublic}
          onValueChange={setIsPublic}
          trackColor={{ false: theme.border, true: theme.secondary }}
          thumbColor={isPublic ? "#fff" : theme.textSecondary}
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
          <Text style={styles.submitButtonText}>{t.wall.addWall}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

// Dynamic styles based on theme
const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
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
    backgroundColor: theme.surface,
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
    borderColor: theme.border,
    borderStyle: "dashed",
    borderRadius: 12,
  },
  imagePlaceholderText: {
    fontSize: 48,
  },
  imagePlaceholderLabel: {
    color: theme.textSecondary,
    marginTop: 8,
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.inputBackground,
    borderRadius: 8,
    padding: 12,
    color: theme.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
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
    color: theme.textSecondary,
    fontSize: 12,
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: theme.secondary,
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
