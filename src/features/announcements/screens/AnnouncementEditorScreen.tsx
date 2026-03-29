/**
 * @fileoverview Announcement Editor Screen
 * @description Screen for creating/editing announcements with preview
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';
import { useTheme, lightTheme } from '@/features/theme/ThemeContext';
import { useRolesContext } from '@/features/roles/RolesContext';
import { useLanguage } from '@/features/language';
import {
  Announcement,
  AnnouncementFormData,
  AnnouncementBackground,
  ImageEditingOptions,
  DEFAULT_IMAGE_EDITING,
  BACKGROUND_PRESETS,
  ICON_OPTIONS,
} from '../types';
import {
  createAnnouncement,
  updateAnnouncement,
  getAnnouncement,
  saveDraft,
} from '../announcementService';
import { AnnouncementCard } from '../components/AnnouncementCard';

type Theme = typeof lightTheme;

export function AnnouncementEditorScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const { canManageAnnouncements } = useRolesContext();
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  const announcementId = (route.params as any)?.announcementId;
  const isEditing = !!announcementId;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [icon, setIcon] = useState('📢');
  const [background, setBackground] = useState<AnnouncementBackground>({
    type: 'color',
    color: '#3B82F6',
  });
  const [imageEditing, setImageEditing] = useState<ImageEditingOptions>(DEFAULT_IMAGE_EDITING);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(() => {
    const end = new Date();
    end.setDate(end.getDate() + 7); // Default: 1 week
    return end;
  });
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaAction, setCtaAction] = useState('');
  const [ctaBackgroundColor, setCtaBackgroundColor] = useState('#FFFFFF');
  const [ctaTextColor, setCtaTextColor] = useState('#000000');
  const [ctaOpacity, setCtaOpacity] = useState(1);

  useEffect(() => {
    if (isEditing) {
      loadAnnouncement();
    }
  }, [announcementId]);

  const loadAnnouncement = async () => {
    try {
      const announcement = await getAnnouncement(announcementId);
      if (announcement) {
        setTitle(announcement.title);
        setText(announcement.text);
        setIcon(announcement.icon || '📢');
        setBackground(announcement.background);
        if (announcement.background.imageEditing) {
          setImageEditing(announcement.background.imageEditing);
        }
        setStartDate(announcement.startDate);
        setEndDate(announcement.endDate);
        if (announcement.cta) {
          setCtaLabel(announcement.cta.label);
          setCtaAction(announcement.cta.actionValue || '');
          setCtaBackgroundColor(announcement.cta.backgroundColor || '#FFFFFF');
          setCtaTextColor(announcement.cta.textColor || '#000000');
          setCtaOpacity((announcement.cta as any).opacity || 1);
        }
      }
    } catch (error) {
      console.error('Error loading announcement:', error);
      Alert.alert(t.common.error, t.announcements.cannotLoad);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert(t.common.error, t.announcements.enterTitle);
      return false;
    }
    if (!text.trim()) {
      Alert.alert(t.common.error, t.announcements.enterText);
      return false;
    }
    if (startDate >= endDate) {
      Alert.alert(t.common.error, t.competitionExt.endAfterStart);
      return false;
    }
    return true;
  };

  const getFormData = (): AnnouncementFormData => {
    // Build background with image editing options if applicable
    const finalBackground: AnnouncementBackground = {
      ...background,
      imageEditing: background.type === 'image' ? imageEditing : undefined,
    };
    
    const formData: AnnouncementFormData = {
      title: title.trim(),
      text: text.trim(),
      icon,
      background: finalBackground,
      startDate,
      endDate,
      priority: 0,
    };

    if (ctaLabel.trim()) {
      formData.cta = {
        label: ctaLabel.trim(),
        actionType: ctaAction.startsWith('http') ? 'link' : 'dismiss',
        actionValue: ctaAction.trim() || undefined,
        backgroundColor: ctaBackgroundColor,
        textColor: ctaTextColor,
        opacity: ctaOpacity,
      };
    }

    return formData;
  };

  const handleSave = async (asDraft = false) => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const formData = getFormData();

      if (asDraft) {
        if (isEditing) {
          await updateAnnouncement(announcementId, formData);
        } else {
          await saveDraft(formData);
        }
        Alert.alert(t.common.success, t.announcements.saved);
      } else {
        if (isEditing) {
          await updateAnnouncement(announcementId, formData);
        } else {
          await createAnnouncement(formData);
        }
        Alert.alert(t.common.success, t.announcements.saved);
      }
      navigation.goBack();
    } catch (error) {
      console.error('Error saving announcement:', error);
      Alert.alert(t.common.error, t.announcements.cannotSave);
    } finally {
      setSaving(false);
    }
  };

  const getPreviewAnnouncement = (): Announcement => {
    const previewBackground: AnnouncementBackground = {
      ...background,
      imageEditing: background.type === 'image' ? imageEditing : undefined,
    };
    
    return {
      id: 'preview',
      title: title || 'כותרת ההודעה',
      text: text || 'טקסט ההודעה יופיע כאן...',
      icon,
      background: previewBackground,
      startDate,
      endDate,
      priority: 0,
      status: 'active',
      createdBy: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      cta: ctaLabel
        ? {
            label: ctaLabel,
            actionType: 'dismiss',
            backgroundColor: ctaBackgroundColor,
            textColor: ctaTextColor,
            opacity: ctaOpacity,
          } as any
        : undefined,
    };
  };

  // Image picker function
  const pickBackgroundImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setBackground({
          type: 'image',
          localImageUri: result.assets[0].uri,
          imageEditing: imageEditing,
        });
        setImageEditing(DEFAULT_IMAGE_EDITING);
        setShowImageEditor(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(t.common.error, t.errors.loadFailed);
    }
  };

  // Remove background image
  const removeBackgroundImage = () => {
    setBackground({
      type: 'color',
      color: '#3B82F6',
    });
    setImageEditing(DEFAULT_IMAGE_EDITING);
  };

  // Update image editing option
  const updateImageEditing = (key: keyof ImageEditingOptions, value: number | string | undefined) => {
    setImageEditing(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!canManageAnnouncements) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color="#ccc" />
          <Text style={styles.accessDeniedText}>אין לך הרשאה לעמוד זה</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerGradient }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'עריכת הודעה' : 'הודעה חדשה'}
        </Text>
        <TouchableOpacity 
          style={styles.headerButton} 
          onPress={() => setShowPreview(true)}
        >
          <Ionicons name="eye" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Icon Picker */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>אייקון</Text>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: theme.surface }]}
            onPress={() => setShowIconPicker(true)}
          >
            <Text style={styles.selectedIcon}>{icon}</Text>
            <Text style={[styles.changeText, { color: theme.textSecondary }]}>שנה</Text>
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>כותרת *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
            placeholder={t.announcements.titlePlaceholder}
            placeholderTextColor={theme.textSecondary}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Text */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>טקסט *</Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              { backgroundColor: theme.surface, color: theme.text },
            ]}
            placeholder={t.announcements.messagePlaceholder}
            placeholderTextColor={theme.textSecondary}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Background */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>רקע</Text>
          
          {/* Image Background Option */}
          {background.type === 'image' ? (
            <View style={styles.imageBackgroundContainer}>
              <Image
                source={{ uri: background.imageUrl || background.localImageUri }}
                style={styles.imageBackgroundPreview}
                resizeMode="cover"
              />
              <View style={styles.imageBackgroundActions}>
                <TouchableOpacity
                  style={[styles.imageActionButton, { backgroundColor: theme.buttonPrimary }]}
                  onPress={() => setShowImageEditor(true)}
                >
                  <Ionicons name="settings" size={18} color="#FFFFFF" />
                  <Text style={styles.imageActionText}>עריכה</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.imageActionButton, { backgroundColor: '#EF4444' }]}
                  onPress={removeBackgroundImage}
                >
                  <Ionicons name="trash" size={18} color="#FFFFFF" />
                  <Text style={styles.imageActionText}>הסר</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.backgroundPresets}
            >
              {/* Image picker button */}
              <TouchableOpacity
                style={[styles.backgroundPreset, styles.imagePickerButton]}
                onPress={pickBackgroundImage}
              >
                <Ionicons name="image" size={24} color="#6B7280" />
              </TouchableOpacity>
              
              {/* Color/Gradient presets */}
              {BACKGROUND_PRESETS.map((preset) => {
                const isSelected = 
                  (background.type === 'color' && background.color === preset.background.color) ||
                  (background.type === 'gradient' && 
                    background.gradientColors?.[0] === preset.background.gradientColors?.[0]);
                    
                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={[
                      styles.backgroundPreset,
                      {
                        backgroundColor:
                          preset.background.type === 'color'
                            ? preset.background.color
                            : preset.background.gradientColors?.[0],
                      },
                      isSelected && styles.selectedPreset,
                    ]}
                    onPress={() => setBackground(preset.background)}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* CTA Button */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>כפתור (אופציונלי)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
            placeholder={t.announcements.buttonTextPlaceholder}
            placeholderTextColor={theme.textSecondary}
            value={ctaLabel}
            onChangeText={setCtaLabel}
          />
          {ctaLabel.trim() && (
            <>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.surface, color: theme.text, marginTop: 8 },
                ]}
                placeholder={t.announcements.linkPlaceholder}
                placeholderTextColor={theme.textSecondary}
                value={ctaAction}
                onChangeText={setCtaAction}
                autoCapitalize="none"
                keyboardType="url"
              />
              
              {/* CTA Button Preview */}
              <View style={styles.ctaPreviewContainer}>
                <TouchableOpacity
                  style={[
                    styles.ctaPreviewButton,
                    { 
                      backgroundColor: ctaBackgroundColor,
                      opacity: ctaOpacity,
                    },
                  ]}
                  disabled
                >
                  <Text style={[styles.ctaPreviewText, { color: ctaTextColor }]}>
                    {ctaLabel}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* CTA Background Color */}
              <Text style={[styles.subSectionTitle, { color: theme.textSecondary }]}>
                צבע רקע כפתור
              </Text>
              <View style={styles.colorOptionsRow}>
                {['#FFFFFF', '#000000', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map((color) => (
                  <TouchableOpacity
                    key={`bg-${color}`}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      color === '#FFFFFF' && styles.whiteColorOption,
                      ctaBackgroundColor === color && styles.selectedColorOption,
                    ]}
                    onPress={() => setCtaBackgroundColor(color)}
                  >
                    {ctaBackgroundColor === color && (
                      <Ionicons 
                        name="checkmark" 
                        size={16} 
                        color={color === '#FFFFFF' || color === '#F59E0B' ? '#000000' : '#FFFFFF'} 
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              
              {/* CTA Text Color */}
              <Text style={[styles.subSectionTitle, { color: theme.textSecondary }]}>
                צבע טקסט כפתור
              </Text>
              <View style={styles.colorOptionsRow}>
                {['#FFFFFF', '#000000', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'].map((color) => (
                  <TouchableOpacity
                    key={`text-${color}`}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      color === '#FFFFFF' && styles.whiteColorOption,
                      ctaTextColor === color && styles.selectedColorOption,
                    ]}
                    onPress={() => setCtaTextColor(color)}
                  >
                    {ctaTextColor === color && (
                      <Ionicons 
                        name="checkmark" 
                        size={16} 
                        color={color === '#FFFFFF' || color === '#F59E0B' ? '#000000' : '#FFFFFF'} 
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              
              {/* CTA Opacity */}
              <View style={styles.sliderRow}>
                <Text style={[styles.subSectionTitle, { color: theme.textSecondary }]}>
                  שקיפות כפתור
                </Text>
                <Text style={[styles.sliderValueText, { color: theme.text }]}>
                  {Math.round(ctaOpacity * 100)}%
                </Text>
              </View>
              <Slider
                style={styles.ctaSlider}
                minimumValue={0.3}
                maximumValue={1}
                value={ctaOpacity}
                onValueChange={setCtaOpacity}
                minimumTrackTintColor={theme.primary}
                maximumTrackTintColor="#E5E7EB"
                thumbTintColor={theme.primary}
              />
            </>
          )}
        </View>

        {/* Schedule */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>תזמון</Text>
          
          <TouchableOpacity
            style={[styles.dateButton, { backgroundColor: theme.surface }]}
            onPress={() => setShowStartDatePicker(true)}
          >
            <Ionicons name="calendar" size={20} color={theme.primary} />
            <View style={styles.dateInfo}>
              <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>
                מתי מתחיל
              </Text>
              <Text style={[styles.dateValue, { color: theme.text }]}>
                {formatDate(startDate)}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateButton, { backgroundColor: theme.surface, marginTop: 8 }]}
            onPress={() => setShowEndDatePicker(true)}
          >
            <Ionicons name="calendar" size={20} color={theme.primary} />
            <View style={styles.dateInfo}>
              <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>
                מתי נגמר
              </Text>
              <Text style={[styles.dateValue, { color: theme.text }]}>
                {formatDate(endDate)}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.footer, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={[styles.footerButton, styles.draftButton]}
          onPress={() => handleSave(true)}
          disabled={saving}
        >
          <Text style={styles.draftButtonText}>שמור טיוטה</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.footerButton, styles.publishButton, { backgroundColor: theme.buttonPrimary }]}
          onPress={() => handleSave(false)}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.publishButtonText}>
              {isEditing ? 'עדכן' : 'פרסם'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Icon Picker Modal */}
      <Modal visible={showIconPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>בחר אייקון</Text>
              <TouchableOpacity onPress={() => setShowIconPicker(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.iconsGrid}>
              {ICON_OPTIONS.map((iconOption) => (
                <TouchableOpacity
                  key={iconOption}
                  style={[
                    styles.iconOption,
                    icon === iconOption && styles.selectedIconOption,
                  ]}
                  onPress={() => {
                    setIcon(iconOption);
                    setShowIconPicker(false);
                  }}
                >
                  <Text style={styles.iconOptionText}>{iconOption}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Preview Modal */}
      <Modal visible={showPreview} transparent animationType="slide">
        <View style={[styles.previewContainer, { backgroundColor: theme.background }]}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.previewHeader}>
              <TouchableOpacity onPress={() => setShowPreview(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.previewTitle, { color: theme.text }]}>
                תצוגה מקדימה
              </Text>
              <View style={{ width: 24 }} />
            </View>
            <View style={styles.previewContent}>
              <AnnouncementCard 
                announcement={getPreviewAnnouncement()} 
                isPreview 
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Image Editor Modal */}
      <Modal visible={showImageEditor} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.imageEditorModal, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>עריכת תמונה</Text>
              <TouchableOpacity onPress={() => setShowImageEditor(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            {/* Image Preview with effects */}
            <View style={styles.imageEditorPreview}>
              <AnnouncementCard 
                announcement={getPreviewAnnouncement()} 
                isPreview={false}
              />
            </View>
            
            <ScrollView style={styles.imageEditorsContainer}>
              {/* Brightness Slider */}
              <View style={styles.sliderContainer}>
                <View style={styles.sliderHeader}>
                  <Ionicons name="sunny" size={20} color={theme.text} />
                  <Text style={[styles.sliderLabel, { color: theme.text }]}>בהירות</Text>
                  <Text style={[styles.sliderValue, { color: theme.textSecondary }]}>
                    {Math.round(imageEditing.brightness * 100)}%
                  </Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={0.3}
                  maximumValue={1.7}
                  value={imageEditing.brightness}
                  onValueChange={(val) => updateImageEditing('brightness', val)}
                  minimumTrackTintColor={theme.primary}
                  maximumTrackTintColor="#E5E7EB"
                  thumbTintColor={theme.primary}
                />
              </View>

              {/* Opacity Slider */}
              <View style={styles.sliderContainer}>
                <View style={styles.sliderHeader}>
                  <Ionicons name="eye" size={20} color={theme.text} />
                  <Text style={[styles.sliderLabel, { color: theme.text }]}>שקיפות</Text>
                  <Text style={[styles.sliderValue, { color: theme.textSecondary }]}>
                    {Math.round(imageEditing.opacity * 100)}%
                  </Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={0.3}
                  maximumValue={1}
                  value={imageEditing.opacity}
                  onValueChange={(val) => updateImageEditing('opacity', val)}
                  minimumTrackTintColor={theme.primary}
                  maximumTrackTintColor="#E5E7EB"
                  thumbTintColor={theme.primary}
                />
              </View>

              {/* Blur Slider */}
              <View style={styles.sliderContainer}>
                <View style={styles.sliderHeader}>
                  <Ionicons name="water" size={20} color={theme.text} />
                  <Text style={[styles.sliderLabel, { color: theme.text }]}>טשטוש</Text>
                  <Text style={[styles.sliderValue, { color: theme.textSecondary }]}>
                    {Math.round(imageEditing.blur)}
                  </Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={10}
                  value={imageEditing.blur}
                  onValueChange={(val) => updateImageEditing('blur', val)}
                  minimumTrackTintColor={theme.primary}
                  maximumTrackTintColor="#E5E7EB"
                  thumbTintColor={theme.primary}
                />
              </View>

              {/* Overlay Color */}
              <View style={styles.sliderContainer}>
                <View style={styles.sliderHeader}>
                  <Ionicons name="color-palette" size={20} color={theme.text} />
                  <Text style={[styles.sliderLabel, { color: theme.text }]}>שכבת צבע</Text>
                </View>
                <View style={styles.overlayColorsRow}>
                  <TouchableOpacity
                    style={[
                      styles.overlayColorOption,
                      { backgroundColor: '#F3F4F6' },
                      !imageEditing.overlayColor && styles.selectedOverlayColor,
                    ]}
                    onPress={() => updateImageEditing('overlayColor', undefined)}
                  >
                    <Ionicons name="close" size={16} color="#6B7280" />
                  </TouchableOpacity>
                  {['#000000', '#1E40AF', '#7C3AED', '#059669', '#DC2626', '#D97706'].map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.overlayColorOption,
                        { backgroundColor: color },
                        imageEditing.overlayColor === color && styles.selectedOverlayColor,
                      ]}
                      onPress={() => updateImageEditing('overlayColor', color)}
                    />
                  ))}
                </View>
                
                {imageEditing.overlayColor && (
                  <View style={[styles.sliderHeader, { marginTop: 12 }]}>
                    <Text style={[styles.sliderLabel, { color: theme.text }]}>עוצמת שכבה</Text>
                    <Text style={[styles.sliderValue, { color: theme.textSecondary }]}>
                      {Math.round((imageEditing.overlayOpacity || 0.3) * 100)}%
                    </Text>
                  </View>
                )}
                {imageEditing.overlayColor && (
                  <Slider
                    style={styles.slider}
                    minimumValue={0.1}
                    maximumValue={0.8}
                    value={imageEditing.overlayOpacity || 0.3}
                    onValueChange={(val) => updateImageEditing('overlayOpacity', val)}
                    minimumTrackTintColor={theme.primary}
                    maximumTrackTintColor="#E5E7EB"
                    thumbTintColor={theme.primary}
                  />
                )}
              </View>

              {/* Reset Button */}
              <TouchableOpacity
                style={[styles.resetButton, { borderColor: theme.textSecondary }]}
                onPress={() => setImageEditing(DEFAULT_IMAGE_EDITING)}
              >
                <Ionicons name="refresh" size={18} color={theme.textSecondary} />
                <Text style={[styles.resetButtonText, { color: theme.textSecondary }]}>
                  איפוס לברירת מחדל
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Done Button */}
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: theme.buttonPrimary }]}
              onPress={() => setShowImageEditor(false)}
            >
              <Text style={styles.doneButtonText}>סיום עריכה</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Pickers - iOS uses datetime mode, Android uses separate date/time */}
      {Platform.OS === 'ios' ? (
        <>
          {showStartDatePicker && (
            <DateTimePicker
              value={startDate}
              mode="datetime"
              display="spinner"
              onChange={(event, date) => {
                if (date) setStartDate(date);
              }}
              minimumDate={new Date()}
            />
          )}

          {showEndDatePicker && (
            <DateTimePicker
              value={endDate}
              mode="datetime"
              display="spinner"
              onChange={(event, date) => {
                if (date) setEndDate(date);
              }}
              minimumDate={startDate}
            />
          )}
        </>
      ) : (
        <>
          {/* Android: Start Date Picker */}
          {showStartDatePicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display="default"
              onChange={(event, date) => {
                setShowStartDatePicker(false);
                if (event.type !== 'dismissed' && date) {
                  // Preserve the time from the current startDate
                  const newDate = new Date(date);
                  newDate.setHours(startDate.getHours());
                  newDate.setMinutes(startDate.getMinutes());
                  setStartDate(newDate);
                  // Show time picker after date is selected
                  setTimeout(() => setShowStartTimePicker(true), 100);
                }
              }}
              minimumDate={new Date()}
            />
          )}

          {/* Android: Start Time Picker */}
          {showStartTimePicker && (
            <DateTimePicker
              value={startDate}
              mode="time"
              display="default"
              onChange={(event, date) => {
                setShowStartTimePicker(false);
                if (event.type !== 'dismissed' && date) {
                  setStartDate(date);
                }
              }}
            />
          )}

          {/* Android: End Date Picker */}
          {showEndDatePicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display="default"
              onChange={(event, date) => {
                setShowEndDatePicker(false);
                if (event.type !== 'dismissed' && date) {
                  // Preserve the time from the current endDate
                  const newDate = new Date(date);
                  newDate.setHours(endDate.getHours());
                  newDate.setMinutes(endDate.getMinutes());
                  setEndDate(newDate);
                  // Show time picker after date is selected
                  setTimeout(() => setShowEndTimePicker(true), 100);
                }
              }}
              minimumDate={startDate}
            />
          )}

          {/* Android: End Time Picker */}
          {showEndTimePicker && (
            <DateTimePicker
              value={endDate}
              mode="time"
              display="default"
              onChange={(event, date) => {
                setShowEndTimePicker(false);
                if (event.type !== 'dismissed' && date) {
                  setEndDate(date);
                }
              }}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  accessDeniedText: {
    fontSize: 18,
    color: theme.textSecondary,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: theme.headerGradient,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: theme.text,
  },
  input: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: theme.inputBackground,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  selectedIcon: {
    fontSize: 32,
  },
  changeText: {
    fontSize: 14,
    color: theme.primary,
  },
  backgroundPresets: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  backgroundPreset: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedPreset: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  dateInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  dateLabel: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  dateValue: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.text,
  },
  // CTA Button Styling
  ctaPreviewContainer: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  ctaPreviewButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  ctaPreviewText: {
    fontSize: 14,
    fontWeight: '600',
  },
  subSectionTitle: {
    fontSize: 13,
    marginTop: 12,
    marginBottom: 8,
    color: theme.textSecondary,
  },
  colorOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  whiteColorOption: {
    borderWidth: 1,
    borderColor: theme.border,
  },
  selectedColorOption: {
    borderWidth: 3,
    borderColor: theme.primary,
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  sliderValueText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.text,
  },
  ctaSlider: {
    width: '100%',
    height: 40,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.surface,
  },
  footerButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  draftButton: {
    backgroundColor: theme.card,
  },
  draftButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  publishButton: {
    backgroundColor: theme.buttonPrimary,
  },
  publishButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
    backgroundColor: theme.modalBackground,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  iconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  iconOption: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: theme.card,
  },
  selectedIconOption: {
    backgroundColor: theme.primary,
  },
  iconOptionText: {
    fontSize: 28,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.surface,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  previewContent: {
    flex: 1,
    paddingTop: 20,
  },
  // Image Background Styles
  imageBackgroundContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageBackgroundPreview: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  imageBackgroundActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  imageActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  imageActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  imagePickerButton: {
    backgroundColor: theme.card,
    borderWidth: 2,
    borderColor: theme.border,
    borderStyle: 'dashed',
  },
  // Image Editor Modal Styles
  imageEditorModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
    backgroundColor: theme.modalBackground,
  },
  imageEditorPreview: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  imageEditorsContainer: {
    paddingHorizontal: 16,
    maxHeight: 300,
  },
  sliderContainer: {
    marginBottom: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    color: theme.text,
  },
  sliderValue: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  overlayColorsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  overlayColorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedOverlayColor: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 16,
    borderColor: theme.border,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  doneButton: {
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: theme.buttonPrimary,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AnnouncementEditorScreen;
