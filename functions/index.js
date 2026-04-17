/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { setGlobalOptions } = require("firebase-functions");
const { onRequest, onCall, HttpsError } = require("firebase-functions/https");
const { onSchedule } = require("firebase-functions/scheduler");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
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
          
          // 4. Delete all feedback for this route
          const feedbackSnapshot = await db
            .collection("communityRouteFeedback")
            .where("routeId", "==", routeId)
            .get();
          
          feedbackSnapshot.forEach((feedbackDoc) => {
            batch.delete(feedbackDoc.ref);
          });
          
          // 5. Delete all sends for this route
          const sendsSnapshot = await db
            .collection("communityRouteSends")
            .where("routeId", "==", routeId)
            .get();
          
          sendsSnapshot.forEach((sendDoc) => {
            batch.delete(sendDoc.ref);
          });
          
          // 6. Delete the route document
          batch.delete(routeDoc.ref);
          
          // Commit the batch
          await batch.commit();
          
          deletedCount++;
          logger.info(`Successfully deleted route ${routeId} and ${commentsSnapshot.size} comments, ${likesSnapshot.size} likes, ${feedbackSnapshot.size} feedbacks, ${sendsSnapshot.size} sends`);
          
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
 * HTTP endpoint to manually trigger cleanup (admin only)
 * Requires a valid Firebase ID token with admin custom claim.
 */
exports.manualCleanupExpiredRoutes = onRequest(
  { 
    maxInstances: 1,
  },
  async (req, res) => {
    // Only allow POST requests
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    // --- Authentication & Admin check ---
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ success: false, error: "Missing or invalid Authorization header" });
      return;
    }

    try {
      const idToken = authHeader.split("Bearer ")[1];
      const decodedToken = await getAuth().verifyIdToken(idToken);

      // Require admin custom claim OR check Firestore isAdmin field as fallback
      let isAdmin = decodedToken.admin === true;
      if (!isAdmin) {
        const userDoc = await db.collection("users").doc(decodedToken.uid).get();
        isAdmin = userDoc.exists && userDoc.data().isAdmin === true;
      }

      if (!isAdmin) {
        res.status(403).json({ success: false, error: "Admin access required" });
        return;
      }
    } catch (authError) {
      logger.error("Auth verification failed:", authError);
      res.status(401).json({ success: false, error: "Invalid token" });
      return;
    }
    // --- End auth check ---
    
    logger.info("Manual cleanup triggered by admin");
    
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
          
          // Delete comments, likes, feedback, and sends
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
          
          const feedbackSnapshot = await db
            .collection("communityRouteFeedback")
            .where("routeId", "==", routeId)
            .get();
          feedbackSnapshot.forEach((doc) => batch.delete(doc.ref));
          
          const sendsSnapshot = await db
            .collection("communityRouteSends")
            .where("routeId", "==", routeId)
            .get();
          sendsSnapshot.forEach((doc) => batch.delete(doc.ref));
          
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
        error: "Internal server error",
      });
    }
  }
);

// ==================== Set User Roles (Server-side) ====================
/**
 * Callable Cloud Function to set roles for a user.
 * Only admins can call this. Sets both Firestore roles field and Custom Claims.
 */
exports.setUserRoles = onCall(
  { maxInstances: 5 },
  async (request) => {
    // 1. Caller must be authenticated
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const callerUid = request.auth.uid;

    // 2. Verify caller is admin (custom claim OR Firestore field)
    let callerIsAdmin = request.auth.token.admin === true;
    if (!callerIsAdmin) {
      const callerDoc = await db.collection("users").doc(callerUid).get();
      callerIsAdmin = callerDoc.exists && callerDoc.data().isAdmin === true;
    }
    if (!callerIsAdmin) {
      throw new HttpsError("permission-denied", "Admin access required");
    }

    // 3. Validate input
    const { targetUserId, roles } = request.data;
    if (!targetUserId || typeof targetUserId !== "string") {
      throw new HttpsError("invalid-argument", "targetUserId is required");
    }
    if (!Array.isArray(roles)) {
      throw new HttpsError("invalid-argument", "roles must be an array");
    }

    const validRoles = ["route_setter", "judge", "head_judge", "social_manager", "admin"];
    for (const role of roles) {
      if (!validRoles.includes(role)) {
        throw new HttpsError("invalid-argument", `Invalid role: ${role}`);
      }
    }

    // 4. Check target user exists
    const targetUserDoc = await db.collection("users").doc(targetUserId).get();
    if (!targetUserDoc.exists) {
      throw new HttpsError("not-found", "Target user not found");
    }

    // 5. Update Firestore document
    const isAdmin = roles.includes("admin");
    await db.collection("users").doc(targetUserId).update({
      roles,
      isAdmin,
      rolesUpdatedAt: Timestamp.now(),
      rolesUpdatedBy: callerUid,
    });

    // 6. Set Custom Claims so rules can use request.auth.token
    const customClaims = { admin: isAdmin, roles };
    await getAuth().setCustomUserClaims(targetUserId, customClaims);

    logger.info(`Roles updated for ${targetUserId} by ${callerUid}:`, roles);
    return { success: true, roles, isAdmin };
  }
);

// ==================== OBJ to Top View ====================
const objToTopView = require("./objToTopView");
exports.objToTopView = objToTopView.objToTopView;

// ==================== Delete Account ====================
/**
 * Callable Cloud Function: deleteAccount
 *
 * – Authenticated users only; deletes data for request.auth.uid.
 * – Recursively deletes /users/{uid} and all subcollections.
 * – Deletes docs referencing the uid in related collections.
 * – Deletes user files from Storage.
 * – Finally deletes the Firebase Auth user record.
 */
exports.deleteAccount = onCall(
  { maxInstances: 5 },
  async (request) => {
    // 1. Must be authenticated
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const uid = request.auth.uid;
    logger.info(`[deleteAccount] Starting deletion for uid=${uid}`);

    /**
     * Recursively delete a document and all its subcollections.
     * @param {Object} docRef - Firestore document reference
     */
    async function deleteDocRecursive(docRef) {
      const subcollections = await docRef.listCollections();
      for (const subcol of subcollections) {
        const snap = await subcol.get();
        for (const subDoc of snap.docs) {
          await deleteDocRecursive(subDoc.ref);
        }
      }
      await docRef.delete();
    }

    /**
     * Delete docs in a collection where a field matches uid.
     * @param {string} collectionName - Firestore collection name
     * @param {string} fieldName - Field to match against uid
     */
    async function deleteByField(collectionName, fieldName) {
      const snapshot = await db
        .collection(collectionName)
        .where(fieldName, "==", uid)
        .get();
      if (snapshot.empty) return 0;
      const batch = db.batch();
      let count = 0;
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
      });
      await batch.commit();
      return count;
    }

    try {
      // ---- A) Delete /users/{uid} doc + subcollections ----
      const userDocRef = db.collection("users").doc(uid);
      const userDocSnap = await userDocRef.get();
      if (userDocSnap.exists) {
        await deleteDocRecursive(userDocRef);
        logger.info(`[deleteAccount] Deleted /users/${uid} and subcollections`);
      }

      // ---- B) Delete docs in related collections ----
      // Community routes created by this user
      const communityRoutes = await db
        .collection("communityRoutes")
        .where("userId", "==", uid)
        .get();
      for (const routeDoc of communityRoutes.docs) {
        const routeId = routeDoc.id;
        const routeData = routeDoc.data();

        // Delete the route image from Storage
        if (routeData.imageUrl) {
          try {
            const match = routeData.imageUrl.match(/\/o\/(.+?)\?/);
            if (match) {
              const storagePath = decodeURIComponent(match[1]);
              await storage.bucket().file(storagePath).delete();
            }
          } catch (imgErr) {
            logger.warn(`[deleteAccount] Image delete failed: ${imgErr.message}`);
          }
        }

        // Delete associated comments, likes, feedback, sends
        const relatedCollections = [
          "communityRouteComments",
          "communityRouteLikes",
          "communityRouteFeedback",
          "communityRouteSends",
        ];
        for (const col of relatedCollections) {
          const snap = await db.collection(col).where("routeId", "==", routeId).get();
          if (!snap.empty) {
            const batch = db.batch();
            snap.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        }

        // Delete the route doc
        await routeDoc.ref.delete();
      }
      logger.info(`[deleteAccount] Deleted ${communityRoutes.size} community routes`);

      // Delete user's likes / comments / sends / feedback across all routes
      const userReferenceCollections = [
        { collection: "communityRouteComments", field: "userId" },
        { collection: "communityRouteLikes", field: "userId" },
        { collection: "communityRouteFeedback", field: "userId" },
        { collection: "communityRouteSends", field: "userId" },
        // TODO: Add more collections as needed, e.g.:
        // { collection: "bookings", field: "userId" },
        // { collection: "orders", field: "userId" },
        // { collection: "sessions", field: "userId" },
      ];

      for (const { collection, field } of userReferenceCollections) {
        const count = await deleteByField(collection, field);
        if (count > 0) {
          logger.info(`[deleteAccount] Deleted ${count} docs from ${collection}`);
        }
      }

      // Delete follower / following relationships
      const followersSnap = await db
        .collection("followers")
        .where("followerId", "==", uid)
        .get();
      if (!followersSnap.empty) {
        const batch = db.batch();
        followersSnap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      const followingSnap = await db
        .collection("followers")
        .where("followingId", "==", uid)
        .get();
      if (!followingSnap.empty) {
        const batch = db.batch();
        followingSnap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      // ---- C) Delete user files from Storage ----
      // Best practice: store all user files under  users/{uid}/
      // Then delete the entire prefix.
      try {
        const bucket = storage.bucket();
        const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
        for (const file of files) {
          await file.delete();
        }
        logger.info(`[deleteAccount] Deleted ${files.length} storage files`);
      } catch (storageErr) {
        // Storage might throw if no files exist; that's fine.
        logger.warn(`[deleteAccount] Storage cleanup: ${storageErr.message}`);
      }

      // ---- D) Delete Firebase Auth user ----
      await getAuth().deleteUser(uid);
      logger.info(`[deleteAccount] Deleted auth user ${uid}`);

      return { success: true, message: "Account and all data deleted successfully." };
    } catch (error) {
      logger.error(`[deleteAccount] Error for uid=${uid}:`, error);

      // If it's a "user not found" from Auth, the user was already deleted
      if (error.code === "auth/user-not-found") {
        return { success: true, message: "Account already deleted." };
      }

      throw new HttpsError("internal", "Failed to delete account. Please try again.");
    }
  }
);

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// ==================== Competition Results Integrity ====================

/**
 * When a participant's `category` changes, cascade it to all of that
 * participant's result entries so leaderboards regroup automatically.
 * Also keeps `categoryName` denormalized on each result in sync.
 */
exports.onParticipantCategoryChange = onDocumentWritten(
  {
    document: "competitions/{competitionId}/participants/{participantId}",
  },
  async (event) => {
    const before = event.data && event.data.before ? event.data.before.data() : undefined;
    const after = event.data && event.data.after ? event.data.after.data() : undefined;
    if (!after) return; // deletion — nothing to cascade
    if (!before) return; // creation — no previous category to compare

    const prevCat = before.category || null;
    const nextCat = after.category || null;
    const prevCatName = before.categoryName || null;
    const nextCatName = after.categoryName || null;

    if (prevCat === nextCat && prevCatName === nextCatName) return;

    const { competitionId } = event.params;
    const userId = after.userId || event.params.participantId;

    try {
      const resultRef = db
        .collection("competitions")
        .doc(competitionId)
        .collection("results")
        .doc(userId);

      const snap = await resultRef.get();
      if (!snap.exists) return;

      await resultRef.update({
        category: nextCat,
        categoryName: nextCatName,
        lastUpdated: Timestamp.now(),
      });
      logger.info(
        `Cascaded category change for ${userId} in ${competitionId}: ${prevCat} -> ${nextCat}`
      );
    } catch (e) {
      logger.error("Category cascade failed", e);
    }
  }
);

/**
 * One-shot callable migration: backfill `version=1`, `lastEditedBy`,
 * `lastEditedAt` on any result document that is missing them. Idempotent —
 * safe to run multiple times. Requires caller to be an admin.
 *
 * Call from a privileged client:
 *   httpsCallable(functions, 'migrateResultsVersioning')({ competitionId })
 *   httpsCallable(functions, 'migrateResultsVersioning')({}) // all competitions
 */
exports.migrateResultsVersioning = onCall(
  { memory: "512MiB", timeoutSeconds: 540 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }
    const claims = request.auth.token || {};
    const uid = request.auth.uid;
    let isAdmin = claims.admin === true;
    if (!isAdmin) {
      try {
        const userDoc = await db.collection("users").doc(uid).get();
        const d = userDoc.data() || {};
        isAdmin = d.isAdmin === true || d.role === "admin";
      } catch (e) {
        // fall through
      }
    }
    if (!isAdmin) {
      throw new HttpsError("permission-denied", "Admins only.");
    }

    const scopeCompetitionId = request.data ? request.data.competitionId : undefined;
    const competitionsRef = db.collection("competitions");
    let compSnap;
    if (scopeCompetitionId) {
      const single = await competitionsRef.doc(scopeCompetitionId).get();
      compSnap = single.exists ? [single] : [];
    } else {
      compSnap = (await competitionsRef.get()).docs;
    }

    let scanned = 0;
    let updated = 0;
    for (const comp of compSnap) {
      const resultsSnap = await competitionsRef
        .doc(comp.id)
        .collection("results")
        .get();
      for (const doc of resultsSnap.docs) {
        scanned += 1;
        const data = doc.data() || {};
        const patch = {};
        if (typeof data.version !== "number") patch.version = 1;
        if (!data.lastEditedAt) patch.lastEditedAt = Timestamp.now();
        if (!data.lastEditedBy && data.userId) {
          patch.lastEditedBy = data.userId;
        }
        if (Object.keys(patch).length > 0) {
          await doc.ref.update(patch);
          updated += 1;
        }
      }
    }
    logger.info(
      `[migrateResultsVersioning] scanned=${scanned} updated=${updated}`
    );
    return { scanned, updated };
  }
);
