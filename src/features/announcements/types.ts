/**
 * @fileoverview Announcement Types
 * @description Type definitions for the announcements system
 */

/**
 * Background style options for announcements
 */
export type AnnouncementBackgroundType = 'color' | 'gradient' | 'image';

/**
 * Image editing effects configuration
 */
export interface ImageEditingOptions {
  /** Brightness adjustment (0-2, 1 = normal) */
  brightness: number;
  /** Opacity/transparency (0-1, 1 = fully opaque) */
  opacity: number;
  /** Blur intensity (0-10, 0 = no blur) */
  blur: number;
  /** Saturation adjustment (0-2, 1 = normal) */
  saturation: number;
  /** Contrast adjustment (0-2, 1 = normal) */
  contrast: number;
  /** Overlay color for tinting (optional) */
  overlayColor?: string;
  /** Overlay opacity (0-1) */
  overlayOpacity?: number;
}

/**
 * Default image editing options
 */
export const DEFAULT_IMAGE_EDITING: ImageEditingOptions = {
  brightness: 1,
  opacity: 1,
  blur: 0,
  saturation: 1,
  contrast: 1,
  overlayColor: undefined,
  overlayOpacity: 0.3,
};

/**
 * Announcement background configuration
 */
export interface AnnouncementBackground {
  type: AnnouncementBackgroundType;
  /** Solid color value (e.g., '#FF5733') */
  color?: string;
  /** Gradient colors array (e.g., ['#FF5733', '#3498db']) */
  gradientColors?: string[];
  /** Gradient direction */
  gradientDirection?: 'horizontal' | 'vertical' | 'diagonal';
  /** Image URL for background */
  imageUrl?: string;
  /** Local image URI (before upload) */
  localImageUri?: string;
  /** Image editing options */
  imageEditing?: ImageEditingOptions;
}

/**
 * Text style options for announcements
 */
export interface AnnouncementTextStyle {
  /** Title color */
  titleColor?: string;
  /** Body text color */
  textColor?: string;
  /** Whether title is bold */
  titleBold?: boolean;
  /** Whether body text is bold */
  textBold?: boolean;
}

/**
 * Call-to-action button configuration
 */
export interface AnnouncementCTA {
  /** Button label */
  label: string;
  /** Button action type */
  actionType: 'link' | 'route' | 'screen' | 'dismiss';
  /** Action value (URL, route ID, or screen name) */
  actionValue?: string;
  /** Button background color */
  backgroundColor?: string;
  /** Button text color */
  textColor?: string;
  /** Button opacity (0-1) */
  opacity?: number;
}

/**
 * Announcement status
 */
export type AnnouncementStatus = 'draft' | 'scheduled' | 'active' | 'expired' | 'deleted';

/**
 * Announcement document structure in Firestore
 */
export interface Announcement {
  id: string;
  /** Announcement title */
  title: string;
  /** Announcement body text */
  text: string;
  /** Icon emoji or icon name */
  icon?: string;
  /** Background configuration */
  background: AnnouncementBackground;
  /** Text style configuration */
  textStyle?: AnnouncementTextStyle;
  /** Call-to-action button */
  cta?: AnnouncementCTA;
  /** Start date/time for display */
  startDate: Date;
  /** End date/time for display */
  endDate: Date;
  /** Display priority (higher = shown first) */
  priority: number;
  /** Current status */
  status: AnnouncementStatus;
  /** ID of user who created */
  createdBy: string;
  /** Display name of user who created */
  createdByName?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** ID of user who last updated */
  updatedBy?: string;
}

/**
 * Form data for creating/editing announcements
 */
export interface AnnouncementFormData {
  title: string;
  text: string;
  icon?: string;
  background: AnnouncementBackground;
  textStyle?: AnnouncementTextStyle;
  cta?: AnnouncementCTA;
  startDate: Date;
  endDate: Date;
  priority: number;
}

/**
 * Preset backgrounds for quick selection
 */
export interface BackgroundPreset {
  id: string;
  name: string;
  background: AnnouncementBackground;
}

/**
 * Default background presets
 */
export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'blue',
    name: 'כחול',
    background: { type: 'color', color: '#3B82F6' },
  },
  {
    id: 'green',
    name: 'ירוק',
    background: { type: 'color', color: '#10B981' },
  },
  {
    id: 'purple',
    name: 'סגול',
    background: { type: 'color', color: '#8B5CF6' },
  },
  {
    id: 'orange',
    name: 'כתום',
    background: { type: 'color', color: '#F59E0B' },
  },
  {
    id: 'red',
    name: 'אדום',
    background: { type: 'color', color: '#EF4444' },
  },
  {
    id: 'pink',
    name: 'ורוד',
    background: { type: 'color', color: '#EC4899' },
  },
  {
    id: 'gradient-sunset',
    name: 'שקיעה',
    background: { 
      type: 'gradient', 
      gradientColors: ['#F59E0B', '#EF4444'],
      gradientDirection: 'horizontal',
    },
  },
  {
    id: 'gradient-ocean',
    name: 'אוקיינוס',
    background: { 
      type: 'gradient', 
      gradientColors: ['#3B82F6', '#06B6D4'],
      gradientDirection: 'horizontal',
    },
  },
  {
    id: 'gradient-forest',
    name: 'יער',
    background: { 
      type: 'gradient', 
      gradientColors: ['#10B981', '#22D3EE'],
      gradientDirection: 'horizontal',
    },
  },
  {
    id: 'gradient-royal',
    name: 'מלכותי',
    background: { 
      type: 'gradient', 
      gradientColors: ['#8B5CF6', '#EC4899'],
      gradientDirection: 'horizontal',
    },
  },
];

/**
 * Default icon options
 */
export const ICON_OPTIONS = [
  '📢', '🎉', '🔔', '⚡', '🏆', '💪', '🧗', '🎯', '💡', '⚠️', 
  '🌟', '🚀', '❤️', '🔥', '✨', '📣', '🎊', '👏', '🙌', '💥',
];
