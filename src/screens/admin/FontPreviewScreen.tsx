import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/features/theme/ThemeContext';

/**
 * System fonts available on iOS and Android without downloading anything.
 * Each entry: { name: display label, fontFamily: the RN fontFamily value }
 */
const SYSTEM_FONTS: { name: string; fontFamily: string; platforms: ('ios' | 'android')[] }[] = [
  // Cross-platform
  { name: 'System Default', fontFamily: 'System', platforms: ['ios', 'android'] },
  { name: 'Monospace', fontFamily: 'monospace', platforms: ['ios', 'android'] },

  // iOS fonts
  { name: 'San Francisco (SF Pro)', fontFamily: 'System', platforms: ['ios'] },
  { name: 'Helvetica Neue', fontFamily: 'HelveticaNeue', platforms: ['ios'] },
  { name: 'Helvetica', fontFamily: 'Helvetica', platforms: ['ios'] },
  { name: 'Arial', fontFamily: 'Arial', platforms: ['ios'] },
  { name: 'Arial Hebrew', fontFamily: 'ArialHebrew', platforms: ['ios'] },
  { name: 'Arial Rounded MT Bold', fontFamily: 'ArialRoundedMTBold', platforms: ['ios'] },
  { name: 'Avenir', fontFamily: 'Avenir', platforms: ['ios'] },
  { name: 'Avenir Next', fontFamily: 'AvenirNext-Regular', platforms: ['ios'] },
  { name: 'Avenir Next Condensed', fontFamily: 'AvenirNextCondensed-Regular', platforms: ['ios'] },
  { name: 'Baskerville', fontFamily: 'Baskerville', platforms: ['ios'] },
  { name: 'Bodoni 72', fontFamily: 'BodoniSvtyTwoITCTT-Book', platforms: ['ios'] },
  { name: 'Chalkboard SE', fontFamily: 'ChalkboardSE-Regular', platforms: ['ios'] },
  { name: 'Cochin', fontFamily: 'Cochin', platforms: ['ios'] },
  { name: 'Copperplate', fontFamily: 'Copperplate', platforms: ['ios'] },
  { name: 'Courier', fontFamily: 'Courier', platforms: ['ios'] },
  { name: 'Courier New', fontFamily: 'CourierNewPSMT', platforms: ['ios'] },
  { name: 'Damascus', fontFamily: 'Damascus', platforms: ['ios'] },
  { name: 'Didot', fontFamily: 'Didot', platforms: ['ios'] },
  { name: 'Futura', fontFamily: 'Futura-Medium', platforms: ['ios'] },
  { name: 'Georgia', fontFamily: 'Georgia', platforms: ['ios'] },
  { name: 'Gill Sans', fontFamily: 'GillSans', platforms: ['ios'] },
  { name: 'Hoefler Text', fontFamily: 'HoeflerText-Regular', platforms: ['ios'] },
  { name: 'Iowan Old Style', fontFamily: 'IowanOldStyle-Roman', platforms: ['ios'] },
  { name: 'Kailasa', fontFamily: 'Kailasa', platforms: ['ios'] },
  { name: 'Marker Felt', fontFamily: 'MarkerFelt-Thin', platforms: ['ios'] },
  { name: 'Menlo', fontFamily: 'Menlo-Regular', platforms: ['ios'] },
  { name: 'Noteworthy', fontFamily: 'Noteworthy-Light', platforms: ['ios'] },
  { name: 'Optima', fontFamily: 'Optima-Regular', platforms: ['ios'] },
  { name: 'Palatino', fontFamily: 'Palatino-Roman', platforms: ['ios'] },
  { name: 'Papyrus', fontFamily: 'Papyrus', platforms: ['ios'] },
  { name: 'Party LET', fontFamily: 'PartyLetPlain', platforms: ['ios'] },
  { name: 'Rockwell', fontFamily: 'Rockwell-Regular', platforms: ['ios'] },
  { name: 'Savoye LET', fontFamily: 'SavoyeLetPlain', platforms: ['ios'] },
  { name: 'Snell Roundhand', fontFamily: 'SnellRoundhand', platforms: ['ios'] },
  { name: 'Symbol', fontFamily: 'Symbol', platforms: ['ios'] },
  { name: 'Thonburi', fontFamily: 'Thonburi', platforms: ['ios'] },
  { name: 'Times New Roman', fontFamily: 'TimesNewRomanPSMT', platforms: ['ios'] },
  { name: 'Trebuchet MS', fontFamily: 'TrebuchetMS', platforms: ['ios'] },
  { name: 'Verdana', fontFamily: 'Verdana', platforms: ['ios'] },
  { name: 'Zapfino', fontFamily: 'Zapfino', platforms: ['ios'] },

  // Android fonts
  { name: 'Roboto', fontFamily: 'Roboto', platforms: ['android'] },
  { name: 'Noto Sans', fontFamily: 'noto-sans', platforms: ['android'] },
  { name: 'Droid Sans', fontFamily: 'Droid Sans', platforms: ['android'] },
  { name: 'Droid Serif', fontFamily: 'Droid Serif', platforms: ['android'] },
  { name: 'Droid Sans Mono', fontFamily: 'Droid Sans Mono', platforms: ['android'] },
  { name: 'Cutive Mono', fontFamily: 'cutive-mono', platforms: ['android'] },
  { name: 'Coming Soon', fontFamily: 'coming-soon', platforms: ['android'] },
  { name: 'Carrois Gothic SC', fontFamily: 'carrois-gothic-sc', platforms: ['android'] },
  { name: 'Dancing Script', fontFamily: 'dancing-script', platforms: ['android'] },
  { name: 'sans-serif', fontFamily: 'sans-serif', platforms: ['android'] },
  { name: 'sans-serif-light', fontFamily: 'sans-serif-light', platforms: ['android'] },
  { name: 'sans-serif-thin', fontFamily: 'sans-serif-thin', platforms: ['android'] },
  { name: 'sans-serif-condensed', fontFamily: 'sans-serif-condensed', platforms: ['android'] },
  { name: 'sans-serif-medium', fontFamily: 'sans-serif-medium', platforms: ['android'] },
  { name: 'serif', fontFamily: 'serif', platforms: ['android'] },
  { name: 'casual', fontFamily: 'casual', platforms: ['android'] },
  { name: 'cursive', fontFamily: 'cursive', platforms: ['android'] },
];

const FONT_SIZES = [14, 18, 24, 32];

const PREVIEW_TEXTS = {
  english: 'The quick brown fox jumps over the lazy dog',
  hebrew: 'אבגדהוזחטיכלמנסעפצקרשת 0123456789',
  numbers: 'AaBbCcDd 1234567890 !@#$%',
};

export default function FontPreviewScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [selectedSize, setSelectedSize] = useState(18);
  const [customText, setCustomText] = useState('');
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);

  const currentPlatform = Platform.OS as 'ios' | 'android';

  const fonts = showAllPlatforms
    ? SYSTEM_FONTS
    : SYSTEM_FONTS.filter((f) => f.platforms.includes(currentPlatform));

  const previewText = customText || PREVIEW_TEXTS.hebrew;

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🔤 תצוגת פונטים</Text>
        <View style={styles.backButton} />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Custom text input */}
        <TextInput
          style={styles.textInput}
          placeholder="הקלד טקסט לתצוגה מקדימה..."
          placeholderTextColor={theme.textSecondary}
          value={customText}
          onChangeText={setCustomText}
        />

        {/* Font size selector */}
        <View style={styles.sizeRow}>
          <Text style={styles.sizeLabel}>גודל:</Text>
          {FONT_SIZES.map((size) => (
            <TouchableOpacity
              key={size}
              style={[styles.sizeButton, selectedSize === size && styles.sizeButtonActive]}
              onPress={() => setSelectedSize(size)}
            >
              <Text
                style={[styles.sizeButtonText, selectedSize === size && styles.sizeButtonTextActive]}
              >
                {size}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Platform toggle */}
        <TouchableOpacity
          style={styles.platformToggle}
          onPress={() => setShowAllPlatforms(!showAllPlatforms)}
        >
          <Text style={styles.platformToggleText}>
            {showAllPlatforms
              ? `כל הפלטפורמות (${SYSTEM_FONTS.length})`
              : `${currentPlatform === 'ios' ? 'iOS' : 'Android'} בלבד (${fonts.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Font list */}
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {fonts.map((font, index) => (
          <View key={`${font.fontFamily}-${index}`} style={styles.fontCard}>
            <View style={styles.fontHeader}>
              <Text style={styles.fontName}>{font.name}</Text>
              <Text style={styles.fontFamily}>{font.fontFamily}</Text>
              <View style={styles.platformBadges}>
                {font.platforms.map((p) => (
                  <View
                    key={p}
                    style={[
                      styles.platformBadge,
                      p === currentPlatform && styles.platformBadgeCurrent,
                    ]}
                  >
                    <Text
                      style={[
                        styles.platformBadgeText,
                        p === currentPlatform && styles.platformBadgeTextCurrent,
                      ]}
                    >
                      {p}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <Text
              style={[styles.preview, { fontFamily: font.fontFamily, fontSize: selectedSize }]}
              numberOfLines={2}
            >
              {previewText}
            </Text>
            {/* Show English sample too */}
            {!customText && (
              <Text
                style={[
                  styles.preview,
                  styles.previewSecondary,
                  { fontFamily: font.fontFamily, fontSize: selectedSize - 2 },
                ]}
                numberOfLines={1}
              >
                {PREVIEW_TEXTS.english}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButtonText: {
      fontSize: 24,
      color: theme.primary,
      fontWeight: '600',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
      writingDirection: 'rtl',
    },
    controls: {
      padding: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 10,
    },
    textInput: {
      backgroundColor: theme.background,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
      writingDirection: 'rtl',
      textAlign: 'right',
    },
    sizeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sizeLabel: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: '600',
      writingDirection: 'rtl',
    },
    sizeButton: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sizeButtonActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    sizeButtonText: {
      fontSize: 13,
      color: theme.text,
      fontWeight: '600',
    },
    sizeButtonTextActive: {
      color: '#fff',
    },
    platformToggle: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    platformToggleText: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: '600',
    },
    list: {
      padding: 12,
      paddingBottom: 40,
      gap: 12,
    },
    fontCard: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 16,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    fontHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      flexWrap: 'wrap',
      gap: 8,
    },
    fontName: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    fontFamily: {
      fontSize: 12,
      color: theme.textSecondary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo-Regular' : 'monospace',
    },
    platformBadges: {
      flexDirection: 'row',
      gap: 4,
      marginLeft: 'auto',
    },
    platformBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: theme.border,
    },
    platformBadgeCurrent: {
      backgroundColor: theme.primary + '22',
    },
    platformBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.textSecondary,
      textTransform: 'uppercase',
    },
    platformBadgeTextCurrent: {
      color: theme.primary,
    },
    preview: {
      color: theme.text,
      lineHeight: undefined,
      writingDirection: 'rtl',
    },
    previewSecondary: {
      color: theme.textSecondary,
      marginTop: 4,
      writingDirection: 'ltr',
    },
  });
}
