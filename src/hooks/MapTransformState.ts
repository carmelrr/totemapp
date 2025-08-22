// hooks/MapTransformState.js
import { useSharedValue, useDerivedValue, useAnimatedStyle, useAnimatedGestureHandler, runOnJS } from 'react-native-reanimated';
import { Dimensions } from 'react-native';

const window = Dimensions.get('window');
const MAP_WIDTH = window.width;
const MAP_HEIGHT = window.width * 0.65;

export function useMapTransform(scale, onTranslateXChange, onTranslateYChange) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useDerivedValue(() => {
    'worklet';
    if (onTranslateXChange) runOnJS(onTranslateXChange)(translateX.value);
    if (onTranslateYChange) runOnJS(onTranslateYChange)(translateY.value);
  });

  const panHandler = useAnimatedGestureHandler({
    onStart: (_, ctx) => {
      'worklet';
      ctx.startX = translateX.value;
      ctx.startY = translateY.value;
    },
    onActive: (event, ctx) => {
      'worklet';
      const scaledWidth = MAP_WIDTH * scale;
      const scaledHeight = MAP_HEIGHT * scale;

      const maxTranslateX = (scaledWidth - MAP_WIDTH) / 2;
      const maxTranslateY = (scaledHeight - MAP_HEIGHT) / 2;

      let newX = ctx.startX + event.translationX;
      let newY = ctx.startY + event.translationY;

      newX = Math.max(-maxTranslateX, Math.min(maxTranslateX, newX));
      newY = Math.max(-maxTranslateY, Math.min(maxTranslateY, newY));

      translateX.value = newX;
      translateY.value = newY;
      if (onTranslateXChange) runOnJS(onTranslateXChange)(newX);
      if (onTranslateYChange) runOnJS(onTranslateYChange)(newY);
    },
  });

  const combinedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale },
      ],
    };
  });

  return { translateX, translateY, panHandler, combinedStyle };
}
