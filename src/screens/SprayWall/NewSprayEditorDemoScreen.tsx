// src/screens/SprayWall/NewSprayEditorDemoScreen.tsx
import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NewSprayEditor } from '../../components/NewSprayEditor';
import { THEME_COLORS } from '../../constants/colors';

interface NewSprayEditorDemoScreenProps {
  navigation: any;
  route?: {
    params?: {
      wallId?: string;
      wallImageUri?: string;
    };
  };
}

export const NewSprayEditorDemoScreen: React.FC<NewSprayEditorDemoScreenProps> = ({
  navigation,
  route,
}) => {
  const { wallId, wallImageUri } = route?.params || {};

  const handleSave = (routeData: any) => {
    console.log('Saving route:', routeData);
    
    Alert.alert(
      'שמירת מסלול',
      `נשמר מסלול עם ${routeData.holds?.length || 0} אחיזות`,
      [
        { text: 'אישור', onPress: () => navigation.goBack() }
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'ביטול',
      'האם לבטל את עריכת המסלול?',
      [
        { text: 'המשך עריכה', style: 'cancel' },
        { text: 'בטל', style: 'destructive', onPress: () => navigation.goBack() }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <NewSprayEditor
        wallId={wallId}
        wallImageUri={wallImageUri}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
});
