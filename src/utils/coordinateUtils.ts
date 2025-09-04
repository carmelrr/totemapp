/**
 * Unified coordinate utilities for the entire application
 * Consolidates functionality from src/utils/mapUtils.ts and src/features/routes-map/utils/coords.ts
 */

// Type definitions
export type Coords2D = { x: number; y: number };
export type ImageCoords = { xImg: number; yImg: number };
export type ScreenCoords = { xS: number; yS: number };
export type NormCoords = { xNorm: number; yNorm: number };
export type ImageDimensions = { imgW: number; imgH: number };
export type MapTransforms = {
    translateX: number;
    translateY: number;
    scale: number;
};

// Constants
const ORIGINAL_MAP_WIDTH = 2560;
const ORIGINAL_MAP_HEIGHT = 1600;

/**
 * Safety utility to ensure numeric values are finite and within reasonable bounds
 */
function safeNumber(value: number, fallback: number = 0, min?: number, max?: number): number {
    if (!isFinite(value)) return fallback;
    if (min !== undefined && value < min) return min;
    if (max !== undefined && value > max) return max;
    return value;
}

/**
 * Convert image coordinates to screen coordinates
 */
export function toScreen(
    { xImg, yImg }: ImageCoords,
    { translateX, translateY, scale }: MapTransforms
): ScreenCoords {
    const safeScale = safeNumber(scale, 1, 0.1, 10);
    const safeTranslateX = safeNumber(translateX, 0);
    const safeTranslateY = safeNumber(translateY, 0);
    const safeXImg = safeNumber(xImg, 0);
    const safeYImg = safeNumber(yImg, 0);

    return {
        xS: safeTranslateX + safeXImg * safeScale,
        yS: safeTranslateY + safeYImg * safeScale,
    };
}

/**
 * Convert screen coordinates to image coordinates
 */
export function toImg(
    { xS, yS }: ScreenCoords,
    { translateX, translateY, scale }: MapTransforms
): ImageCoords {
    const safeScale = safeNumber(scale, 1, 0.1, 10);
    const safeTranslateX = safeNumber(translateX, 0);
    const safeTranslateY = safeNumber(translateY, 0);
    const safeXS = safeNumber(xS, 0);
    const safeYS = safeNumber(yS, 0);

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
    const safeImgW = safeNumber(imgW, 1, 1);
    const safeImgH = safeNumber(imgH, 1, 1);
    const safeXImg = safeNumber(xImg, 0);
    const safeYImg = safeNumber(yImg, 0);

    return {
        xNorm: safeNumber(safeXImg / safeImgW, 0, 0, 1),
        yNorm: safeNumber(safeYImg / safeImgH, 0, 0, 1),
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
 * Legacy function: Get screen coordinates for a route (backwards compatibility)
 * This maintains compatibility with existing code that used mapUtils.ts
 */
export function getScreenCoords(
    route: { x: number; y: number } | null,
    scale: number,
    translateX: number,
    translateY: number,
    mapWidth: number,
    mapHeight: number
): { screenX: number; screenY: number } {
    // Check if route has required properties
    if (!route || typeof route.x !== "number" || typeof route.y !== "number") {
        return { screenX: 0, screenY: 0 };
    }

    // Helper function to check if coordinate is already normalized
    const isNormalized = (value: number) => value >= 0 && value <= 1;

    // Smart normalization: only convert if not already normalized
    const xNorm = isNormalized(route.x) ? route.x : route.x / ORIGINAL_MAP_WIDTH;
    const yNorm = isNormalized(route.y) ? route.y : route.y / ORIGINAL_MAP_HEIGHT;

    // Calculate relative position on map (without transformations)
    const relativeX = xNorm * mapWidth;
    const relativeY = yNorm * mapHeight;

    // Screen position with transformations
    const centerX = mapWidth / 2;
    const centerY = mapHeight / 2;

    // Position relative to map center
    const offsetX = relativeX - centerX;
    const offsetY = relativeY - centerY;

    // Apply transformations: scale first, then translate
    const scaledX = offsetX * scale;
    const scaledY = offsetY * scale;

    // Final screen position
    const screenX = centerX + scaledX + translateX;
    const screenY = centerY + scaledY + translateY;

    return { screenX, screenY };
}

/**
 * Check if a route is visible on screen
 */
export function isRouteVisibleOnScreen(
    route: { x: number; y: number } | null,
    scale: number,
    translateX: number,
    translateY: number,
    mapWidth: number,
    mapHeight: number,
    circleRadius: number = 15
): boolean {
    if (!route || typeof route.x !== "number" || typeof route.y !== "number") {
        return false;
    }

    const { screenX, screenY } = getScreenCoords(
        route,
        scale,
        translateX,
        translateY,
        mapWidth,
        mapHeight
    );

    // Check if circle is visible on screen (with safety margin)
    const isVisible =
        screenX >= -circleRadius &&
        screenX <= mapWidth + circleRadius &&
        screenY >= -circleRadius &&
        screenY <= mapHeight + circleRadius;

    return isVisible;
}

/**
 * Convert coordinates to relative format (0-1)
 */
export function toRelativeCoords(
    x: number,
    y: number,
    mapWidth: number,
    mapHeight: number
): { x: number; y: number } {
    return {
        x: x / mapWidth,
        y: y / mapHeight,
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
    const safeScale = safeNumber(scale, 1, minScale, maxScale);
    const safeTranslateX = safeNumber(translateX, 0);
    const safeTranslateY = safeNumber(translateY, 0);
    const safeScreenW = safeNumber(screenW, 1, 1);
    const safeScreenH = safeNumber(screenH, 1, 1);
    const safeImgW = safeNumber(imgW, 1, 1);
    const safeImgH = safeNumber(imgH, 1, 1);

    // Calculate bounds
    const scaledImgW = safeImgW * safeScale;
    const scaledImgH = safeImgH * safeScale;

    // Calculate translation limits
    let clampedTranslateX = safeTranslateX;
    let clampedTranslateY = safeTranslateY;

    // If image is larger than screen, prevent over-panning
    if (scaledImgW > safeScreenW) {
        const maxTranslateX = 0;
        const minTranslateX = safeScreenW - scaledImgW;
        clampedTranslateX = Math.max(minTranslateX, Math.min(maxTranslateX, safeTranslateX));
    } else {
        // If image is smaller than screen, center it
        clampedTranslateX = (safeScreenW - scaledImgW) / 2;
    }

    if (scaledImgH > safeScreenH) {
        const maxTranslateY = 0;
        const minTranslateY = safeScreenH - scaledImgH;
        clampedTranslateY = Math.max(minTranslateY, Math.min(maxTranslateY, safeTranslateY));
    } else {
        // If image is smaller than screen, center it
        clampedTranslateY = (safeScreenH - scaledImgH) / 2;
    }

    return {
        translateX: clampedTranslateX,
        translateY: clampedTranslateY,
        scale: safeScale,
    };
}

/**
 * חישוב גבולות נקודת התצוגה הנוכחית במערכת קואורדינטות התמונה
 * Calculate current viewport bounds in image coordinate system
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

/**
 * Utility to convert between different coordinate systems
 */
export const CoordinateUtils = {
    toScreen,
    toImg,
    toNorm,
    fromNorm,
    getScreenCoords,
    isRouteVisibleOnScreen,
    toRelativeCoords,
    clampViewport,
    getViewportBounds,
    safeNumber,
};

export default CoordinateUtils;
