/**
 * Text utilities for handling Hebrew and English text detection and formatting
 */

/**
 * Detects if text is primarily Hebrew
 * @param text - The text to analyze
 * @returns true if text is primarily Hebrew, false otherwise
 */
export const isHebrewText = (text: string | null | undefined): boolean => {
    if (!text || typeof text !== "string") return false;

    // Remove common characters that are language-neutral
    const cleanText = text.replace(
        /[\s\d\-.,!?@#$%^&*()_+=\[\]{}|\\:";'<>?/~`]/g,
        "",
    );

    if (cleanText.length === 0) return true; // Default to Hebrew for empty/neutral text

    // Hebrew Unicode range: 0x0590-0x05FF
    const hebrewChars = cleanText.match(/[\u0590-\u05FF]/g);
    const hebrewCount = hebrewChars ? hebrewChars.length : 0;

    // English characters: a-z, A-Z
    const englishChars = cleanText.match(/[a-zA-Z]/g);
    const englishCount = englishChars ? englishChars.length : 0;

    // If both exist, choose the more common one
    if (hebrewCount > 0 && englishCount > 0) {
        return hebrewCount >= englishCount;
    }

    // If only one type exists, return accordingly
    if (hebrewCount > 0) return true;
    if (englishCount > 0) return false;

    // Default to Hebrew for unclear cases
    return true;
};

/**
 * Gets the appropriate text alignment based on text content
 * @param text - The text to analyze
 * @returns 'right' for Hebrew text, 'left' for English text
 */
export const getTextAlign = (text: string | null | undefined): 'left' | 'right' => {
    return isHebrewText(text) ? 'right' : 'left';
};

/**
 * Gets the appropriate writing direction based on text content
 * @param text - The text to analyze
 * @returns 'rtl' for Hebrew text, 'ltr' for English text
 */
export const getWritingDirection = (text: string | null | undefined): 'ltr' | 'rtl' => {
    return isHebrewText(text) ? 'rtl' : 'ltr';
};

/**
 * Formats user display name with fallback
 * @param displayName - The display name
 * @param fallback - Fallback text if no display name
 * @returns Formatted display name
 */
export const formatDisplayName = (displayName?: string, fallback = 'Anonymous'): string => {
    return displayName?.trim() || fallback;
};

/**
 * Truncates text to specified length with ellipsis
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export const truncateText = (text: string, maxLength: number): string => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
};
