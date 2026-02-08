// Editor Service - Firebase operations for saving/loading rooms

import { db } from '@/features/data/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { Room, Wall, Mat, Sector, EntranceArrow } from '../types';

const ROOMS_COLLECTION = 'editor_rooms';

/**
 * Convert Firestore document to Room object
 */
function docToRoom(docId: string, data: any): Room {
  return {
    id: docId,
    name: data.name,
    width: data.width,
    height: data.height,
    backgroundColor: data.backgroundColor || '#1a1a2e',
    gridColor: data.gridColor || '#4a4a6a',
    gridSize: data.gridSize || 50,
    showGrid: data.showGrid ?? true,
    walls: data.walls || [],
    mats: data.mats || [],
    sectors: data.sectors || [],
    textLabels: data.textLabels || [],
    entranceArrow: data.entranceArrow ?? undefined,
    isPublished: data.isPublished ?? false,
    isHidden: data.isHidden ?? false,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    createdBy: data.createdBy || '',
  };
}

/**
 * Recursively strip `undefined` values from an object/array so Firestore
 * doesn't reject the payload. `null` is kept (Firestore supports it).
 */
function stripUndefined<T>(value: T): T {
  if (value === undefined) return null as unknown as T;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripUndefined) as unknown as T;
  const cleaned: any = {};
  for (const [k, v] of Object.entries(value)) {
    if (v !== undefined) {
      cleaned[k] = stripUndefined(v);
    }
  }
  return cleaned as T;
}

/**
 * Convert Room object to Firestore document data
 */
function roomToDoc(room: Partial<Room>): any {
  const doc: any = {};
  
  if (room.name !== undefined) doc.name = room.name;
  if (room.width !== undefined) doc.width = room.width;
  if (room.height !== undefined) doc.height = room.height;
  if (room.backgroundColor !== undefined) doc.backgroundColor = room.backgroundColor;
  if (room.gridColor !== undefined) doc.gridColor = room.gridColor;
  if (room.gridSize !== undefined) doc.gridSize = room.gridSize;
  if (room.showGrid !== undefined) doc.showGrid = room.showGrid;
  if (room.walls !== undefined) doc.walls = stripUndefined(room.walls);
  if (room.mats !== undefined) doc.mats = stripUndefined(room.mats);
  if (room.sectors !== undefined) doc.sectors = stripUndefined(room.sectors);
  if (room.textLabels !== undefined) doc.textLabels = stripUndefined(room.textLabels);
  if (room.entranceArrow !== undefined) doc.entranceArrow = room.entranceArrow === null ? null : stripUndefined(room.entranceArrow);
  if (room.isPublished !== undefined) doc.isPublished = room.isPublished;
  if (room.isHidden !== undefined) doc.isHidden = room.isHidden;
  if (room.createdBy !== undefined) doc.createdBy = room.createdBy;
  
  doc.updatedAt = serverTimestamp();
  
  return doc;
}

/**
 * Create a new room
 */
export async function createRoom(room: Omit<Room, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const docData = {
      ...roomToDoc(room),
      createdAt: serverTimestamp(),
    };
    
    const docRef = await addDoc(collection(db, ROOMS_COLLECTION), docData);
    console.log('[EditorService] Created room:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('[EditorService] Error creating room:', error);
    throw error;
  }
}

/**
 * Update an existing room
 */
export async function updateRoom(roomId: string, updates: Partial<Room>): Promise<void> {
  try {
    const docRef = doc(db, ROOMS_COLLECTION, roomId);
    
    // Check if document exists
    const docSnap = await getDoc(docRef);
    
    const data = {
      ...roomToDoc(updates),
      updatedAt: serverTimestamp(),
    };
    
    // If document doesn't exist, add createdAt
    if (!docSnap.exists()) {
      (data as any).createdAt = serverTimestamp();
    }
    
    // Use setDoc with merge to create if not exists or update if exists
    await setDoc(docRef, data, { merge: true });
    console.log('[EditorService] Updated room:', roomId, docSnap.exists() ? '(existing)' : '(new)');
  } catch (error) {
    console.error('[EditorService] Error updating room:', error);
    throw error;
  }
}

/**
 * Delete a room
 */
export async function deleteRoom(roomId: string): Promise<void> {
  try {
    const docRef = doc(db, ROOMS_COLLECTION, roomId);
    await deleteDoc(docRef);
    console.log('[EditorService] Deleted room:', roomId);
  } catch (error) {
    console.error('[EditorService] Error deleting room:', error);
    throw error;
  }
}

/**
 * Get a single room by ID
 */
export async function getRoom(roomId: string): Promise<Room | null> {
  try {
    const docRef = doc(db, ROOMS_COLLECTION, roomId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docToRoom(docSnap.id, docSnap.data());
    }
    
    return null;
  } catch (error) {
    console.error('[EditorService] Error getting room:', error);
    throw error;
  }
}

/**
 * Get all rooms (optionally filtered by user)
 */
export async function getRooms(userId?: string): Promise<Room[]> {
  try {
    let q = query(
      collection(db, ROOMS_COLLECTION),
      orderBy('createdAt', 'desc')
    );
    
    if (userId) {
      q = query(
        collection(db, ROOMS_COLLECTION),
        where('createdBy', '==', userId),
        orderBy('createdAt', 'desc')
      );
    }
    
    const snapshot = await getDocs(q);
    const rooms: Room[] = [];
    
    snapshot.forEach(doc => {
      rooms.push(docToRoom(doc.id, doc.data()));
    });
    
    console.log('[EditorService] Got rooms:', rooms.length);
    return rooms;
  } catch (error) {
    console.error('[EditorService] Error getting rooms:', error);
    throw error;
  }
}

/**
 * Subscribe to rooms changes
 */
export function subscribeToRooms(
  callback: (rooms: Room[]) => void,
  userId?: string
): () => void {
  console.log('[EditorService] Subscribing to rooms, userId:', userId);
  
  let q;
  
  if (userId) {
    // Query rooms created by this user
    q = query(
      collection(db, ROOMS_COLLECTION),
      where('createdBy', '==', userId)
    );
  } else {
    // Query all rooms
    q = query(
      collection(db, ROOMS_COLLECTION)
    );
  }
  
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const rooms: Room[] = [];
      snapshot.forEach(doc => {
        rooms.push(docToRoom(doc.id, doc.data()));
      });
      console.log('[EditorService] Got rooms from subscription:', rooms.length, rooms.map(r => r.name));
      callback(rooms);
    },
    (error) => {
      console.error('[EditorService] Subscription error:', error);
    }
  );
  
  return unsubscribe;
}

/**
 * Save room walls
 */
export async function saveRoomWalls(roomId: string, walls: Wall[]): Promise<void> {
  try {
    const docRef = doc(db, ROOMS_COLLECTION, roomId);
    await updateDoc(docRef, {
      walls,
      updatedAt: serverTimestamp(),
    });
    console.log('[EditorService] Saved walls for room:', roomId);
  } catch (error) {
    console.error('[EditorService] Error saving walls:', error);
    throw error;
  }
}

/**
 * Save room mats
 */
export async function saveRoomMats(roomId: string, mats: Mat[]): Promise<void> {
  try {
    const docRef = doc(db, ROOMS_COLLECTION, roomId);
    await updateDoc(docRef, {
      mats,
      updatedAt: serverTimestamp(),
    });
    console.log('[EditorService] Saved mats for room:', roomId);
  } catch (error) {
    console.error('[EditorService] Error saving mats:', error);
    throw error;
  }
}

/**
 * Save room sectors
 */
export async function saveRoomSectors(roomId: string, sectors: Sector[]): Promise<void> {
  try {
    const docRef = doc(db, ROOMS_COLLECTION, roomId);
    await updateDoc(docRef, {
      sectors,
      updatedAt: serverTimestamp(),
    });
    console.log('[EditorService] Saved sectors for room:', roomId);
  } catch (error) {
    console.error('[EditorService] Error saving sectors:', error);
    throw error;
  }
}

/**
 * Publish a room to the routes map
 */
export async function publishRoom(roomId: string): Promise<void> {
  try {
    const docRef = doc(db, ROOMS_COLLECTION, roomId);
    await updateDoc(docRef, {
      isPublished: true,
      updatedAt: serverTimestamp(),
    });
    console.log('[EditorService] Published room:', roomId);
  } catch (error) {
    console.error('[EditorService] Error publishing room:', error);
    throw error;
  }
}

/**
 * Unpublish a room from the routes map
 */
export async function unpublishRoom(roomId: string): Promise<void> {
  try {
    const docRef = doc(db, ROOMS_COLLECTION, roomId);
    await updateDoc(docRef, {
      isPublished: false,
      updatedAt: serverTimestamp(),
    });
    console.log('[EditorService] Unpublished room:', roomId);
  } catch (error) {
    console.error('[EditorService] Error unpublishing room:', error);
    throw error;
  }
}

/**
 * Toggle room visibility (admin only)
 */
export async function setRoomVisibility(roomId: string, isHidden: boolean): Promise<void> {
  try {
    const docRef = doc(db, ROOMS_COLLECTION, roomId);
    await updateDoc(docRef, {
      isHidden,
      updatedAt: serverTimestamp(),
    });
    console.log('[EditorService] Set room visibility:', roomId, isHidden);
  } catch (error) {
    console.error('[EditorService] Error setting room visibility:', error);
    throw error;
  }
}

/**
 * Get all published rooms (for routes map)
 */
export async function getPublishedRooms(includeHidden: boolean = false): Promise<Room[]> {
  try {
    let q;
    if (includeHidden) {
      // Admin view - get all published rooms
      q = query(
        collection(db, ROOMS_COLLECTION),
        where('isPublished', '==', true),
        orderBy('createdAt', 'desc')
      );
    } else {
      // User view - only get non-hidden published rooms
      q = query(
        collection(db, ROOMS_COLLECTION),
        where('isPublished', '==', true),
        where('isHidden', '==', false),
        orderBy('createdAt', 'desc')
      );
    }
    
    const snapshot = await getDocs(q);
    const rooms: Room[] = [];
    
    snapshot.forEach(doc => {
      rooms.push(docToRoom(doc.id, doc.data()));
    });
    
    console.log('[EditorService] Got published rooms:', rooms.length);
    return rooms;
  } catch (error) {
    console.error('[EditorService] Error getting published rooms:', error);
    throw error;
  }
}

/**
 * Export room data for backup/transfer
 */
export function exportRoom(room: Room): string {
  return JSON.stringify(room, null, 2);
}

/**
 * Import room from JSON
 */
export function importRoom(json: string): Omit<Room, 'id'> {
  const data = JSON.parse(json);
  
  // Validate required fields
  if (!data.name || !data.width || !data.height) {
    throw new Error('Invalid room data: missing required fields');
  }
  
  return {
    name: data.name,
    width: data.width,
    height: data.height,
    backgroundColor: data.backgroundColor || '#1a1a2e',
    gridColor: data.gridColor || '#4a4a6a',
    gridSize: data.gridSize || 50,
    showGrid: data.showGrid ?? true,
    walls: data.walls || [],
    mats: data.mats || [],
    sectors: data.sectors || [],
    textLabels: data.textLabels || [],
    entranceArrow: data.entranceArrow ?? undefined,
    isPublished: data.isPublished ?? false,
    isHidden: data.isHidden ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: '',
  };
}
