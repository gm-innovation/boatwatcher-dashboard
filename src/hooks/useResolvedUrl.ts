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

    // Resolve private storage refs, legacy public URLs, signed URLs and raw bucket paths
    const isStorageUrl =
      storedUrl.startsWith('storage://') ||
      storedUrl.startsWith('worker-photos/') ||
      storedUrl.startsWith('worker-documents/') ||
      storedUrl.includes('/storage/v1/object/public/worker-photos/') ||
      storedUrl.includes('/storage/v1/object/public/worker-documents/') ||
      storedUrl.includes('/storage/v1/object/sign/worker-photos/') ||
      storedUrl.includes('/storage/v1/object/sign/worker-documents/');

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
