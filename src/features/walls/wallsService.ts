import { db, storage } from "@/features/data/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  onSnapshot,
  DocumentData,
  QuerySnapshot,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { deleteAllRoutesForWall } from "@/features/spraywall/routesService";

export interface Wall {
  id?: string;
  name: string;
  imageUrl: string;
  width: number;
  height: number;
  isPublic: boolean;
  createdAt?: any;
  createdBy?: string | null;
}

/**
 * Convert a file URI to a Blob using XMLHttpRequest (more reliable in React Native)
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

export async function uploadImageAsync(uri: string, storagePath: string): Promise<string> {
  try {
    console.log("📤 Uploading image to:", storagePath);
    console.log("📤 Image URI:", uri);
    
    // Use XMLHttpRequest method for React Native compatibility
    const blob = await uriToBlob(uri);
    console.log("📦 Blob created, size:", blob.size, "type:", blob.type);
    
    if (blob.size === 0) {
      throw new Error("Image file is empty");
    }
    
    const storageRef = ref(storage, storagePath);
    
    // Use uploadBytesResumable for better error handling
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: 'image/jpeg',
    });
    
    // Wait for upload to complete
    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`📤 Upload progress: ${progress.toFixed(1)}%`);
        },
        (error) => {
          console.error("❌ Upload task error:", error.code, error.message);
          reject(error);
        },
        () => {
          console.log("✅ Upload complete");
          resolve();
        }
      );
    });
    
    const downloadUrl = await getDownloadURL(storageRef);
    console.log("🔗 Download URL:", downloadUrl);
    return downloadUrl;
  } catch (error: any) {
    console.error("❌ Upload error:", error);
    console.error("❌ Error code:", error.code);
    console.error("❌ Error details:", JSON.stringify(error, null, 2));
    throw new Error(`שגיאה בהעלאת התמונה: ${error.message || error.code || 'Unknown error'}`);
  }
}

export async function addWall(payload: {
  name: string;
  width: number;
  height: number;
  isPublic: boolean;
  imageUri: string;
}): Promise<string> {
  const { name, width, height, isPublic, imageUri } = payload;
  // Use sprayWalls path to match storage rules
  const timestamp = Date.now();
  const safeName = name.replace(/[^a-zA-Z0-9]/g, "_");
  const imagePath = `sprayWalls/${timestamp}_${safeName}/image.jpg`;
  
  const imageUrl = await uploadImageAsync(imageUri, imagePath);

  const docRef = await addDoc(collection(db, "walls"), {
    name,
    imageUrl,
    width,
    height,
    isPublic,
    createdAt: serverTimestamp(),
    createdBy: null,
  });

  return docRef.id;
}

export async function getWallsOnce(): Promise<Wall[]> {
  const q = query(collection(db, "walls"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  const out: Wall[] = [];
  snapshot.forEach((d) => out.push({ id: d.id, ...(d.data() as DocumentData) } as Wall));
  return out;
}

export function listenToWalls(callback: (walls: Wall[]) => void) {
  const q = query(collection(db, "walls"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot: QuerySnapshot) => {
    const walls: Wall[] = [];
    snapshot.forEach((d) => walls.push({ id: d.id, ...(d.data() as DocumentData) } as Wall));
    callback(walls);
  });
}

/**
 * Update wall image (admin only) - this will delete all routes!
 */
export async function updateWallImage(
  wallId: string,
  newImageUri: string,
  deleteRoutesOnChange: boolean = true
): Promise<string> {
  // First, get the current wall to delete old image
  const wallRef = doc(db, "walls", wallId);
  const wallSnap = await getDoc(wallRef);
  
  if (!wallSnap.exists()) {
    throw new Error("Wall not found");
  }
  
  const currentWall = wallSnap.data() as Wall;
  
  // Delete all routes if flag is set (admin changes wall image)
  if (deleteRoutesOnChange) {
    console.log(`🗑️ Deleting all routes for wall ${wallId} due to image change`);
    await deleteAllRoutesForWall(wallId);
  }
  
  // Upload new image
  const timestamp = Date.now();
  const imagePath = `sprayWalls/${wallId}/${timestamp}_image.jpg`;
  const newImageUrl = await uploadImageAsync(newImageUri, imagePath);
  
  // Update wall document
  await updateDoc(wallRef, {
    imageUrl: newImageUrl,
    updatedAt: serverTimestamp(),
  });
  
  // Try to delete old image from storage (optional, don't fail if it errors)
  if (currentWall.imageUrl) {
    try {
      const oldImageRef = ref(storage, currentWall.imageUrl);
      await deleteObject(oldImageRef);
    } catch (e) {
      console.log("Could not delete old image:", e);
    }
  }
  
  return newImageUrl;
}

/**
 * Get a single wall by ID
 */
export async function getWallById(wallId: string): Promise<Wall | null> {
  const wallRef = doc(db, "walls", wallId);
  const wallSnap = await getDoc(wallRef);
  
  if (!wallSnap.exists()) {
    return null;
  }
  
  return { id: wallSnap.id, ...wallSnap.data() } as Wall;
}
