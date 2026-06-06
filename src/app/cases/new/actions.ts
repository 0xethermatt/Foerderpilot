'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service-client';
import { isServiceRoleConfigured } from '@/lib/supabase/safe-client';

// Dev fallback — matches the UUID in supabase/seed.sql
const DEV_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? '00000000-0000-0000-0000-000000000001';

// ─── Validation schema ────────────────────────────────────────────────────────

function toOptionalInt(val: unknown) {
  if (val === '' || val === undefined || val === null) return undefined;
  const n = parseInt(String(val), 10);
  return isNaN(n) ? undefined : n;
}

function toOptionalFloat(val: unknown) {
  if (val === '' || val === undefined || val === null) return undefined;
  const n = parseFloat(String(val));
  return isNaN(n) ? undefined : n;
}

const schema = z.object({
  // Customer
  first_name: z.string().min(1, 'Pflichtfeld'),
  last_name: z.string().min(1, 'Pflichtfeld'),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  phone: z.string().optional(),
  street: z.string().min(1, 'Pflichtfeld'),
  postal_code: z
    .string()
    .regex(/^\d{5}$/, 'Bitte 5-stellige PLZ eingeben'),
  city: z.string().min(1, 'Pflichtfeld'),

  // Project address
  project_address_street: z.string().min(1, 'Pflichtfeld'),
  project_address_postal_code: z
    .string()
    .regex(/^\d{5}$/, 'Bitte 5-stellige PLZ eingeben'),
  project_address_city: z.string().min(1, 'Pflichtfeld'),

  // Building
  building_type: z.enum(['EFH', 'MFH', 'DHH', 'RH', 'WHG'], {
    errorMap: () => ({ message: 'Bitte Gebäudetyp auswählen' }),
  }),
  housing_units: z.preprocess(
    (v) => (v === '' ? undefined : parseInt(String(v), 10)),
    z.number({ invalid_type_error: 'Bitte Zahl eingeben' }).int().min(1, 'Mindestens 1'),
  ),
  owner_status: z.enum(['owner', 'owner_community', 'other'], {
    errorMap: () => ({ message: 'Bitte Eigentümerstatus auswählen' }),
  }),
  self_occupied: z.preprocess((v) => v === 'true', z.boolean()),

  // Current heating
  current_heating_type: z.enum(
    ['gas', 'oil', 'electric', 'district_heat', 'heat_pump', 'pellet', 'other'],
    { errorMap: () => ({ message: 'Bitte Heizungstyp auswählen' }) },
  ),
  current_heating_year: z.preprocess(
    toOptionalInt,
    z
      .number()
      .int()
      .min(1900, 'Ungültiges Jahr')
      .max(2030, 'Ungültiges Jahr')
      .optional(),
  ),

  // Planned heating
  planned_heating_type: z.enum(['air_water', 'brine_water', 'water_water'], {
    errorMap: () => ({ message: 'Bitte Wärmepumpentyp auswählen' }),
  }),
  planned_heat_pump_model: z.string().optional(),

  // Cost & notes
  estimated_total_cost: z.preprocess(
    toOptionalFloat,
    z.number().positive('Muss größer 0 sein').optional(),
  ),
  notes: z.string().optional(),
});

// ─── Action state type ────────────────────────────────────────────────────────

export type CreateCaseState = {
  fieldErrors?: Partial<Record<string, string[]>>;
  message?: string;
} | null;

// ─── Server action ────────────────────────────────────────────────────────────

export async function createFundingCaseAction(
  _prevState: CreateCaseState,
  formData: FormData,
): Promise<CreateCaseState> {
  // Guard: service role not configured
  if (!isServiceRoleConfigured()) {
    return {
      message:
        'Datenbankzugang nicht konfiguriert. Bitte .env.local mit NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY befüllen.',
    };
  }

  // Normalize empty strings for optional fields
  const raw = Object.fromEntries(formData.entries());
  const normalized = {
    ...raw,
    phone: raw.phone || undefined,
    current_heating_year: raw.current_heating_year || undefined,
    planned_heat_pump_model: raw.planned_heat_pump_model || undefined,
    estimated_total_cost: raw.estimated_total_cost || undefined,
    notes: raw.notes || undefined,
  };

  const parsed = schema.safeParse(normalized);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const d = parsed.data;
  const supabase = createServiceClient();

  // 1. Create customer
  const { data: customer, error: customerErr } = await supabase
    .from('customers')
    .insert({
      company_id: DEV_COMPANY_ID,
      first_name: d.first_name,
      last_name: d.last_name,
      email: d.email,
      phone: d.phone ?? null,
      street: d.street,
      postal_code: d.postal_code,
      city: d.city,
    })
    .select()
    .single();

  if (customerErr || !customer) {
    return {
      message: `Fehler beim Anlegen des Kunden: ${customerErr?.message ?? 'Unbekannter Fehler'}`,
    };
  }

  // 2. Create funding case
  const title = `WP ${d.project_address_street}, ${d.project_address_city}`;

  const { data: fundingCase, error: caseErr } = await supabase
    .from('funding_cases')
    .insert({
      company_id: DEV_COMPANY_ID,
      customer_id: customer.id,
      title,
      status: 'lead_received',
      risk_level: 'yellow',
      project_address_street: d.project_address_street,
      project_address_postal_code: d.project_address_postal_code,
      project_address_city: d.project_address_city,
      building_type: d.building_type,
      housing_units: d.housing_units,
      owner_status: d.owner_status,
      self_occupied: d.self_occupied,
      current_heating_type: d.current_heating_type,
      current_heating_year: d.current_heating_year ?? null,
      planned_heating_type: d.planned_heating_type,
      planned_heat_pump_model: d.planned_heat_pump_model ?? null,
      estimated_cost: d.estimated_total_cost ?? null,
      notes: d.notes ?? null,
    })
    .select()
    .single();

  if (caseErr || !fundingCase) {
    return {
      message: `Fehler beim Anlegen des Förderfalls: ${caseErr?.message ?? 'Unbekannter Fehler'}`,
    };
  }

  redirect(`/cases/${fundingCase.id}`);
}
