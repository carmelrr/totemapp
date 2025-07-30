import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Pressable } from 'react-native-gesture-handler';
import { useTheme } from '../context/ThemeContext';

// טבלת צבעים מקיפה עם מספר רב של צבעים ושמות
const COLOR_GRID = [
  // שורה 1 - גווני אדום
  [
    { hex: '#FF0000', name: 'אדום' },
    { hex: '#FF1744', name: 'אדום כהה' },
    { hex: '#FF5722', name: 'אדום כתום' },
    { hex: '#E91E63', name: 'ורוד אדום' },
    { hex: '#F44336', name: 'אדום חי' },
    { hex: '#FF6B6B', name: 'אדום בהיר' },
    { hex: '#FF8A80', name: 'אדום פסטל' },
    { hex: '#FFCDD2', name: 'ורוד בהיר' }
  ],
  // שורה 2 - גווני כתום
  [
    { hex: '#FF9800', name: 'כתום' },
    { hex: '#FF8F00', name: 'כתום זהב' },
    { hex: '#FF6F00', name: 'כתום כהה' },
    { hex: '#FFB74D', name: 'כתום בהיר' },
    { hex: '#FFCC02', name: 'כתום צהוב' },
    { hex: '#FFE082', name: 'כתום חיוור' },
    { hex: '#FFECB3', name: 'כתום פסטל' },
    { hex: '#FFF3E0', name: 'קרם כתום' }
  ],
  // שורה 3 - גווני צהוב
  [
    { hex: '#FFEB3B', name: 'צהוב' },
    { hex: '#FFC107', name: 'צהוב זהב' },
    { hex: '#FF8F00', name: 'צהוב כתום' },
    { hex: '#FFFF00', name: 'צהוב בהיר' },
    { hex: '#FFFF8D', name: 'צהוב חיוור' },
    { hex: '#FFFDE7', name: 'שנהב' },
    { hex: '#F9FBE7', name: 'ירוק צהוב' },
    { hex: '#F0F4C3', name: 'ירוק בהיר' }
  ],
  // שורה 4 - גווני ירוק
  [
    { hex: '#4CAF50', name: 'ירוק' },
    { hex: '#8BC34A', name: 'ירוק בהיר' },
    { hex: '#CDDC39', name: 'ירוק ליים' },
    { hex: '#689F38', name: 'ירוק זית' },
    { hex: '#388E3C', name: 'ירוק יער' },
    { hex: '#2E7D32', name: 'ירוק כהה' },
    { hex: '#A5D6A7', name: 'ירוק פסטל' },
    { hex: '#C8E6C9', name: 'ירוק חיוור' }
  ],
  // שורה 5 - גווני תכלת
  [
    { hex: '#00BCD4', name: 'תכלת' },
    { hex: '#26C6DA', name: 'תכלת בהיר' },
    { hex: '#00ACC1', name: 'תכלת כהה' },
    { hex: '#0097A7', name: 'תכלת עמוק' },
    { hex: '#80DEEA', name: 'תכלת חיוור' },
    { hex: '#B2EBF2', name: 'תכלת פסטל' },
    { hex: '#E0F2F1', name: 'אקווה' },
    { hex: '#4DD0E1', name: 'ציאן' }
  ],
  // שורה 6 - גווני כחול
  [
    { hex: '#2196F3', name: 'כחול' },
    { hex: '#1976D2', name: 'כחול כהה' },
    { hex: '#0D47A1', name: 'כחול נייבי' },
    { hex: '#42A5F5', name: 'כחול בהיר' },
    { hex: '#64B5F6', name: 'כחול שמיים' },
    { hex: '#90CAF9', name: 'כחול חיוור' },
    { hex: '#BBDEFB', name: 'כחול פסטל' },
    { hex: '#E3F2FD', name: 'כחול בייבי' }
  ],
  // שורה 7 - גווני סגול
  [
    { hex: '#9C27B0', name: 'סגול' },
    { hex: '#673AB7', name: 'סגול כהה' },
    { hex: '#3F51B5', name: 'סגול כחול' },
    { hex: '#7B1FA2', name: 'סגול עמוק' },
    { hex: '#AB47BC', name: 'סגול בהיר' },
    { hex: '#BA68C8', name: 'סגול ורוד' },
    { hex: '#CE93D8', name: 'סגול חיוור' },
    { hex: '#E1BEE7', name: 'סגול פסטל' }
  ],
  // שורה 8 - גווני חום וטבעיים
  [
    { hex: '#795548', name: 'חום' },
    { hex: '#8D6E63', name: 'חום בהיר' },
    { hex: '#6D4C41', name: 'חום כהה' },
    { hex: '#5D4037', name: 'חום קפה' },
    { hex: '#A1887F', name: 'חום חול' },
    { hex: '#BCAAA4', name: 'חום פסטל' },
    { hex: '#D7CCC8', name: 'בז\'' },
    { hex: '#EFEBE9', name: 'קרם' }
  ],
  // שורה 9 - גווני אפור
  [
    { hex: '#9E9E9E', name: 'אפור' },
    { hex: '#757575', name: 'אפור כהה' },
    { hex: '#424242', name: 'אפור פחם' },
    { hex: '#212121', name: 'אפור כמעט שחור' },
    { hex: '#BDBDBD', name: 'אפור בהיר' },
    { hex: '#E0E0E0', name: 'אפור חיוור' },
    { hex: '#F5F5F5', name: 'אפור פסטל' },
    { hex: '#FAFAFA', name: 'אפור כמעט לבן' }
  ],
  // שורה 10 - צבעים מיוחדים
  [
    { hex: '#000000', name: 'שחור' },
    { hex: '#FFFFFF', name: 'לבן' },
    { hex: '#FFD700', name: 'זהב' },
    { hex: '#C0C0C0', name: 'כסף' },
    { hex: '#FF1493', name: 'ורוד עז' },
    { hex: '#00FF00', name: 'ירוק ניאון' },
    { hex: '#FF00FF', name: 'מגנטה' },
    { hex: '#00FFFF', name: 'ציאן ניאון' }
  ]
];

export default function ColorPickerScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const [selectedColor, setSelectedColor] = useState(null);

  const handleColorSelect = useCallback((colorData) => {
    setSelectedColor(colorData);
    
    // הוספה אוטומטית למסך הוספת מסלול
    const newColor = {
      name: colorData.name,
      value: colorData.hex,
      textColor: getContrastColor(colorData.hex),
    };
    
    // חזרה למסך הוספת מסלול עם הצבע החדש
    navigation.navigate({
      name: 'AddRouteScreen',
      params: { 
        coords: route.params?.coords,
        customColor: newColor 
      },
      merge: true
    });
  }, [navigation, route.params?.coords]);

  const handleSaveColor = () => {
    if (!selectedColor) {
      Alert.alert('שגיאה', 'אנא בחר צבע תחילה');
      return;
    }

    const newColor = {
      name: selectedColor.name,
      value: selectedColor.hex,
      textColor: getContrastColor(selectedColor.hex),
    };

    navigation.navigate({
      name: 'AddRouteScreen',
      params: { 
        coords: route.params?.coords,
        customColor: newColor 
      },
      merge: true
    });
  };

  // פונקציה לקביעת צבע טקסט מתאים
  const getContrastColor = (hexColor) => {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#FFFFFF';
  };

  // Create styles based on current theme
  const styles = createStyles(theme);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>בחר צבע</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.closeButton}>ביטול</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* טבלת צבעים */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>בחר צבע (לחיצה אוטומטית מוסיפה למסלול):</Text>
          <View style={styles.colorGrid}>
            {COLOR_GRID.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.colorRow}>
                {row.map((colorData, colIndex) => (
                  <Pressable
                    key={`${rowIndex}-${colIndex}`}
                    style={[
                      styles.colorCell,
                      { backgroundColor: colorData.hex },
                      selectedColor?.hex === colorData.hex && styles.colorCellSelected
                    ]}
                    onPress={() => handleColorSelect(colorData)}
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                  >
                    <Text style={[
                      styles.colorLabel,
                      { color: getContrastColor(colorData.hex) }
                    ]}>
                      {colorData.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* תצוגה מקדימה */}
        {selectedColor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>צבע נבחר:</Text>
            <View style={styles.selectedColorPreview}>
              <View 
                style={[
                  styles.previewBox, 
                  { backgroundColor: selectedColor.hex }
                ]}
              />
              <View>
                <Text style={styles.colorName}>{selectedColor.name}</Text>
                <Text style={styles.colorCode}>{selectedColor.hex}</Text>
              </View>
            </View>
            
            <Pressable 
              style={styles.saveButton} 
              onPress={handleSaveColor}
            >
              <Text style={styles.saveButtonText}>הוסף צבע למסלול</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'right',
  },
  closeButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'right',
  },
  colorGrid: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  colorRow: {
    flexDirection: 'row',
  },
  colorCell: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: '#000',
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  colorCellSelected: {
    borderWidth: 4,
    borderColor: '#333',
  },
  colorLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  selectedColorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  previewBox: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
    borderWidth: 2,
    borderColor: '#ccc',
  },
  colorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'right',
  },
  colorCode: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  saveButton: {
    backgroundColor: '#28a745',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
