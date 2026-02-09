/**
 * Shared utilities for all RouteDetail screens
 * (RouteDetailsScreen, SprayRouteDetailScreen, CommunityRouteDetailScreen)
 */

/** V-Scale grades used across all feedback forms */
export const V_GRADES = [
  'VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12',
];

/**
 * Get the index of a V-grade in the V_GRADES array.
 * VB = 0, V0 = 1, V1 = 2, etc.
 */
export const getGradeIndex = (grade: string): number => {
  const index = V_GRADES.indexOf(grade);
  return index >= 0 ? index : -1;
};

/**
 * Get allowed grades for community rating (±2 from builder's original).
 * If builder set V5, community can rate V3-V7.
 */
export const getAllowedGrades = (originalGrade: string): string[] => {
  const originalIndex = getGradeIndex(originalGrade);
  if (originalIndex < 0) return V_GRADES;

  const minIndex = Math.max(0, originalIndex - 2);
  const maxIndex = Math.min(V_GRADES.length - 1, originalIndex + 2);
  return V_GRADES.slice(minIndex, maxIndex + 1);
};

/**
 * Determine text color based on background brightness (light bg → dark text, vice-versa).
 */
export const getContrastTextColor = (backgroundColor: string): string => {
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1F2937' : '#FFFFFF';
};

/**
 * Format a Firestore timestamp (or Date) for display.
 */
export const formatDate = (
  timestamp: any,
  locale: string = 'he-IL',
  options?: Intl.DateTimeFormatOptions,
): string => {
  if (!timestamp) return '';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString(locale, options);
  } catch {
    return '';
  }
};
