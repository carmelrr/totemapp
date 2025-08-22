// Manual setup instructions for Firestore
// This file contains the exact data to create in Firebase Console

console.log("=== FIRESTORE SETUP INSTRUCTIONS ===");
console.log("");
console.log("1. Go to Firebase Console > Firestore Database");
console.log("");

console.log('2. Create Collection: "sprayWalls"');
console.log('   Document ID: "totem-35"');
console.log("   Data:");
console.log(
  JSON.stringify(
    {
      name: "Totem Spray 35°",
      angle: 35,
      currentSeasonId: null,
      createdAt: "2025-08-13T00:00:00.000Z", // Replace with current date
      updatedAt: "2025-08-13T00:00:00.000Z", // Replace with current date
    },
    null,
    2,
  ),
);
console.log("");

console.log("3. Update your user document to be admin:");
console.log('   Collection: "users"');
console.log("   Document ID: [YOUR_USER_UID]");
console.log("   Add/Update field:");
console.log('   role: "admin"');
console.log("");

console.log("4. Deploy Firebase Rules:");
console.log("   Run in terminal:");
console.log("   firebase deploy --only firestore:rules");
console.log("   firebase deploy --only storage");
console.log("");

console.log("=== END SETUP ===");
