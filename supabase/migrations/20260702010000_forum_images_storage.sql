-- Finasset — forum image uploads (Supabase Storage)
-- Creates the public 'forum-images' bucket used by the community composer
-- (desktop.html / mobile.html → _comUploadImage). Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('forum-images', 'forum-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Authenticated users may upload only into their own folder (path = <uid>/...)
DROP POLICY IF EXISTS "forum-images auth upload" ON storage.objects;
CREATE POLICY "forum-images auth upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'forum-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Anyone can read (bucket is public; explicit policy for API listing/consistency)
DROP POLICY IF EXISTS "forum-images public read" ON storage.objects;
CREATE POLICY "forum-images public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'forum-images');

-- Owners may delete their own uploads
DROP POLICY IF EXISTS "forum-images owner delete" ON storage.objects;
CREATE POLICY "forum-images owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'forum-images' AND (storage.foldername(name))[1] = auth.uid()::text);
