import { supabase } from '@/integrations/supabase/client';

/**
 * Gets a URL for a file in a storage bucket.
 * For private buckets (worker-photos, worker-documents), creates a signed URL.
 * For public buckets, returns the public URL.
 */
export async function getStorageUrl(bucket: string, path: string): Promise<string | null> {
  const privateBuckets = ['worker-photos', 'worker-documents'];
  
  if (privateBuckets.includes(bucket)) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600); // 1 hour
    
    if (error) {
      console.error(`[getStorageUrl] Error creating signed URL for ${bucket}/${path}:`, error);
      return null;
    }
    return data.signedUrl;
  }
  
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * After uploading a file, stores the path (not URL) for private buckets.
 * For private buckets, we store just the path and resolve URLs at display time.
 * For public buckets, we store the full public URL for backward compatibility.
 */
export function getUploadedFileReference(bucket: string, path: string): string {
  const privateBuckets = ['worker-photos', 'worker-documents'];
  
  if (privateBuckets.includes(bucket)) {
    // Store as storage:// URI for private buckets
    return `storage://${bucket}/${path}`;
  }
  
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Resolves a stored file reference to a displayable URL.
 * Handles both storage:// URIs (new private format) and legacy public URLs.
 */
export async function resolveFileUrl(storedUrl: string | null): Promise<string | null> {
  if (!storedUrl) return null;
  
  // New format: storage://bucket/path
  if (storedUrl.startsWith('storage://')) {
    const rest = storedUrl.replace('storage://', '');
    const slashIndex = rest.indexOf('/');
    const bucket = rest.substring(0, slashIndex);
    const path = rest.substring(slashIndex + 1);
    return getStorageUrl(bucket, path);
  }
  
  // Legacy: full public URL - still works if bucket was public when stored
  // For now, return as-is. If bucket is now private, this URL won't work.
  // We detect this and try to extract the path and create a signed URL.
  const workerPhotosMatch = storedUrl.match(/\/storage\/v1\/object\/public\/worker-photos\/(.+)/);
  if (workerPhotosMatch) {
    return getStorageUrl('worker-photos', workerPhotosMatch[1]);
  }
  
  const workerDocsMatch = storedUrl.match(/\/storage\/v1\/object\/public\/worker-documents\/(.+)/);
  if (workerDocsMatch) {
    return getStorageUrl('worker-documents', workerDocsMatch[1]);
  }
  
  // Public URL or external URL - return as-is
  return storedUrl;
}
