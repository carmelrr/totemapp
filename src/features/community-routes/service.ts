// src/features/community-routes/service.ts
// Firebase service for Community Routes feature
// Handles CRUD operations with automatic expiration support

import { db, storage } from '@/features/data/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  increment,
  Timestamp,
  DocumentData,
  QuerySnapshot,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import {
  CommunityRoute,
  CommunityRouteComment,
  CommunityRouteLike,
  CommunityRouteFilters,
  ROUTE_EXPIRATION_DAYS,
} from './types';

const COLLECTION_NAME = 'communityRoutes';
const COMMENTS_COLLECTION = 'communityRouteComments';
const LIKES_COLLECTION = 'communityRouteLikes';

// ==================== Image Upload ====================

/**
 * Convert a file URI to a Blob using XMLHttpRequest (React Native compatible)
 */
async function uriToBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr.response);
    };
    xhr.onerror = function () {
      reject(new Error('Failed to convert URI to Blob'));
    };
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

/**
 * Upload a community route image to Firebase Storage
 * Images are stored in a separate folder for easy cleanup
 */
export async function uploadCommunityRouteImage(
  uri: string,
  userId: string
): Promise<string> {
  try {
    const timestamp = Date.now();
    const storagePath = `community-routes/${userId}/${timestamp}.jpg`;
    
    console.log('📤 Uploading community route image to:', storagePath);
    
    const blob = await uriToBlob(uri);
    
    if (blob.size === 0) {
      throw new Error('Image file is empty');
    }
    
    const storageRef = ref(storage, storagePath);
    
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: 'image/jpeg',
    });
    
    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`📤 Upload progress: ${progress.toFixed(1)}%`);
        },
        (error) => {
          console.error('❌ Upload error:', error);
          reject(error);
        },
        () => {
          console.log('✅ Upload complete');
          resolve();
        }
      );
    });
    
    const downloadUrl = await getDownloadURL(storageRef);
    console.log('🔗 Download URL:', downloadUrl);
    return downloadUrl;
  } catch (error: any) {
    console.error('❌ Upload error:', error);
    throw new Error(`שגיאה בהעלאת התמונה: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Delete an image from Firebase Storage
 */
export async function deleteCommunityRouteImage(imageUrl: string): Promise<void> {
  try {
    // Extract the storage path from the URL
    const storageRef = ref(storage, getStoragePathFromUrl(imageUrl));
    await deleteObject(storageRef);
    console.log('🗑️ Image deleted:', imageUrl);
  } catch (error) {
    console.error('Error deleting image:', error);
    // Don't throw - image might already be deleted
  }
}

/**
 * Extract storage path from download URL
 */
function getStoragePathFromUrl(url: string): string {
  // Firebase Storage URL format: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?...
  const match = url.match(/\/o\/(.+?)\?/);
  if (match) {
    return decodeURIComponent(match[1]);
  }
  throw new Error('Invalid storage URL');
}

// ==================== Route CRUD ====================

/**
 * Create a new community route
 */
export async function createCommunityRoute(
  route: Omit<CommunityRoute, 'id' | 'createdAt' | 'expiresAt' | 'viewCount' | 'likeCount' | 'commentCount'>
): Promise<string> {
  // Calculate expiration date (30 days from now)
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ROUTE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
  
  // Remove undefined values to prevent Firestore errors
  const cleanedRoute = Object.fromEntries(
    Object.entries(route).filter(([, value]) => value !== undefined)
  );
  
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...cleanedRoute,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
  });
  
  console.log('✅ Community route created:', docRef.id);
  return docRef.id;
}

/**
 * Get a single community route by ID
 */
export async function getCommunityRoute(routeId: string): Promise<CommunityRoute | null> {
  const docRef = doc(db, COLLECTION_NAME, routeId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return { id: snapshot.id, ...snapshot.data() } as CommunityRoute;
}

/**
 * Get community routes with filters
 */
export async function getCommunityRoutes(
  filters: CommunityRouteFilters = { sortBy: 'newest' },
  limitCount: number = 20
): Promise<CommunityRoute[]> {
  let q = query(
    collection(db, COLLECTION_NAME),
    where('expiresAt', '>', Timestamp.now()), // Only non-expired routes
  );
  
  // Apply gym filter
  if (filters.gymName) {
    q = query(q, where('gymName', '==', filters.gymName));
  }
  
  // Apply creator filter
  if (filters.createdByMe) {
    // This would need the userId passed in, simplified for now
  }
  
  // Apply sorting
  switch (filters.sortBy) {
    case 'popular':
      q = query(q, orderBy('likeCount', 'desc'), limit(limitCount));
      break;
    case 'expiring-soon':
      q = query(q, orderBy('expiresAt', 'asc'), limit(limitCount));
      break;
    case 'newest':
    default:
      q = query(q, orderBy('createdAt', 'desc'), limit(limitCount));
  }
  
  const snapshot = await getDocs(q);
  const routes: CommunityRoute[] = [];
  snapshot.forEach((d) => {
    routes.push({ id: d.id, ...d.data() } as CommunityRoute);
  });
  
  return routes;
}

/**
 * Get community routes for a specific user
 */
export async function getUserCommunityRoutes(userId: string): Promise<CommunityRoute[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('createdBy', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  const routes: CommunityRoute[] = [];
  snapshot.forEach((d) => {
    routes.push({ id: d.id, ...d.data() } as CommunityRoute);
  });
  
  return routes;
}

/**
 * Listen to community routes in real-time
 */
export function listenToCommunityRoutes(
  callback: (routes: CommunityRoute[]) => void,
  filters: CommunityRouteFilters = { sortBy: 'newest' }
) {
  let q = query(
    collection(db, COLLECTION_NAME),
    where('expiresAt', '>', Timestamp.now()),
    orderBy('expiresAt', 'asc'), // Need this for the inequality filter
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  
  return onSnapshot(q, (snapshot: QuerySnapshot) => {
    const routes: CommunityRoute[] = [];
    snapshot.forEach((d) => {
      routes.push({ id: d.id, ...d.data() } as CommunityRoute);
    });
    callback(routes);
  });
}

/**
 * Update a community route
 */
export async function updateCommunityRoute(
  routeId: string,
  updates: Partial<Omit<CommunityRoute, 'id' | 'createdAt' | 'expiresAt'>>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, routeId);
  await updateDoc(docRef, updates);
}

/**
 * Delete a community route and its image
 */
export async function deleteCommunityRoute(routeId: string): Promise<void> {
  // First get the route to get the image URL
  const route = await getCommunityRoute(routeId);
  
  if (!route) {
    console.log('Route not found, nothing to delete');
    return;
  }
  
  // Delete the image from storage
  if (route.imageUrl) {
    await deleteCommunityRouteImage(route.imageUrl);
  }
  
  // Delete all comments
  const commentsQuery = query(
    collection(db, COMMENTS_COLLECTION),
    where('routeId', '==', routeId)
  );
  const commentsSnapshot = await getDocs(commentsQuery);
  const batch = writeBatch(db);
  commentsSnapshot.forEach((d) => {
    batch.delete(d.ref);
  });
  
  // Delete all likes
  const likesQuery = query(
    collection(db, LIKES_COLLECTION),
    where('routeId', '==', routeId)
  );
  const likesSnapshot = await getDocs(likesQuery);
  likesSnapshot.forEach((d) => {
    batch.delete(d.ref);
  });
  
  // Delete the route document
  batch.delete(doc(db, COLLECTION_NAME, routeId));
  
  await batch.commit();
  console.log('✅ Community route deleted:', routeId);
}

/**
 * Increment view count for a route
 */
export async function incrementViewCount(routeId: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, routeId);
  await updateDoc(docRef, {
    viewCount: increment(1),
  });
}

// ==================== Likes ====================

/**
 * Toggle like on a route
 */
export async function toggleLike(
  routeId: string,
  userId: string
): Promise<boolean> {
  const likeId = `${routeId}_${userId}`;
  const likeRef = doc(db, LIKES_COLLECTION, likeId);
  const routeRef = doc(db, COLLECTION_NAME, routeId);
  
  const likeDoc = await getDoc(likeRef);
  
  if (likeDoc.exists()) {
    // Unlike
    await deleteDoc(likeRef);
    await updateDoc(routeRef, { likeCount: increment(-1) });
    return false;
  } else {
    // Like
    await setDoc(likeRef, {
      routeId,
      userId,
      createdAt: serverTimestamp(),
    });
    await updateDoc(routeRef, { likeCount: increment(1) });
    return true;
  }
}

/**
 * Check if user has liked a route
 */
export async function hasUserLiked(routeId: string, userId: string): Promise<boolean> {
  const likeId = `${routeId}_${userId}`;
  const likeRef = doc(db, LIKES_COLLECTION, likeId);
  const likeDoc = await getDoc(likeRef);
  return likeDoc.exists();
}

// ==================== Comments ====================

/**
 * Add a comment to a route
 */
export async function addComment(
  routeId: string,
  userId: string,
  userName: string,
  text: string
): Promise<string> {
  const docRef = await addDoc(collection(db, COMMENTS_COLLECTION), {
    routeId,
    userId,
    userName,
    text,
    createdAt: serverTimestamp(),
  });
  
  // Increment comment count
  const routeRef = doc(db, COLLECTION_NAME, routeId);
  await updateDoc(routeRef, { commentCount: increment(1) });
  
  return docRef.id;
}

/**
 * Get comments for a route
 */
export async function getComments(routeId: string): Promise<CommunityRouteComment[]> {
  const q = query(
    collection(db, COMMENTS_COLLECTION),
    where('routeId', '==', routeId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  const comments: CommunityRouteComment[] = [];
  snapshot.forEach((d) => {
    comments.push({ id: d.id, ...d.data() } as CommunityRouteComment);
  });
  
  return comments;
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: string, routeId: string): Promise<void> {
  await deleteDoc(doc(db, COMMENTS_COLLECTION, commentId));
  
  // Decrement comment count
  const routeRef = doc(db, COLLECTION_NAME, routeId);
  await updateDoc(routeRef, { commentCount: increment(-1) });
}

// ==================== Expiration Helpers ====================

/**
 * Get days until expiration
 */
export function getDaysUntilExpiration(expiresAt: any): number {
  if (!expiresAt) return 0;
  
  const expirationDate = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
  const now = new Date();
  const diffTime = expirationDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Check if a route is about to expire (less than 7 days)
 */
export function isExpiringSoon(expiresAt: any): boolean {
  return getDaysUntilExpiration(expiresAt) <= 7;
}
