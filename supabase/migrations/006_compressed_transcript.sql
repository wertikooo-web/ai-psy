-- Migration 006: add compressed_transcript cache to consultations
--
-- Stores the map-reduce compressed version of a long transcript so that
-- chunking LLM calls run once per transcript change, not once per analysis mode.
--
-- sourceHash inside the jsonb must match the current canonicalTranscriptText hash
-- before the cached value is trusted. If the transcript changes, the column is
-- overwritten with the new compressed version.

ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS compressed_transcript jsonb DEFAULT NULL;

COMMENT ON COLUMN public.consultations.compressed_transcript IS
  'Cached map-reduce compression of a long transcript. '
  'Schema: { version, text, sourceHash, chunksCount, createdAt, model? }. '
  'Invalidated automatically when canonicalTranscriptText hash changes.';
