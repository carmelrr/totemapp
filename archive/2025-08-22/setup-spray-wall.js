// Setup script for Spray Wall Firebase collections
// Run this script manually in Firebase console or via Cloud Functions

// This script creates the initial data structure for the spray wall

const setupSprayWall = async () => {
  // Create initial spray wall document
  const sprayWallData = {
    name: "Totem Spray 35°",
    angle: 35,
    currentSeasonId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // This should be created manually in Firebase console:
  // Collection: sprayWalls
  // Document ID: totem-35
  // Data: sprayWallData

  console.log("Create this document in Firebase Console:");
  console.log("Collection: sprayWalls");
  console.log("Document ID: totem-35");
  console.log("Data:", JSON.stringify(sprayWallData, null, 2));

  // Also ensure you have an admin user
  console.log(
    '\nEnsure you have an admin user with role: "admin" in users collection',
  );
};

setupSprayWall();
