// screens/Routes/NewRouteScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouteStore } from '../../features/routes/store';
import { THEME_COLORS } from '../../constants/colors';
import { HOLD_ROLE_CONFIG, ROLE_ORDER } from '../../constants/roles';
import { validateRoute } from '../../features/routes/validators';

interface NewRouteScreenProps {
  navigation: any;
  route: {
    params: {
      wallId: string;
    };
  };
}

export const NewRouteScreen: React.FC<NewRouteScreenProps> = ({
  navigation,
  route: routeParams,
}) => {
  const routeStore = useRouteStore();
  const [routeName, setRouteName] = useState('');
  const [routeGrade, setRouteGrade] = useState('');
  const [routeStyle, setRouteStyle] = useState('boulder');
  const [selectedRole, setSelectedRole] = useState<'start' | 'finish' | 'hand' | 'foot' | 'any'>('start');

  useEffect(() => {
    // אתחל מסלול חדש
    routeStore.setRoute({
      wallId: routeParams.params.wallId,
      holds: [],
      name: '',
      grade: '',
      style: 'boulder',
      createdAt: Date.now(),
      createdBy: 'current-user', // TODO: מידע משתמש אמיתי
    });
  }, []);

  const handleSaveRoute = () => {
    const validation = routeStore.validate();
    
    if (!routeName.trim()) {
      Alert.alert('שגיאה', 'אנא הזן שם למסלול');
      return;
    }

    if (!validation.isValid) {
      Alert.alert('שגיאה', validation.errors.join('\n'));
      return;
    }

    // עדכן מטה-דאטה
    routeStore.updateRouteMeta({
      name: routeName,
      grade: routeGrade,
      style: routeStyle,
    });

    Alert.alert(
      'שמירת מסלול',
      'האם לשמור את המסלול?',
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'שמור', onPress: saveRoute },
      ]
    );
  };

  const saveRoute = async () => {
    try {
      // TODO: שמירה ב-Firebase
      Alert.alert('הצלחה', 'המסלול נשמר בהצלחה', [
        { text: 'אישור', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לשמור את המסלול');
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'איפוס',
      'האם למחוק את כל האחיזות?',
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'מחק', style: 'destructive', onPress: routeStore.clearAllHolds },
      ]
    );
  };

  const currentHolds = routeStore.route.holds || [];
  const validation = routeStore.validate();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerButton}>ביטול</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>מסלול חדש</Text>
        <TouchableOpacity onPress={handleSaveRoute}>
          <Text style={[styles.headerButton, styles.saveButton]}>שמור</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Route Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>פרטי המסלול</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>שם המסלול</Text>
            <TextInput
              style={styles.textInput}
              value={routeName}
              onChangeText={setRouteName}
              placeholder="הזן שם למסלול"
              placeholderTextColor={THEME_COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>דירוג</Text>
            <TextInput
              style={styles.textInput}
              value={routeGrade}
              onChangeText={setRouteGrade}
              placeholder="למשל: V3, 6a+"
              placeholderTextColor={THEME_COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>סגנון</Text>
            <View style={styles.styleButtons}>
              {['boulder', 'lead', 'top-rope'].map((style) => (
                <TouchableOpacity
                  key={style}
                  style={[
                    styles.styleButton,
                    routeStyle === style && styles.selectedStyleButton
                  ]}
                  onPress={() => setRouteStyle(style)}
                >
                  <Text style={[
                    styles.styleButtonText,
                    routeStyle === style && styles.selectedStyleButtonText
                  ]}>
                    {style === 'boulder' ? 'בולדר' : 
                     style === 'lead' ? 'ליד' : 'טופ רופ'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Hold Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>בחירת תפקיד אחיזה</Text>
          <View style={styles.roleButtons}>
            {ROLE_ORDER.map((role) => {
              const config = HOLD_ROLE_CONFIG[role];
              return (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleButton,
                    selectedRole === role && styles.selectedRoleButton,
                    { borderColor: config.color }
                  ]}
                  onPress={() => setSelectedRole(role)}
                >
                  <Text style={styles.roleIcon}>{config.icon}</Text>
                  <Text style={[
                    styles.roleText,
                    selectedRole === role && styles.selectedRoleText
                  ]}>
                    {config.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Route Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>התקדמות המסלול</Text>
          
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              אחיזות: {currentHolds.length}
            </Text>
            
            {ROLE_ORDER.map((role) => {
              const count = currentHolds.filter(h => h.role === role).length;
              const config = HOLD_ROLE_CONFIG[role];
              
              return count > 0 ? (
                <Text key={role} style={styles.progressText}>
                  {config.icon} {config.name}: {count}
                </Text>
              ) : null;
            })}
          </View>

          {/* Validation Status */}
          {!validation.isValid && (
            <View style={styles.validationContainer}>
              <Text style={styles.validationTitle}>שגיאות:</Text>
              {validation.errors.map((error, index) => (
                <Text key={index} style={styles.errorText}>• {error}</Text>
              ))}
            </View>
          )}

          {validation.warnings.length > 0 && (
            <View style={styles.validationContainer}>
              <Text style={styles.validationTitle}>התראות:</Text>
              {validation.warnings.map((warning, index) => (
                <Text key={index} style={styles.warningText}>• {warning}</Text>
              ))}
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearAll}
            disabled={currentHolds.length === 0}
          >
            <Text style={styles.clearButtonText}>מחק את כל האחיזות</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsText}>
          🎯 בחר תפקיד אחיזה ולחץ על הקיר להוספת אחיזה
        </Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: THEME_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.border,
  },
  headerButton: {
    fontSize: 16,
    color: THEME_COLORS.primary,
    fontWeight: '600',
  },
  saveButton: {
    color: THEME_COLORS.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: THEME_COLORS.surface,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME_COLORS.text,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME_COLORS.text,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: THEME_COLORS.text,
    backgroundColor: THEME_COLORS.background,
  },
  styleButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  styleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    alignItems: 'center',
  },
  selectedStyleButton: {
    backgroundColor: THEME_COLORS.primary,
    borderColor: THEME_COLORS.primary,
  },
  styleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  selectedStyleButtonText: {
    color: '#FFFFFF',
  },
  roleButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleButton: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    backgroundColor: THEME_COLORS.background,
  },
  selectedRoleButton: {
    backgroundColor: THEME_COLORS.surface,
  },
  roleIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  selectedRoleText: {
    color: THEME_COLORS.primary,
  },
  progressContainer: {
    gap: 8,
  },
  progressText: {
    fontSize: 14,
    color: THEME_COLORS.text,
  },
  validationContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: THEME_COLORS.background,
    borderRadius: 8,
  },
  validationTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: THEME_COLORS.error,
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: THEME_COLORS.warning,
    marginBottom: 4,
  },
  clearButton: {
    backgroundColor: THEME_COLORS.error,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  instructions: {
    backgroundColor: THEME_COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.border,
  },
  instructionsText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    textAlign: 'center',
  },
});
