import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import {
  ROUTE_COLORS,
  getColorTranslationKey,
  getContrastTextColor,
  isValidHexColor,
} from "@/features/routes-map/utils/colors";
import {
  initializeColorSettings,
  getColorSettingSync,
  saveColorSetting,
  CustomColorSetting,
} from "@/features/routes-map/services/ColorSettingsService";

interface ColorPickerScreenProps {
  route: {
    params?: {
      onColorSelect?: (color: string) => void;
      selectedColor?: string;
    };
  };
  navigation: any;
}

const ColorPickerScreen: React.FC<ColorPickerScreenProps> = ({
  route,
  navigation,
}) => {
  const { t, language, isLoading: languageLoading } = useLanguage();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const onColorSelect = route.params?.onColorSelect;
  const initialSelected = route.params?.selectedColor || "";

  const [selectedColor, setSelectedColor] = useState(initialSelected);
  const [settingsVersion, setSettingsVersion] = useState(0);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOriginalHex, setEditingOriginalHex] = useState<string | null>(null);
  const [editHex, setEditHex] = useState("");
  const [editNameHe, setEditNameHe] = useState("");
  const [editNameEn, setEditNameEn] = useState("");
  const [editR, setEditR] = useState(128);
  const [editG, setEditG] = useState(128);
  const [editB, setEditB] = useState(128);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    initializeColorSettings().then(() => setSettingsVersion((v) => v + 1));
  }, []);

  // --- helpers ---
  const hexToRgb = (hex: string) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m
      ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
      : { r: 128, g: 128, b: 128 };
  };

  const rgbToHex = (r: number, g: number, b: number) =>
    "#" +
    [r, g, b]
      .map((x) => {
        const h = Math.round(x).toString(16);
        return h.length === 1 ? "0" + h : h;
      })
      .join("")
      .toUpperCase();

  const getDisplayColor = useCallback(
    (originalHex: string) => {
      // settingsVersion forces re-eval after saves
      void settingsVersion;
      const s = getColorSettingSync(originalHex);
      return s?.hex || originalHex;
    },
    [settingsVersion]
  );

  const getDisplayName = useCallback(
    (originalHex: string) => {
      void settingsVersion;
      const setting = getColorSettingSync(originalHex);
      if (setting) return language === "he" ? setting.nameHe : setting.nameEn;
      const key = getColorTranslationKey(originalHex);
      return (t.colors as any)?.[key] || key;
    },
    [settingsVersion, language, t]
  );

  // --- edit modal ---
  const openEditModal = (originalHex: string) => {
    const setting = getColorSettingSync(originalHex);
    const currentHex = setting?.hex || originalHex;
    const rgb = hexToRgb(currentHex);
    setEditingOriginalHex(originalHex);
    setEditHex(currentHex);
    setEditNameHe(setting?.nameHe || "");
    setEditNameEn(setting?.nameEn || "");
    setEditR(rgb.r);
    setEditG(rgb.g);
    setEditB(rgb.b);
    setShowEditModal(true);
  };

  const handleRgbChange = (channel: "r" | "g" | "b", value: number) => {
    const r = channel === "r" ? value : editR;
    const g = channel === "g" ? value : editG;
    const b = channel === "b" ? value : editB;
    if (channel === "r") setEditR(value);
    if (channel === "g") setEditG(value);
    if (channel === "b") setEditB(value);
    setEditHex(rgbToHex(r, g, b));
  };

  const handleHexInput = (text: string) => {
    let hex = text.startsWith("#") ? text : "#" + text;
    setEditHex(hex.toUpperCase());
    if (isValidHexColor(hex)) {
      const rgb = hexToRgb(hex);
      setEditR(rgb.r);
      setEditG(rgb.g);
      setEditB(rgb.b);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingOriginalHex) return;
    if (!isValidHexColor(editHex)) {
      Alert.alert(t.common.error, t.colors.invalidColorCode);
      return;
    }
    if (!editNameHe.trim() || !editNameEn.trim()) {
      Alert.alert(t.common.error, t.colors.colorNameRequired);
      return;
    }
    setIsSaving(true);
    try {
      await saveColorSetting(editingOriginalHex, {
        hex: editHex,
        nameHe: editNameHe.trim(),
        nameEn: editNameEn.trim(),
        originalHex: editingOriginalHex,
      });
      setSettingsVersion((v) => v + 1);
      setShowEditModal(false);
    } catch (e) {
      Alert.alert(t.common.error, t.colors.colorSaveError);
    } finally {
      setIsSaving(false);
    }
  };

  // --- select color & go back ---
  const handleSelect = (originalHex: string) => {
    setSelectedColor(originalHex);
    if (onColorSelect) onColorSelect(originalHex);
    navigation.goBack();
  };

  // --- render ---
  const renderColorItem = ({ item }: { item: string }) => {
    const displayHex = getDisplayColor(item);
    const name = getDisplayName(item);
    const isSelected = selectedColor === item;
    const textColor = getContrastTextColor(displayHex);

    return (
      <TouchableOpacity
        style={[
          styles.colorItem,
          { backgroundColor: displayHex },
          isSelected && styles.selectedColorItem,
        ]}
        onPress={() => handleSelect(item)}
        onLongPress={() => openEditModal(item)}
        delayLongPress={400}
      >
        <View style={styles.colorOverlay}>
          <Text style={[styles.colorName, { color: textColor }]}>{name}</Text>
        </View>
        {isSelected && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={16} color="#fff" />
          </View>
        )}
        <View style={styles.editHint}>
          <Ionicons name="create-outline" size={12} color={textColor} style={{ opacity: 0.5 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {language === "he" ? "ניהול צבעים" : "Manage Colors"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.instruction}>
        {language === "he" ? "לחץ לבחירה, לחיצה ארוכה לעריכה" : "Tap to select, long press to edit"}
      </Text>

      <FlatList
        data={[...ROUTE_COLORS]}
        renderItem={renderColorItem}
        keyExtractor={(item) => item}
        numColumns={2}
        contentContainerStyle={styles.colorGrid}
        extraData={settingsVersion}
      />

      {/* Edit Color Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {language === "he" ? "עריכת צבע" : "Edit Color"}
            </Text>

            {/* Color preview */}
            <View style={[styles.previewSwatch, { backgroundColor: editHex }]}>
              <Text style={[styles.previewHex, { color: isValidHexColor(editHex) ? getContrastTextColor(editHex) : "#fff" }]}>
                {editHex}
              </Text>
            </View>

            {/* Hex input */}
            <Text style={styles.fieldLabel}>Hex</Text>
            <TextInput
              style={styles.textInput}
              value={editHex}
              onChangeText={handleHexInput}
              placeholder="#FF0000"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="characters"
              maxLength={7}
            />

            {/* RGB sliders */}
            <Text style={[styles.fieldLabel, { color: "#E53935" }]}>R: {editR}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={255}
              step={1}
              value={editR}
              onValueChange={(v) => handleRgbChange("r", v)}
              minimumTrackTintColor="#E53935"
              maximumTrackTintColor={theme.border}
              thumbTintColor="#E53935"
            />
            <Text style={[styles.fieldLabel, { color: "#43A047" }]}>G: {editG}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={255}
              step={1}
              value={editG}
              onValueChange={(v) => handleRgbChange("g", v)}
              minimumTrackTintColor="#43A047"
              maximumTrackTintColor={theme.border}
              thumbTintColor="#43A047"
            />
            <Text style={[styles.fieldLabel, { color: "#1E88E5" }]}>B: {editB}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={255}
              step={1}
              value={editB}
              onValueChange={(v) => handleRgbChange("b", v)}
              minimumTrackTintColor="#1E88E5"
              maximumTrackTintColor={theme.border}
              thumbTintColor="#1E88E5"
            />

            {/* Names */}
            <Text style={styles.fieldLabel}>{language === "he" ? "שם בעברית" : "Hebrew name"}</Text>
            <TextInput
              style={styles.textInput}
              value={editNameHe}
              onChangeText={setEditNameHe}
              placeholder={t.addRoute.colorExampleHe}
              placeholderTextColor={theme.textSecondary}
            />
            <Text style={styles.fieldLabel}>{language === "he" ? "שם באנגלית" : "English name"}</Text>
            <TextInput
              style={styles.textInput}
              value={editNameEn}
              onChangeText={setEditNameEn}
              placeholder="Red"
              placeholderTextColor={theme.textSecondary}
            />

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.modalCancelText}>{t.common?.cancel || "ביטול"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, isSaving && { opacity: 0.6 }]}
                onPress={handleSaveEdit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>{t.common?.save || "שמור"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Dynamic styles factory for theme support
const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.text,
    },
    closeButton: {
      padding: 8,
    },
    instruction: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
      marginVertical: 10,
    },
    colorGrid: {
      paddingHorizontal: 8,
      paddingBottom: 20,
    },
    colorItem: {
      flex: 1,
      margin: 6,
      height: 80,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: theme.border,
      position: "relative",
    },
    selectedColorItem: {
      borderColor: theme.primary,
      borderWidth: 3,
    },
    colorOverlay: {
      backgroundColor: "rgba(0, 0, 0, 0.25)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    colorName: {
      fontSize: 14,
      fontWeight: "bold",
      textAlign: "center",
    },
    checkBadge: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    editHint: {
      position: "absolute",
      bottom: 4,
      right: 6,
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    modalContent: {
      backgroundColor: theme.background,
      borderRadius: 20,
      padding: 20,
      maxHeight: "85%",
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.text,
      textAlign: "center",
      marginBottom: 12,
    },
    previewSwatch: {
      height: 56,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    previewHex: {
      fontSize: 16,
      fontWeight: "bold",
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.textSecondary,
      marginBottom: 4,
      marginTop: 6,
    },
    textInput: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    },
    slider: {
      width: "100%",
      height: 36,
    },
    modalButtons: {
      flexDirection: "row",
      gap: 12,
      marginTop: 16,
    },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: theme.surface,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalCancelText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    modalSaveBtn: {
      flex: 2,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: theme.success || theme.primary,
      alignItems: "center",
    },
    modalSaveText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#fff",
    },
  });

export default ColorPickerScreen;
