// src/components/ui/UserAvatar.tsx
// Reusable avatar component that uses default avatar when user has no profile image

import React from 'react';
import { View, Image, Text, StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { useDefaultAvatar } from '@/context/DefaultAvatarContext';
import { useTheme } from '@/features/theme/ThemeContext';

interface UserAvatarProps {
  photoURL?: string | null;
  displayName?: string | null;
  size?: number;
  style?: ViewStyle | ImageStyle;
  textStyle?: TextStyle;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  photoURL,
  displayName,
  size = 40,
  style,
  textStyle,
}) => {
  const { defaultAvatarUrl } = useDefaultAvatar();
  const { theme } = useTheme();

  // Determine which image to show
  const imageUrl = photoURL || defaultAvatarUrl;
  const initial = (displayName || '?').charAt(0).toUpperCase();

  const avatarStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 2,
    borderColor: theme.primary,
    overflow: 'hidden',
  };

  const imageStyle: ImageStyle = {
    width: size,
    height: size,
  };

  const fallbackStyle: ViewStyle = {
    ...avatarStyle,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  };

  const initialStyle: TextStyle = {
    color: '#fff',
    fontSize: size * 0.45,
    fontWeight: 'bold',
  };

  // If we have an image URL (user's photo or default avatar)
  if (imageUrl) {
    return (
      <View style={[avatarStyle, style]}>
        <Image
          source={{ uri: imageUrl }}
          style={imageStyle}
          resizeMode="cover"
        />
      </View>
    );
  }

  // Fallback to initial letter
  return (
    <View style={[fallbackStyle, style]}>
      <Text style={[initialStyle, textStyle]}>{initial}</Text>
    </View>
  );
};

export default UserAvatar;
