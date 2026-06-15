import type { FundingCaseExportData, DocumentExportRow, AICheckExportSummary, TaskExportRow } from './funding-case-export';

export type ExportVariant = 'internal' | 'customer' | 'handover';

export interface ExportOptions {
  variant: ExportVariant;
  include_ai_details: boolean;
  include_completed_tasks: boolean;
  include_disclaimers: boolean;
}

export const DEFAULT_OPTIONS: ExportOptions = {
  variant:                  'internal',
  include_ai_details:       true,
  include_completed_tasks:  false,
  include_disclaimers:      true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function line(label: string, value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === '') return `- **${label}:** –`;
  if (typeof value === 'boolean') return `- **${label}:** ${value ? 'Ja' : 'Nein'}`;
  return `- **${label}:** ${value}`;
}

function tableRow(cells: string[]): string {
  return '| ' + cells.map((c) => (c || '–').replace(/\|/g, '｜')).join(' | ') + ' |';
}

function docStatusEmoji(row: DocumentExportRow): string {
  if (row.rejected)           return '❌ Abgelehnt';
  if (row.reviewed)           return '✅ Geprüft';
  if (row.status_label === 'Fehlend')  return '⬜ Fehlend';
  return '⏳ ' + row.status_label;
}

function riskEmoji(risk: string): string {
  if (risk.startsWith('Grün')) return '🟢';
  if (risk.startsWith('Gelb')) return '🟡';
  if (risk.startsWith('Rot'))  return '🔴';
  return '⚪';
}

function aiCheckSection(check: AICheckExportSummary | null, title: string): string {
  if (!check) return `### ${title}\n\n_Keine abgeschlossene Prüfung vorhanden._\n`;

  const lines: string[] = [
    `### ${title}`,
    '',
    `${riskEmoji(check.risk_label)} **Ergebnis:** ${check.result_label} | **Risiko:** ${check.risk_label} | **Konfidenz:** ${check.confidence ?? '–'}`,
    '',
    `**Human Review:** ${check.human_review_status} | **Erstellt am:** ${check.created_at} | Modell: ${check.model ?? '–'}`,
    '',
    `> ⚠️ Automatische Vorprüfung – keine Rechts- oder Förderberatung. Manuelle Prüfung erforderlich.`,
    '',
    `**Kurzfassung:**`,
    check.summary_de || '–',
  ];

  if (check.key_findings.length > 0) {
    lines.push('', '**Wesentliche Hinweise:**');
    for (const f of check.key_findings) lines.push(`- ${f}`);
  }

  if (check.recommended_next_steps.length > 0) {
    lines.push('', '**Empfohlene nächste Schritte:**');
    for (const s of check.recommended_next_steps) lines.push(`- ${s}`);
  }

  lines.push('');
  return lines.join('\n');
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildDocTable(rows: DocumentExportRow[]): string {
  if (rows.length === 0) return '_Keine Unterlagen in dieser Phase._\n';
  const lines = [
    tableRow(['Unterlage', 'Datei', 'Status', 'Hochgeladen']),
    tableRow(['---', '---', '---', '---']),
    ...rows.map((r) =>
      tableRow([r.type_label, r.filename ?? '–', docStatusEmoji(r), r.uploaded_at ?? '–']),
    ),
  ];
  return lines.join('\n') + '\n';
}

function buildNextStepsSection(data: FundingCaseExportData, variant: ExportVariant): string {
  const steps: string[] = [];
  const { blockers, warnings, case_summary, bza, kfw_application, implementation_and_proofs } = data;
  const payout = implementation_and_proofs.payout_status;
  const proof  = implementation_and_proofs.proof_submission_status;
  const impl   = implementation_and_proofs.implementation_status;

  if (payout === 'Eingegangen') {
    steps.push('Fall archivieren – Auszahlung bestätigt');
  } else if (proof === 'Eingereicht') {
    steps.push('Auf KfW-Auszahlung warten');
  } else if (proof === 'Vorbereitet') {
    if (variant === 'customer') {
      steps.push('Nachweise in „Meine KfW" hochladen und einreichen (Rechnung + BnD)');
    } else {
      steps.push('Kunden anweisen, Nachweise in „Meine KfW" einzureichen');
    }
  } else if (data.documents.after_implementation.some((d) => !d.reviewed && !d.rejected)) {
    steps.push('Rechnung und BnD hochladen und prüfen');
  } else if (impl === 'Abgeschlossen' && !implementation_and_proofs.bnd_id) {
    steps.push('BnD-ID eintragen');
    steps.push('Nachweise intern vorbereiten');
  } else if (impl === 'Gestartet') {
    steps.push('Umsetzung abwarten');
    steps.push('BnD beim Fachunternehmen anfordern');
  } else if (kfw_application.approval_received) {
    steps.push('Umsetzung durch Fachunternehmen starten');
    if (!data.documents.after_implementation.every((d) => d.reviewed)) {
      steps.push('Rechnung und BnD anfordern');
    }
  } else if (kfw_application.customer_submitted) {
    steps.push('Auf KfW-Förderzusage warten');
    if (variant !== 'customer') steps.push('Kein Vorhabenbeginn vor schriftlicher KfW-Förderzusage');
  } else if (kfw_application.status === 'Vorbereitet') {
    steps.push('Kundenanweisung senden');
    if (variant === 'customer') {
      steps.push('Antrag in „Meine KfW" einreichen – bitte nicht selbst beginnen');
    } else {
      steps.push('Kunden anweisen, Antrag in „Meine KfW" einzureichen');
    }
  } else if (bza.bza_status === 'Erstellt') {
    if (!bza.bza_id) {
      steps.push('BzA-ID eintragen (15-stellig)');
    } else {
      steps.push('KfW-Antrag intern vorbereiten');
    }
  } else if (bza.bza_status === 'Angefordert') {
    steps.push('BzA-ID vom Fachunternehmen eintragen sobald vorhanden');
  } else {
    if (blockers.length > 0) {
      for (const b of blockers) steps.push(b);
    }
    if (warnings.some((w) => w.includes('Prüfung'))) {
      steps.push('Unterlagen prüfen und freigeben');
    }
    if (blockers.length === 0 && !warnings.some((w) => w.includes('Prüfung'))) {
      steps.push('BzA beim Fachunternehmen anfordern');
    }
  }

  if (steps.length === 0) steps.push(case_summary.next_action);

  return steps.map((s) => `- ${s}`).join('\n') + '\n';
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export function renderFundingCaseMarkdown(
  data: FundingCaseExportData,
  opts: ExportOptions = DEFAULT_OPTIONS,
): string {
  const { variant, include_ai_details, include_completed_tasks, include_disclaimers } = opts;
  const sections: string[] = [];

  // ── Header ──
  const variantLabel = variant === 'internal' ? 'Interner Export' : variant === 'customer' ? 'Kundenzusammenfassung' : 'Fachbetrieb/BzA-Übergabe';
  sections.push(`# Förderakte: ${data.case_summary.title}`);
  sections.push([
    '',
    `**Erstellt am:** ${data.generated_at}  `,
    `**Exporttyp:** ${variantLabel} | Förderpilot  `,
    variant === 'internal' ? '> ⚠️ Interne Arbeitsunterlage – nicht für Kunden bestimmt' : '',
    '',
    '---',
  ].filter((l) => l !== '').join('\n'));

  if (include_disclaimers) {
    sections.push([
      '> **Hinweis:** Keine Fördergarantie. Keine automatische Antragstellung.',
      '> Keine automatische Nachweiseinreichung. Manuelle Prüfung erforderlich.',
      variant === 'customer'
        ? '> Sie stellen den Antrag selbst im Portal „Meine KfW". Bitte nicht mit der Maßnahme beginnen, bevor die schriftliche KfW-Förderzusage vorliegt.'
        : '',
    ].filter(Boolean).join('\n'));
  }

  // ── 1. Kurzstatus ──
  sections.push('## 1. Kurzstatus\n');
  sections.push([
    line('Kunde',              data.case_summary.customer_name),
    line('Objekt',             data.case_summary.project_address),
    line('Status',             data.case_summary.status),
    line('Risiko',             data.case_summary.risk_level),
    line('Antragsbereitschaft', data.case_summary.readiness_label),
    line('Aktueller Schritt',  data.case_summary.current_workflow_step),
    line('Nächste Aktion',     data.case_summary.next_action),
  ].join('\n'));

  // ── 2. Kunde & Objekt (skip customer detail in handover) ──
  if (variant !== 'handover') {
    sections.push('## 2. Kunde & Objekt\n');
    sections.push([
      line('Name',             data.customer.name),
      line('E-Mail',           data.customer.email),
      line('Telefon',          data.customer.phone),
      line('Rechnungsadresse', data.customer.billing_address),
      line('Projektadresse',   data.customer.project_address),
      line('Gebäudetyp',       data.building.building_type),
      line('Wohneinheiten',    data.building.residential_units),
      line('Eigentümer',       data.building.owner_type),
      line('Selbst bewohnt',   data.building.owner_occupied),
    ].join('\n'));
  }

  // ── 3. Heizungsdaten (skip in customer variant) ──
  if (variant !== 'customer') {
    sections.push('## 3. Heizungsdaten\n');
    sections.push([
      line('Bestehende Heizung',  data.heating.existing_heating_type),
      line('Baujahr Heizung',     data.heating.existing_heating_year),
      line('Geplante Wärmepumpe', data.heating.planned_heat_pump_type),
      line('Modell',              data.heating.planned_model),
      line('Geschätzte Kosten',   data.heating.estimated_costs),
    ].join('\n'));
  }

  // ── 4. Unterlagenstatus ──
  sections.push('## 4. Unterlagenstatus\n');

  sections.push('### Vor Antragstellung\n');
  sections.push(buildDocTable(data.documents.before_application));

  if (variant !== 'customer') {
    sections.push('### Nach Förderzusage\n');
    sections.push(buildDocTable(data.documents.after_approval));

    sections.push('### Nach Umsetzung\n');
    sections.push(buildDocTable(data.documents.after_implementation));
  }

  // ── 5. KI-Prüfungen (internal only, with option) ──
  if (include_ai_details && variant === 'internal') {
    sections.push('## 5. KI-Prüfungen\n');
    sections.push(aiCheckSection(data.ai_checks.funding_precheck_latest, 'KI-Fördercheck'));
    sections.push(aiCheckSection(data.ai_checks.contract_check_latest,   'Vertragsprüfung (KI)'));
    sections.push(aiCheckSection(data.ai_checks.offer_check_latest,      'Angebotsprüfung (KI)'));
  }

  // ── 6. BzA & KfW-Antrag ──
  const secNum = include_ai_details && variant === 'internal' ? 6 : 5;
  sections.push(`## ${secNum}. BzA & KfW-Antragsvorbereitung\n`);
  sections.push([
    line('BzA-Verantwortlicher',    data.bza.responsible_party),
    line('BzA-Status',              data.bza.bza_status),
    line('BzA-ID',                  data.bza.bza_id),
    line('BzA erstellt am',         data.bza.bza_created_at),
    line('BzA-Dokument',            data.bza.bza_document_status),
    '',
    line('KfW-Antragsstatus',       data.kfw_application.status),
    line('Vorbereitet am',          data.kfw_application.prepared_at),
    line('Interne Referenz',        data.kfw_application.reference),
    line('Antrag durch Kunden gestellt', data.kfw_application.customer_submitted),
    line('KfW-Förderzusage erhalten', data.kfw_application.approval_received),
    line('KfW-Bewilligung (Dokument)', data.kfw_application.approval_document_status),
  ].join('\n'));

  if (variant !== 'handover') {
    // ── 7. Umsetzung & Nachweise ──
    sections.push(`## ${secNum + 1}. Umsetzung & Nachweise\n`);
    sections.push([
      line('Umsetzung',             data.implementation_and_proofs.implementation_status),
      line('Gestartet am',          data.implementation_and_proofs.implementation_started_at),
      line('Abgeschlossen am',      data.implementation_and_proofs.implementation_completed_at),
      line('Rechnung (Dokument)',   data.implementation_and_proofs.invoice_status),
      line('BnD-ID',               data.implementation_and_proofs.bnd_id),
      line('BnD erstellt am',      data.implementation_and_proofs.bnd_created_at),
      line('BnD (Dokument)',        data.implementation_and_proofs.bnd_document_status),
      line('Nachweiseinreichung',  data.implementation_and_proofs.proof_submission_status),
      line('Eingereicht am',       data.implementation_and_proofs.proof_submitted_at),
      line('Auszahlung',           data.implementation_and_proofs.payout_status),
    ].join('\n'));

    // ── 8. Offene Aufgaben ──
    if (variant === 'internal' && data.open_tasks.length > 0) {
      sections.push(`## ${secNum + 2}. Offene Aufgaben\n`);
      const taskLines = [
        tableRow(['Aufgabe', 'Priorität', 'Fällig', 'Status']),
        tableRow(['---', '---', '---', '---']),
        ...data.open_tasks.map((t: TaskExportRow) =>
          tableRow([t.title, t.priority, t.due_date ?? '–', 'Offen']),
        ),
      ];
      if (include_completed_tasks && data.completed_tasks.length > 0) {
        taskLines.push(
          ...data.completed_tasks.map((t: TaskExportRow) =>
            tableRow([`~~${t.title}~~`, t.priority, t.due_date ?? '–', '✅ Erledigt']),
          ),
        );
      }
      sections.push(taskLines.join('\n') + '\n');
    }
  }

  // ── 9. Offene Punkte ──
  const hasCritical = data.blockers.length > 0 || data.warnings.length > 0;
  if (hasCritical) {
    sections.push(`## ${secNum + (variant === 'internal' ? 3 : 2)}. Offene Punkte & Warnungen\n`);
    if (data.blockers.length > 0) {
      sections.push('**Blocker (muss geklärt werden):**\n');
      sections.push(data.blockers.map((b) => `- 🔴 ${b}`).join('\n') + '\n');
    }
    if (data.warnings.length > 0) {
      sections.push('**Warnungen:**\n');
      sections.push(data.warnings.map((w) => `- 🟡 ${w}`).join('\n') + '\n');
    }
  }

  // ── 10. Nächste Schritte ──
  sections.push(`## ${secNum + (variant === 'internal' ? 4 : 2) + (hasCritical ? 1 : 0)}. Nächste Schritte\n`);
  sections.push(buildNextStepsSection(data, variant));

  // ── 11. Disclaimer ──
  if (include_disclaimers) {
    sections.push('---\n');
    sections.push([
      '## Rechtlicher Hinweis\n',
      'Dieser Export ist eine interne Arbeitsunterlage. Förderpilot führt keine automatische ',
      'Antragstellung durch und ersetzt keine Rechts-, Steuer- oder Förderberatung. Eine Förderung ',
      'kann nicht garantiert werden. Die Antragstellung und Nachweiseinreichung erfolgen durch den ',
      'Kunden im Portal „Meine KfW". Förderpilot speichert keine Zugangsdaten für „Meine KfW".',
    ].join(''));
  }

  return sections.join('\n\n') + '\n';
}
