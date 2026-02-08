// src/components/ui/UserAvatar.tsx
// Optimized avatar component with caching using expo-image
// Uses memory and disk caching for faster loading of profile images

import React, { memo, useMemo } from 'react';
import { View, Text, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useDefaultAvatar } from '@/context/DefaultAvatarContext';
import { useTheme } from '@/features/theme/ThemeContext';

interface UserAvatarProps {
  photoURL?: string | null;
  displayName?: string | null;
  size?: number;
  style?: ViewStyle | ImageStyle;
  textStyle?: TextStyle;
  /** Priority for image loading: 'low' | 'normal' | 'high' */
  priority?: 'low' | 'normal' | 'high';
  /** Whether to show placeholder while loading */
  showPlaceholder?: boolean;
}

// Blurhash placeholder for avatars (generic gray/blue gradient)
const AVATAR_BLURHASH = 'L6PZfSi_.AyE_3t7t7R*D%ozNGog';

const UserAvatarComponent: React.FC<UserAvatarProps> = ({
  photoURL,
  displayName,
  size = 40,
  style,
  textStyle,
  priority = 'normal',
  showPlaceholder = true,
}) => {
  const { defaultAvatarUrl } = useDefaultAvatar();
  const { theme } = useTheme();

  // Determine which image to show
  const imageUrl = photoURL || defaultAvatarUrl;
  const initial = (displayName || '?').charAt(0).toUpperCase();

  // Memoize styles to prevent unnecessary re-renders
  const styles = useMemo(() => ({
    avatar: {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 2,
      borderColor: theme.primary,
      overflow: 'hidden',
    } as ViewStyle,
    image: {
      width: size,
      height: size,
    } as ImageStyle,
    fallback: {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 2,
      borderColor: theme.primary,
      overflow: 'hidden',
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    } as ViewStyle,
    initial: {
      color: '#fff',
      fontSize: size * 0.45,
      fontWeight: 'bold',
    } as TextStyle,
  }), [size, theme.primary]);

  // If we have an image URL (user's photo or default avatar)
  if (imageUrl) {
    return (
      <View style={[styles.avatar, style]}>
        <ExpoImage
          source={{ uri: imageUrl }}
          style={styles.image}
          contentFit="cover"
          // Enable aggressive caching
          cachePolicy="memory-disk"
          // Transition for smooth loading
          transition={showPlaceholder ? 200 : 0}
          // Placeholder for loading state
          placeholder={showPlaceholder ? AVATAR_BLURHASH : undefined}
          // Priority for loading queue
          priority={priority}
          // Recycle images when scrolling
          recyclingKey={imageUrl}
        />
      </View>
    );
  }

  // Fallback to initial letter
  return (
    <View style={[styles.fallback, style]}>
      <Text style={[styles.initial, textStyle]}>{initial}</Text>
    </View>
  );
};

// Memoize the component to prevent unnecessary re-renders
// Only re-render if photoURL, displayName, size, or theme changes
export const UserAvatar = memo(UserAvatarComponent, (prevProps, nextProps) => {
  return (
    prevProps.photoURL === nextProps.photoURL &&
    prevProps.displayName === nextProps.displayName &&
    prevProps.size === nextProps.size &&
    prevProps.priority === nextProps.priority
  );
});

export default UserAvatar;

// Utility function to prefetch avatar images
export const prefetchAvatars = async (urls: (string | null | undefined)[]): Promise<void> => {
  const validUrls = urls.filter((url): url is string => !!url);
  if (validUrls.length === 0) return;
  
  try {
    await ExpoImage.prefetch(validUrls);
  } catch (error) {
    // Silent fail - prefetching is optional optimization
    console.debug('Avatar prefetch error:', error);
  }
};
