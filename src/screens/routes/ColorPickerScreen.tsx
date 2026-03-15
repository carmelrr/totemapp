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
  ScrollView,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
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
  deleteColorSetting,
  addCustomColor,
  getCustomColors,
  hidePredefinedColor,
  getHiddenColors,
  CustomColorSetting,
} from "@/features/routes-map/services/ColorSettingsService";
import { RoutesService } from "@/features/routes-map/services/RoutesService";

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
  const layout = useResponsiveLayout();
  const styles = useMemo(() => createStyles(theme, layout), [theme, layout]);
  const numColumns = layout.isLandscape ? (layout.isTablet ? 4 : 3) : 2;

  const onColorSelect = route.params?.onColorSelect;
  const initialSelected = route.params?.selectedColor || "";

  const [selectedColor, setSelectedColor] = useState(initialSelected);
  const [settingsVersion, setSettingsVersion] = useState(0);

  // Custom (non-predefined) colors list
  const [customColors, setCustomColors] = useState<string[]>([]);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOriginalHex, setEditingOriginalHex] = useState<string | null>(null);
  const [editingIsCustom, setEditingIsCustom] = useState(false);
  const [editHex, setEditHex] = useState("");
  const [editNameHe, setEditNameHe] = useState("");
  const [editNameEn, setEditNameEn] = useState("");
  const [editR, setEditR] = useState(128);
  const [editG, setEditG] = useState(128);
  const [editB, setEditB] = useState(128);
  const [isSaving, setIsSaving] = useState(false);

  // Add new color modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addHex, setAddHex] = useState("#FF0000");
  const [addNameHe, setAddNameHe] = useState("");
  const [addNameEn, setAddNameEn] = useState("");
  const [addR, setAddR] = useState(255);
  const [addG, setAddG] = useState(0);
  const [addB, setAddB] = useState(0);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    initializeColorSettings().then(() => {
      setSettingsVersion((v) => v + 1);
      refreshCustomColors();
    });
  }, []);

  const refreshCustomColors = () => {
    const customs = getCustomColors();
    setCustomColors(customs.map((c) => c.hex));
  };

  // All colors = predefined (minus hidden) + custom
  const allColors = useMemo(() => {
    void settingsVersion; // react to changes
    const hidden = getHiddenColors();
    const visiblePredefined = ROUTE_COLORS.filter(c => !hidden.has(c.toUpperCase()));
    return [...visiblePredefined, ...customColors];
  }, [settingsVersion, customColors]);

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
    const isPredefined = (ROUTE_COLORS as readonly string[]).includes(originalHex);
    const setting = getColorSettingSync(originalHex);
    const currentHex = setting?.hex || originalHex;
    const rgb = hexToRgb(currentHex);
    setEditingOriginalHex(originalHex);
    setEditingIsCustom(!isPredefined);
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
      Alert.alert(t.common.error, t.colors?.invalidColorCode || "Invalid color code");
      return;
    }
    if (!editNameHe.trim() || !editNameEn.trim()) {
      Alert.alert(t.common.error, t.colors?.colorNameRequired || "Color name required");
      return;
    }
    setIsSaving(true);
    try {
      const oldDisplayHex = getDisplayColor(editingOriginalHex);

      await saveColorSetting(editingOriginalHex, {
        hex: editHex,
        nameHe: editNameHe.trim(),
        nameEn: editNameEn.trim(),
        originalHex: editingOriginalHex,
      });

      // If the display color changed, update existing routes that use this color
      if (oldDisplayHex.toUpperCase() !== editHex.toUpperCase()) {
        try {
          const count = await RoutesService.updateRoutesByColor(editingOriginalHex, editHex);
          // Also try updating routes that had the old display hex
          if (oldDisplayHex.toUpperCase() !== editingOriginalHex.toUpperCase()) {
            await RoutesService.updateRoutesByColor(oldDisplayHex, editHex);
          }
          console.log(`Updated ${count} routes from ${oldDisplayHex} to ${editHex}`);
        } catch (err) {
          console.warn('Could not update existing routes:', err);
        }
      }

      setSettingsVersion((v) => v + 1);
      refreshCustomColors();
      setShowEditModal(false);
    } catch (e) {
      Alert.alert(t.common.error, t.colors?.colorSaveError || "Error saving color");
    } finally {
      setIsSaving(false);
    }
  };

  // --- delete color ---
  const handleDeleteColor = (hex: string) => {
    const isPredefined = (ROUTE_COLORS as readonly string[]).includes(hex);
    const displayName = getDisplayName(hex);
    Alert.alert(
      t.colors.deleteColor,
      `${t.colors.deleteColorConfirm}\n\n${displayName}`,
      [
        { text: t.common.cancel, style: "cancel" },
        {
          text: t.common.delete,
          style: "destructive",
          onPress: async () => {
            try {
              if (isPredefined) {
                // Hide predefined color from the list
                await hidePredefinedColor(hex);
                // Also remove any custom setting override
                await deleteColorSetting(hex).catch(() => {});
              } else {
                // For custom colors, remove from Firestore entirely
                await deleteColorSetting(hex);
              }
              setSettingsVersion((v) => v + 1);
              refreshCustomColors();
            } catch (e) {
              Alert.alert(t.common.error, t.colors.deleteError);
            }
          },
        },
      ]
    );
  };

  // --- add new color ---
  const handleAddRgbChange = (channel: "r" | "g" | "b", value: number) => {
    const r = channel === "r" ? value : addR;
    const g = channel === "g" ? value : addG;
    const b = channel === "b" ? value : addB;
    if (channel === "r") setAddR(value);
    if (channel === "g") setAddG(value);
    if (channel === "b") setAddB(value);
    setAddHex(rgbToHex(r, g, b));
  };

  const handleAddHexInput = (text: string) => {
    let hex = text.startsWith("#") ? text : "#" + text;
    setAddHex(hex.toUpperCase());
    if (isValidHexColor(hex)) {
      const rgb = hexToRgb(hex);
      setAddR(rgb.r);
      setAddG(rgb.g);
      setAddB(rgb.b);
    }
  };

  const handleAddNewColor = async () => {
    if (!isValidHexColor(addHex)) {
      Alert.alert(t.common.error, t.colors.invalidColorCode);
      return;
    }
    if (!addNameHe.trim() || !addNameEn.trim()) {
      Alert.alert(t.common.error, t.colors.colorNameRequired);
      return;
    }
    // Check if color already exists
    if (allColors.some((c) => c.toUpperCase() === addHex.toUpperCase())) {
      Alert.alert(t.common.error, t.colors.colorAlreadyExists);
      return;
    }
    setIsAdding(true);
    try {
      await addCustomColor({
        hex: addHex.toUpperCase(),
        nameHe: addNameHe.trim(),
        nameEn: addNameEn.trim(),
      });
      setSettingsVersion((v) => v + 1);
      refreshCustomColors();
      setShowAddModal(false);
      setAddHex("#FF0000");
      setAddNameHe("");
      setAddNameEn("");
      setAddR(255);
      setAddG(0);
      setAddB(0);
    } catch (e) {
      Alert.alert(t.common.error, t.colors.addError);
    } finally {
      setIsAdding(false);
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
    const isCustom = !(ROUTE_COLORS as readonly string[]).includes(item);

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
        {/* Delete button */}
        <TouchableOpacity
          style={styles.deleteBadge}
          onPress={() => handleDeleteColor(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={22} color="#E53935" />
        </TouchableOpacity>
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
          {t.colors.manageColors}
        </Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButton}>
          <Ionicons name="add-circle-outline" size={28} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.instruction}>
        {t.colors.tapToSelectLongPressEdit}
      </Text>

      <FlatList
        data={allColors}
        renderItem={renderColorItem}
        keyExtractor={(item) => item}
        key={numColumns}
        numColumns={numColumns}
        contentContainerStyle={styles.colorGrid}
        extraData={settingsVersion}
      />

      {/* Edit Color Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t.colors.editColorTitle}
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
            <Text style={styles.fieldLabel}>{t.colors.hebrewName}</Text>
            <TextInput
              style={styles.textInput}
              value={editNameHe}
              onChangeText={setEditNameHe}
              placeholder={t.addRoute.colorExampleHe}
              placeholderTextColor={theme.textSecondary}
            />
            <Text style={styles.fieldLabel}>{t.colors.englishName}</Text>
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
                <Text style={styles.modalCancelText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, isSaving && { opacity: 0.6 }]}
                onPress={handleSaveEdit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>{t.common.save}</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Delete button */}
            <TouchableOpacity
              style={styles.modalDeleteBtn}
              onPress={() => {
                setShowEditModal(false);
                if (editingOriginalHex) handleDeleteColor(editingOriginalHex);
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#E53935" />
              <Text style={styles.modalDeleteText}>{t.colors.deleteColor}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add New Color Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {t.colors.addNewColor}
              </Text>

              {/* Color preview */}
              <View style={[styles.previewSwatch, { backgroundColor: addHex }]}>
                <Text style={[styles.previewHex, { color: isValidHexColor(addHex) ? getContrastTextColor(addHex) : "#fff" }]}>
                  {addHex}
                </Text>
              </View>

              {/* Hex input */}
              <Text style={styles.fieldLabel}>Hex</Text>
              <TextInput
                style={styles.textInput}
                value={addHex}
                onChangeText={handleAddHexInput}
                placeholder="#FF0000"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
                maxLength={7}
              />

              {/* RGB sliders */}
              <Text style={[styles.fieldLabel, { color: "#E53935" }]}>R: {addR}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={255}
                step={1}
                value={addR}
                onValueChange={(v) => handleAddRgbChange("r", v)}
                minimumTrackTintColor="#E53935"
                maximumTrackTintColor={theme.border}
                thumbTintColor="#E53935"
              />
              <Text style={[styles.fieldLabel, { color: "#43A047" }]}>G: {addG}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={255}
                step={1}
                value={addG}
                onValueChange={(v) => handleAddRgbChange("g", v)}
                minimumTrackTintColor="#43A047"
                maximumTrackTintColor={theme.border}
                thumbTintColor="#43A047"
              />
              <Text style={[styles.fieldLabel, { color: "#1E88E5" }]}>B: {addB}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={255}
                step={1}
                value={addB}
                onValueChange={(v) => handleAddRgbChange("b", v)}
                minimumTrackTintColor="#1E88E5"
                maximumTrackTintColor={theme.border}
                thumbTintColor="#1E88E5"
              />

              {/* Names */}
              <Text style={styles.fieldLabel}>{t.colors.hebrewName}</Text>
              <TextInput
                style={styles.textInput}
                value={addNameHe}
                onChangeText={setAddNameHe}
                placeholder={t.addRoute.colorExampleHe}
                placeholderTextColor={theme.textSecondary}
              />
              <Text style={styles.fieldLabel}>{t.colors.englishName}</Text>
              <TextInput
                style={styles.textInput}
                value={addNameEn}
                onChangeText={setAddNameEn}
                placeholder="e.g. Orange"
                placeholderTextColor={theme.textSecondary}
              />

              {/* Buttons */}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={styles.modalCancelText}>{t.common.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, isAdding && { opacity: 0.6 }]}
                  onPress={handleAddNewColor}
                  disabled={isAdding}
                >
                  {isAdding ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalSaveText}>{t.colors.add}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Dynamic styles factory for theme support
const createStyles = (theme: any, layout?: ReturnType<typeof useResponsiveLayout>) => {
  const isLandscape = layout?.isLandscape ?? false;
  const isTablet = layout?.isTablet ?? false;
  
  return StyleSheet.create({
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
    addButton: {
      padding: 8,
    },
    instruction: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
      marginVertical: 10,
    },
    colorGrid: {
      paddingHorizontal: isLandscape ? 16 : 8,
      paddingBottom: 20,
    },
    colorItem: {
      flex: 1,
      margin: 6,
      height: isTablet ? 100 : 80,
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
    deleteBadge: {
      position: "absolute",
      top: -8,
      left: -8,
      backgroundColor: "#fff",
      borderRadius: 14,
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.25,
      shadowRadius: 3,
      elevation: 5,
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
      maxWidth: isTablet ? 500 : undefined,
      alignSelf: isTablet ? 'center' : undefined,
      width: isTablet ? '80%' : undefined,
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
    modalDeleteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#E5393520",
    },
    modalDeleteText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#E53935",
    },
  });
};

export default ColorPickerScreen;
