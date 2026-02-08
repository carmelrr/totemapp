// src/components/ui/CachedAvatar.tsx
// High-performance avatar component optimized for lists and leaderboards
// Uses expo-image with aggressive caching and recycling
// Automatically uses the default avatar from context when no photoURL is provided

import React, { memo, useMemo } from 'react';
import { View, Text, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { Image as ExpoImage, ImageContentFit } from 'expo-image';
import { useTheme } from '@/features/theme/ThemeContext';
import { useDefaultAvatar } from '@/context/DefaultAvatarContext';

interface CachedAvatarProps {
  /** User's photo URL */
  photoURL?: string | null;
  /** User's display name for fallback initial */
  displayName?: string | null;
  /** Avatar size in pixels */
  size?: number;
  /** Additional container styles */
  style?: ViewStyle;
  /** Whether to show border */
  showBorder?: boolean;
  /** Border color override */
  borderColor?: string;
  /** Fallback image for when there's no photo */
  fallbackSource?: any;
}

// Blurhash placeholder - neutral gray gradient
const AVATAR_BLURHASH = 'L5H2EC=PM+yV0g-mq.wG9c010J}I';

/**
 * CachedAvatar - Optimized for list rendering
 * 
 * Key optimizations:
 * - Uses expo-image for built-in memory and disk caching
 * - Aggressive memoization to prevent re-renders
 * - recyclingKey for efficient image recycling in lists
 * - Minimal props to reduce comparison overhead
 */
const CachedAvatarComponent: React.FC<CachedAvatarProps> = ({
  photoURL,
  displayName,
  size = 50,
  style,
  showBorder = true,
  borderColor,
  fallbackSource,
}) => {
  const { theme } = useTheme();
  const { defaultAvatarUrl } = useDefaultAvatar();
  
  // Determine the actual image URL to use:
  // 1. User's photoURL if available
  // 2. Provided fallbackSource (for backwards compatibility)
  // 3. Default avatar from context (admin-configurable)
  // 4. Initial letter fallback
  const effectiveImageUrl = photoURL || (fallbackSource ? null : defaultAvatarUrl);
  
  const initial = useMemo(() => 
    (displayName || '?').charAt(0).toUpperCase(),
    [displayName]
  );

  const containerStyle = useMemo((): ViewStyle => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden',
    backgroundColor: theme.surface,
    ...(showBorder && {
      borderWidth: 2,
      borderColor: borderColor || theme.primary,
    }),
  }), [size, theme.surface, theme.primary, showBorder, borderColor]);

  const imageStyle = useMemo((): ImageStyle => ({
    width: size,
    height: size,
  }), [size]);

  const fallbackStyle = useMemo((): ViewStyle => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...(showBorder && {
      borderWidth: 2,
      borderColor: borderColor || theme.primary,
    }),
  }), [size, theme.primary, showBorder, borderColor]);

  const textStyle = useMemo((): TextStyle => ({
    color: '#fff',
    fontSize: size * 0.4,
    fontWeight: 'bold',
  }), [size]);

  // Use fallback image if provided and no photoURL (backwards compatibility)
  if (fallbackSource && !photoURL) {
    return (
      <View style={[containerStyle, style]}>
        <ExpoImage
          source={fallbackSource}
          style={imageStyle}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
        />
      </View>
    );
  }

  // Show photo if available (user's photo or default avatar from context)
  if (effectiveImageUrl) {
    return (
      <View style={[containerStyle, style]}>
        <ExpoImage
          source={{ uri: effectiveImageUrl }}
          style={imageStyle}
          contentFit="cover"
          // Memory + disk caching for fast reload
          cachePolicy="memory-disk"
          // Smooth transition from placeholder
          transition={200}
          // Placeholder during loading
          placeholder={AVATAR_BLURHASH}
          // Unique key for recycling in lists
          recyclingKey={effectiveImageUrl}
          // Normal priority for list items
          priority="normal"
        />
      </View>
    );
  }

  // Fallback to initial letter
  return (
    <View style={[fallbackStyle, style]}>
      <Text style={textStyle}>{initial}</Text>
    </View>
  );
};

// Memoize with custom comparison for list performance
export const CachedAvatar = memo(CachedAvatarComponent, (prev, next) => {
  return (
    prev.photoURL === next.photoURL &&
    prev.displayName === next.displayName &&
    prev.size === next.size &&
    prev.showBorder === next.showBorder &&
    prev.borderColor === next.borderColor
  );
});

export default CachedAvatar;

/**
 * Prefetch multiple avatar images in parallel
 * Call this when you have a list of users and want to preload their avatars
 */
export const prefetchAvatarImages = async (photoURLs: (string | null | undefined)[]): Promise<void> => {
  const validUrls = photoURLs.filter((url): url is string => !!url && url.startsWith('http'));
  
  if (validUrls.length === 0) return;
  
  try {
    // Prefetch all images in parallel
    await Promise.all(validUrls.map(url => ExpoImage.prefetch(url)));
  } catch (error) {
    // Silent fail - prefetching is an optimization, not critical
    console.debug('[CachedAvatar] Prefetch failed:', error);
  }
};

/**
 * Clear avatar image cache
 * Useful when user updates their profile photo
 */
export const clearAvatarCache = async (): Promise<void> => {
  try {
    await ExpoImage.clearMemoryCache();
  } catch (error) {
    console.debug('[CachedAvatar] Cache clear failed:', error);
  }
};
