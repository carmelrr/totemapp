import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "@/features/data/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const UserContext = createContext({
  isAdmin: false,
  circleSize: 12, // ברירת מחדל: גודל בינוני (6=קטן, 12=בינוני, 20=גדול)
  setCircleSize: (newSize: number) => {},
  showZoomSlider: false, // ברירת מחדל: מוסתר
  setShowZoomSlider: (show: boolean) => {},
});

export function UserProvider({ children, isAdmin }) {
  const [circleSize, setCircleSize] = useState(12); // Default to medium size
  const [showZoomSlider, setShowZoomSlider] = useState(false); // Default to hidden

  // Load user preferences from Firestore
  useEffect(() => {
    const loadUserPreferences = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const userData = docSnap.data();
            if (userData.circleSize) {
              setCircleSize(userData.circleSize);
            }
            if (userData.showZoomSlider !== undefined) {
              setShowZoomSlider(userData.showZoomSlider);
            }
          }
        } catch (error) {
          // Error loading user preferences - silently handled
        }
      }
    };

    loadUserPreferences();
  }, []);

  // Save circle size preference to Firestore
  const saveCircleSize = async (newSize) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const docRef = doc(db, "users", user.uid);
        await setDoc(docRef, { circleSize: newSize }, { merge: true });
        setCircleSize(newSize);
      } catch (error) {
        // Error saving circle size preference - silently handled
      }
    }
  };

  // Save zoom slider preference to Firestore
  const saveShowZoomSlider = async (show: boolean) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const docRef = doc(db, "users", user.uid);
        await setDoc(docRef, { showZoomSlider: show }, { merge: true });
        setShowZoomSlider(show);
      } catch (error) {
        // Error saving zoom slider preference - silently handled
      }
    }
  };

  return (
    <UserContext.Provider
      value={{
        isAdmin,
        circleSize,
        setCircleSize: saveCircleSize,
        showZoomSlider,
        setShowZoomSlider: saveShowZoomSlider,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
