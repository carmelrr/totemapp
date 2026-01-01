/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/https");
const { onSchedule } = require("firebase-functions/scheduler");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

// Initialize Firebase Admin
initializeApp();

const db = getFirestore();
const storage = getStorage();

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// ==================== Community Routes Cleanup ====================

/**
 * Scheduled function to clean up expired community routes
 * Runs daily at 3:00 AM UTC
 * 
 * This function:
 * 1. Queries for all community routes with expiresAt < now
 * 2. Deletes the route images from Firebase Storage
 * 3. Deletes all comments and likes associated with the route
 * 4. Deletes the route document from Firestore
 */
exports.cleanupExpiredCommunityRoutes = onSchedule(
  {
    schedule: "0 3 * * *", // Every day at 3:00 AM UTC
    timeZone: "UTC",
    retryCount: 3,
  },
  async (event) => {
    logger.info("Starting cleanup of expired community routes...");
    
    const now = Timestamp.now();
    let deletedCount = 0;
    let errorCount = 0;
    
    try {
      // Query for expired routes
      const expiredRoutesSnapshot = await db
        .collection("communityRoutes")
        .where("expiresAt", "<", now)
        .get();
      
      logger.info(`Found ${expiredRoutesSnapshot.size} expired routes to delete`);
      
      // Process each expired route
      for (const routeDoc of expiredRoutesSnapshot.docs) {
        try {
          const routeData = routeDoc.data();
          const routeId = routeDoc.id;
          
          logger.info(`Deleting route: ${routeId} - ${routeData.name}`);
          
          // 1. Delete the image from Storage
          if (routeData.imageUrl) {
            try {
              const imageUrl = routeData.imageUrl;
              // Extract path from URL
              const match = imageUrl.match(/\/o\/(.+?)\?/);
              if (match) {
                const storagePath = decodeURIComponent(match[1]);
                await storage.bucket().file(storagePath).delete();
                logger.info(`Deleted image: ${storagePath}`);
              }
            } catch (imgError) {
              logger.warn(`Could not delete image for route ${routeId}:`, imgError.message);
              // Continue with deletion even if image delete fails
            }
          }
          
          // 2. Delete all comments for this route
          const commentsSnapshot = await db
            .collection("communityRouteComments")
            .where("routeId", "==", routeId)
            .get();
          
          const batch = db.batch();
          commentsSnapshot.forEach((commentDoc) => {
            batch.delete(commentDoc.ref);
          });
          
          // 3. Delete all likes for this route
          const likesSnapshot = await db
            .collection("communityRouteLikes")
            .where("routeId", "==", routeId)
            .get();
          
          likesSnapshot.forEach((likeDoc) => {
            batch.delete(likeDoc.ref);
          });
          
          // 4. Delete the route document
          batch.delete(routeDoc.ref);
          
          // Commit the batch
          await batch.commit();
          
          deletedCount++;
          logger.info(`Successfully deleted route ${routeId} and ${commentsSnapshot.size} comments, ${likesSnapshot.size} likes`);
          
        } catch (routeError) {
          errorCount++;
          logger.error(`Error deleting route ${routeDoc.id}:`, routeError);
        }
      }
      
      logger.info(`Cleanup completed. Deleted: ${deletedCount}, Errors: ${errorCount}`);
      
    } catch (error) {
      logger.error("Error in cleanup function:", error);
      throw error;
    }
  }
);

/**
 * HTTP endpoint to manually trigger cleanup (for testing/admin use)
 * This can be called from the Firebase console or via curl
 */
exports.manualCleanupExpiredRoutes = onRequest(
  { 
    maxInstances: 1,
    // You may want to add authentication in production
  },
  async (req, res) => {
    // Only allow POST requests
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }
    
    logger.info("Manual cleanup triggered");
    
    const now = Timestamp.now();
    let deletedCount = 0;
    let errorCount = 0;
    
    try {
      const expiredRoutesSnapshot = await db
        .collection("communityRoutes")
        .where("expiresAt", "<", now)
        .get();
      
      for (const routeDoc of expiredRoutesSnapshot.docs) {
        try {
          const routeData = routeDoc.data();
          const routeId = routeDoc.id;
          
          // Delete image
          if (routeData.imageUrl) {
            try {
              const match = routeData.imageUrl.match(/\/o\/(.+?)\?/);
              if (match) {
                const storagePath = decodeURIComponent(match[1]);
                await storage.bucket().file(storagePath).delete();
              }
            } catch (imgError) {
              logger.warn(`Image delete failed: ${imgError.message}`);
            }
          }
          
          // Delete comments and likes
          const batch = db.batch();
          
          const commentsSnapshot = await db
            .collection("communityRouteComments")
            .where("routeId", "==", routeId)
            .get();
          commentsSnapshot.forEach((doc) => batch.delete(doc.ref));
          
          const likesSnapshot = await db
            .collection("communityRouteLikes")
            .where("routeId", "==", routeId)
            .get();
          likesSnapshot.forEach((doc) => batch.delete(doc.ref));
          
          batch.delete(routeDoc.ref);
          await batch.commit();
          
          deletedCount++;
        } catch (error) {
          errorCount++;
          logger.error(`Error: ${error.message}`);
        }
      }
      
      res.json({
        success: true,
        message: `Cleanup completed. Deleted: ${deletedCount}, Errors: ${errorCount}`,
        deletedCount,
        errorCount,
      });
      
    } catch (error) {
      logger.error("Cleanup error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
