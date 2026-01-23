/**
 * Error Reporting Service
 * שירות דיווח שגיאות - חלופה ל-Crashlytics
 * 
 * שומר שגיאות ב-Firestore לצפייה ב-Firebase Console
 * בעתיד אפשר להחליף ב-Sentry או Crashlytics עם react-native-firebase
 */

import { db, auth } from '@/features/data/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ===== TYPES =====

interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  userId?: string;
  userEmail?: string;
  platform: string;
  appVersion: string;
  expoVersion?: string;
  deviceInfo: {
    os: string;
    osVersion?: string;
  };
  timestamp: any;
  severity: 'error' | 'warning' | 'info';
  context?: Record<string, any>;
  handled: boolean;
}

// ===== CONFIGURATION =====

const ERRORS_COLLECTION = 'errorReports';
const MAX_ERRORS_PER_SESSION = 50; // מניעת spam
let errorCount = 0;

// ===== MAIN FUNCTIONS =====

/**
 * דיווח שגיאה ל-Firebase
 */
export async function reportError(
  error: Error | string,
  options: {
    severity?: 'error' | 'warning' | 'info';
    context?: Record<string, any>;
    componentStack?: string;
    handled?: boolean;
  } = {}
): Promise<void> {
  // מניעת spam
  if (errorCount >= MAX_ERRORS_PER_SESSION) {
    console.warn('Max error reports per session reached');
    return;
  }
  errorCount++;

  try {
    const user = auth.currentUser;
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'string' ? undefined : error.stack;

    const report: ErrorReport = {
      message: errorMessage,
      stack: errorStack,
      componentStack: options.componentStack,
      userId: user?.uid,
      userEmail: user?.email || undefined,
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version || '1.0.0',
      expoVersion: Constants.expoConfig?.sdkVersion,
      deviceInfo: {
        os: Platform.OS,
        osVersion: Platform.Version?.toString(),
      },
      timestamp: serverTimestamp(),
      severity: options.severity || 'error',
      context: options.context,
      handled: options.handled ?? true,
    };

    await addDoc(collection(db, ERRORS_COLLECTION), report);
    console.log('Error reported to Firebase');
  } catch (reportingError) {
    // אם נכשל דיווח השגיאה, לפחות נרשום ל-console
    console.error('Failed to report error:', reportingError);
    console.error('Original error:', error);
  }
}

/**
 * דיווח אזהרה
 */
export async function reportWarning(
  message: string,
  context?: Record<string, any>
): Promise<void> {
  await reportError(message, { severity: 'warning', context, handled: true });
}

/**
 * דיווח מידע (לא שגיאה)
 */
export async function reportInfo(
  message: string,
  context?: Record<string, any>
): Promise<void> {
  await reportError(message, { severity: 'info', context, handled: true });
}

/**
 * עטיפת פונקציה עם דיווח שגיאות אוטומטי
 */
export function withErrorReporting<T extends (...args: any[]) => any>(
  fn: T,
  context?: Record<string, any>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      await reportError(error as Error, { context, handled: true });
      throw error;
    }
  }) as T;
}

// ===== GLOBAL ERROR HANDLER =====

/**
 * הגדרת handler גלובלי לשגיאות לא מטופלות
 */
export function setupGlobalErrorHandler(): void {
  // שגיאות JavaScript לא מטופלות
  const originalHandler = ErrorUtils.getGlobalHandler();
  
  ErrorUtils.setGlobalHandler(async (error, isFatal) => {
    await reportError(error, {
      severity: 'error',
      handled: false,
      context: { isFatal },
    });
    
    // קריאה ל-handler המקורי
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });

  // Promise rejections לא מטופלות
  if (typeof globalThis !== 'undefined') {
    const originalRejectionHandler = (globalThis as any).onunhandledrejection;
    
    (globalThis as any).onunhandledrejection = async (event: any) => {
      await reportError(
        event.reason?.message || 'Unhandled Promise Rejection',
        {
          severity: 'error',
          handled: false,
          context: { reason: String(event.reason) },
        }
      );
      
      if (originalRejectionHandler) {
        originalRejectionHandler(event);
      }
    };
  }

  console.log('✅ Global error handler set up');
}

// ===== ERROR BOUNDARY HELPER =====

/**
 * פונקציה לשימוש ב-Error Boundary של React
 */
export async function handleErrorBoundary(
  error: Error,
  errorInfo: { componentStack: string }
): Promise<void> {
  await reportError(error, {
    severity: 'error',
    componentStack: errorInfo.componentStack,
    handled: true,
    context: { source: 'ErrorBoundary' },
  });
}

// ===== PERFORMANCE TRACKING =====

/**
 * מדידת זמן ביצוע פונקציה
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    
    // דיווח רק אם הפעולה ארכה יותר מ-3 שניות
    if (duration > 3000) {
      await reportInfo(`Slow operation: ${name}`, {
        duration,
        operation: name,
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    await reportError(error as Error, {
      context: { operation: name, duration },
    });
    throw error;
  }
}

// TypeScript declaration for ErrorUtils
declare const ErrorUtils: {
  getGlobalHandler: () => ((error: Error, isFatal?: boolean) => void) | null;
  setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
};
