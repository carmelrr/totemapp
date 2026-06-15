/**
 * @fileoverview Q&A Media Service
 * @description Uploads/deletes Q&A images and videos in Firebase Storage under `qa/{uid}/…`.
 * Mirrors the announcement image-upload pattern (fetch URI → blob → uploadBytes → getDownloadURL).
 * The actual knowledge-base attachment is gated by firestore.rules (manager/admin only).
 */

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/features/data/firebase';
import type { QAMediaKind } from './types';

const QA_MEDIA_ROOT = 'qa';

/** Best-effort file extension from a local URI, with a kind-based fallback. */
function extFromUri(uri: string, kind: QAMediaKind): string {
  const match = uri.split('?')[0].match(/\.([a-zA-Z0-9]+)$/);
  if (match) return match[1].toLowerCase();
  return kind === 'video' ? 'mp4' : 'jpg';
}

/**
 * Upload a picked image/video to Storage and return its download URL.
 * @param localUri  Local file URI from expo-image-picker.
 * @param kind      'image' | 'video' — used for the fallback extension.
 * @param ownerUid  Current user's uid (used as the storage folder segment).
 */
export async function uploadQAMedia(
  localUri: string,
  kind: QAMediaKind,
  ownerUid: string,
): Promise<string> {
  const ext = extFromUri(localUri, kind);
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const fileRef = ref(storage, `${QA_MEDIA_ROOT}/${ownerUid || 'shared'}/${fileName}`);

  try {
    const response = await fetch(localUri);
    const blob = await response.blob();
    const snapshot = await uploadBytes(fileRef, blob);
    return await getDownloadURL(snapshot.ref);
  } catch (error: any) {
    console.error('Error uploading Q&A media:', error);
    throw new Error('לא ניתן להעלות את הקובץ: ' + (error?.message || error));
  }
}

/**
 * Delete an uploaded media file by its download URL. No-ops for external links
 * (which are not Storage URLs) and swallows "already deleted" errors.
 */
export async function deleteQAMedia(url: string): Promise<void> {
  try {
    if (!url || !url.includes('/o/')) return; // external link or invalid — nothing to delete
    const path = decodeURIComponent(url.split('/o/')[1].split('?')[0]);
    await deleteObject(ref(storage, path));
  } catch (error) {
    console.warn('deleteQAMedia failed (file may already be gone):', error);
  }
}
