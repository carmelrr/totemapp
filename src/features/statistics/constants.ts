// src/features/statistics/constants.ts

export const GRADE_ORDER = [
  'VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5',
  'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12',
];

export const GRADE_COLORS: Record<string, string> = {
  VB: '#8BC34A',
  V0: '#4CAF50',
  V1: '#009688',
  V2: '#00BCD4',
  V3: '#2196F3',
  V4: '#3F51B5',
  V5: '#673AB7',
  V6: '#9C27B0',
  V7: '#E91E63',
  V8: '#F44336',
  V9: '#FF5722',
  V10: '#FF9800',
  V11: '#795548',
  V12: '#424242',
};

export const RATING_COLORS: Record<number, string> = {
  1: '#F44336',
  2: '#FF9800',
  3: '#FFC107',
  4: '#8BC34A',
  5: '#4CAF50',
};

export const DAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const GRADE_GROUPS = {
  easy: ['VB', 'V0', 'V1', 'V2'],
  medium: ['V3', 'V4'],
  hard: ['V5', 'V6'],
  elite: ['V7', 'V8', 'V9', 'V10', 'V11', 'V12'],
};

export const GRADE_GROUP_COLORS = {
  easy: '#222222',
  medium: '#F5C518',
  hard: '#E53935',
  elite: '#1E88E5',
};

/** Sort grades by climbing difficulty order, not alphabetically */
export function gradeIndex(grade: string): number {
  const idx = GRADE_ORDER.indexOf(grade);
  return idx === -1 ? 99 : idx;
}

/** Get the grade group for a grade string */
export function getGradeGroup(grade: string): 'easy' | 'medium' | 'hard' | 'elite' {
  if (GRADE_GROUPS.easy.includes(grade)) return 'easy';
  if (GRADE_GROUPS.medium.includes(grade)) return 'medium';
  if (GRADE_GROUPS.hard.includes(grade)) return 'hard';
  return 'elite';
}

/** Convert Firestore timestamp to JS Date */
export function toDate(ts: any): Date {
  if (!ts) return new Date(0);
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts);
}

/** Get period dates from a period string */
export function getPeriodDates(period: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = new Date(now);
  let startDate: Date;

  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
      startDate = new Date(2020, 0, 1);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { startDate, endDate };
}

/** Get the previous period of equal length for comparison */
export function getPreviousPeriodDates(startDate: Date, endDate: Date): { startDate: Date; endDate: Date } {
  const duration = endDate.getTime() - startDate.getTime();
  return {
    startDate: new Date(startDate.getTime() - duration),
    endDate: new Date(startDate.getTime()),
  };
}
