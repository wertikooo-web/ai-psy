-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 023: Storage bucket + policies for professional documents
-- Bucket: professional-development (private)
-- Path pattern: {user_id}/documents/{document_id}/{filename}
-- Access: signed URLs only (no public URLs)
-- ═══════════════════════════════════════════════════════════════════════════

-- Create private bucket (run via Supabase dashboard or service role API if SQL INSERT not allowed)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'professional-development',
  'professional-development',
  false,                           -- private: no public URLs
  20971520,                        -- 20 MB limit
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS policies ──────────────────────────────────────────────────────
-- Path segment [1] = user_id — enforced at storage level

CREATE POLICY "prof_docs_storage_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'professional-development'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "prof_docs_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'professional-development'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "prof_docs_storage_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'professional-development'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
