// features/routes/validators.ts
import { Route, Hold, HoldRole } from './types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateRoute(route: Partial<Route>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // בדיקות בסיסיות
  if (!route.name || route.name.trim().length === 0) {
    errors.push('שם המסלול נדרש');
  }

  if (!route.holds || route.holds.length === 0) {
    errors.push('המסלול חייב לכלול לפחות אחיזה אחת');
  } else {
    const holds = route.holds;

    // בדוק שיש לפחות אחיזת התחלה
    const startHolds = holds.filter(h => h.role === 'start');
    if (startHolds.length === 0) {
      errors.push('המסלול חייב לכלול לפחות אחיזת התחלה אחת');
    }

    // בדוק שיש לפחות אחיזת סיום
    const finishHolds = holds.filter(h => h.role === 'finish');
    if (finishHolds.length === 0) {
      errors.push('המסלול חייב לכלול לפחות אחיזת סיום אחת');
    }

    // בדוק שיש אחיזות ביניים (hand או any)
    const middleHolds = holds.filter(h => h.role === 'hand' || h.role === 'any');
    if (middleHolds.length === 0 && holds.length > 2) {
      warnings.push('מומלץ להוסיף אחיזות ביניים למסלול');
    }

    // בדוק קואורדינטות תקינות
    for (const hold of holds) {
      if (hold.x < 0 || hold.x > 1 || hold.y < 0 || hold.y > 1) {
        errors.push(`אחיזה ${hold.id} נמצאת מחוץ לגבולות הקיר`);
      }
      
      if (hold.size <= 0 || hold.size > 0.1) {
        warnings.push(`גודל אחיזה ${hold.id} נראה לא תקין`);
      }
    }

    // בדוק צבעים תקינים
    const validColorPattern = /^#[0-9A-Fa-f]{6}$/;
    for (const hold of holds) {
      if (!validColorPattern.test(hold.color)) {
        errors.push(`צבע אחיזה ${hold.id} לא תקין`);
      }
    }
  }

  if (!route.grade || route.grade.trim().length === 0) {
    warnings.push('מומלץ להגדיר דירוג למסלול');
  }

  if (!route.wallId) {
    errors.push('מזהה קיר נדרש');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateHold(hold: Partial<Hold>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof hold.x !== 'number' || hold.x < 0 || hold.x > 1) {
    errors.push('קואורדינטת X חייבת להיות בין 0 ל-1');
  }

  if (typeof hold.y !== 'number' || hold.y < 0 || hold.y > 1) {
    errors.push('קואורדינטת Y חייבת להיות בין 0 ל-1');
  }

  if (!hold.role) {
    errors.push('תפקיד האחיזה נדרש');
  } else {
    const validRoles: HoldRole[] = ['start', 'finish', 'hand', 'foot', 'any'];
    if (!validRoles.includes(hold.role)) {
      errors.push('תפקיד האחיזה לא תקין');
    }
  }

  if (!hold.color) {
    errors.push('צבע האחיזה נדרש');
  } else {
    const validColorPattern = /^#[0-9A-Fa-f]{6}$/;
    if (!validColorPattern.test(hold.color)) {
      errors.push('צבע האחיזה לא תקין');
    }
  }

  if (typeof hold.size !== 'number' || hold.size <= 0) {
    errors.push('גודל האחיזה חייב להיות מספר חיובי');
  } else if (hold.size > 0.1) {
    warnings.push('גודל האחיזה נראה גדול מדי');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateGrade(grade: string): boolean {
  // דירוגי V-scale בסיסיים
  const vScalePattern = /^V[0-9]|V1[0-7]$/; // V0-V17
  
  // דירוגי Font בסיסיים
  const fontPattern = /^[1-9][a-c]?[\+\-]?$/; // 1-9 עם אפשרות ל a/b/c ו +/-
  
  return vScalePattern.test(grade) || fontPattern.test(grade) || grade === 'Project';
}
