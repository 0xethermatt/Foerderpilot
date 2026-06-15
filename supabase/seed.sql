-- ============================================================
-- Förderpilot V0 – development seed data
--
-- Run with:  supabase db reset   (local)
-- or:        supabase db seed    (Supabase CLI ≥ 1.138)
--
-- The company UUID below matches DEFAULT_COMPANY_ID in .env.local.
-- ============================================================

INSERT INTO companies (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Muster SHK GmbH')
ON CONFLICT (id) DO NOTHING;

-- ─── Demo customers ────────────────────────────────────────────────────────────
INSERT INTO customers (id, company_id, first_name, last_name, email, phone, street, city, postal_code)
VALUES
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000001','Hans','Müller','hans.mueller@example-testdaten.de','+49 89 12345678','Musterstraße 1','München','80331'),
  ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000001','Petra','Schmidt','petra.schmidt@example-testdaten.de','+49 30 98765432','Beispielweg 7','Berlin','10115'),
  ('33333333-3333-3333-3333-333333333333','00000000-0000-0000-0000-000000000001','Thomas','Weber','thomas.weber@example-testdaten.de','+49 221 11223344','Testgasse 12','Köln','50667'),
  ('44444444-4444-4444-4444-444444444444','00000000-0000-0000-0000-000000000001','Maria','Hoffmann','maria.hoffmann@example-testdaten.de','+49 40 99887766','Demostraße 3','Hamburg','20095')
ON CONFLICT (id) DO NOTHING;

-- ─── Demo cases ────────────────────────────────────────────────────────────────
INSERT INTO funding_cases (id,company_id,customer_id,title,status,risk_level,project_address_street,project_address_postal_code,project_address_city,building_type,current_heating_type,current_heating_year,planned_heating_type,planned_heat_pump_model,estimated_cost,funding_amount,bza_status,kfw_application_status,implementation_status,proof_submission_status,payout_status,notes)
VALUES
  ('aaaaaaaa-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','TESTDATEN – Müller Wärmepumpe EFH München','data_missing','red','Musterstraße 1','80331','München','EFH','gas',2003,'air_water','Viessmann Vitocal 200-A',16500,5000,'not_started','not_started','not_started','not_started','pending','Testfall – unvollständige Unterlagen.'),
  ('aaaaaaaa-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','TESTDATEN – Schmidt Sole-WP Doppelhaus Berlin','contract_review_needed','yellow','Beispielweg 7','10115','Berlin','DHH','oil',1998,'brine_water','Buderus Logatherm WPS 6',22000,7500,'not_started','not_started','not_started','not_started','pending','Testfall – Unterlagen vorhanden, Prüfung ausstehend.'),
  ('aaaaaaaa-3333-3333-3333-333333333333','00000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','TESTDATEN – Weber Luft-WP Reihenhaus Köln','funding_check_done','green','Testgasse 12','50667','Köln','RH','gas',2001,'air_water','Vaillant aroTHERM plus VWL 55/5 AS',18500,6200,'not_started','not_started','not_started','not_started','pending','Testfall – Happy Path, alle Unterlagen geprüft.'),
  ('aaaaaaaa-4444-4444-4444-444444444444','00000000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','TESTDATEN – Hoffmann Wärmepumpe Hamburg','approval_received','green','Demostraße 3','20095','Hamburg','EFH','oil',1996,'air_water','Daikin Altherma 3 H HT',19800,7000,'created','approved','not_started','not_started','pending','Testfall – KfW-Zusage erhalten, Umsetzung startet.')
ON CONFLICT (id) DO NOTHING;
