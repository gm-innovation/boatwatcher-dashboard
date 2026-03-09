-- Make worker-photos and worker-documents buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('worker-photos', 'worker-documents');