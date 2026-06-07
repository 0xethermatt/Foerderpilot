-- ============================================================
-- Förderpilot V0 – add priority column to tasks
-- ============================================================

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high'));
