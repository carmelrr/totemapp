/**
 * @fileoverview Shift System Constants
 * @description Constants and configurations for the shift management system
 */

import { ShiftStatus, RegistrationStatus } from './types';

/**
 * Shift status display info
 */
export const SHIFT_STATUS_CONFIG: Record<ShiftStatus, { label: string; labelEn: string; color: string; icon: string }> = {
  open: {
    label: 'פתוח להרשמה',
    labelEn: 'Open',
    color: '#10B981',
    icon: '🟢',
  },
  closed: {
    label: 'הרשמה סגורה',
    labelEn: 'Closed',
    color: '#F59E0B',
    icon: '🟡',
  },
  assigned: {
    label: 'שובץ',
    labelEn: 'Assigned',
    color: '#3B82F6',
    icon: '🔵',
  },
  completed: {
    label: 'הושלם',
    labelEn: 'Completed',
    color: '#6B7280',
    icon: '✅',
  },
  cancelled: {
    label: 'בוטל',
    labelEn: 'Cancelled',
    color: '#EF4444',
    icon: '❌',
  },
};

/**
 * Registration status display info
 */
export const REGISTRATION_STATUS_CONFIG: Record<RegistrationStatus, { label: string; labelEn: string; color: string; icon: string }> = {
  pending: {
    label: 'ממתין לאישור',
    labelEn: 'Pending',
    color: '#F59E0B',
    icon: '⏳',
  },
  approved: {
    label: 'אושר',
    labelEn: 'Approved',
    color: '#10B981',
    icon: '✅',
  },
  rejected: {
    label: 'נדחה',
    labelEn: 'Rejected',
    color: '#EF4444',
    icon: '❌',
  },
  waitlisted: {
    label: 'ברשימת המתנה',
    labelEn: 'Waitlisted',
    color: '#8B5CF6',
    icon: '📋',
  },
  cancelled: {
    label: 'בוטל',
    labelEn: 'Cancelled',
    color: '#6B7280',
    icon: '🚫',
  },
};

/**
 * Default shift roles to suggest when setting up the system
 */
export const DEFAULT_SHIFT_ROLES = [
  { name: 'עובד דלפק', nameEn: 'Desk Worker', icon: '🖥️', color: '#3B82F6' },
  { name: 'מדריך', nameEn: 'Instructor', icon: '🧗', color: '#10B981' },
  { name: 'אחראי קיר', nameEn: 'Wall Manager', icon: '🏗️', color: '#F59E0B' },
  { name: 'אחראי משמרת', nameEn: 'Shift Manager', icon: '👷', color: '#8B5CF6' },
];

/**
 * Days of week in Hebrew
 */
export const DAYS_OF_WEEK_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const DAYS_OF_WEEK_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Recurrence type display
 */
export const RECURRENCE_CONFIG = {
  none: { label: 'חד-פעמי', labelEn: 'One-time' },
  daily: { label: 'יומי', labelEn: 'Daily' },
  weekly: { label: 'שבועי', labelEn: 'Weekly' },
  biweekly: { label: 'דו-שבועי', labelEn: 'Bi-weekly' },
  monthly: { label: 'חודשי', labelEn: 'Monthly' },
};
