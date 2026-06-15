-- ============================================================
-- Förderpilot V0 – Demo / Test data (Phase 18)
--
-- Inserts 4 synthetic demo cases for SHK demo scenarios.
-- All data is clearly marked as TESTDATEN.
-- Idempotent: ON CONFLICT DO NOTHING on all rows.
-- ============================================================

BEGIN;

-- ─── Customers ───────────────────────────────────────────────────────────────

INSERT INTO customers (id, company_id, first_name, last_name, email, phone, street, city, postal_code)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000001',
    'Hans', 'Müller',
    'hans.mueller@example-testdaten.de',
    '+49 89 12345678',
    'Musterstraße 1',
    'München',
    '80331'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000001',
    'Petra', 'Schmidt',
    'petra.schmidt@example-testdaten.de',
    '+49 30 98765432',
    'Beispielweg 7',
    'Berlin',
    '10115'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000001',
    'Thomas', 'Weber',
    'thomas.weber@example-testdaten.de',
    '+49 221 11223344',
    'Testgasse 12',
    'Köln',
    '50667'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    '00000000-0000-0000-0000-000000000001',
    'Maria', 'Hoffmann',
    'maria.hoffmann@example-testdaten.de',
    '+49 40 99887766',
    'Demostraße 3',
    'Hamburg',
    '20095'
  )
ON CONFLICT (id) DO NOTHING;

-- ─── Case 1: Müller – Unterlagen fehlen ──────────────────────────────────────

INSERT INTO funding_cases (
  id, company_id, customer_id, title, status, risk_level,
  project_address_street, project_address_postal_code, project_address_city,
  building_type, housing_units, owner_status, self_occupied,
  current_heating_type, current_heating_year,
  planned_heating_type, planned_heat_pump_model,
  estimated_cost, funding_amount,
  notes,
  bza_status, kfw_application_status, implementation_status, proof_submission_status, payout_status
) VALUES (
  'aaaaaaaa-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'TESTDATEN – Müller Wärmepumpe EFH München',
  'data_missing', 'red',
  'Musterstraße 1', '80331', 'München',
  'EFH', 1, 'owner', true,
  'gas', 2003,
  'air_water', 'Viessmann Vitocal 200-A',
  16500, 5000,
  'Testfall – unvollständige Unterlagen. Angebot, Fotos und Eigentumsnachweis fehlen.',
  'not_started', 'not_started', 'not_started', 'not_started', 'pending'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (id, funding_case_id, title, description, priority, completed)
VALUES
  (
    'bbbbbbbb-1111-0001-0000-000000000001',
    'aaaaaaaa-1111-1111-1111-111111111111',
    'Angebot vom Installateur anfordern',
    'Kostenangebot inkl. Wärmepumpenmodell, Effizienzklasse und Montageleistung.',
    'high', false
  ),
  (
    'bbbbbbbb-1111-0001-0000-000000000002',
    'aaaaaaaa-1111-1111-1111-111111111111',
    'Foto Altanlage und Typenschild anfordern',
    'Foto der Gasheizung + Typenschild mit Baujahr vom Kunden anfordern.',
    'high', false
  ),
  (
    'bbbbbbbb-1111-0001-0000-000000000003',
    'aaaaaaaa-1111-1111-1111-111111111111',
    'Eigentumsnachweis (Grundbuchauszug) anfordern',
    'Grundbuchauszug oder Kaufvertrag beim Kunden anfragen.',
    'normal', false
  )
ON CONFLICT (id) DO NOTHING;

-- ─── Case 2: Schmidt – Dokumente vorhanden, Prüfung ausstehend ───────────────

INSERT INTO funding_cases (
  id, company_id, customer_id, title, status, risk_level,
  project_address_street, project_address_postal_code, project_address_city,
  building_type, housing_units, owner_status, self_occupied,
  current_heating_type, current_heating_year,
  planned_heating_type, planned_heat_pump_model,
  estimated_cost, funding_amount,
  notes,
  bza_status, kfw_application_status, implementation_status, proof_submission_status, payout_status
) VALUES (
  'aaaaaaaa-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222',
  'TESTDATEN – Schmidt Sole-WP Doppelhaus Berlin',
  'contract_review_needed', 'yellow',
  'Beispielweg 7', '10115', 'Berlin',
  'DHH', 1, 'owner', true,
  'oil', 1998,
  'brine_water', 'Buderus Logatherm WPS 6',
  22000, 7500,
  'Testfall – Unterlagen hochgeladen, Prüfung steht aus. Angebot und Vertrag müssen geprüft werden.',
  'not_started', 'not_started', 'not_started', 'not_started', 'pending'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO documents (id, funding_case_id, name, type, storage_path, status, uploaded_by)
VALUES
  (
    'cccccccc-2222-0001-0000-000000000001',
    'aaaaaaaa-2222-2222-2222-222222222222',
    'Angebot_Schmidt_Buderus_WP.pdf',
    'offer',
    'demo/schmidt/Angebot_Schmidt_Buderus_WP.pdf',
    'needs_review', 'admin'
  ),
  (
    'cccccccc-2222-0001-0000-000000000002',
    'aaaaaaaa-2222-2222-2222-222222222222',
    'Leistungsvertrag_Schmidt.pdf',
    'contract',
    'demo/schmidt/Leistungsvertrag_Schmidt.pdf',
    'needs_review', 'admin'
  ),
  (
    'cccccccc-2222-0001-0000-000000000003',
    'aaaaaaaa-2222-2222-2222-222222222222',
    'Foto_Altanlage_Schmidt.jpg',
    'old_heating_photo',
    'demo/schmidt/Foto_Altanlage_Schmidt.jpg',
    'needs_review', 'admin'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_checks (
  id, case_id, check_type, provider, model, status,
  result_json, summary, risk_level, confidence,
  human_review_status, rule_version, disclaimer
) VALUES (
  'dddddddd-2222-0001-0000-000000000001',
  'aaaaaaaa-2222-2222-2222-222222222222',
  'offer_check',
  'anthropic', 'claude-sonnet-4-6', 'completed',
  '{
    "assessment": "needs_revision",
    "summary_de": "Das Angebot enthält grundlegende Angaben, aber einige förderrelevante Informationen fehlen.",
    "key_findings": [
      "JAZ-Angabe (Jahresarbeitszahl) fehlt im Angebot",
      "Hydraulischer Abgleich nicht erwähnt",
      "Fördervorbehalt nicht explizit formuliert"
    ],
    "recommended_next_steps": [
      "JAZ und Effizienzklasse vom Installateur nachfordern",
      "Hydraulischen Abgleich ins Angebot aufnehmen lassen",
      "Fördervorbehalt im Vertrag sicherstellen"
    ]
  }',
  'Angebotsprüfung: Nachbesserung empfohlen – JAZ und hydraulischer Abgleich fehlen.',
  'yellow', 'medium',
  'pending',
  'v1.0',
  'KI-gestützte Vorprüfung. Kein Ersatz für fachliche Beratung. Keine Fördergarantie.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (id, funding_case_id, title, priority, completed)
VALUES
  (
    'bbbbbbbb-2222-0001-0000-000000000001',
    'aaaaaaaa-2222-2222-2222-222222222222',
    'Angebot prüfen und KI-Prüfungsergebnis freigeben',
    'high', false
  ),
  (
    'bbbbbbbb-2222-0001-0000-000000000002',
    'aaaaaaaa-2222-2222-2222-222222222222',
    'Liefer-/Leistungsvertrag prüfen',
    'high', false
  ),
  (
    'bbbbbbbb-2222-0001-0000-000000000003',
    'aaaaaaaa-2222-2222-2222-222222222222',
    'Foto Typenschild Altanlage anfordern',
    'normal', false
  ),
  (
    'bbbbbbbb-2222-0001-0000-000000000004',
    'aaaaaaaa-2222-2222-2222-222222222222',
    'Eigentumsnachweis anfordern',
    'normal', false
  )
ON CONFLICT (id) DO NOTHING;

-- ─── Case 3: Weber – Alle Unterlagen geprüft, BzA-bereit ─────────────────────

INSERT INTO funding_cases (
  id, company_id, customer_id, title, status, risk_level,
  project_address_street, project_address_postal_code, project_address_city,
  building_type, housing_units, owner_status, self_occupied,
  current_heating_type, current_heating_year,
  planned_heating_type, planned_heat_pump_model,
  estimated_cost, funding_amount,
  notes,
  bza_responsible_party,
  bza_status, kfw_application_status, implementation_status, proof_submission_status, payout_status
) VALUES (
  'aaaaaaaa-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000001',
  '33333333-3333-3333-3333-333333333333',
  'TESTDATEN – Weber Luft-WP Reihenhaus Köln',
  'funding_check_done', 'green',
  'Testgasse 12', '50667', 'Köln',
  'RH', 1, 'owner', true,
  'gas', 2001,
  'air_water', 'Vaillant aroTHERM plus VWL 55/5 AS',
  18500, 6200,
  'Testfall – Happy Path BzA-bereit. Alle 5 Pflichtunterlagen geprüft, KI-Checks freigegeben.',
  'specialist_company',
  'not_started', 'not_started', 'not_started', 'not_started', 'pending'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO documents (id, funding_case_id, name, type, storage_path, status, uploaded_by)
VALUES
  (
    'cccccccc-3333-0001-0000-000000000001',
    'aaaaaaaa-3333-3333-3333-333333333333',
    'Angebot_Weber_Vaillant.pdf',
    'offer',
    'demo/weber/Angebot_Weber_Vaillant.pdf',
    'reviewed', 'admin'
  ),
  (
    'cccccccc-3333-0001-0000-000000000002',
    'aaaaaaaa-3333-3333-3333-333333333333',
    'Leistungsvertrag_Weber.pdf',
    'contract',
    'demo/weber/Leistungsvertrag_Weber.pdf',
    'reviewed', 'admin'
  ),
  (
    'cccccccc-3333-0001-0000-000000000003',
    'aaaaaaaa-3333-3333-3333-333333333333',
    'Foto_Altanlage_Weber.jpg',
    'old_heating_photo',
    'demo/weber/Foto_Altanlage_Weber.jpg',
    'reviewed', 'admin'
  ),
  (
    'cccccccc-3333-0001-0000-000000000004',
    'aaaaaaaa-3333-3333-3333-333333333333',
    'Foto_Typenschild_Weber.jpg',
    'old_heating_nameplate',
    'demo/weber/Foto_Typenschild_Weber.jpg',
    'reviewed', 'admin'
  ),
  (
    'cccccccc-3333-0001-0000-000000000005',
    'aaaaaaaa-3333-3333-3333-333333333333',
    'Grundbuchauszug_Weber.pdf',
    'owner_proof',
    'demo/weber/Grundbuchauszug_Weber.pdf',
    'reviewed', 'admin'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_checks (
  id, case_id, check_type, provider, model, status,
  result_json, summary, risk_level, confidence,
  human_review_status, reviewed_by, reviewed_at,
  rule_version, disclaimer
) VALUES
  (
    'dddddddd-3333-0001-0000-000000000001',
    'aaaaaaaa-3333-3333-3333-333333333333',
    'offer_check',
    'anthropic', 'claude-sonnet-4-6', 'completed',
    '{
      "assessment": "pass",
      "summary_de": "Das Angebot erfüllt alle wesentlichen KfW-BEG-Anforderungen. JAZ und Effizienzklasse sind angegeben.",
      "key_findings": [
        "JAZ 4,1 angegeben – förderfähig",
        "Hydraulischer Abgleich Methode B vorgesehen",
        "Keine Vorauszahlungen vereinbart"
      ],
      "recommended_next_steps": [
        "BzA beim Fachunternehmen anfordern",
        "KfW-Antrag vorbereiten"
      ]
    }',
    'Angebotsprüfung: Plausibel – alle KfW-Anforderungen erfüllt.',
    'green', 'high',
    'approved', 'admin', NOW() - INTERVAL ''2 days'',
    'v1.0',
    'KI-gestützte Vorprüfung. Kein Ersatz für fachliche Beratung. Keine Fördergarantie.'
  ),
  (
    'dddddddd-3333-0001-0000-000000000002',
    'aaaaaaaa-3333-3333-3333-333333333333',
    'contract_check',
    'anthropic', 'claude-sonnet-4-6', 'completed',
    '{
      "assessment": "pass",
      "summary_de": "Der Vertrag enthält einen gültigen Fördervorbehalt und ist für die KfW-Antragstellung geeignet.",
      "key_findings": [
        "Fördervorbehalt korrekt formuliert: ''vorbehaltlich der Förderzusage der KfW''",
        "Zahlungsbedingungen: 10% Anzahlung, Rest nach Einbau – KfW-konform",
        "Keine Vorhabenbeginn-Klausel gefunden"
      ],
      "recommended_next_steps": [
        "BzA beim Fachunternehmen anfordern",
        "KfW-Antrag intern vorbereiten"
      ]
    }',
    'Vertragsprüfung: Fördervorbehalt plausibel – Vertrag KfW-geeignet.',
    'green', 'high',
    'approved', 'admin', NOW() - INTERVAL ''2 days'',
    'v1.0',
    'KI-gestützte Vorprüfung. Kein Ersatz für fachliche Beratung. Keine Fördergarantie.'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (id, funding_case_id, title, priority, completed)
VALUES
  (
    'bbbbbbbb-3333-0001-0000-000000000001',
    'aaaaaaaa-3333-3333-3333-333333333333',
    'BzA beim Fachunternehmen (Vaillant-Partner) anfordern',
    'high', false
  )
ON CONFLICT (id) DO NOTHING;

-- ─── Case 4: Hoffmann – KfW-Zusage erhalten, Umsetzung startet ───────────────

INSERT INTO funding_cases (
  id, company_id, customer_id, title, status, risk_level,
  project_address_street, project_address_postal_code, project_address_city,
  building_type, housing_units, owner_status, self_occupied,
  current_heating_type, current_heating_year,
  planned_heating_type, planned_heat_pump_model,
  estimated_cost, funding_amount,
  notes,
  bza_responsible_party,
  bza_status, bza_id, bza_created_at,
  kfw_application_status, kfw_application_prepared_at, kfw_approval_received_at,
  implementation_status, proof_submission_status, payout_status
) VALUES (
  'aaaaaaaa-4444-4444-4444-444444444444',
  '00000000-0000-0000-0000-000000000001',
  '44444444-4444-4444-4444-444444444444',
  'TESTDATEN – Hoffmann Wärmepumpe Hamburg',
  'approval_received', 'green',
  'Demostraße 3', '20095', 'Hamburg',
  'EFH', 1, 'owner', true,
  'oil', 1996,
  'air_water', 'Daikin Altherma 3 H HT',
  19800, 7000,
  'Testfall – KfW-Förderzusage erhalten. Umsetzung kann beginnen. BnD und Nachweise ausstehend.',
  'specialist_company',
  'created', '123456789012345', (NOW() - INTERVAL ''3 weeks'')::date,
  'approved', NOW() - INTERVAL ''3 weeks'', NOW() - INTERVAL ''1 week'',
  'not_started', 'not_started', 'pending'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO documents (id, funding_case_id, name, type, storage_path, status, uploaded_by)
VALUES
  (
    'cccccccc-4444-0001-0000-000000000001',
    'aaaaaaaa-4444-4444-4444-444444444444',
    'Angebot_Hoffmann_Daikin.pdf',
    'offer',
    'demo/hoffmann/Angebot_Hoffmann_Daikin.pdf',
    'reviewed', 'admin'
  ),
  (
    'cccccccc-4444-0001-0000-000000000002',
    'aaaaaaaa-4444-4444-4444-444444444444',
    'Leistungsvertrag_Hoffmann.pdf',
    'contract',
    'demo/hoffmann/Leistungsvertrag_Hoffmann.pdf',
    'reviewed', 'admin'
  ),
  (
    'cccccccc-4444-0001-0000-000000000003',
    'aaaaaaaa-4444-4444-4444-444444444444',
    'Foto_Altanlage_Hoffmann.jpg',
    'old_heating_photo',
    'demo/hoffmann/Foto_Altanlage_Hoffmann.jpg',
    'reviewed', 'admin'
  ),
  (
    'cccccccc-4444-0001-0000-000000000004',
    'aaaaaaaa-4444-4444-4444-444444444444',
    'Foto_Typenschild_Hoffmann.jpg',
    'old_heating_nameplate',
    'demo/hoffmann/Foto_Typenschild_Hoffmann.jpg',
    'reviewed', 'admin'
  ),
  (
    'cccccccc-4444-0001-0000-000000000005',
    'aaaaaaaa-4444-4444-4444-444444444444',
    'Eigentumsnachweis_Hoffmann.pdf',
    'owner_proof',
    'demo/hoffmann/Eigentumsnachweis_Hoffmann.pdf',
    'reviewed', 'admin'
  ),
  (
    'cccccccc-4444-0001-0000-000000000006',
    'aaaaaaaa-4444-4444-4444-444444444444',
    'KfW_Foerderzusage_Hoffmann.pdf',
    'kfw_approval',
    'demo/hoffmann/KfW_Foerderzusage_Hoffmann.pdf',
    'reviewed', 'admin'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_checks (
  id, case_id, check_type, provider, model, status,
  result_json, summary, risk_level, confidence,
  human_review_status, reviewed_by, reviewed_at,
  rule_version, disclaimer
) VALUES
  (
    'dddddddd-4444-0001-0000-000000000001',
    'aaaaaaaa-4444-4444-4444-444444444444',
    'offer_check',
    'anthropic', 'claude-sonnet-4-6', 'completed',
    '{
      "assessment": "pass",
      "summary_de": "Angebot vollständig und KfW-konform. JAZ 3,9 und hydraulischer Abgleich sind angegeben.",
      "key_findings": [
        "JAZ 3,9 – über Mindestanforderung",
        "Hydraulischer Abgleich Methode B enthalten",
        "Keine problematischen Vorauszahlungsklauseln"
      ],
      "recommended_next_steps": ["Umsetzung gemäß Plan starten"]
    }',
    'Angebotsprüfung: Plausibel – alle KfW-Anforderungen erfüllt.',
    'green', 'high',
    'approved', 'admin', NOW() - INTERVAL ''3 weeks'',
    'v1.0',
    'KI-gestützte Vorprüfung. Kein Ersatz für fachliche Beratung. Keine Fördergarantie.'
  ),
  (
    'dddddddd-4444-0001-0000-000000000002',
    'aaaaaaaa-4444-4444-4444-444444444444',
    'contract_check',
    'anthropic', 'claude-sonnet-4-6', 'completed',
    '{
      "assessment": "pass",
      "summary_de": "Vertrag mit gültigem Fördervorbehalt. KfW-konform.",
      "key_findings": [
        "Fördervorbehalt vorhanden",
        "Zahlungsplan KfW-konform",
        "Kein vorzeitiger Maßnahmenbeginn vereinbart"
      ],
      "recommended_next_steps": ["Umsetzung gemäß Plan starten"]
    }',
    'Vertragsprüfung: Fördervorbehalt plausibel – KfW-geeignet.',
    'green', 'high',
    'approved', 'admin', NOW() - INTERVAL ''3 weeks'',
    'v1.0',
    'KI-gestützte Vorprüfung. Kein Ersatz für fachliche Beratung. Keine Fördergarantie.'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (id, funding_case_id, title, description, priority, completed)
VALUES
  (
    'bbbbbbbb-4444-0001-0000-000000000001',
    'aaaaaaaa-4444-4444-4444-444444444444',
    'Umsetzung starten – Wärmepumpe einbauen lassen',
    'KfW-Förderzusage liegt vor. Maßnahme darf jetzt beginnen.',
    'high', false
  ),
  (
    'bbbbbbbb-4444-0001-0000-000000000002',
    'aaaaaaaa-4444-4444-4444-444444444444',
    'BnD-Nachweis beim Fachbetrieb anfordern',
    'Nach Einbau: Bestätigung des Fachunternehmens (BnD) für Nachweiseinreichung benötigt.',
    'normal', false
  ),
  (
    'bbbbbbbb-4444-0001-0000-000000000003',
    'aaaaaaaa-4444-4444-4444-444444444444',
    'Rechnung nach Einbau hochladen',
    'Rechnung des Fachbetriebs nach erfolgtem Einbau als Nachweis hochladen.',
    'normal', false
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
