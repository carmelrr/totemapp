import { auth, db } from "@/features/data/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { migrateFeedbacksWithDisplayName } from "@/features/routes/routesService";
import type { PrivacySettings } from "../types";

export async function fetchProfile(userId: string) {
  if (!userId) return {};
  
  const docRef = doc(db, "users", userId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      displayName: data.displayName,
      photoURL: data.photoURL,
      isAdmin: data.isAdmin,
      privacySettings: data.privacySettings,
    };
  }
  
  return {};
}

export async function saveProfile(userId: string, profile: { displayName: string; photoURL: string | null }) {
  const user = auth.currentUser;
  if (!user || user.uid !== userId) {
    throw new Error("User not authenticated");
  }

  // Update Firebase Authentication profile
  await updateProfile(user, {
    displayName: profile.displayName,
    photoURL: profile.photoURL,
  });

  // Update Firestore user document
  await setDoc(
    doc(db, "users", userId),
    { 
      displayName: profile.displayName, 
      photoURL: profile.photoURL 
    },
    { merge: true }
  );

  // Auto-migrate existing feedbacks with new displayName
  try {
    await migrateFeedbacksWithDisplayName(userId);
  } catch (migrationError) {
    console.error("Migration failed but profile was saved:", migrationError);
  }
}

export async function savePrivacySettings(userId: string, settings: PrivacySettings) {
  if (!userId) return;
  
  await setDoc(
    doc(db, "users", userId),
    {
      privacySettings: settings,
    },
    { merge: true }
  );
}
