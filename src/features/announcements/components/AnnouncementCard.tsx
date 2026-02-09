/**
 * @fileoverview Announcement Card Component
 * @description Displays a single announcement in the feed
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Image,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Announcement, DEFAULT_IMAGE_EDITING } from '../types';

interface AnnouncementCardProps {
  announcement: Announcement;
  onDismiss?: () => void;
  isPreview?: boolean;
}

export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  announcement,
  onDismiss,
  isPreview = false,
}) => {
  const navigation = useNavigation();

  const handleCTAPress = async () => {
    if (!announcement.cta) return;

    const { actionType, actionValue } = announcement.cta;

    switch (actionType) {
      case 'link':
        if (actionValue) {
          try {
            await Linking.openURL(actionValue);
          } catch (error) {
            console.error('Failed to open URL:', error);
          }
        }
        break;
      case 'route':
        if (actionValue) {
          (navigation as any).navigate('RoutesMapTab', {
            screen: 'RouteDetails',
            params: { routeId: actionValue },
          });
        }
        break;
      case 'screen':
        if (actionValue) {
          (navigation as any).navigate(actionValue);
        }
        break;
      case 'dismiss':
        onDismiss?.();
        break;
    }
  };

  const renderBackground = () => {
    const { background } = announcement;

    if (background.type === 'image' && (background.imageUrl || background.localImageUri)) {
      const imageSource = background.imageUrl || background.localImageUri;
      const editing = background.imageEditing || DEFAULT_IMAGE_EDITING;
      
      return (
        <View style={StyleSheet.absoluteFillObject}>
          {/* Image with opacity */}
          <Image
            source={{ uri: imageSource }}
            style={[
              StyleSheet.absoluteFillObject,
              {
                opacity: editing.opacity,
              },
            ]}
            resizeMode="cover"
            blurRadius={Platform.OS === 'ios' ? editing.blur : editing.blur * 2}
          />
          
          {/* Brightness/Contrast overlay */}
          {(editing.brightness !== 1 || editing.contrast !== 1) && (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: editing.brightness < 1 
                    ? `rgba(0, 0, 0, ${(1 - editing.brightness) * 0.6})`
                    : editing.brightness > 1
                    ? `rgba(255, 255, 255, ${(editing.brightness - 1) * 0.4})`
                    : 'transparent',
                },
              ]}
            />
          )}
          
          {/* Color overlay for tinting */}
          {editing.overlayColor && editing.overlayOpacity && editing.overlayOpacity > 0 && (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: editing.overlayColor,
                  opacity: editing.overlayOpacity,
                },
              ]}
            />
          )}
          
          {/* Gradient overlay for text readability */}
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)']}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
      );
    }

    if (background.type === 'gradient' && background.gradientColors) {
      return (
        <LinearGradient
          colors={background.gradientColors as [string, string, ...string[]]}
          start={
            background.gradientDirection === 'vertical'
              ? { x: 0.5, y: 0 }
              : background.gradientDirection === 'diagonal'
              ? { x: 0, y: 0 }
              : { x: 0, y: 0.5 }
          }
          end={
            background.gradientDirection === 'vertical'
              ? { x: 0.5, y: 1 }
              : background.gradientDirection === 'diagonal'
              ? { x: 1, y: 1 }
              : { x: 1, y: 0.5 }
          }
          style={StyleSheet.absoluteFillObject}
        />
      );
    }

    return null;
  };

  const backgroundColor =
    announcement.background.type === 'color'
      ? announcement.background.color || '#3B82F6'
      : 'transparent';

  const titleColor = announcement.textStyle?.titleColor || '#FFFFFF';
  const textColor = announcement.textStyle?.textColor || '#FFFFFF';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor },
        isPreview && styles.previewContainer,
      ]}
    >
      {renderBackground()}
      
      <View style={styles.content}>
        {/* Icon and Title Row */}
        <View style={styles.headerRow}>
          {announcement.icon && (
            <Text style={styles.icon}>{announcement.icon}</Text>
          )}
          <Text
            style={[
              styles.title,
              { color: titleColor },
              announcement.textStyle?.titleBold && styles.bold,
            ]}
          >
            {announcement.title}
          </Text>
        </View>

        {/* Body Text */}
        {announcement.text && (
          <Text
            style={[
              styles.text,
              { color: textColor },
              announcement.textStyle?.textBold && styles.bold,
            ]}
          >
            {announcement.text}
          </Text>
        )}

        {/* CTA Button */}
        {announcement.cta && (
          <TouchableOpacity
            style={[
              styles.ctaButton,
              {
                backgroundColor: announcement.cta.backgroundColor || '#FFFFFF',
                opacity: announcement.cta.opacity ?? 1,
              },
            ]}
            onPress={handleCTAPress}
            disabled={isPreview}
          >
            <Text
              style={[
                styles.ctaText,
                { color: announcement.cta.textColor || '#000000' },
              ]}
            >
              {announcement.cta.label}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Preview Badge */}
      {isPreview && (
        <View style={styles.previewBadge}>
          <Text style={styles.previewBadgeText}>תצוגה מקדימה</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  previewContainer: {
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderStyle: 'dashed',
  },
  content: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 24,
    marginStart: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  bold: {
    fontWeight: '700',
  },
  ctaButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 4,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  previewBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default AnnouncementCard;
