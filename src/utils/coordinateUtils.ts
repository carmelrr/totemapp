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
 * Marked as worklet to allow usage in gesture handlers on UI thread
 */
function safeNumber(value: number, fallback: number = 0, min?: number, max?: number): number {
    'worklet';
    if (!isFinite(value)) return fallback;
    if (min !== undefined && value < min) return min;
    if (max !== undefined && value > max) return max;
    return value;
}

/**
 * Convert image coordinates to screen coordinates
 * 
 * Transform model: screenPos = (imagePos - imgCenter) * scale + imgCenter + translate
 * 
 * Note: The simple formula (screenPos = imagePos * scale + translate) is preserved
 * as a legacy fallback when image dimensions are not provided.
 */
export function toScreen(
    { xImg, yImg }: ImageCoords,
    { translateX, translateY, scale }: MapTransforms,
    imageDimensions?: ImageDimensions
): ScreenCoords {
    const safeScale = safeNumber(scale, 1, 0.1, 10);
    const safeTranslateX = safeNumber(translateX, 0);
    const safeTranslateY = safeNumber(translateY, 0);
    const safeXImg = safeNumber(xImg, 0);
    const safeYImg = safeNumber(yImg, 0);

    // If image dimensions are provided, use the correct center-based formula
    if (imageDimensions && imageDimensions.imgW > 0 && imageDimensions.imgH > 0) {
        const imgCenterX = imageDimensions.imgW / 2;
        const imgCenterY = imageDimensions.imgH / 2;
        return {
            xS: (safeXImg - imgCenterX) * safeScale + imgCenterX + safeTranslateX,
            yS: (safeYImg - imgCenterY) * safeScale + imgCenterY + safeTranslateY,
        };
    }

    // Legacy fallback
    return {
        xS: safeTranslateX + safeXImg * safeScale,
        yS: safeTranslateY + safeYImg * safeScale,
    };
}

/**
 * Convert screen coordinates to image coordinates
 * 
 * Transform model: screenPos = (imagePos - imgCenter) * scale + imgCenter + translate
 * To invert: imagePos = (screenPos - imgCenter - translate) / scale + imgCenter
 * 
 * Note: The simple formula is preserved as a legacy fallback when image dimensions
 * are not provided.
 */
export function toImg(
    { xS, yS }: ScreenCoords,
    { translateX, translateY, scale }: MapTransforms,
    imageDimensions?: ImageDimensions
): ImageCoords {
    const safeScale = safeNumber(scale, 1, 0.1, 10);
    const safeTranslateX = safeNumber(translateX, 0);
    const safeTranslateY = safeNumber(translateY, 0);
    const safeXS = safeNumber(xS, 0);
    const safeYS = safeNumber(yS, 0);

    // If image dimensions are provided, use the correct center-based formula
    if (imageDimensions && imageDimensions.imgW > 0 && imageDimensions.imgH > 0) {
        const imgCenterX = imageDimensions.imgW / 2;
        const imgCenterY = imageDimensions.imgH / 2;
        return {
            xImg: (safeXS - imgCenterX - safeTranslateX) / safeScale + imgCenterX,
            yImg: (safeYS - imgCenterY - safeTranslateY) / safeScale + imgCenterY,
        };
    }

    // Legacy fallback
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
 * With transform order [translate, scale]: scale happens from image center
 * Screen position = (imagePos - imgCenter) * scale + imgCenter + translate
 * 
 * For left edge (imagePos = 0): screenPos = -imgW/2 * scale + imgW/2 + translate
 * For right edge (imagePos = imgW): screenPos = imgW/2 * scale + imgW/2 + translate
 * 
 * Marked as worklet to allow usage in gesture handlers on UI thread
 */
export function clampViewport(
    { translateX, translateY, scale }: MapTransforms,
    screenW: number,
    screenH: number,
    imgW: number,
    imgH: number,
    minScale: number = 0.5,
    maxScale: number = 4,
    allowPanAtMinZoom: boolean = true // Allow panning even when not zoomed for better UX
): MapTransforms {
    'worklet';
    // Ensure all inputs are finite and positive
    const safeScale = safeNumber(scale, 1, minScale, maxScale);
    const safeTranslateX = safeNumber(translateX, 0);
    const safeTranslateY = safeNumber(translateY, 0);
    const safeScreenW = safeNumber(screenW, 1, 1);
    const safeScreenH = safeNumber(screenH, 1, 1);
    const safeImgW = safeNumber(imgW, 1, 1);
    const safeImgH = safeNumber(imgH, 1, 1);

    // Image center
    const imgCenterX = safeImgW / 2;
    const imgCenterY = safeImgH / 2;
    
    // Calculate where image edges appear on screen:
    // Left edge (imageX=0): screenX = (0 - imgCenterX) * scale + imgCenterX + translateX
    //                      = imgCenterX * (1 - scale) + translateX
    // Right edge (imageX=imgW): screenX = (imgW - imgCenterX) * scale + imgCenterX + translateX
    //                          = imgCenterX * (1 + scale) + translateX
    
    const scaledWidth = safeImgW * safeScale;
    const scaledHeight = safeImgH * safeScale;

    let clampedTranslateX = safeTranslateX;
    let clampedTranslateY = safeTranslateY;

    // If scaled image is larger than screen, keep edges within bounds
    // Allow overscroll so edges can come into view (30% of viewport as breathing room)
    if (scaledWidth > safeScreenW) {
        const overscrollX = safeScreenW * 0.3;
        // Don't let left edge go past screen left (leftEdge <= 0)
        // leftEdge = imgCenterX * (1 - scale) + translateX <= 0
        // translateX <= imgCenterX * (scale - 1)
        const maxTranslateX = imgCenterX * (safeScale - 1) + overscrollX;
        
        // Don't let right edge go before screen right (rightEdge >= screenW)
        // rightEdge = imgCenterX * (1 + scale) + translateX >= screenW
        // translateX >= screenW - imgCenterX * (1 + scale)
        const minTranslateX = safeScreenW - imgCenterX * (1 + safeScale) - overscrollX;
        
        clampedTranslateX = Math.max(minTranslateX, Math.min(maxTranslateX, safeTranslateX));
    } else if (allowPanAtMinZoom) {
        // Allow panning, but keep image at least partially visible (25% on each side)
        const margin = scaledWidth * 0.25;
        const maxTranslateX = safeScreenW - margin - imgCenterX * (1 - safeScale);
        const minTranslateX = margin - imgCenterX * (1 + safeScale);
        clampedTranslateX = Math.max(minTranslateX, Math.min(maxTranslateX, safeTranslateX));
    } else {
        // Center the image horizontally (legacy behavior)
        clampedTranslateX = (safeScreenW - safeImgW) / 2;
    }

    if (scaledHeight > safeScreenH) {
        const overscrollY = safeScreenH * 0.3;
        const maxTranslateY = imgCenterY * (safeScale - 1) + overscrollY;
        const minTranslateY = safeScreenH - imgCenterY * (1 + safeScale) - overscrollY;
        clampedTranslateY = Math.max(minTranslateY, Math.min(maxTranslateY, safeTranslateY));
    } else if (allowPanAtMinZoom) {
        // Allow vertical panning too, keep at least 25% visible on each side
        const margin = scaledHeight * 0.25;
        const maxTranslateY = safeScreenH - margin - imgCenterY * (1 - safeScale);
        const minTranslateY = margin - imgCenterY * (1 + safeScale);
        clampedTranslateY = Math.max(minTranslateY, Math.min(maxTranslateY, safeTranslateY));
    } else {
        // Center the image vertically (legacy behavior)
        clampedTranslateY = (safeScreenH - safeImgH) / 2;
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
 * 
 * Transform model: screenPos = (imagePos - imgCenter) * scale + imgCenter + translate
 * To invert: imagePos = (screenPos - imgCenter - translate) / scale + imgCenter
 */
export function getViewportBounds(
    { translateX, translateY, scale }: MapTransforms,
    screenW: number,
    screenH: number,
    imageW?: number,
    imageH?: number
) {
    // ✅ Safety: מוודא שכל הערכים תקינים לפני חלוקה
    const safeScale = Math.max(0.1, Math.min(10, isFinite(scale) ? scale : 1));
    const safeTranslateX = isFinite(translateX) ? translateX : 0;
    const safeTranslateY = isFinite(translateY) ? translateY : 0;
    const safeScreenW = Math.max(1, isFinite(screenW) ? screenW : 1);
    const safeScreenH = Math.max(1, isFinite(screenH) ? screenH : 1);
    
    // If image dimensions are provided, use the correct center-based formula
    // Otherwise fall back to the simple formula for backwards compatibility
    if (imageW !== undefined && imageH !== undefined && imageW > 0 && imageH > 0) {
        const imgCenterX = imageW / 2;
        const imgCenterY = imageH / 2;
        
        return {
            xMinImg: (0 - imgCenterX - safeTranslateX) / safeScale + imgCenterX,
            yMinImg: (0 - imgCenterY - safeTranslateY) / safeScale + imgCenterY,
            xMaxImg: (safeScreenW - imgCenterX - safeTranslateX) / safeScale + imgCenterX,
            yMaxImg: (safeScreenH - imgCenterY - safeTranslateY) / safeScale + imgCenterY,
        };
    }

    // Legacy fallback (simple formula)
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
