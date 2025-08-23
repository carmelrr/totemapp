import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Import your Firebase config
const firebaseConfig = {
  // Add your config here - copy from firebase-config.js
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function setupSprayWall() {
  try {
    console.log("Setting up Spray Wall...");

    // 1. Create spray wall document
    const sprayWallData = {
      name: "Totem Spray 35°",
      angle: 35,
      currentSeasonId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setDoc(doc(db, "sprayWalls", "totem-35"), sprayWallData);
    console.log("✅ Spray wall document created");

    // 2. Check current user and make admin
    const user = auth.currentUser;
    if (user) {
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        await setDoc(
          userRef,
          {
            ...userData,
            role: "admin",
          },
          { merge: true },
        );
        console.log(`✅ User ${user.email} is now admin`);
      } else {
        // Create user document
        await setDoc(userRef, {
          role: "admin",
          email: user.email,
          displayName: user.displayName || user.email,
          createdAt: new Date(),
        });
        console.log(`✅ Created admin user: ${user.email}`);
      }
    } else {
      console.log("❌ No user logged in. Please login first.");
    }

    console.log("🎉 Setup complete!");
  } catch (error) {
    console.error("❌ Setup failed:", error);
  }
}

// To use this script:
// 1. Copy your Firebase config from firebase-config.js
// 2. Make sure you're logged in to the app
// 3. Run this function in your browser console or as a script

export default setupSprayWall;
