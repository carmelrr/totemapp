// features/data/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported as isAnalyticsSupported, logEvent } from "firebase/analytics";
import { getRemoteConfig, fetchAndActivate, getValue } from "firebase/remote-config";
import { getPerformance } from "firebase/performance";
import { 
  initializeAppCheck, 
  ReCaptchaEnterpriseProvider,
  CustomProvider 
} from "firebase/app-check";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

// ===== FIREBASE CONFIGURATION =====

// Your web app's Firebase configuration
// Uses environment variables with fallbacks for development
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyDCClgfCWH9megeAsPydnR9MknrbSV2ToM",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "totemapp-464009.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "totemapp-464009",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "totemapp-464009.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "720872675049",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:720872675049:web:410665ffdf49999f07c278",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-2T1NVDPG50",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with proper React Native persistence
let auth;
try {
  // Check if we're in React Native environment
  const isReactNative =
    typeof globalThis.navigator !== "undefined" && (globalThis.navigator as any).product === "ReactNative";

  if (isReactNative) {
    // Import React Native specific modules dynamically
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    const { getReactNativePersistence } = require("firebase/auth");

    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } else {
    // For web or Node.js environments
    auth = getAuth(app);
  }
} catch (error) {
  console.warn("Auth initialization failed, using fallback:", error.message);
  // Fallback to default auth
  try {
    auth = getAuth(app);
  } catch (fallbackError) {
    console.error("Fallback auth initialization also failed:", fallbackError);
    throw fallbackError;
  }
}

const db = getFirestore(app);
const storage = getStorage(app);

// ===== APP CHECK INITIALIZATION =====
// App Check protects your backend resources from abuse
// It verifies that requests come from your authentic app

let appCheck;
try {
  const isReactNative =
    typeof globalThis.navigator !== "undefined" && 
    (globalThis.navigator as any).product === "ReactNative";

  if (isReactNative) {
    // For React Native, we use a custom provider or debug token in development
    // In production, you'll need to set up Play Integrity (Android) or DeviceCheck (iOS)
    if (__DEV__) {
      // In development, App Check can use debug tokens
      // Set FIREBASE_APPCHECK_DEBUG_TOKEN=true in your environment
      console.log("App Check: Running in debug mode");
    }
    // Note: Full App Check for React Native requires @react-native-firebase/app-check
    // For now, we'll skip App Check on React Native - this is normal for Expo managed workflow
  }
  // Skip web App Check initialization for now - not needed for mobile app
} catch (error: any) {
  console.warn("App Check initialization skipped:", error.message);
}

// Export configured instances
export { auth, db, storage, appCheck };

// ===== ANALYTICS =====
// מעקב אחר שימוש באפליקציה
let analytics: any = null;

const initAnalytics = async () => {
  try {
    // Analytics works only on web, not in React Native
    const supported = await isAnalyticsSupported();
    if (supported) {
      analytics = getAnalytics(app);
      console.log("✅ Analytics initialized");
    }
  } catch (error) {
    console.log("Analytics not available in this environment");
  }
};
initAnalytics();

// פונקציה לשליחת אירועים ל-Analytics
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (analytics) {
    logEvent(analytics, eventName, params);
  }
};

// אירועים מוכנים לשימוש
export const AnalyticsEvents = {
  // משתמשים
  userSignUp: () => trackEvent('sign_up'),
  userLogin: () => trackEvent('login'),
  userLogout: () => trackEvent('logout'),
  
  // מסלולים
  routeCreated: (grade: string) => trackEvent('route_created', { grade }),
  routeCompleted: (routeId: string, grade: string) => trackEvent('route_completed', { route_id: routeId, grade }),
  routeViewed: (routeId: string) => trackEvent('route_viewed', { route_id: routeId }),
  
  // פידבק
  feedbackAdded: (routeId: string, rating: number) => trackEvent('feedback_added', { route_id: routeId, rating }),
  
  // תחרויות
  competitionJoined: (competitionId: string) => trackEvent('competition_joined', { competition_id: competitionId }),
  
  // כללי
  screenView: (screenName: string) => trackEvent('screen_view', { screen_name: screenName }),
};

// ===== REMOTE CONFIG =====
// שליטה מרחוק על הגדרות האפליקציה
let remoteConfig: any = null;

const initRemoteConfig = async () => {
  try {
    // Remote Config works only on web
    const isWeb = typeof globalThis !== 'undefined' && typeof (globalThis as any).document !== 'undefined';
    if (isWeb) {
      remoteConfig = getRemoteConfig(app);
      
      // הגדרות ברירת מחדל
      remoteConfig.defaultConfig = {
        maintenance_mode: false,
        maintenance_message: "האפליקציה בתחזוקה, נחזור בקרוב!",
        min_app_version: "1.0.0",
        feature_competitions_enabled: true,
        feature_community_routes_enabled: true,
        welcome_message: "ברוכים הבאים לטוטם!",
      };
      
      // זמן מינימום בין רענונים (1 שעה בפרודקשן, 0 בפיתוח)
      remoteConfig.settings.minimumFetchIntervalMillis = __DEV__ ? 0 : 3600000;
      
      await fetchAndActivate(remoteConfig);
      console.log("✅ Remote Config initialized");
    }
  } catch (error) {
    console.log("Remote Config not available:", error);
  }
};
initRemoteConfig();

// פונקציות לקריאת הגדרות
export const RemoteConfig = {
  isMaintenanceMode: () => {
    if (!remoteConfig) return false;
    return getValue(remoteConfig, 'maintenance_mode').asBoolean();
  },
  getMaintenanceMessage: () => {
    if (!remoteConfig) return "";
    return getValue(remoteConfig, 'maintenance_message').asString();
  },
  getMinAppVersion: () => {
    if (!remoteConfig) return "1.0.0";
    return getValue(remoteConfig, 'min_app_version').asString();
  },
  isFeatureEnabled: (featureName: string) => {
    if (!remoteConfig) return true;
    return getValue(remoteConfig, `feature_${featureName}_enabled`).asBoolean();
  },
  getWelcomeMessage: () => {
    if (!remoteConfig) return "ברוכים הבאים!";
    return getValue(remoteConfig, 'welcome_message').asString();
  },
  getString: (key: string, defaultValue: string = "") => {
    if (!remoteConfig) return defaultValue;
    return getValue(remoteConfig, key).asString() || defaultValue;
  },
  getNumber: (key: string, defaultValue: number = 0) => {
    if (!remoteConfig) return defaultValue;
    return getValue(remoteConfig, key).asNumber() || defaultValue;
  },
  getBoolean: (key: string, defaultValue: boolean = false) => {
    if (!remoteConfig) return defaultValue;
    return getValue(remoteConfig, key).asBoolean();
  },
  // רענון ידני
  refresh: async () => {
    if (remoteConfig) {
      await fetchAndActivate(remoteConfig);
    }
  },
};

// ===== PERFORMANCE MONITORING =====
// מעקב אחר ביצועים
let performance: any = null;

const initPerformance = async () => {
  try {
    // Performance works only on web
    const isWeb = typeof globalThis !== 'undefined' && typeof (globalThis as any).document !== 'undefined';
    if (isWeb) {
      performance = getPerformance(app);
      console.log("✅ Performance Monitoring initialized");
    }
  } catch (error) {
    console.log("Performance Monitoring not available:", error);
  }
};
initPerformance();

export { analytics, remoteConfig, performance };

import { Route } from "@/features/routes/types";

// ===== ROUTE MANAGEMENT =====

export async function saveRoute(route: Route): Promise<void> {
  try {
    await setDoc(doc(db, "routes", route.id), {
      ...route,
      createdAt: route.createdAt || Date.now(),
    });
  } catch (error) {
    console.error("Error saving route:", error);
    throw new Error("Failed to save route");
  }
}

export async function getRoute(id: string): Promise<Route | null> {
  try {
    const docRef = doc(db, "routes", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Route;
    }

    return null;
  } catch (error) {
    console.error("Error getting route:", error);
    throw new Error("Failed to get route");
  }
}

export async function getWallRoutes(wallId: string): Promise<Route[]> {
  try {
    const q = query(
      collection(db, "routes"),
      where("wallId", "==", wallId),
      orderBy("createdAt", "desc"),
    );

    const querySnapshot = await getDocs(q);
    const routes: Route[] = [];

    querySnapshot.forEach((doc) => {
      routes.push({ id: doc.id, ...doc.data() } as Route);
    });

    return routes;
  } catch (error) {
    console.error("Error getting wall routes:", error);
    throw new Error("Failed to get routes");
  }
}

export function listenToWallRoutes(
  wallId: string,
  callback: (routes: Route[]) => void,
): () => void {
  const q = query(
    collection(db, "routes"),
    where("wallId", "==", wallId),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(q, (snapshot) => {
    const routes: Route[] = [];
    snapshot.forEach((doc) => {
      routes.push({ id: doc.id, ...doc.data() } as Route);
    });
    callback(routes);
  });
}

export async function deleteRoute(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "routes", id));
  } catch (error) {
    console.error("Error deleting route:", error);
    throw new Error("Failed to delete route");
  }
}

// ===== UTILITIES =====

export function generateWallId(): string {
  return `wall_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateRouteId(): string {
  return `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ===== EXPORT UTILITIES =====

export async function saveExportedImage(
  imageBlob: Blob,
  routeId: string,
): Promise<string> {
  try {
    const imageRef = ref(storage, `exports/${routeId}/route_image.png`);
    await uploadBytes(imageRef, imageBlob);

    const downloadUrl = await getDownloadURL(imageRef);
    return downloadUrl;
  } catch (error) {
    console.error("Error saving exported image:", error);
    throw new Error("Failed to save exported image");
  }
}
