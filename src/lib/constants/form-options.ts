export const BUILDING_TYPE_OPTIONS = [
  { value: 'EFH', label: 'Einfamilienhaus' },
  { value: 'DHH', label: 'Doppelhaushälfte' },
  { value: 'RH', label: 'Reihenhaus' },
  { value: 'MFH', label: 'Mehrfamilienhaus' },
  { value: 'WHG', label: 'Eigentumswohnung' },
] as const;

export const OWNER_STATUS_OPTIONS = [
  { value: 'owner', label: 'Eigentümer' },
  { value: 'owner_community', label: 'Eigentümergemeinschaft' },
  { value: 'other', label: 'Sonstiges' },
] as const;

export const CURRENT_HEATING_TYPE_OPTIONS = [
  { value: 'gas', label: 'Gasheizung' },
  { value: 'oil', label: 'Ölheizung' },
  { value: 'electric', label: 'Elektroheizung' },
  { value: 'district_heat', label: 'Fernwärme' },
  { value: 'heat_pump', label: 'Wärmepumpe (bestehend)' },
  { value: 'pellet', label: 'Pelletsheizung' },
  { value: 'other', label: 'Sonstiges' },
] as const;

export const PLANNED_HEATING_TYPE_OPTIONS = [
  { value: 'air_water', label: 'Luft-Wasser-Wärmepumpe' },
  { value: 'brine_water', label: 'Sole-Wasser-Wärmepumpe' },
  { value: 'water_water', label: 'Wasser-Wasser-Wärmepumpe' },
] as const;

export const BUILDING_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  BUILDING_TYPE_OPTIONS.map(({ value, label }) => [value, label]),
);

export const OWNER_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  OWNER_STATUS_OPTIONS.map(({ value, label }) => [value, label]),
);

export const CURRENT_HEATING_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  CURRENT_HEATING_TYPE_OPTIONS.map(({ value, label }) => [value, label]),
);

export const PLANNED_HEATING_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PLANNED_HEATING_TYPE_OPTIONS.map(({ value, label }) => [value, label]),
);

export const STATUS_OPTIONS = [
  { value: 'lead_received',           label: 'Lead erhalten' },
  { value: 'data_missing',            label: 'Daten fehlen' },
  { value: 'funding_check_done',      label: 'Förderprüfung erledigt' },
  { value: 'offer_created',           label: 'Angebot erstellt' },
  { value: 'contract_review_needed',  label: 'Vertragsprüfung nötig' },
  { value: 'contract_signed',         label: 'Vertrag unterzeichnet' },
  { value: 'bza_prepared',            label: 'BZA vorbereitet' },
  { value: 'application_submitted',   label: 'Antrag gestellt' },
  { value: 'approval_received',       label: 'Genehmigung erhalten' },
  { value: 'execution_released',      label: 'Ausführung freigegeben' },
  { value: 'proof_documents_pending', label: 'Nachweise ausstehend' },
  { value: 'proof_submitted',         label: 'Nachweise eingereicht' },
  { value: 'completed',               label: 'Abgeschlossen' },
] as const;

export const RISK_LEVEL_OPTIONS = [
  { value: 'green',  label: 'Grün' },
  { value: 'yellow', label: 'Gelb' },
  { value: 'red',    label: 'Rot' },
] as const;

export const DOCUMENT_TYPE_OPTIONS = [
  { value: 'offer',                  label: 'Angebot' },
  { value: 'contract',               label: 'Vertrag' },
  { value: 'old_heating_photo',      label: 'Foto Altanlage' },
  { value: 'old_heating_nameplate',  label: 'Typenschild Altanlage' },
  { value: 'owner_proof',            label: 'Eigentumsnachweis' },
  { value: 'bza',                    label: 'BZA' },
  { value: 'kfw_approval',           label: 'KfW-Bewilligung' },
  { value: 'invoice',                label: 'Rechnung' },
  { value: 'bnd',                    label: 'BND' },
  { value: 'other',                  label: 'Sonstiges' },
] as const;

export const DOCUMENT_STATUS_OPTIONS = [
  { value: 'uploaded',      label: 'Hochgeladen' },
  { value: 'needs_review',  label: 'Prüfung ausstehend' },
  { value: 'reviewed',      label: 'Geprüft' },
  { value: 'missing',       label: 'Fehlend' },
  { value: 'rejected',      label: 'Abgelehnt' },
] as const;

export const DOCUMENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DOCUMENT_TYPE_OPTIONS.map(({ value, label }) => [value, label]),
);

export const DOCUMENT_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  DOCUMENT_STATUS_OPTIONS.map(({ value, label }) => [value, label]),
);
