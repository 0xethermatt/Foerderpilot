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
