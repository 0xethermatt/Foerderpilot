import type { FundingPrecheckInput } from '../types';

export const RULE_VERSION =
  'KfW/BEG Heizungsförderung structured precheck V0 - manually maintained rules';

export const SOURCES_USED = [
  'KfW Heizungsförderung / BEG - manually maintained context',
  'Internal Förderpilot checklist rules V0',
];

export const DISCLAIMER =
  'Dieses KI-Ergebnis ist eine automatische Vorprüfung und stellt keine Rechts-, Steuer- oder ' +
  'Energieberatung dar. Eine Förderung kann nicht garantiert werden. Die manuelle Prüfung durch ' +
  'einen qualifizierten Fachbetrieb oder zugelassenen Energieberater ist zwingend erforderlich ' +
  'bevor ein Antrag gestellt wird.';

export function buildFundingPrecheckPrompt(input: FundingPrecheckInput): string {
  const uploadedStr =
    input.uploadedDocumentTypes.length > 0
      ? input.uploadedDocumentTypes.join(', ')
      : 'keine';

  const missingStr =
    input.missingDocumentTypes.length > 0
      ? input.missingDocumentTypes.join(', ')
      : 'keine';

  const tasksStr =
    input.openTaskTitles.length > 0
      ? input.openTaskTitles.map((t) => `  - ${t}`).join('\n')
      : '  (keine offenen Aufgaben)';

  return `Du bist ein Förderberater-Assistent für einen deutschen SHK-Fachbetrieb (Sanitär, Heizung, Klima).
Deine Aufgabe ist die strukturierte Erstprüfung eines Wärmepumpen-Förderfalls nach BEG (Bundesförderung für effiziente Gebäude).
Dies ist eine interne Workflow-Vorprüfung, keine abschließende Förderberatung.

PFLICHTREGELN – NIEMALS VERLETZBAR:
1. Du garantierst KEINE Förderung. Die Wörter "garantiert", "garantiere", "Fördergarantie" sind verboten.
2. Du erfindest KEINE fehlenden Daten. Wenn Angaben fehlen, markiere sie als fehlend.
3. Du machst KEINE verbindlichen Aussagen zur Förderhöhe oder Förderfähigkeit.
4. human_review_required muss immer der boolesche Wert true sein.
5. Alle Nutzer-sichtbaren Texte müssen auf Deutsch sein.
6. Du gibst keine Rechts- oder Steuerberatung.

DATENGRUNDLAGE: BEG-Heizungsförderung, Stand 2024/2025, manuell gepflegte Regeln.
EXTERNE QUELLEN: Keine. Verwende ausschließlich die unten stehenden Falldaten.

FALLSTAMMDATEN:
Titel: ${input.caseTitle}
Status: ${input.caseStatus}
Aktuelle Risikostufe: ${input.caseRiskLevel}
Projektort: ${input.projectPostalCode ?? input.customerPostalCode} ${input.projectCity ?? input.customerCity}
Gebäudetyp: ${input.buildingType ?? '(nicht angegeben)'}
Wohneinheiten: ${input.housingUnits ?? '(nicht angegeben)'}
Eigentümerstatus: ${input.ownerStatus ?? '(nicht angegeben)'}
Selbst bewohnt: ${input.selfOccupied === true ? 'Ja' : input.selfOccupied === false ? 'Nein' : '(nicht angegeben)'}
Bestehende Heizung: ${input.currentHeatingType ?? '(nicht angegeben)'}, Baujahr: ${input.currentHeatingYear ?? '(nicht angegeben)'}
Geplante Wärmepumpe: ${input.plannedHeatingType ?? '(nicht angegeben)'}${input.plannedHeatPumpModel ? ` – Modell: ${input.plannedHeatPumpModel}` : ''}
Geschätzte Investitionskosten: ${input.estimatedCost != null ? `${Number(input.estimatedCost).toLocaleString('de-DE')} €` : '(nicht angegeben)'}
Geplanter Förderbetrag: ${input.fundingAmount != null ? `${Number(input.fundingAmount).toLocaleString('de-DE')} €` : '(nicht angegeben)'}
${input.notes ? `Interne Notizen: ${input.notes}` : ''}

DOKUMENTENSTATUS:
Antragsbereitschaft: ${input.readinessState} (${input.reviewedCount}/${input.totalRequiredBeforeApp} Pflichtunterlagen geprüft, ${input.blockingCount} blockierend)
Hochgeladene Dokumenttypen: ${uploadedStr}
Fehlende Pflichtdokumente: ${missingStr}

OFFENE AUFGABEN:
${tasksStr}

AUSGABE-ANFORDERUNG:
Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt.
Kein Text davor oder danach. Kein Markdown-Codeblock. Nur das rohe JSON-Objekt.

Exaktes Schema (keine zusätzlichen Felder):
{
  "overall_assessment": "likely_eligible" | "unclear" | "critical",
  "risk_level": "green" | "yellow" | "red",
  "summary_de": "Zusammenfassung in 2-4 Sätzen auf Deutsch",
  "missing_information": ["string", ...],
  "blocking_items": ["string", ...],
  "possible_bonuses": [
    { "name": "string", "status": "possible" | "unclear" | "unlikely", "reason_de": "string" }
  ],
  "detected_risks": [
    { "severity": "low" | "medium" | "high", "risk_de": "string", "recommended_action_de": "string" }
  ],
  "recommended_next_steps": ["string", ...],
  "customer_message_draft_de": "string",
  "internal_notes_de": ["string", ...],
  "confidence": "low" | "medium" | "high",
  "human_review_required": true
}

BEWERTUNGSLOGIK:
- overall_assessment = "critical": Klarer Ausschlussgrund erkennbar (z.B. Neubau, kein vollständiger Heizungsersatz, bestehende WP als Altanlage, Gebäudetyp nicht förderfähig)
- overall_assessment = "unclear": Wichtige Daten fehlen oder es bestehen offene Risiken ohne eindeutigen Ausschluss
- overall_assessment = "likely_eligible": Eckdaten passen, keine erkennbaren Ausschlussgründe
- risk_level = "red": Blockierende Dokumente fehlen ODER overall_assessment = "critical"
- risk_level = "yellow": Fehlende Informationen oder mittlere/hohe Risiken vorhanden
- risk_level = "green": Vollständige Datenlage, alle vor-Antrag-Dokumente geprüft, kein Blocker
- confidence = "low": Mehr als 3 wichtige Felder fehlen
- confidence = "medium": 1-3 wichtige Felder fehlen oder Risiken erkannt
- confidence = "high": Alle wichtigen Felder vorhanden, konsistente Datenlage
- customer_message_draft_de: Freundlicher Entwurf, kein Förderversprechen, kein "garantiert"`;
}
