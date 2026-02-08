/**
 * @fileoverview Announcement Service
 * @description Firebase operations for announcements management
 */

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
  Timestamp,
  limit,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, auth, storage } from '@/features/data/firebase';
import { Announcement, AnnouncementFormData, AnnouncementStatus, AnnouncementBackground } from './types';
import { getUserRoles } from '@/features/roles/rolesService';
import { canManageAnnouncements } from '@/features/roles/constants';

const ANNOUNCEMENTS_COLLECTION = 'announcements';
const ANNOUNCEMENTS_IMAGES_PATH = 'announcements/images';

/**
 * Check if current user has permission to manage announcements
 */
async function checkAnnouncementPermission(): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  const roles = await getUserRoles(user.uid);
  if (!canManageAnnouncements(roles)) {
    throw new Error('Not authorized to manage announcements');
  }
}

/**
 * Upload announcement image to Firebase Storage
 */
export async function uploadAnnouncementImage(localUri: string): Promise<string> {
  await checkAnnouncementPermission();
  
  const user = auth.currentUser!;
  const fileName = `announcement_${user.uid}_${Date.now()}.jpg`;
  const imageRef = ref(storage, `${ANNOUNCEMENTS_IMAGES_PATH}/${fileName}`);
  
  try {
    // Convert local URI to blob
    const response = await fetch(localUri);
    const blob = await response.blob();
    
    // Upload to Firebase Storage
    console.log('Uploading announcement image to Firebase Storage...');
    const snapshot = await uploadBytes(imageRef, blob);
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('Announcement image uploaded successfully:', downloadURL);
    
    return downloadURL;
  } catch (error: any) {
    console.error('Error uploading announcement image:', error);
    throw new Error('לא ניתן להעלות תמונה: ' + (error.message || error));
  }
}

/**
 * Delete announcement image from Firebase Storage
 */
export async function deleteAnnouncementImage(imageUrl: string): Promise<void> {
  try {
    // Extract path from Firebase Storage URL
    const urlParts = imageUrl.split('/o/')[1].split('?')[0];
    const filePath = decodeURIComponent(urlParts);
    
    const imageRef = ref(storage, filePath);
    await deleteObject(imageRef);
    
    console.log('Announcement image deleted successfully');
  } catch (error) {
    console.error('Error deleting announcement image:', error);
    // Don't throw - image might already be deleted
  }
}

/**
 * Clean object by removing undefined values (Firebase doesn't accept them)
 */
function removeUndefinedValues<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: Partial<T> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
}

/**
 * Process background - upload image if needed
 * Removes undefined values that Firebase doesn't accept
 */
async function processBackground(background: AnnouncementBackground): Promise<AnnouncementBackground> {
  const result: AnnouncementBackground = { type: background.type };
  
  if (background.type === 'image' && background.localImageUri && !background.imageUrl) {
    // Upload image and get URL
    const imageUrl = await uploadAnnouncementImage(background.localImageUri);
    result.imageUrl = imageUrl;
    if (background.imageEditing) {
      result.imageEditing = removeUndefinedValues(background.imageEditing) as any;
    }
    return result;
  }
  
  // Copy only defined properties to avoid Firebase undefined errors
  if (background.color !== undefined) result.color = background.color;
  if (background.gradientColors !== undefined) result.gradientColors = background.gradientColors;
  if (background.gradientDirection !== undefined) result.gradientDirection = background.gradientDirection;
  if (background.imageUrl !== undefined) result.imageUrl = background.imageUrl;
  if (background.imageEditing !== undefined) {
    result.imageEditing = removeUndefinedValues(background.imageEditing) as any;
  }
  // Never include localImageUri in Firestore
  
  return result;
}

/**
 * Convert Firestore timestamp to Date
 */
function toDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  return new Date(timestamp);
}

/**
 * Convert Firestore document to Announcement
 */
function docToAnnouncement(doc: any): Announcement {
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title || '',
    text: data.text || '',
    icon: data.icon,
    background: data.background || { type: 'color', color: '#3B82F6' },
    textStyle: data.textStyle,
    cta: data.cta,
    startDate: toDate(data.startDate),
    endDate: toDate(data.endDate),
    priority: data.priority || 0,
    status: data.status || 'draft',
    createdBy: data.createdBy,
    createdByName: data.createdByName,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    updatedBy: data.updatedBy,
  };
}

/**
 * Calculate announcement status based on current time and dates
 */
function calculateStatus(
  currentStatus: AnnouncementStatus,
  startDate: Date,
  endDate: Date
): AnnouncementStatus {
  if (currentStatus === 'deleted') return 'deleted';
  if (currentStatus === 'draft') return 'draft';
  
  const now = new Date();
  
  if (now < startDate) return 'scheduled';
  if (now >= startDate && now <= endDate) return 'active';
  if (now > endDate) return 'expired';
  
  return currentStatus;
}

/**
 * Create a new announcement
 */
export async function createAnnouncement(
  formData: AnnouncementFormData
): Promise<string> {
  await checkAnnouncementPermission();
  
  const user = auth.currentUser!;
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const displayName = userDoc.data()?.displayName || user.email || 'Unknown';
  
  const now = new Date();
  const status = calculateStatus('scheduled', formData.startDate, formData.endDate);
  
  // Process background (upload image if needed)
  const processedBackground = await processBackground(formData.background);
  
  // Build document data, only including defined fields
  const docData: Record<string, any> = {
    title: formData.title,
    text: formData.text,
    icon: formData.icon || '📢',
    background: processedBackground,
    startDate: Timestamp.fromDate(formData.startDate),
    endDate: Timestamp.fromDate(formData.endDate),
    priority: formData.priority || 0,
    status,
    createdBy: user.uid,
    createdByName: displayName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  // Only add optional fields if they're defined
  if (formData.textStyle) {
    docData.textStyle = removeUndefinedValues(formData.textStyle);
  }
  if (formData.cta) {
    docData.cta = removeUndefinedValues(formData.cta);
  }
  
  const docRef = await addDoc(collection(db, ANNOUNCEMENTS_COLLECTION), docData);
  
  return docRef.id;
}

/**
 * Update an existing announcement
 */
export async function updateAnnouncement(
  announcementId: string,
  formData: Partial<AnnouncementFormData>
): Promise<void> {
  await checkAnnouncementPermission();
  
  const user = auth.currentUser!;
  const announcementRef = doc(db, ANNOUNCEMENTS_COLLECTION, announcementId);
  
  // Get current announcement to preserve some fields
  const announcementDoc = await getDoc(announcementRef);
  if (!announcementDoc.exists()) {
    throw new Error('Announcement not found');
  }
  
  const currentData = announcementDoc.data();
  const startDate = formData.startDate || toDate(currentData.startDate);
  const endDate = formData.endDate || toDate(currentData.endDate);
  const status = calculateStatus(
    currentData.status, 
    startDate, 
    endDate
  );
  
  // Build update data, avoiding undefined values
  const updateData: Record<string, any> = {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  };
  
  // Only add defined fields
  if (formData.title !== undefined) updateData.title = formData.title;
  if (formData.text !== undefined) updateData.text = formData.text;
  if (formData.icon !== undefined) updateData.icon = formData.icon;
  if (formData.priority !== undefined) updateData.priority = formData.priority;
  
  // Process background (upload image if needed)
  if (formData.background) {
    updateData.background = await processBackground(formData.background);
  }
  
  // Clean optional nested objects
  if (formData.textStyle) {
    updateData.textStyle = removeUndefinedValues(formData.textStyle);
  }
  if (formData.cta) {
    updateData.cta = removeUndefinedValues(formData.cta);
  }
  
  // Convert dates to Timestamps
  if (formData.startDate) {
    updateData.startDate = Timestamp.fromDate(formData.startDate);
  }
  if (formData.endDate) {
    updateData.endDate = Timestamp.fromDate(formData.endDate);
  }
  
  await updateDoc(announcementRef, updateData);
}

/**
 * Delete an announcement (soft delete) and its associated image
 */
export async function deleteAnnouncement(announcementId: string): Promise<void> {
  await checkAnnouncementPermission();
  
  // First get the announcement to check for background image
  const announcement = await getAnnouncement(announcementId);
  
  // Delete the background image from storage if it exists
  if (announcement?.background?.imageUrl) {
    await deleteAnnouncementImage(announcement.background.imageUrl);
  }
  
  const user = auth.currentUser!;
  const announcementRef = doc(db, ANNOUNCEMENTS_COLLECTION, announcementId);
  
  await updateDoc(announcementRef, {
    status: 'deleted',
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
}

/**
 * Permanently delete an announcement and its associated image
 */
export async function permanentlyDeleteAnnouncement(announcementId: string): Promise<void> {
  await checkAnnouncementPermission();
  
  // First get the announcement to check for background image
  const announcement = await getAnnouncement(announcementId);
  
  // Delete the background image from storage if it exists
  if (announcement?.background?.imageUrl) {
    await deleteAnnouncementImage(announcement.background.imageUrl);
  }
  
  const announcementRef = doc(db, ANNOUNCEMENTS_COLLECTION, announcementId);
  await deleteDoc(announcementRef);
}

/**
 * Get a single announcement by ID
 */
export async function getAnnouncement(announcementId: string): Promise<Announcement | null> {
  const announcementRef = doc(db, ANNOUNCEMENTS_COLLECTION, announcementId);
  const announcementDoc = await getDoc(announcementRef);
  
  if (!announcementDoc.exists()) {
    return null;
  }
  
  return docToAnnouncement(announcementDoc);
}

/**
 * Get all announcements (for admin/social manager)
 */
export async function getAllAnnouncements(): Promise<Announcement[]> {
  await checkAnnouncementPermission();
  
  const q = query(
    collection(db, ANNOUNCEMENTS_COLLECTION),
    where('status', '!=', 'deleted'),
    orderBy('status'),
    orderBy('priority', 'desc'),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToAnnouncement);
}

/**
 * Get active announcements for display in feed
 * Returns announcements that are currently active (within start/end date)
 */
export async function getActiveAnnouncements(): Promise<Announcement[]> {
  const now = new Date();
  
  const q = query(
    collection(db, ANNOUNCEMENTS_COLLECTION),
    where('status', 'in', ['active', 'scheduled']),
    orderBy('priority', 'desc'),
    orderBy('startDate', 'asc')
  );
  
  const snapshot = await getDocs(q);
  const announcements = snapshot.docs.map(docToAnnouncement);
  
  // Filter to only include currently active announcements
  return announcements.filter(a => {
    const nowTime = now.getTime();
    return a.startDate.getTime() <= nowTime && a.endDate.getTime() >= nowTime;
  });
}

/**
 * Subscribe to active announcements (real-time updates)
 */
export function subscribeToActiveAnnouncements(
  callback: (announcements: Announcement[]) => void
): () => void {
  const q = query(
    collection(db, ANNOUNCEMENTS_COLLECTION),
    where('status', 'in', ['active', 'scheduled']),
    orderBy('priority', 'desc'),
    orderBy('startDate', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const now = new Date();
    const announcements = snapshot.docs
      .map(docToAnnouncement)
      .filter(a => {
        const nowTime = now.getTime();
        return a.startDate.getTime() <= nowTime && a.endDate.getTime() >= nowTime;
      });
    
    callback(announcements);
  });
}

/**
 * Subscribe to all announcements (for admin/social manager)
 */
export function subscribeToAllAnnouncements(
  callback: (announcements: Announcement[]) => void
): () => void {
  const q = query(
    collection(db, ANNOUNCEMENTS_COLLECTION),
    where('status', '!=', 'deleted'),
    orderBy('status'),
    orderBy('priority', 'desc'),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const announcements = snapshot.docs.map(docToAnnouncement);
    callback(announcements);
  });
}

/**
 * Update status of announcements based on current time
 * This should be called periodically or on app launch
 */
export async function updateAnnouncementStatuses(): Promise<void> {
  const q = query(
    collection(db, ANNOUNCEMENTS_COLLECTION),
    where('status', 'in', ['scheduled', 'active'])
  );
  
  const snapshot = await getDocs(q);
  const now = new Date();
  
  for (const docSnapshot of snapshot.docs) {
    const data = docSnapshot.data();
    const startDate = toDate(data.startDate);
    const endDate = toDate(data.endDate);
    const newStatus = calculateStatus(data.status, startDate, endDate);
    
    if (newStatus !== data.status) {
      await updateDoc(doc(db, ANNOUNCEMENTS_COLLECTION, docSnapshot.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    }
  }
}

/**
 * Publish a draft announcement (set status to scheduled or active)
 */
export async function publishAnnouncement(announcementId: string): Promise<void> {
  await checkAnnouncementPermission();
  
  const user = auth.currentUser!;
  const announcementRef = doc(db, ANNOUNCEMENTS_COLLECTION, announcementId);
  const announcementDoc = await getDoc(announcementRef);
  
  if (!announcementDoc.exists()) {
    throw new Error('Announcement not found');
  }
  
  const data = announcementDoc.data();
  const startDate = toDate(data.startDate);
  const endDate = toDate(data.endDate);
  const status = calculateStatus('scheduled', startDate, endDate);
  
  await updateDoc(announcementRef, {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
}

/**
 * Save announcement as draft
 */
export async function saveDraft(formData: AnnouncementFormData): Promise<string> {
  await checkAnnouncementPermission();
  
  const user = auth.currentUser!;
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const displayName = userDoc.data()?.displayName || user.email || 'Unknown';
  
  // Process background (upload image if needed) and remove undefined values
  const processedBackground = await processBackground(formData.background);
  
  // Build document data, only including defined fields
  const docData: Record<string, any> = {
    title: formData.title,
    text: formData.text,
    icon: formData.icon || '📢',
    background: processedBackground,
    startDate: Timestamp.fromDate(formData.startDate),
    endDate: Timestamp.fromDate(formData.endDate),
    priority: formData.priority || 0,
    status: 'draft',
    createdBy: user.uid,
    createdByName: displayName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  // Only add optional fields if they're defined
  if (formData.textStyle) {
    docData.textStyle = removeUndefinedValues(formData.textStyle);
  }
  if (formData.cta) {
    docData.cta = removeUndefinedValues(formData.cta);
  }
  
  const docRef = await addDoc(collection(db, ANNOUNCEMENTS_COLLECTION), docData);
  
  return docRef.id;
}

/**
 * Duplicate an existing announcement
 */
export async function duplicateAnnouncement(announcementId: string): Promise<string> {
  await checkAnnouncementPermission();
  
  const announcement = await getAnnouncement(announcementId);
  if (!announcement) {
    throw new Error('Announcement not found');
  }
  
  const user = auth.currentUser!;
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const displayName = userDoc.data()?.displayName || user.email || 'Unknown';
  
  const docRef = await addDoc(collection(db, ANNOUNCEMENTS_COLLECTION), {
    title: `${announcement.title} (עותק)`,
    text: announcement.text,
    icon: announcement.icon,
    background: announcement.background,
    textStyle: announcement.textStyle,
    cta: announcement.cta,
    startDate: Timestamp.fromDate(announcement.startDate),
    endDate: Timestamp.fromDate(announcement.endDate),
    priority: announcement.priority,
    status: 'draft',
    createdBy: user.uid,
    createdByName: displayName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  return docRef.id;
}
