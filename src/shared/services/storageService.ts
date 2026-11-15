import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, auth } from '../firebase/config';

export interface UploadOptions {
  onProgress?: (progressPercent: number) => void;
  timeoutMs?: number;
}

/**
 * Uploads a restaurant asset (logo or cover image) to Firebase Storage using
 * uploadBytesResumable with live progress tracking, strict timeout hang protection,
 * and comprehensive error diagnostics.
 *
 * @param tenantId The unique tenant identifier for the restaurant
 * @param file The image File or compressed Blob object
 * @param type Asset type: 'logo' or 'cover'
 * @param options Optional callbacks for progress and custom timeout duration
 * @returns The resolved durable download URL from Firebase Storage
 */
export async function uploadRestaurantAsset(
  tenantId: string,
  file: File,
  type: 'logo' | 'cover',
  options?: UploadOptions
): Promise<string> {
  if (!storage) {
    throw new Error('Firebase Storage is not initialized or unavailable in this environment.');
  }

  if (!auth?.currentUser) {
    throw new Error('Authentication required. Please sign in to upload restaurant assets.');
  }

  if (!tenantId || tenantId.trim() === '') {
    throw new Error('Invalid restaurant identifier (tenantId is missing).');
  }

  // Enforce strict file size limits (2MB logo, 5MB cover)
  const maxSizeBytes = type === 'logo' ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error(
      `${type === 'logo' ? 'Logo' : 'Cover image'} exceeds the maximum permitted size of ${
        type === 'logo' ? '2 MB' : '5 MB'
      }.`
    );
  }

  // Validate allowed image MIME types
  const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (file.type && !allowedMimes.includes(file.type.toLowerCase())) {
    throw new Error('Invalid image format. Allowed formats are PNG, JPEG, and WebP.');
  }

  // Sanitize file extension
  const rawExt = file.name.split('.').pop()?.toLowerCase();
  const safeExt = rawExt && ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'webp';
  
  // Consistent, tenant-scoped storage path
  const path = `restaurants/${tenantId}/branding/${type}_${Date.now()}.${safeExt}`;
  const storageRef = ref(storage, path);

  const metadata = {
    contentType: file.type || (safeExt === 'webp' ? 'image/webp' : 'image/png'),
    customMetadata: {
      tenantId,
      assetType: type,
      originalName: file.name,
      uploadedAt: new Date().toISOString()
    }
  };

  const timeoutMs = options?.timeoutMs || 25000; // 25 seconds timeout

  return new Promise<string>((resolve, reject) => {
    let isCompleted = false;
    let timeoutTimer: NodeJS.Timeout | null = null;

    const uploadTask = uploadBytesResumable(storageRef, file, metadata);

    // Timeout protection: abort upload if taking longer than timeoutMs
    timeoutTimer = setTimeout(() => {
      if (!isCompleted) {
        isCompleted = true;
        try {
          uploadTask.cancel();
        } catch (_) {}

        console.error('[StorageService] Upload timed out after', timeoutMs, 'ms for path:', path);
        reject(
          new Error('Upload is taking too long. Please check your internet connection and try again.')
        );
      }
    }, timeoutMs);

    // Monitor upload progress and status
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (options?.onProgress && snapshot.totalBytes > 0) {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          options.onProgress(Math.min(progress, 100));
        }
      },
      (error: any) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (isCompleted) return;
        isCompleted = true;

        const errorCode = error?.code || 'unknown';
        const errorMessage = error?.message || 'Unknown Firebase Storage error';

        // Safe developer diagnostic logging (no sensitive credentials)
        console.error('[StorageService] Upload failed:', {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          tenantId,
          storagePath: path,
          errorCode,
          errorMessage
        });

        // Human-friendly error translation
        if (errorCode === 'storage/unauthorized') {
          reject(new Error('Permission denied. You do not have permission to upload assets for this restaurant.'));
        } else if (errorCode === 'storage/canceled') {
          reject(new Error('Upload was canceled or timed out. Please try again.'));
        } else if (errorCode === 'storage/retry-limit-exceeded') {
          reject(new Error('Upload timed out due to network connectivity. Please check your connection and try again.'));
        } else if (
          errorCode === 'storage/unknown' ||
          errorMessage.toLowerCase().includes('not found') ||
          errorMessage.toLowerCase().includes('bucket')
        ) {
          reject(
            new Error(
              'Firebase Storage bucket is not ready or not found. Please ensure Firebase Storage is enabled in the Firebase Console.'
            )
          );
        } else {
          reject(new Error(`Upload failed: ${errorMessage}`));
        }
      },
      async () => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (isCompleted) return;
        isCompleted = true;

        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          if (options?.onProgress) {
            options.onProgress(100);
          }
          resolve(downloadUrl);
        } catch (urlErr: any) {
          console.error('[StorageService] Failed to retrieve download URL:', urlErr);
          reject(new Error('Upload completed, but failed to retrieve image URL.'));
        }
      }
    );
  });
}

/**
 * Safely deletes an old branding image object from Firebase Storage if it exists.
 * Does not throw if the file is already deleted or from an external source.
 * 
 * @param downloadUrl The Firebase Storage download URL of the asset to delete
 */
export async function deleteOldBrandingAsset(downloadUrl: string): Promise<void> {
  if (!storage || !downloadUrl || !downloadUrl.includes('firebasestorage.googleapis.com')) {
    return;
  }

  try {
    const storageRef = ref(storage, downloadUrl);
    await deleteObject(storageRef);
    console.info('[StorageService] Successfully cleaned up superseded asset from Storage.');
  } catch (err: any) {
    // Non-blocking: Do not interrupt user flow if old file was already removed
    console.warn('[StorageService] Non-critical: Could not delete superseded storage asset:', err?.message || err);
  }
}
