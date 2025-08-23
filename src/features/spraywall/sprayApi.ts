import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  getDoc,
  getDocs,
  setDoc,
  query,
  orderBy,
  where,
  Timestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage, auth } from "@/features/data/firebase";

export const sprayApi = {
  // Get current season for a wall
  async getCurrentSeason(wallId) {
    try {
      console.log("getCurrentSeason called for wallId:", wallId);
      console.log("Current user:", auth.currentUser?.uid);

      const wallDoc = await getDoc(doc(db, "sprayWalls", wallId));
      if (!wallDoc.exists()) {
        console.log("Spray wall does not exist, creating...");
        // Create spray wall automatically if doesn't exist
        await this.createSprayWall(wallId);
        return null; // No current season yet
      }

      const wallData = wallDoc.data();
      const currentSeasonId = wallData.currentSeasonId;

      if (!currentSeasonId) return null;

      const seasonDoc = await getDoc(
        doc(db, "sprayWalls", wallId, "seasons", currentSeasonId),
      );
      return seasonDoc.exists()
        ? { id: seasonDoc.id, ...seasonDoc.data() }
        : null;
    } catch (error) {
      console.error("Error getting current season:", error);
      throw error;
    }
  },

  // Create spray wall document
  async createSprayWall(wallId) {
    try {
      console.log("Creating spray wall for wallId:", wallId);
      console.log("Current user:", auth.currentUser?.uid);

      const sprayWallData = {
        name: "Totem Spray 35°",
        angle: 35,
        currentSeasonId: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await setDoc(doc(db, "sprayWalls", wallId), sprayWallData);
      console.log("Spray wall created automatically");
    } catch (error) {
      console.error("Error creating spray wall:", error);
      throw error;
    }
  },

  // Listen to routes for a specific season
  listenRoutes(wallId, seasonId, callback) {
    const routesRef = collection(
      db,
      "sprayWalls",
      wallId,
      "seasons",
      seasonId,
      "routes",
    );
    const q = query(routesRef, orderBy("createdAt", "desc"));

    return onSnapshot(q, (snapshot) => {
      const routes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(routes);
    });
  },

  // Create new season (admin only)
  async createNewSeason(wallId, imageFile, cropMeta) {
    try {
      // First, get current season to delete old image
      const wallDoc = await getDoc(doc(db, "sprayWalls", wallId));
      let previousSeason = null;

      if (wallDoc.exists()) {
        const wallData = wallDoc.data();
        if (wallData.currentSeasonId) {
          const prevSeasonDoc = await getDoc(
            doc(db, "sprayWalls", wallId, "seasons", wallData.currentSeasonId),
          );
          if (prevSeasonDoc.exists()) {
            previousSeason = prevSeasonDoc.data();
          }
        }
      }

      const seasonId = Date.now().toString();
      const imagePath = `sprayWalls/${wallId}/seasons/${seasonId}/wall.jpg`;
      const imageRef = ref(storage, imagePath);

      // Upload new image
      await uploadBytes(imageRef, imageFile);
      const imageURL = await getDownloadURL(imageRef);

      // Create season document
      const seasonData = {
        imagePath,
        imageURL,
        startedAt: Timestamp.now(),
        endedAt: null,
        cropMeta,
      };

      await setDoc(
        doc(db, "sprayWalls", wallId, "seasons", seasonId),
        seasonData,
      );

      // Update wall's current season
      await updateDoc(doc(db, "sprayWalls", wallId), {
        currentSeasonId: seasonId,
        updatedAt: Timestamp.now(),
      });

      // Delete previous season's image from Storage (after successful upload)
      if (previousSeason && previousSeason.imagePath) {
        try {
          const prevImageRef = ref(storage, previousSeason.imagePath);
          await deleteObject(prevImageRef);
          console.log("Previous season image deleted successfully");
        } catch (deleteError) {
          console.warn("Could not delete previous image:", deleteError);
          // Don't throw error here - new season was created successfully
        }
      }

      return seasonId;
    } catch (error) {
      console.error("Error creating new season:", error);
      throw error;
    }
  },

  // Create route
  async createRoute(wallId, seasonId, routeData) {
    try {
      const routesRef = collection(
        db,
        "sprayWalls",
        wallId,
        "seasons",
        seasonId,
        "routes",
      );
      const docRef = await addDoc(routesRef, {
        ...routeData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        status: "open",
      });
      return docRef.id;
    } catch (error) {
      console.error("Error creating route:", error);
      throw error;
    }
  },

  // Create send
  async createSend(wallId, seasonId, routeId, userId, userName) {
    try {
      const sendsRef = collection(
        db,
        "sprayWalls",
        wallId,
        "seasons",
        seasonId,
        "sends",
      );
      const docRef = await addDoc(sendsRef, {
        routeId,
        userId,
        userName,
        createdAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (error) {
      console.error("Error creating send:", error);
      throw error;
    }
  },

  // Get leaderboard data
  async getLeaderboard(wallId, seasonId = null) {
    try {
      let sendsRef;

      if (seasonId) {
        // Current season only
        sendsRef = collection(
          db,
          "sprayWalls",
          wallId,
          "seasons",
          seasonId,
          "sends",
        );
      } else {
        // All time - would need to aggregate across seasons (for future implementation)
        throw new Error("All-time leaderboard not implemented yet");
      }

      const sendsSnapshot = await getDocs(sendsRef);
      const sends = sendsSnapshot.docs.map((doc) => doc.data());

      // Group by user and count
      const userCounts = {};
      sends.forEach((send) => {
        if (!userCounts[send.userId]) {
          userCounts[send.userId] = {
            userId: send.userId,
            userName: send.userName,
            count: 0,
          };
        }
        userCounts[send.userId].count++;
      });

      // Sort by count
      return Object.values(userCounts).sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      throw error;
    }
  },
};
