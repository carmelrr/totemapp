// features/data/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
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
const firebaseConfig = {
  apiKey: "AIzaSyDCClgfCWH9megeAsPydnR9MknrbSV2ToM",
  authDomain: "totemapp-464009.firebaseapp.com",
  projectId: "totemapp-464009",
  storageBucket: "totemapp-464009.firebasestorage.app",
  messagingSenderId: "720872675049",
  appId: "1:720872675049:web:410665ffdf49999f07c278",
  measurementId: "G-2T1NVDPG50",
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

// Export configured instances
export { auth, db, storage };

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
