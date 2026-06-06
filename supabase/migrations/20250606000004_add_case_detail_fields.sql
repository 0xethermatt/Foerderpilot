-- ============================================================
-- Förderpilot V0 – extend funding_cases with detail fields
-- Run order: 4 of 4  (after enable_rls)
-- ============================================================

ALTER TABLE funding_cases
  ADD COLUMN IF NOT EXISTS project_address_street       TEXT,
  ADD COLUMN IF NOT EXISTS project_address_postal_code  TEXT,
  ADD COLUMN IF NOT EXISTS project_address_city         TEXT,

  ADD COLUMN IF NOT EXISTS building_type  TEXT
    CHECK (building_type IS NULL OR building_type IN ('EFH', 'MFH', 'DHH', 'RH', 'WHG')),

  ADD COLUMN IF NOT EXISTS housing_units  INTEGER
    CHECK (housing_units IS NULL OR housing_units >= 1),

  ADD COLUMN IF NOT EXISTS owner_status   TEXT
    CHECK (owner_status IS NULL OR owner_status IN (
      'owner', 'owner_community', 'other'
    )),

  ADD COLUMN IF NOT EXISTS self_occupied  BOOLEAN,

  ADD COLUMN IF NOT EXISTS current_heating_type  TEXT
    CHECK (current_heating_type IS NULL OR current_heating_type IN (
      'gas', 'oil', 'electric', 'district_heat', 'heat_pump', 'pellet', 'other'
    )),

  ADD COLUMN IF NOT EXISTS current_heating_year  INTEGER
    CHECK (current_heating_year IS NULL OR (current_heating_year >= 1900 AND current_heating_year <= 2030)),

  ADD COLUMN IF NOT EXISTS planned_heating_type  TEXT
    CHECK (planned_heating_type IS NULL OR planned_heating_type IN (
      'air_water', 'brine_water', 'water_water'
    )),

  ADD COLUMN IF NOT EXISTS planned_heat_pump_model  TEXT;

-- Index: filter open cases by building type (useful for reporting)
CREATE INDEX IF NOT EXISTS idx_funding_cases_building_type
  ON funding_cases (building_type)
  WHERE building_type IS NOT NULL;
