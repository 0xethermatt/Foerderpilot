'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import { createFundingCaseAction, type CreateCaseState } from './actions';
import {
  BUILDING_TYPE_OPTIONS,
  OWNER_STATUS_OPTIONS,
  CURRENT_HEATING_TYPE_OPTIONS,
  PLANNED_HEATING_TYPE_OPTIONS,
} from '@/lib/constants/form-options';

// ─── Test data presets (dev/test only) ────────────────────────────────────────

type PresetData = Record<string, string>;

interface TestPreset {
  id: string;
  label: string;
  data: PresetData;
}

const TEST_PRESETS: TestPreset[] = [
  {
    id: 'standard',
    label: 'Guter Standardfall',
    data: {
      first_name: 'Max',
      last_name: 'Mustermann',
      email: 'max.mustermann@example.test',
      phone: '+4915112345678',
      street: 'Birkenweg 7',
      postal_code: '54321',
      city: 'Testdorf',
      project_address_street: 'Birkenweg 7',
      project_address_postal_code: '54321',
      project_address_city: 'Testdorf',
      building_type: 'EFH',
      housing_units: '1',
      owner_status: 'owner',
      self_occupied: 'true',
      current_heating_type: 'oil',
      current_heating_year: '1999',
      planned_heating_type: 'air_water',
      planned_heat_pump_model: 'Viessmann Vitocal 250-A',
      estimated_total_cost: '28000',
      notes: 'Testfall: guter Standardfall mit vollständigen Unterlagen.',
    },
  },
  {
    id: 'incomplete',
    label: 'Unvollständiger Fall',
    data: {
      first_name: 'Erika',
      last_name: 'Musterfrau',
      email: 'erika.musterfrau@example.test',
      phone: '+4915223456789',
      street: 'Testgasse 3',
      postal_code: '99998',
      city: 'Beispieldorf',
      project_address_street: 'Testgasse 3',
      project_address_postal_code: '99998',
      project_address_city: 'Beispieldorf',
      building_type: 'EFH',
      housing_units: '1',
      owner_status: 'owner',
      self_occupied: 'true',
      current_heating_type: 'oil',
      current_heating_year: '2002',
      planned_heating_type: 'air_water',
      planned_heat_pump_model: 'Wärmepumpe ca. 10 kW',
      estimated_total_cost: '19635',
      notes: 'Testfall: unvollständiges Angebot, fehlende Dokumente und unklare Modellangaben.',
    },
  },
  {
    id: 'contract_risk',
    label: 'Kritischer Vertragsfall',
    data: {
      first_name: 'Hans-Peter',
      last_name: 'Mustermeier',
      email: 'hans-peter.mustermeier@example.test',
      phone: '+4915334567890',
      street: 'Hauptstraße 22',
      postal_code: '77777',
      city: 'Testheim',
      project_address_street: 'Hauptstraße 22',
      project_address_postal_code: '77777',
      project_address_city: 'Testheim',
      building_type: 'EFH',
      housing_units: '1',
      owner_status: 'owner',
      self_occupied: 'true',
      current_heating_type: 'oil',
      current_heating_year: '2005',
      planned_heating_type: 'air_water',
      planned_heat_pump_model: 'Stiebel Eltron WPL 15 AC',
      estimated_total_cost: '16800',
      notes: 'Testfall: Vertrag enthält problematische Klausel zum vorzeitigen Beginn.',
    },
  },
  {
    id: 'post_approval',
    label: 'Nach-Zusage-Testfall',
    data: {
      first_name: 'Claudia',
      last_name: 'Beispiel',
      email: 'claudia.beispiel@example.test',
      phone: '+4915445678901',
      street: 'Förderweg 12',
      postal_code: '88888',
      city: 'Zuschussstadt',
      project_address_street: 'Förderweg 12',
      project_address_postal_code: '88888',
      project_address_city: 'Zuschussstadt',
      building_type: 'EFH',
      housing_units: '1',
      owner_status: 'owner',
      self_occupied: 'true',
      current_heating_type: 'gas',
      current_heating_year: '2001',
      planned_heating_type: 'air_water',
      planned_heat_pump_model: 'Vaillant aroTHERM plus',
      estimated_total_cost: '31500',
      notes: 'Testfall: später für KfW-Zusage, Rechnung und BND-Nachweise verwenden.',
    },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls = (err?: string[]) =>
  `block w-full rounded-md border px-3 py-2 text-sm shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 dark:disabled:text-gray-500 ${
    err?.length
      ? 'border-red-300 dark:border-red-700 focus:ring-red-500 focus:border-red-500'
      : 'border-gray-300 dark:border-gray-500 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400'
  }`;

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5" aria-hidden>*</span>}
      </label>
      {children}
      {error?.[0] && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error[0]}</p>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-800 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 pb-2 border-b border-gray-100 dark:border-gray-800">
        {title}
      </h2>
      {children}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded-md bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm font-medium text-white dark:text-gray-900 shadow-sm hover:bg-gray-700 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 dark:focus:ring-offset-gray-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? 'Wird gespeichert…' : 'Förderfall anlegen'}
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewCaseForm() {
  const [state, formAction] = useFormState<CreateCaseState, FormData>(
    createFundingCaseAction,
    null,
  );
  const fe = state?.fieldErrors ?? {};

  const formRef = useRef<HTMLFormElement>(null);
  const [selectedPresetId, setSelectedPresetId] = useState('random');
  const [filledLabel, setFilledLabel] = useState<string | null>(null);

  function applyPreset(presetId: string) {
    const form = formRef.current;
    if (!form) return;

    const preset =
      presetId === 'random'
        ? TEST_PRESETS[Math.floor(Math.random() * TEST_PRESETS.length)]
        : (TEST_PRESETS.find((p) => p.id === presetId) ?? TEST_PRESETS[0]);

    for (const [name, value] of Object.entries(preset.data)) {
      const el = form.elements.namedItem(name) as
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement
        | null;
      if (el) el.value = value;
    }

    setFilledLabel(preset.label);
  }

  const IS_DEV = process.env.NODE_ENV !== 'production';

  return (
    <form ref={formRef} action={formAction} className="space-y-6" noValidate>
      {/* Top-level error banner */}
      {state?.message && (
        <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-300">{state.message}</p>
        </div>
      )}

      {/* ── Test data helper (dev only) ────────────────────────────────── */}
      {IS_DEV && (
        <div className="rounded-lg border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Testdaten-Hilfe
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-500 ml-1">
              · Nur für die lokale Testphase – keine echten Kundendaten.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedPresetId}
              onChange={(e) => setSelectedPresetId(e.target.value)}
              className="rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              <option value="random">Zufällig</option>
              {TEST_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => applyPreset(selectedPresetId)}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors"
            >
              <FlaskConical className="h-3 w-3" />
              Testdaten einfügen
            </button>
            {filledLabel && (
              <span className="text-xs text-amber-700 dark:text-amber-400">
                ✓ Testdaten eingefügt: <strong>{filledLabel}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── 1. Kundendaten ─────────────────────────────────────────────── */}
      <Section title="1. Kundendaten">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Vorname" required error={fe.first_name}>
            <input
              name="first_name"
              type="text"
              autoComplete="given-name"
              className={inputCls(fe.first_name)}
            />
          </Field>
          <Field label="Nachname" required error={fe.last_name}>
            <input
              name="last_name"
              type="text"
              autoComplete="family-name"
              className={inputCls(fe.last_name)}
            />
          </Field>
          <Field label="E-Mail" required error={fe.email}>
            <input
              name="email"
              type="email"
              autoComplete="email"
              className={inputCls(fe.email)}
            />
          </Field>
          <Field label="Telefon" error={fe.phone}>
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              className={inputCls(fe.phone)}
            />
          </Field>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">Rechnungsadresse des Kunden</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <Field label="Straße und Hausnummer" required error={fe.street}>
              <input
                name="street"
                type="text"
                autoComplete="street-address"
                className={inputCls(fe.street)}
              />
            </Field>
          </div>
          <Field label="PLZ" required error={fe.postal_code}>
            <input
              name="postal_code"
              type="text"
              maxLength={5}
              inputMode="numeric"
              autoComplete="postal-code"
              className={inputCls(fe.postal_code)}
            />
          </Field>
        </div>
        <Field label="Ort" required error={fe.city}>
          <input
            name="city"
            type="text"
            autoComplete="address-level2"
            className={inputCls(fe.city)}
          />
        </Field>
      </Section>

      {/* ── 2. Projektadresse ──────────────────────────────────────────── */}
      <Section title="2. Projektadresse (Einbauort)">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <Field
              label="Straße und Hausnummer"
              required
              error={fe.project_address_street}
            >
              <input
                name="project_address_street"
                type="text"
                className={inputCls(fe.project_address_street)}
              />
            </Field>
          </div>
          <Field label="PLZ" required error={fe.project_address_postal_code}>
            <input
              name="project_address_postal_code"
              type="text"
              maxLength={5}
              inputMode="numeric"
              className={inputCls(fe.project_address_postal_code)}
            />
          </Field>
        </div>
        <Field label="Ort" required error={fe.project_address_city}>
          <input
            name="project_address_city"
            type="text"
            className={inputCls(fe.project_address_city)}
          />
        </Field>
      </Section>

      {/* ── 3. Gebäudedaten ────────────────────────────────────────────── */}
      <Section title="3. Gebäudedaten">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Gebäudetyp" required error={fe.building_type}>
            <select name="building_type" defaultValue="" className={inputCls(fe.building_type)}>
              <option value="" disabled>Bitte wählen…</option>
              {BUILDING_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Anzahl Wohneinheiten" required error={fe.housing_units}>
            <input
              name="housing_units"
              type="number"
              min={1}
              max={100}
              defaultValue={1}
              className={inputCls(fe.housing_units)}
            />
          </Field>
          <Field label="Eigentümerstatus" required error={fe.owner_status}>
            <select name="owner_status" defaultValue="" className={inputCls(fe.owner_status)}>
              <option value="" disabled>Bitte wählen…</option>
              {OWNER_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Selbst bewohnt" required error={fe.self_occupied}>
            <select name="self_occupied" defaultValue="true" className={inputCls(fe.self_occupied)}>
              <option value="true">Ja</option>
              <option value="false">Nein</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* ── 4. Bestehende Heizung ──────────────────────────────────────── */}
      <Section title="4. Bestehende Heizung">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Heizungstyp" required error={fe.current_heating_type}>
            <select
              name="current_heating_type"
              defaultValue=""
              className={inputCls(fe.current_heating_type)}
            >
              <option value="" disabled>Bitte wählen…</option>
              {CURRENT_HEATING_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Baujahr Heizanlage (optional)"
            error={fe.current_heating_year}
          >
            <input
              name="current_heating_year"
              type="number"
              min={1900}
              max={2030}
              placeholder="z. B. 2005"
              className={inputCls(fe.current_heating_year)}
            />
          </Field>
        </div>
      </Section>

      {/* ── 5. Geplante Anlage ─────────────────────────────────────────── */}
      <Section title="5. Geplante Wärmepumpe & Kosten">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Wärmepumpentyp" required error={fe.planned_heating_type}>
            <select
              name="planned_heating_type"
              defaultValue=""
              className={inputCls(fe.planned_heating_type)}
            >
              <option value="" disabled>Bitte wählen…</option>
              {PLANNED_HEATING_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Gerätemodell (optional)" error={fe.planned_heat_pump_model}>
            <input
              name="planned_heat_pump_model"
              type="text"
              placeholder="z. B. Viessmann Vitocal 250-A"
              className={inputCls(fe.planned_heat_pump_model)}
            />
          </Field>
          <Field
            label="Geschätzte Gesamtkosten (€, optional)"
            error={fe.estimated_total_cost}
          >
            <input
              name="estimated_total_cost"
              type="number"
              min={0}
              step={100}
              placeholder="z. B. 28000"
              className={inputCls(fe.estimated_total_cost)}
            />
          </Field>
        </div>

        <Field label="Notizen (optional)" error={fe.notes}>
          <textarea
            name="notes"
            rows={3}
            placeholder="Besonderheiten, Absprachen, offene Punkte…"
            className={`${inputCls(fe.notes)} resize-none`}
          />
        </Field>
      </Section>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          <span className="text-red-500">*</span> Pflichtfeld
        </p>
        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors"
          >
            Abbrechen
          </Link>
          <SubmitButton />
        </div>
      </div>
    </form>
  );
}
