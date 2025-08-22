// screens/SprayWall/SprayWallScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomToolbar } from '../../components/ui/BottomToolbar';
import { FloatingPanel } from '../../components/ui/FloatingPanel';
import { ToolButton } from '../../components/ui/ToolButton';
import { THEME_COLORS } from '../../constants/colors';
import { screenToCanonical, canonicalToScreen } from '../../utils/matrix';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface SprayWallScreenProps {
  route: {
    params: {
      wallId?: string;
    };
  };
  navigation: any;
}

export const SprayWallScreen: React.FC<SprayWallScreenProps> = ({ 
  route, 
  navigation 
}) => {
  const [selectedTool, setSelectedTool] = useState('circle');
  const [transform, setTransform] = useState({ scale: 1, tx: 0, ty: 0 });
  const [wallImage, setWallImage] = useState<string | null>(null);

  const tools = [
    { id: 'circle', title: 'טבעת', icon: '⭕' },
    { id: 'dot', title: 'נקודה', icon: '⚫' },
    { id: 'volume', title: 'נפח', icon: '📦' },
    { id: 'outline', title: 'קו מתאר', icon: '🔲' },
  ];

  const handleToolSelect = (toolId: string) => {
    setSelectedTool(toolId);
  };

  const handleCanvasTouch = (x: number, y: number) => {
    if (!wallImage) return;

    const canonicalPoint = screenToCanonical(
      x, 
      y, 
      transform.tx, 
      transform.ty, 
      transform.scale
    );

    console.log('Touch at canonical:', canonicalPoint);
    
    // כאן נוסיף את הלוגיקה להוספת אחיזה
    switch (selectedTool) {
      case 'circle':
        // addCircleHold(canonicalPoint);
        break;
      case 'dot':
        // addDotHold(canonicalPoint);
        break;
      case 'volume':
        // startVolumeCreation(canonicalPoint);
        break;
      case 'outline':
        // startOutlineCreation(canonicalPoint);
        break;
    }
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleMenuPress = () => {
    // תפריט עם אפשרויות נוספות
    Alert.alert(
      'אפשרויות',
      'בחר פעולה',
      [
        { text: 'הגדרות רשת', onPress: () => navigateToGridAlign() },
        { text: 'כלי סימטריה', onPress: () => navigateToSymmetry() },
        { text: 'ייצוא תמונה', onPress: () => exportImage() },
        { text: 'ביטול', style: 'cancel' },
      ]
    );
  };

  const navigateToGridAlign = () => {
    navigation.navigate('GridAlignScreen', { wallId: route.params?.wallId });
  };

  const navigateToSymmetry = () => {
    navigation.navigate('SymmetryToolsScreen', { wallId: route.params?.wallId });
  };

  const exportImage = () => {
    // לוגיקת ייצוא
    Alert.alert('ייצוא', 'התמונה נשמרה בהצלחה');
  };

  useEffect(() => {
    // טען את תמונת הקיר
    // loadWallImage(route.params?.wallId);
  }, [route.params?.wallId]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header Controls */}
      <FloatingPanel position="top-left">
        <ToolButton
          title="חזור"
          icon="◀"
          onPress={handleBackPress}
        />
      </FloatingPanel>

      <FloatingPanel position="top-right">
        <ToolButton
          title="תפריט"
          icon="☰"
          onPress={handleMenuPress}
        />
      </FloatingPanel>

      {/* Main Canvas Area */}
      <View style={styles.canvasContainer}>
        {/* כאן יהיה קנבס Skia או רכיב תמונה אינטראקטיבי */}
        <View style={styles.placeholder}>
          {/* Placeholder עד שנוסיף את קנבס Skia */}
        </View>
      </View>

      {/* Bottom Toolbar */}
      <BottomToolbar
        selectedTool={selectedTool}
        onToolSelect={handleToolSelect}
        tools={tools}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  canvasContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: THEME_COLORS.surface,
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
