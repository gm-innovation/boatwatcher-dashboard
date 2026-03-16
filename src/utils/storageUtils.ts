import { supabase } from '@/integrations/supabase/client';

const privateBuckets = ['worker-photos', 'worker-documents'] as const;
type PrivateBucket = (typeof privateBuckets)[number];

function extractPrivateStorageReference(storedUrl: string): { bucket: PrivateBucket; path: string } | null {
  if (storedUrl.startsWith('storage://')) {
    const rest = storedUrl.replace('storage://', '');
    const slashIndex = rest.indexOf('/');

    if (slashIndex === -1) return null;

    const bucket = rest.substring(0, slashIndex) as PrivateBucket;
    const path = rest.substring(slashIndex + 1);

    if (privateBuckets.includes(bucket) && path) {
      return { bucket, path };
    }
  }

  const rawPathMatch = storedUrl.match(/^(worker-photos|worker-documents)\/(.+)$/);
  if (rawPathMatch) {
    return {
      bucket: rawPathMatch[1] as PrivateBucket,
      path: rawPathMatch[2],
    };
  }

  const objectUrlMatch = storedUrl.match(
    /\/storage\/v1\/(?:object|render\/image)\/(?:public|sign)\/(worker-photos|worker-documents)\/([^?]+)/,
  );
  if (objectUrlMatch) {
    return {
      bucket: objectUrlMatch[1] as PrivateBucket,
      path: decodeURIComponent(objectUrlMatch[2]),
    };
  }

  return null;
}

/**
 * Gets a URL for a file in a storage bucket.
 * For private buckets (worker-photos, worker-documents), creates a signed URL.
 * For public buckets, returns the public URL.
 */
export async function getStorageUrl(bucket: string, path: string): Promise<string | null> {
  if (privateBuckets.includes(bucket as PrivateBucket)) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600);

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
  if (privateBuckets.includes(bucket as PrivateBucket)) {
    return `storage://${bucket}/${path}`;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Resolves a stored file reference to a displayable URL.
 * Handles storage:// URIs, raw bucket paths, signed URLs and legacy public URLs.
 */
export async function resolveFileUrl(storedUrl: string | null): Promise<string | null> {
  if (!storedUrl) return null;

  const reference = extractPrivateStorageReference(storedUrl);
  if (reference) {
    return getStorageUrl(reference.bucket, reference.path);
  }

  return storedUrl;
}
