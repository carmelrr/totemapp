import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "@/features/data/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const UserContext = createContext({
  isAdmin: false,
  circleSize: 15,
  setCircleSize: (newSize: number) => {},
});

export function UserProvider({ children, isAdmin }) {
  const [circleSize, setCircleSize] = useState(15); // Default to medium size

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

  return (
    <UserContext.Provider
      value={{
        isAdmin,
        circleSize,
        setCircleSize: saveCircleSize,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
