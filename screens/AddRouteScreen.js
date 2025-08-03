import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, FlatList, Dimensions, RefreshControl, Pressable } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addRoute } from '../routesService';
import { auth } from '../firebase-config';
import { useTheme } from '../context/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');

// רשימת דירוגים V0-V17
const V_GRADES = Array.from({ length: 18 }, (_, i) => `V${i}`);

// רשימת צבעים בסיסית
const DEFAULT_COLORS = [
  { name: 'כחול', value: '#007AFF', textColor: '#FFFFFF' },
  { name: 'תכלת', value: '#40E0D0', textColor: '#000000' },
  { name: 'אדום', value: '#FF3B30', textColor: '#FFFFFF' },
  { name: 'כתום', value: '#FF9500', textColor: '#FFFFFF' },
  { name: 'צהוב', value: '#FFCC00', textColor: '#000000' },
  { name: 'ירוק', value: '#34C759', textColor: '#FFFFFF' },
  { name: 'שחור', value: '#000000', textColor: '#FFFFFF' },
  { name: 'לבן', value: '#FFFFFF', textColor: '#000000' },
];

export default function AddRouteScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { coords, customColor } = route.params || {};
  const { theme } = useTheme();
  
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [customColors, setCustomColors] = useState([]);
  const [deletedDefaultColors, setDeletedDefaultColors] = useState([]);
  const [tempColors, setTempColors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // טען צבעים מותאמים אישית מהאחסון המקומי
  useEffect(() => {
    loadCustomColors();
  }, [loadCustomColors]);

  // רענון כללי בעת פוקוס על הדף
  useFocusEffect(
    useCallback(() => {
      loadCustomColors();
    }, [loadCustomColors])
  );

  const loadCustomColors = useCallback(async () => {
    try {
      const [savedColors, savedDeletedColors] = await Promise.all([
        AsyncStorage.getItem('customColors'),
        AsyncStorage.getItem('deletedDefaultColors')
      ]);
      
      if (savedColors) {
        const parsedColors = JSON.parse(savedColors);
        setCustomColors(parsedColors);
      }
      
      if (savedDeletedColors) {
        const parsedDeletedColors = JSON.parse(savedDeletedColors);
        setDeletedDefaultColors(parsedDeletedColors);
      }
    } catch (error) {
      // טעינה לא הצליחה - נמשיך עם רשימה ריקה
    }
  }, []);

  const saveDeletedDefaultColors = useCallback(async (deletedColors) => {
    try {
      await AsyncStorage.setItem('deletedDefaultColors', JSON.stringify(deletedColors));
    } catch (error) {
      // שמירה לא הצליחה - נמשיך
    }
  }, []);

  const saveCustomColors = useCallback(async (colors) => {
    try {
      await AsyncStorage.setItem('customColors', JSON.stringify(colors));
    } catch (error) {
      // שמירה לא הצליחה - נמשיך
    }
  }, []);

  const handleGradePress = useCallback((grade) => {
    setSelectedGrade(grade);
  }, []);

  const handleColorPress = useCallback((colorValue) => {
    // אם במצב עריכה, הצג דיאלוג מחיקה לכל צבע
    if (isEditMode) {
      handleColorDelete(colorValue);
      return;
    }
    
    // אחרת, בחר את הצבע כרגיל
    setSelectedColor(colorValue);
  }, [isEditMode]);

  const addTempColor = useCallback((colorValue) => {
    setTempColors(prev => 
      prev.includes(colorValue) ? prev : [...prev, colorValue]
    );
  }, []);

  const removeTempColor = useCallback((colorValue) => {
    setTempColors(prev => prev.filter(c => c !== colorValue));
  }, []);

  const addTempColorsToRoute = useCallback(() => {
    if (tempColors.length === 0) {
      Alert.alert('מידע', 'לא נבחרו צבעים זמניים להוספה');
      return;
    }

    // סינון צבעים שלא קיימים כבר ברשימה הקבועה
    const colorsToAdd = tempColors.filter(tempColor => 
      !customColors.some(customColor => customColor.value === tempColor)
    );

    if (colorsToAdd.length === 0) {
      Alert.alert('מידע', 'כל הצבעים הזמניים כבר קיימים ברשימה הקבועה');
      setTempColors([]);
      return;
    }

    // יצירת אובייקטי צבע חדשים
    const newColorsToAdd = colorsToAdd.map(colorValue => {
      const allCurrentColors = [
        ...DEFAULT_COLORS.filter(color => !deletedDefaultColors.includes(color.value)), 
        ...customColors
      ];
      const existingColor = allCurrentColors.find(c => c.value === colorValue);
      return existingColor || {
        name: `צבע ${colorValue}`,
        value: colorValue,
        textColor: getContrastColor(colorValue)
      };
    });

    // הוספה לרשימה הקבועה
    const updatedCustomColors = [...customColors, ...newColorsToAdd];
    setCustomColors(updatedCustomColors);
    saveCustomColors(updatedCustomColors);
    
    // איפוס רשימת הצבעים הזמניים
    setTempColors([]);
    
    Alert.alert('הושלם', `${colorsToAdd.length} צבעים נוספו לרשימה הקבועה`);
  }, [tempColors, customColors, deletedDefaultColors, getContrastColor, saveCustomColors]);

  // פונקציה לקביעת צבע טקסט מתאים
  const getContrastColor = useCallback((hexColor) => {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#FFFFFF';
  }, []);

  const handleColorDelete = useCallback((colorValue) => {
    // מצא את הצבע למחיקה
    const allCurrentColors = [
      ...DEFAULT_COLORS.filter(color => !deletedDefaultColors.includes(color.value)), 
      ...customColors
    ];
    const colorToDelete = allCurrentColors.find(c => c.value === colorValue);
    const isCustomColor = customColors.some(c => c.value === colorValue);
    const isDefaultColor = DEFAULT_COLORS.some(c => c.value === colorValue);
    
    if (colorToDelete) {
      const colorType = isCustomColor ? 'מותאם אישית' : 'ברירת מחדל';
      
      Alert.alert(
        'מחיקת צבע',
        `האם אתה בטוח שברצונך למחוק את הצבע "${colorToDelete.name}" (${colorType})?`,
        [
          {
            text: 'ביטול',
            style: 'cancel'
          },
          {
            text: 'מחק',
            style: 'destructive',
            onPress: async () => {
              // אם זה צבע מותאם אישית, הסר אותו מהרשימה
              if (isCustomColor) {
                const newColors = customColors.filter(c => c.value !== colorValue);
                setCustomColors(newColors);
                saveCustomColors(newColors);
                Alert.alert('הושלם', 'הצבע המותאם אישית נמחק לצמיתות');
              }
              
              // אם זה צבע ברירת מחדל, הוסף אותו לרשימת הצבעים המוחקים
              if (isDefaultColor) {
                const newDeletedColors = [...deletedDefaultColors, colorValue];
                setDeletedDefaultColors(newDeletedColors);
                saveDeletedDefaultColors(newDeletedColors);
                Alert.alert('הושלם', 'צבע ברירת המחדל הוסתר. ניתן לשחזר אותו בכפתור השחזור');
              }
              
              // אם הצבע הנבחר הוא שנמחק, נוריד את הבחירה
              if (selectedColor === colorValue) {
                setSelectedColor('');
              }
            }
          }
        ]
      );
    }
  }, [customColors, deletedDefaultColors, selectedColor, saveCustomColors, saveDeletedDefaultColors]);

  // Handle custom color return from ColorPickerScreen
  useEffect(() => {
    if (customColor) {
      // עדכון מיידי של הצבע הנבחר
      setSelectedColor(customColor.value);
      
      // הוסף את הצבע לרשימה הזמנית
      addTempColor(customColor.value);
      
      // הוסף את הצבע לרשימה הקבועה רק אם הוא לא קיים
      setCustomColors(prev => {
        const existingColorIndex = prev.findIndex(c => c.value === customColor.value);
        
        if (existingColorIndex === -1) {
          // הוסף צבע חדש לרשימה הקבועה
          const newColors = [...prev, customColor];
          // שמירה אסינכרונית
          AsyncStorage.setItem('customColors', JSON.stringify(newColors))
            .catch(error => {
            // Error saving custom colors
          });
          return newColors;
        }
        return prev;
      });
    }
  }, [customColor, addTempColor]);

  const allColors = [
    ...DEFAULT_COLORS.filter(color => !deletedDefaultColors.includes(color.value)), 
    ...customColors
  ];

  const handleSave = async () => {
    if (!selectedGrade || !selectedColor) {
      Alert.alert('Error', 'Please select both grade and color');
      return;
    }

    if (!coords) {
      Alert.alert('Error', 'No coordinates provided');
      return;
    }

    // Check if user is logged in
    if (!auth.currentUser) {
      Alert.alert('Permission Denied', 'You must be logged in to add routes.');
      return;
    }

    setLoading(true);
    try {
      const routeData = { 
        ...coords, 
        grade: selectedGrade, 
        color: selectedColor,
        createdBy: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
        createdByEmail: auth.currentUser.email
      };
      
      await addRoute(routeData);
      Alert.alert('Success', 'Route added successfully!', [
        { 
          text: 'OK', 
          onPress: () => {
            // חזרה למסך המפה (למסך הקודם של AddRouteScreen)
            navigation.navigate('WallMapScreen');
          }
        }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to add route: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomColor = useCallback(() => {
    navigation.navigate('ColorPickerScreen', {
      coords: coords // Pass coords so they can be returned with the custom color
    });
  }, [navigation, coords]);

  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadCustomColors();
      // רענון נוסף - אפשר לאפס את הבחירות הנוכחיות
      // setSelectedGrade('');
      // setSelectedColor('');
    } finally {
      setRefreshing(false);
    }
  }, [loadCustomColors]);

  const handleRestoreDefaultColors = useCallback(() => {
    Alert.alert(
      'שחזור צבעים',
      'האם אתה בטוח שברצונך לשחזר את כל צבעי ברירת המחדל?',
      [
        {
          text: 'ביטול',
          style: 'cancel'
        },
        {
          text: 'שחזר',
          onPress: () => {
            setDeletedDefaultColors([]);
            saveDeletedDefaultColors([]);
          }
        }
      ]
    );
  }, [saveDeletedDefaultColors]);

  const renderGradeItem = useCallback(({ item, index }) => {
    const isSelected = selectedGrade === item;
    
    return (
      <Pressable
        style={({ pressed }) => [
          styles.gradeButton,
          isSelected && styles.gradeButtonSelected,
          pressed && styles.gradeButtonPressed
        ]}
        onPress={() => handleGradePress(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={[
          styles.gradeButtonText,
          isSelected && styles.gradeButtonTextSelected
        ]}>
          {item}
        </Text>
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Text style={styles.selectedIndicatorText}>✓</Text>
          </View>
        )}
      </Pressable>
    );
  }, [selectedGrade, handleGradePress]);

  const renderColorItem = useCallback(({ item, index }) => {
    const isSelected = selectedColor === item.value;
    const isCustomColor = customColors.some(c => c.value === item.value);
    const isDefaultColor = DEFAULT_COLORS.some(c => c.value === item.value);
    const isTempColor = tempColors.includes(item.value);
    
    return (
      <Pressable
        style={({ pressed }) => [
          styles.colorButton,
          { backgroundColor: item.value },
          isSelected && !isEditMode && styles.colorButtonSelected,
          isEditMode && styles.colorButtonEditMode,
          isTempColor && styles.colorButtonTemp,
          pressed && styles.colorButtonPressed,
          isCustomColor && styles.customColorButton
        ]}
        onPress={() => handleColorPress(item.value)}
        onLongPress={() => {
          if (!isEditMode) {
            addTempColor(item.value);
          }
        }}
        android_disableSound={true}
        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        pressRetentionOffset={{ top: 20, left: 20, right: 20, bottom: 20 }}
      >
        <Text style={[
          styles.colorButtonText,
          { color: item.textColor }
        ]}>
          {item.name}
        </Text>
        {isSelected && !isEditMode && (
          <View style={[styles.selectedIndicator, { backgroundColor: item.textColor }]}>
            <Text style={[styles.selectedIndicatorText, { color: item.value }]}>✓</Text>
          </View>
        )}
        {isCustomColor && (
          <View style={styles.customColorIndicator}>
            <Text style={styles.customColorIndicatorText}>✨</Text>
          </View>
        )}
        {isTempColor && (
          <View style={styles.tempColorIndicator}>
            <Text style={styles.tempColorIndicatorText}>⏰</Text>
          </View>
        )}
        {isEditMode && (
          <View style={styles.deleteIndicator}>
            <Text style={styles.deleteIndicatorText}>🗑️</Text>
          </View>
        )}
      </Pressable>
    );
  }, [selectedColor, handleColorPress, isEditMode]);

  // Create styles based on current theme
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Add New Route</Text>
        <Pressable 
          onPress={() => navigation.navigate('WallMapScreen')}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.headerButtonPressed
          ]}
        >
          <Text style={styles.closeButton}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
            title="משיכה לרענון..."
            titleColor="#007AFF"
          />
        }
      >
          {/* בחירת דירוג */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Grade</Text>
              {selectedGrade && (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>{selectedGrade}</Text>
                </View>
              )}
            </View>
            <FlatList
              data={V_GRADES}
              renderItem={renderGradeItem}
              keyExtractor={(item) => item}
              numColumns={6}
              scrollEnabled={false}
              contentContainerStyle={styles.gradeGrid}
            />
          </View>

          {/* בחירת צבע */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Color</Text>
              <View style={styles.colorHeaderControls}>
                <Pressable
                  style={({ pressed }) => [
                    styles.editButton,
                    isEditMode && styles.editButtonActive,
                    pressed && styles.editButtonPressed
                  ]}
                  onPress={toggleEditMode}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={[
                    styles.editButtonText,
                    isEditMode && styles.editButtonTextActive
                  ]}>
                    {isEditMode ? 'סיום' : 'עריכה'}
                  </Text>
                </Pressable>
                <View style={styles.colorInfo}>
                  <Text style={styles.colorInfoText}>
                    {isEditMode ? 'לחץ על צבע כלשהו למחיקה' : 'לחץ על צבע לבחירה, לחיצה ארוכה להוספה זמנית'}
                  </Text>
                  {selectedColor && !isEditMode && (
                    <View style={[styles.selectedBadge, { backgroundColor: selectedColor }]}>
                      <Text style={[
                        styles.selectedBadgeText, 
                        { color: allColors.find(c => c.value === selectedColor)?.textColor || '#FFFFFF' }
                      ]}>
                        {allColors.find(c => c.value === selectedColor)?.name || 'Custom'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <FlatList
              data={allColors}
              renderItem={renderColorItem}
              keyExtractor={(item, index) => `${item.value}-${index}`}
              numColumns={2}
              scrollEnabled={false}
              contentContainerStyle={styles.colorGrid}
            />
            {isEditMode && (
              <View style={styles.editModeButtons}>
                <View style={styles.addColorButtonContainer}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.addColorButton,
                      pressed && styles.addColorButtonPressed
                    ]}
                    onPress={handleAddCustomColor}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <Text style={styles.addColorButtonIcon}>🎨</Text>
                    <Text style={styles.addColorButtonText}>הוסף צבע מותאם אישית</Text>
                  </Pressable>
                </View>
                {deletedDefaultColors.length > 0 && (
                  <View style={styles.addColorButtonContainer}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.restoreButton,
                        pressed && styles.restoreButtonPressed
                      ]}
                      onPress={handleRestoreDefaultColors}
                      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                      <Text style={styles.restoreButtonIcon}>🔄</Text>
                      <Text style={styles.restoreButtonText}>שחזר צבעי ברירת מחדל</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* צבעים זמניים */}
          {tempColors.length > 0 && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>צבעים זמניים ({tempColors.length})</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.clearTempButton,
                    pressed && styles.clearTempButtonPressed
                  ]}
                  onPress={() => setTempColors([])}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.clearTempButtonText}>נקה הכל</Text>
                </Pressable>
              </View>
              
              <Text style={styles.tempColorsHelpText}>
                לחץ על צבע למחיקה מהרשימה הזמנית
              </Text>
              
              <View style={styles.tempColorsContainer}>
                {tempColors.map((colorValue, index) => {
                  const colorData = allColors.find(c => c.value === colorValue) || {
                    name: `צבע ${colorValue}`,
                    value: colorValue,
                    textColor: getContrastColor(colorValue)
                  };
                  
                  return (
                    <Pressable
                      key={`temp-${colorValue}-${index}`}
                      style={({ pressed }) => [
                        styles.tempColorButton,
                        { backgroundColor: colorValue },
                        pressed && styles.tempColorButtonPressed
                      ]}
                      onPress={() => removeTempColor(colorValue)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={[
                        styles.tempColorButtonText,
                        { color: colorData.textColor }
                      ]}>
                        {colorData.name}
                      </Text>
                      <View style={styles.tempColorRemoveIcon}>
                        <Text style={styles.tempColorRemoveIconText}>×</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              
              <View style={styles.tempColorsActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.addTempColorsButton,
                    pressed && styles.addTempColorsButtonPressed
                  ]}
                  onPress={addTempColorsToRoute}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.addTempColorsButtonIcon}>➕</Text>
                  <Text style={styles.addTempColorsButtonText}>הוסף לרשימה הקבועה</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* רמז על צבעים זמניים אם הרשימה ריקה */}
          {tempColors.length === 0 && !isEditMode && (
            <View style={styles.tempColorsHint}>
              <Text style={styles.tempColorsHintText}>
                💡 טיפ: לחץ לחיצה ארוכה על צבע כדי להוסיף אותו לרשימה הזמנית
              </Text>
            </View>
          )}

          {/* כפתור שמירה */}
          {!isEditMode && (
            <Pressable 
              style={({ pressed }) => [
                styles.saveButton, 
                (!selectedGrade || !selectedColor) && styles.saveButtonDisabled,
                loading && styles.saveButtonLoading,
                pressed && selectedGrade && selectedColor && !loading && styles.saveButtonPressed
              ]} 
              onPress={handleSave}
              disabled={loading || !selectedGrade || !selectedColor}
            >
              <View style={styles.saveButtonContent}>
                <Text style={styles.saveButtonIcon}>🧗‍♂️</Text>
                <Text style={styles.saveButtonText}>
                  {loading ? 'Saving Route...' : 'Save Route'}
                </Text>
              </View>
            </Pressable>
          )}
        </ScrollView>
      </View>
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
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.text,
  },
  closeButton: {
    fontSize: 16,
    color: theme.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionContainer: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  colorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  colorHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    flex: 1,
    justifyContent: 'space-between',
  },
  colorInfoText: {
    fontSize: 10,
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'right',
    maxWidth: 140,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  selectedBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  selectedBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  gradeGrid: {
    gap: 10,
  },
  gradeButton: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    margin: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    minHeight: 50,
  },
  gradeButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    transform: [{ scale: 1.05 }],
    elevation: 4,
    shadowOpacity: 0.3,
  },
  gradeButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  gradeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
  },
  gradeButtonTextSelected: {
    color: '#ffffff',
  },
  colorGrid: {
    gap: 10,
  },
  colorButton: {
    flex: 1,
    height: 60,
    borderRadius: 12,
    margin: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  colorButtonSelected: {
    borderColor: '#2c3e50',
    transform: [{ scale: 1.02 }],
    elevation: 5,
    shadowOpacity: 0.4,
  },
  colorButtonEditMode: {
    borderColor: '#dc3545',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  colorButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  customColorButton: {
    borderWidth: 2,
    borderColor: '#ffc107',
    borderStyle: 'dashed',
  },
  colorButtonTemp: {
    borderWidth: 3,
    borderColor: '#17a2b8',
    borderStyle: 'solid',
  },
  colorButtonText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  selectedIndicatorText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  customColorIndicator: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 193, 7, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customColorIndicatorText: {
    fontSize: 10,
    color: '#fff',
  },
  tempColorIndicator: {
    position: 'absolute',
    top: 2,
    right: 20,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(23, 162, 184, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tempColorIndicatorText: {
    fontSize: 10,
    color: '#fff',
  },
  deleteIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(220, 53, 69, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIndicatorText: {
    fontSize: 12,
    color: '#fff',
  },
  editButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  editButtonActive: {
    backgroundColor: '#dc3545',
  },
  editButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  editButtonTextActive: {
    color: '#ffffff',
  },
  editModeButtons: {
    marginTop: 10,
    gap: 10,
  },
  addColorButtonContainer: {
    paddingHorizontal: 4,
  },
  addColorButton: {
    height: 60,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#28a745',
    borderStyle: 'dashed',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    flexDirection: 'row',
  },
  addColorButtonPressed: {
    opacity: 0.7,
    backgroundColor: '#f8f9fa',
    transform: [{ scale: 0.98 }],
    borderColor: '#218838',
  },
  addColorButtonIcon: {
    fontSize: 22,
    marginRight: 8,
  },
  addColorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#28a745',
  },
  restoreButton: {
    height: 60,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    flexDirection: 'row',
  },
  restoreButtonPressed: {
    opacity: 0.7,
    backgroundColor: '#f8f9fa',
    transform: [{ scale: 0.98 }],
    borderColor: '#0056b3',
  },
  restoreButtonIcon: {
    fontSize: 22,
    marginRight: 8,
  },
  restoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  clearTempButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    alignItems: 'center',
  },
  clearTempButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  clearTempButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  tempColorsHelpText: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'right',
    marginBottom: 10,
  },
  tempColorsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15,
  },
  tempColorButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    marginRight: 8,
    marginBottom: 8,
  },
  tempColorButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  tempColorButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 6,
  },
  tempColorRemoveIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tempColorRemoveIconText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  tempColorsActions: {
    alignItems: 'center',
  },
  addTempColorsButton: {
    backgroundColor: '#17a2b8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    minWidth: 200,
  },
  addTempColorsButtonPressed: {
    opacity: 0.8,
    backgroundColor: '#138496',
    transform: [{ scale: 0.95 }],
  },
  addTempColorsButtonIcon: {
    fontSize: 16,
    marginRight: 8,
    color: '#ffffff',
  },
  addTempColorsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  tempColorsHint: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#17a2b8',
  },
  tempColorsHintText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'right',
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#28a745',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  saveButtonDisabled: {
    backgroundColor: '#adb5bd',
    elevation: 1,
    shadowOpacity: 0.1,
  },
  saveButtonLoading: {
    backgroundColor: '#6c757d',
  },
  saveButtonPressed: {
    opacity: 0.8,
    backgroundColor: '#218838',
    transform: [{ scale: 0.98 }],
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerButtonPressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
});