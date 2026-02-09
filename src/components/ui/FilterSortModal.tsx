import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTheme } from '@/features/theme/ThemeContext';

const { width: screenWidth } = Dimensions.get("window");

export default function FilterSortModal({
  visible,
  onClose,
  filters,
  onFiltersChange,
  sortBy,
  onSortChange,
  initialActiveTab,
  buttonPos,
}) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [activeTab, setActiveTab] = useState(initialActiveTab || "filter");

  // Update activeTab when initialActiveTab changes
  useEffect(() => {
    if (initialActiveTab) {
      setActiveTab(initialActiveTab);
    }
  }, [initialActiveTab]);

  // Provide default values to prevent undefined errors
  const safeFilters = filters || { grades: [], colors: [], status: "all" };
  const safeSortBy = sortBy || "grade";

  const gradeOptions = [
    "V1",
    "V2",
    "V3",
    "V4",
    "V5",
    "V6",
    "V7",
    "V8",
    "V9",
    "V10",
  ];
  const statusOptions = [
    { key: "all", label: "הכל" },
    { key: "completed", label: "סגורים" },
    { key: "uncompleted", label: "פתוחים" },
  ];

  const sortOptions = [
    { value: "gradeDesc", label: "דירוג מהגבוה לנמוך" },
    { value: "gradeAsc", label: "דירוג מהנמוך לגבוה" },
    { value: "color", label: "לפי צבע" },
    { value: "ratingDesc", label: "ציון מהגבוה לנמוך" },
    { value: "ratingAsc", label: "ציון מהנמוך לגבוה" },
    { value: "completions", label: "לפי כמות סגירות" },
    { value: "createdAt", label: "תאריך בנייה" },
  ];

  const filterOptions = [
    { value: "grades", label: "סינון לפי דירוג" },
    { value: "colors", label: "סינון לפי צבע" },
    { value: "status", label: "סינון לפי סטטוס" },
    { value: "clear", label: "נקה כל הסינונים" },
  ];

  const handleSelect = (item) => {
    if (activeTab === "sort") {
      if (onSortChange) {
        onSortChange(item.value);
      }
      if (onClose) onClose();
    } else if (activeTab === "filter") {
      if (item.type === "grades") {
        const newGrades = safeFilters.grades.includes(item.value)
          ? safeFilters.grades.filter((g) => g !== item.value)
          : [...safeFilters.grades, item.value];
        if (onFiltersChange) {
          onFiltersChange({ ...safeFilters, grades: newGrades });
        }
      } else if (item.type === "status") {
        if (item.value === "all") {
          // אפס את כל הבחירות כאשר בוחרים "כל המסלולים"
          if (onFiltersChange) {
            onFiltersChange({ grades: [], colors: [], status: "all" });
          }
        } else {
          if (onFiltersChange) {
            onFiltersChange({ ...safeFilters, status: item.value });
          }
        }
        if (onClose) onClose();
      }
    }
  };

  if (!visible || !buttonPos) return null;

  const getDropdownData = () => {
    if (activeTab === "filter") {
      return [
        // Status options at top
        {
          type: "status",
          value: "all",
          label: "כל המסלולים",
          isSelected: safeFilters.status === "all",
        },
        {
          type: "status",
          value: "completed",
          label: "מסלולים שנסגרו",
          isSelected: safeFilters.status === "completed",
        },
        {
          type: "status",
          value: "uncompleted",
          label: "מסלולים שלא נסגרו",
          isSelected: safeFilters.status === "uncompleted",
        },
        // Grades
        ...gradeOptions.map((grade) => ({
          type: "grades",
          value: grade,
          label: `דירוג ${grade}`,
          isSelected: safeFilters.grades.includes(grade),
        })),
      ];
    } else {
      return sortOptions;
    }
  };

  const dropdownData = getDropdownData();

  // חישוב מיקום החץ
  const dropdownLeft = Math.max(
    10,
    Math.min(screenWidth - 290, buttonPos.x - 50),
  );
  const arrowPosition = Math.max(
    15,
    Math.min(
      265, // רוחב הטאב פחות מרווח
      buttonPos.x + buttonPos.width / 2 - dropdownLeft,
    ),
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={StyleSheet.absoluteFillObject}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: theme.overlay },
          ]}
        >
          <View
            style={[
              styles.dropdown,
              {
                top: buttonPos.y + buttonPos.height + 8, // מתחת לכפתור
                left: Math.max(
                  10,
                  Math.min(screenWidth - 290, buttonPos.x - 50),
                ), // מרכוז עם הגבלות
                width: Math.min(screenWidth - 20, 280), // רוחב קבוע
              },
            ]}
          >
            {/* חץ שמצביע על הכפתור */}
            <View style={[styles.arrow, { left: arrowPosition }]} />

            {/* כותרת עם טאב יחיד */}
            <View style={styles.tabContainer}>
              <View style={styles.singleTab}>
                <Text style={styles.singleTabText}>
                  {activeTab === "filter" ? "🔍 סינון" : "📊 מיון"}
                </Text>
              </View>
            </View>

            {/* רשימת האופציות */}
            <FlatList
              data={dropdownData}
              keyExtractor={(item, index) =>
                `${(item as any).type || "sort"}-${item.value}-${index}`
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    (item as any).isSelected ? styles.selectedItem : null,
                  ]}
                  onPress={() => handleSelect(item)}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      (item as any).isSelected ? styles.selectedItemText : null,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
              style={styles.dropdownList}
            />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  dropdown: {
    position: "absolute",
    maxHeight: 250,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    elevation: 8,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
    overflow: "hidden",
  },
  arrow: {
    position: "absolute",
    top: -8,
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderStartWidth: 8,
    borderEndWidth: 8,
    borderTopWidth: 8,
    borderStartColor: "transparent",
    borderEndColor: "transparent",
    borderTopColor: theme.surface,
    zIndex: 1001,
  },
  tabContainer: {
    backgroundColor: theme.inputBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  singleTab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: theme.secondary,
  },
  singleTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  activeTab: {
    backgroundColor: theme.secondary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.textSecondary,
  },
  activeTabText: {
    color: "#fff",
  },
  dropdownList: {
    maxHeight: 250,
    backgroundColor: theme.surface,
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  dropdownItemText: {
    fontSize: 15,
    color: theme.text,
    fontWeight: "500",
  },
  selectedItem: {
    backgroundColor: theme.activeTab,
    borderEndWidth: 3,
    borderEndColor: theme.secondary,
  },
  selectedItemText: {
    color: theme.secondary,
    fontWeight: "600",
  },
});
