import { useState, useEffect } from 'react';
import { resolveFileUrl } from '@/utils/storageUtils';

/**
 * Hook that resolves a stored file URL (which may be a legacy public URL 
 * or a storage:// URI) into a displayable signed URL.
 */
export function useResolvedUrl(storedUrl: string | null | undefined): string | null {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(storedUrl || null);

  useEffect(() => {
    if (!storedUrl) {
      setResolvedUrl(null);
      return;
    }

    // If it doesn't look like a Supabase storage URL or storage:// URI, use as-is
    const isStorageUrl = storedUrl.startsWith('storage://') || 
      storedUrl.includes('/storage/v1/object/public/worker-photos/') ||
      storedUrl.includes('/storage/v1/object/public/worker-documents/');
    
    if (!isStorageUrl) {
      setResolvedUrl(storedUrl);
      return;
    }

    let cancelled = false;
    resolveFileUrl(storedUrl).then(url => {
      if (!cancelled) setResolvedUrl(url);
    });

    return () => { cancelled = true; };
  }, [storedUrl]);

  return resolvedUrl;
}
