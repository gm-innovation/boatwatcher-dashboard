/**
 * Storage Provider Abstraction
 * 
 * - Web: uses Supabase Storage (cloud buckets)
 * - Electron: uses Local Server REST API for file storage
 */

import { isElectron } from '@/lib/dataProvider';
import { supabase } from '@/integrations/supabase/client';
import { getStorageUrl, getUploadedFileReference, resolveFileUrl } from '@/utils/storageUtils';
import { localStorage as localStorageProvider } from '@/lib/localServerProvider';

export async function uploadFile(
  bucket: string,
  path: string,
  file: File,
  options?: { upsert?: boolean }
): Promise<string | null> {
  if (isElectron()) {
    return localStorageProvider.upload(bucket, path, file);
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: options?.upsert ?? false });

  if (error) {
    console.error(`[storageProvider] Upload error for ${bucket}/${path}:`, error);
    return null;
  }

  return getUploadedFileReference(bucket, path);
}

export async function getFileUrl(bucket: string, path: string): Promise<string | null> {
  if (isElectron()) {
    return localStorageProvider.getUrl(bucket, path);
  }

  return getStorageUrl(bucket, path);
}

export async function resolveUrl(storedUrl: string | null): Promise<string | null> {
  if (!storedUrl) return null;

  if (isElectron()) {
    // URLs from local server are already absolute
    if (storedUrl.startsWith('http') || storedUrl.startsWith('data:')) {
      return storedUrl;
    }
    // Relative path from local server
    const api = (window as any).electronAPI;
    const base = api?.getServerUrl?.() || 'http://localhost:3001';
    return `${base}${storedUrl}`;
  }

  return resolveFileUrl(storedUrl);
}

export function getPublicUrl(bucket: string, path: string): string | null {
  if (isElectron()) {
    return localStorageProvider.getUrl(bucket, path);
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
