-- ============================================================
-- Förderpilot V0 – Phase 7: document table + storage bucket
-- ============================================================

-- 1. Drop old CHECK constraint on type and replace with new document types
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;

UPDATE documents
SET type = 'other'
WHERE type NOT IN (
  'offer', 'contract', 'old_heating_photo', 'old_heating_nameplate',
  'owner_proof', 'bza', 'kfw_approval', 'invoice', 'bnd', 'other'
);

ALTER TABLE documents
  ADD CONSTRAINT documents_type_check
  CHECK (type IN (
    'offer', 'contract', 'old_heating_photo', 'old_heating_nameplate',
    'owner_proof', 'bza', 'kfw_approval', 'invoice', 'bnd', 'other'
  ));

-- 2. Add new columns
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS mime_type   TEXT,
  ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS notes       TEXT,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3. Add status CHECK constraint
DO $$
BEGIN
  ALTER TABLE documents
    ADD CONSTRAINT documents_status_check
    CHECK (status IN ('uploaded', 'needs_review', 'reviewed', 'missing', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Add updated_at trigger
DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Ensure service_role has full access
GRANT ALL ON documents TO service_role;

-- 6. Create private storage bucket for case documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'case-documents',
  'case-documents',
  false,
  15728640,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;
