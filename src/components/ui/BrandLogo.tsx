/**
 * BrandLogo - Reusable Totem logo component
 * Can display different variants (icon/full) and colors (dark/light/white)
 */

import React from 'react';
import { Image, ImageStyle, StyleProp, View, ViewStyle } from 'react-native';

export type LogoVariant = 'icon' | 'full';
export type LogoColor = 'dark' | 'white' | 'original';

interface BrandLogoProps {
  variant?: LogoVariant;
  color?: LogoColor;
  size?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  tintColor?: string; // Optional tint color override
}

// Logo sources
const logoSources = {
  icon: {
    dark: require('@/assets/logo/logo-icon-dark.png'),
    white: require('@/assets/logo/logo-icon-white.png'),
    original: require('@/assets/logo/logo-icon-original.png'),
  },
  full: {
    dark: require('@/assets/logo/logo-full-dark.png'),
    white: require('@/assets/logo/logo-full-white.png'),
    original: require('@/assets/logo/logo-full-original.png'),
  },
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'icon',
  color = 'dark',
  size = 40,
  style,
  imageStyle,
  tintColor,
}) => {
  const source = logoSources[variant][color];
  
  // For icon, width = height = size
  // For full logo, height = size, width calculated from aspect ratio (~3:1)
  const dimensions = variant === 'icon' 
    ? { width: size, height: size }
    : { width: size * 3, height: size };

  return (
    <View style={style}>
      <Image
        source={source}
        style={[dimensions, imageStyle, tintColor ? { tintColor } : undefined]}
        resizeMode="contain"
      />
    </View>
  );
};

export default BrandLogo;
