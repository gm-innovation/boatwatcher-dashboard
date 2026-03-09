/**
 * Storage Provider Abstraction
 * 
 * - Web: uses Supabase Storage (cloud buckets)
 * - Electron: saves to local filesystem via IPC
 */

import { isElectron } from '@/lib/dataProvider';
import { supabase } from '@/integrations/supabase/client';
import { getStorageUrl, getUploadedFileReference, resolveFileUrl } from '@/utils/storageUtils';

export async function uploadFile(
  bucket: string,
  path: string,
  file: File,
  options?: { upsert?: boolean }
): Promise<string | null> {
  if (isElectron()) {
    // In Electron, save file to local data directory via IPC
    const api = (window as any).electronAPI;
    if (api?.storage?.uploadFile) {
      return api.storage.uploadFile(bucket, path, await file.arrayBuffer());
    }
    // Fallback: convert to data URL and store locally
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
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
    const api = (window as any).electronAPI;
    if (api?.storage?.getFileUrl) {
      return api.storage.getFileUrl(bucket, path);
    }
    return null;
  }

  return getStorageUrl(bucket, path);
}

export async function resolveUrl(storedUrl: string | null): Promise<string | null> {
  if (!storedUrl) return null;

  if (isElectron()) {
    // In Electron, data URLs or local paths are returned as-is
    if (storedUrl.startsWith('data:') || storedUrl.startsWith('file://')) {
      return storedUrl;
    }
    const api = (window as any).electronAPI;
    if (api?.storage?.resolveUrl) {
      return api.storage.resolveUrl(storedUrl);
    }
    return storedUrl;
  }

  return resolveFileUrl(storedUrl);
}

export function getPublicUrl(bucket: string, path: string): string | null {
  if (isElectron()) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
