import { MapTransforms } from '../types/route';

export type Coords2D = { x: number; y: number };
export type ImageCoords = { xImg: number; yImg: number };
export type ScreenCoords = { xS: number; yS: number };
export type NormCoords = { xNorm: number; yNorm: number };
export type ImageDimensions = { imgW: number; imgH: number };

/**
 * Convert image coordinates to screen coordinates
 */
export function toScreen(
  { xImg, yImg }: ImageCoords,
  { translateX, translateY, scale }: MapTransforms
): ScreenCoords {
  return {
    xS: translateX + xImg * scale,
    yS: translateY + yImg * scale,
  };
}

/**
 * Convert screen coordinates to image coordinates
 */
export function toImg(
  { xS, yS }: ScreenCoords,
  { translateX, translateY, scale }: MapTransforms
): ImageCoords {
  // ✅ Safety: מוודא שה־scale תקין לפני חלוקה
  const safeScale = Math.max(0.1, Math.min(10, isFinite(scale) ? scale : 1));
  const safeTranslateX = isFinite(translateX) ? translateX : 0;
  const safeTranslateY = isFinite(translateY) ? translateY : 0;
  const safeXS = isFinite(xS) ? xS : 0;
  const safeYS = isFinite(yS) ? yS : 0;
  
  return {
    xImg: (safeXS - safeTranslateX) / safeScale,
    yImg: (safeYS - safeTranslateY) / safeScale,
  };
}

/**
 * Convert image coordinates to normalized coordinates (0..1)
 */
export function toNorm(
  { xImg, yImg }: ImageCoords,
  { imgW, imgH }: ImageDimensions
): NormCoords {
  // ✅ Safety: בודק dimensions תקינים לפני חלוקה
  const safeImgW = Math.max(1, isFinite(imgW) ? imgW : 1);
  const safeImgH = Math.max(1, isFinite(imgH) ? imgH : 1);
  const safeXImg = isFinite(xImg) ? xImg : 0;
  const safeYImg = isFinite(yImg) ? yImg : 0;
  
  return {
    xNorm: Math.max(0, Math.min(1, safeXImg / safeImgW)),
    yNorm: Math.max(0, Math.min(1, safeYImg / safeImgH)),
  };
}

/**
 * Convert normalized coordinates to image coordinates
 */
export function fromNorm(
  { xNorm, yNorm }: NormCoords,
  { imgW, imgH }: ImageDimensions
): ImageCoords {
  return {
    xImg: xNorm * imgW,
    yImg: yNorm * imgH,
  };
}

/**
 * Clamp viewport transforms to keep image in view
 */
export function clampViewport(
  { translateX, translateY, scale }: MapTransforms,
  screenW: number,
  screenH: number,
  imgW: number,
  imgH: number,
  minScale: number = 0.5,
  maxScale: number = 4
): MapTransforms {
  // Ensure all inputs are finite and positive
  if (!isFinite(scale) || scale <= 0) scale = 1;
  if (!isFinite(translateX)) translateX = 0;
  if (!isFinite(translateY)) translateY = 0;
  if (!isFinite(screenW) || screenW <= 0) screenW = 1;
  if (!isFinite(screenH) || screenH <= 0) screenH = 1;
  if (!isFinite(imgW) || imgW <= 0) imgW = 1;
  if (!isFinite(imgH) || imgH <= 0) imgH = 1;
  
  // Clamp scale
  const clampedScale = Math.max(minScale, Math.min(maxScale, scale));
  
  // Calculate bounds
  const scaledImgW = imgW * clampedScale;
  const scaledImgH = imgH * clampedScale;
  
  // If image is smaller than screen, center it
  let clampedTranslateX = translateX;
  let clampedTranslateY = translateY;
  
  if (scaledImgW <= screenW) {
    // Center horizontally
    clampedTranslateX = (screenW - scaledImgW) / 2;
  } else {
    // Clamp to prevent showing empty space
    const maxTranslateX = 0;
    const minTranslateX = screenW - scaledImgW;
    clampedTranslateX = Math.max(minTranslateX, Math.min(maxTranslateX, translateX));
  }
  
  if (scaledImgH <= screenH) {
    // Center vertically
    clampedTranslateY = (screenH - scaledImgH) / 2;
  } else {
    // Clamp to prevent showing empty space
    const maxTranslateY = 0;
    const minTranslateY = screenH - scaledImgH;
    clampedTranslateY = Math.max(minTranslateY, Math.min(maxTranslateY, translateY));
  }
  
  // Ensure final values are finite
  const finalTranslateX = isFinite(clampedTranslateX) ? Math.round(clampedTranslateX * 2) / 2 : 0;
  const finalTranslateY = isFinite(clampedTranslateY) ? Math.round(clampedTranslateY * 2) / 2 : 0;
  const finalScale = isFinite(clampedScale) ? clampedScale : 1;
  
  return {
    translateX: finalTranslateX,
    translateY: finalTranslateY,
    scale: finalScale,
  };
}

/**
 * Calculate viewport bounds in image coordinates
 */
export function getViewportBounds(
  { translateX, translateY, scale }: MapTransforms,
  screenW: number,
  screenH: number
) {
  // ✅ Safety: מוודא שכל הערכים תקינים לפני חלוקה
  const safeScale = Math.max(0.1, Math.min(10, isFinite(scale) ? scale : 1));
  const safeTranslateX = isFinite(translateX) ? translateX : 0;
  const safeTranslateY = isFinite(translateY) ? translateY : 0;
  const safeScreenW = Math.max(1, isFinite(screenW) ? screenW : 1);
  const safeScreenH = Math.max(1, isFinite(screenH) ? screenH : 1);
  
  return {
    xMinImg: -safeTranslateX / safeScale,
    yMinImg: -safeTranslateY / safeScale,
    xMaxImg: (-safeTranslateX + safeScreenW) / safeScale,
    yMaxImg: (-safeTranslateY + safeScreenH) / safeScale,
  };
}
