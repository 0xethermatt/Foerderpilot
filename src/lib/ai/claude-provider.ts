import Anthropic from '@anthropic-ai/sdk';
import type { AIReasoningProvider, FundingPrecheckInput, FundingPrecheckResult } from './types';
import { FundingPrecheckResultSchema } from './types';
import type { ContractCheckInput, ContractCheckResult } from './contract-check/types';
import { ContractCheckResultSchema } from './contract-check/types';
import type { OfferCheckInput, OfferCheckResult } from './offer-check/types';
import { OfferCheckResultSchema } from './offer-check/types';
import { buildFundingPrecheckPrompt } from './prompts/funding-precheck';
import { buildContractCheckPrompt } from './prompts/contract-check';
import { buildOfferCheckPrompt } from './prompts/offer-check';

// ─── Tool definition ───────────────────────────────────────────────────────────
// Forces the model to return structured JSON via tool_use, which is immune to
// truncation and markdown fences (the primary cause of "Unexpected end of JSON input").

const PRECHECK_TOOL: Anthropic.Tool = {
  name: 'report_funding_precheck',
  description:
    'Gibt das strukturierte Ergebnis der Wärmepumpen-Förderfall-Vorprüfung zurück.',
  input_schema: {
    type: 'object' as const,
    properties: {
      overall_assessment: {
        type: 'string',
        enum: ['likely_eligible', 'unclear', 'critical'],
        description: 'Gesamteinschätzung zur Förderfähigkeit.',
      },
      risk_level: {
        type: 'string',
        enum: ['green', 'yellow', 'red'],
        description: 'Risikostufe des Falls.',
      },
      summary_de: {
        type: 'string',
        description: 'Zusammenfassung in 2–4 Sätzen auf Deutsch.',
      },
      missing_information: {
        type: 'array',
        items: { type: 'string' },
        description: 'Liste fehlender Informationen.',
      },
      blocking_items: {
        type: 'array',
        items: { type: 'string' },
        description: 'Blockierende Punkte für die Antragstellung.',
      },
      possible_bonuses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            status: { type: 'string', enum: ['possible', 'unclear', 'unlikely'] },
            reason_de: { type: 'string' },
          },
          required: ['name', 'status', 'reason_de'],
        },
      },
      detected_risks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: { type: 'string', enum: ['low', 'medium', 'high'] },
            risk_de: { type: 'string' },
            recommended_action_de: { type: 'string' },
          },
          required: ['severity', 'risk_de', 'recommended_action_de'],
        },
      },
      recommended_next_steps: {
        type: 'array',
        items: { type: 'string' },
      },
      customer_message_draft_de: {
        type: 'string',
        description:
          'Freundlicher Entwurf für eine Kundennachricht. Kein Förderversprechen.',
      },
      internal_notes_de: {
        type: 'array',
        items: { type: 'string' },
        description: 'Interne Hinweise für den Sachbearbeiter.',
      },
      confidence: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Konfidenz der Einschätzung.',
      },
      human_review_required: {
        type: 'boolean',
        description: 'Muss immer true sein – manuelle Prüfung ist Pflicht.',
      },
    },
    required: [
      'overall_assessment',
      'risk_level',
      'summary_de',
      'missing_information',
      'blocking_items',
      'possible_bonuses',
      'detected_risks',
      'recommended_next_steps',
      'customer_message_draft_de',
      'internal_notes_de',
      'confidence',
      'human_review_required',
    ],
  },
};

const SYSTEM_PROMPT =
  'Du bist ein präziser Förderberater-Assistent für einen deutschen SHK-Fachbetrieb. ' +
  'Du garantierst keine Förderung und erfindest keine Daten. ' +
  'Rufe ausschließlich das bereitgestellte Tool auf – keinen Freitext ausgeben. ' +
  'Alle Texte müssen auf Deutsch sein. ' +
  'Die Heizungsförderung läuft über KfW / Meine KfW – NICHT über das BAFA-Portal. ' +
  'BzA = Bestätigung zum Antrag. ' +
  'Der Liefer-/Leistungsvertrag mit Fördervorbehalt muss VOR der Antragstellung vorliegen.';

// ─── Output sanitizer ─────────────────────────────────────────────────────────
// Lightweight post-processing guard: catches rule violations that slipped through
// the prompt and either replaces them in text or flags them in internal_notes_de.
// Does not fail valid results — adds transparent correction notes instead.

interface SanitizeRule {
  /** Pattern to detect in concatenated output text */
  pattern: RegExp;
  /** Short label added to internal_notes_de when triggered */
  flag: string;
  /** Optional: safe string replacement applied to every text field */
  replace?: { from: RegExp; to: string };
}

const SANITIZE_RULES: SanitizeRule[] = [
  {
    pattern: /BAFA[- ]?Portal/i,
    flag: '[Regelkorrektur] "BAFA-Portal" erkannt und ersetzt durch "KfW-Portal (Meine KfW)".',
    replace: { from: /BAFA[- ]?Portal/gi, to: 'KfW-Portal (Meine KfW)' },
  },
  {
    pattern: /Verwendungsnachweis\s+Antrag/i,
    flag: '[Regelkorrektur] Falsche BzA-Definition erkannt. BzA = "Bestätigung zum Antrag".',
    replace: {
      from: /Bestätigung zum Verwendungsnachweis Antrag/gi,
      to: 'Bestätigung zum Antrag (BzA)',
    },
  },
  {
    // Detects "Vertrag erst nach Antrag" / "Vertrag nach Antragstellung"
    pattern: /[Vv]ertrag\s+(?:erst\s+)?nach\s+(?:der\s+)?[Aa]ntrag/,
    flag:
      '[Regelkorrektur] Falsche Vertragsreihenfolge erkannt. ' +
      'Liefer-/Leistungsvertrag mit Fördervorbehalt muss VOR der Antragstellung vorliegen.',
  },
];

function applyTextReplace(text: string, rule: SanitizeRule): string {
  if (!rule.replace) return text;
  return text.replace(rule.replace.from, rule.replace.to);
}

function sanitizeStrings(
  texts: string[],
  rules: SanitizeRule[],
): string[] {
  return texts.map((t) =>
    rules.reduce((s, rule) => applyTextReplace(s, rule), t),
  );
}

function sanitizeResult(result: FundingPrecheckResult): FundingPrecheckResult {
  // Build a single string of all output text for pattern matching
  const allText = [
    result.summary_de,
    result.customer_message_draft_de,
    ...result.missing_information,
    ...result.blocking_items,
    ...result.recommended_next_steps,
    ...result.internal_notes_de,
    ...result.detected_risks.map((r) => `${r.risk_de} ${r.recommended_action_de}`),
    ...result.possible_bonuses.map((b) => b.reason_de),
  ].join(' ');

  const triggeredFlags: string[] = [];
  for (const rule of SANITIZE_RULES) {
    if (rule.pattern.test(allText)) {
      triggeredFlags.push(rule.flag);
    }
  }

  if (triggeredFlags.length === 0) return result;

  console.warn('[ClaudeProvider] Sanitizer triggered:', triggeredFlags);

  // Apply text replacements to all free-text fields
  const applyAll = (s: string) =>
    SANITIZE_RULES.reduce((t, rule) => applyTextReplace(t, rule), s);

  return {
    ...result,
    summary_de: applyAll(result.summary_de),
    customer_message_draft_de: applyAll(result.customer_message_draft_de),
    missing_information: sanitizeStrings(result.missing_information, SANITIZE_RULES),
    blocking_items: sanitizeStrings(result.blocking_items, SANITIZE_RULES),
    recommended_next_steps: sanitizeStrings(result.recommended_next_steps, SANITIZE_RULES),
    detected_risks: result.detected_risks.map((r) => ({
      ...r,
      risk_de: applyAll(r.risk_de),
      recommended_action_de: applyAll(r.recommended_action_de),
    })),
    possible_bonuses: result.possible_bonuses.map((b) => ({
      ...b,
      reason_de: applyAll(b.reason_de),
    })),
    internal_notes_de: [
      ...result.internal_notes_de,
      ...triggeredFlags,
    ],
  };
}

// ─── Contract check tool definition ──────────────────────────────────────────

const CONTRACT_CHECK_TOOL: Anthropic.Tool = {
  name: 'report_contract_check',
  description:
    'Gibt das strukturierte Ergebnis der KfW-Vertragsanalyse (Liefer-/Leistungsvertrag) zurück.',
  input_schema: {
    type: 'object' as const,
    properties: {
      overall_assessment: {
        type: 'string',
        enum: ['pass', 'needs_revision', 'critical'],
      },
      risk_level: {
        type: 'string',
        enum: ['green', 'yellow', 'red'],
      },
      summary_de: { type: 'string' },
      detected_contract_type: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      contract_parties: {
        type: 'object',
        properties: {
          customer_name: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          contractor_name: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          project_address: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
        required: ['customer_name', 'contractor_name', 'project_address'],
      },
      funding_reservation: {
        type: 'object',
        properties: {
          present: { type: 'boolean' },
          type: {
            type: 'string',
            enum: ['aufschiebend', 'aufloesend', 'both', 'unclear', 'missing'],
          },
          mentions_kfw_funding_approval: { type: 'boolean' },
          relevant_excerpt_de: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          assessment_de: { type: 'string' },
        },
        required: ['present', 'type', 'mentions_kfw_funding_approval', 'relevant_excerpt_de', 'assessment_de'],
      },
      premature_start_risk: {
        type: 'object',
        properties: {
          detected: { type: 'boolean' },
          severity: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
          problematic_excerpt_de: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          assessment_de: { type: 'string' },
        },
        required: ['detected', 'severity', 'problematic_excerpt_de', 'assessment_de'],
      },
      implementation_period: {
        type: 'object',
        properties: {
          present: { type: 'boolean' },
          excerpt_de: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          assessment_de: { type: 'string' },
        },
        required: ['present', 'excerpt_de', 'assessment_de'],
      },
      missing_or_unclear_items: { type: 'array', items: { type: 'string' } },
      critical_findings: { type: 'array', items: { type: 'string' } },
      recommended_changes: { type: 'array', items: { type: 'string' } },
      safe_clause_suggestion_de: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      recommended_next_steps: { type: 'array', items: { type: 'string' } },
      customer_message_draft_de: { type: 'string' },
      internal_notes_de: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      human_review_required: { type: 'boolean' },
    },
    required: [
      'overall_assessment',
      'risk_level',
      'summary_de',
      'detected_contract_type',
      'contract_parties',
      'funding_reservation',
      'premature_start_risk',
      'implementation_period',
      'missing_or_unclear_items',
      'critical_findings',
      'recommended_changes',
      'safe_clause_suggestion_de',
      'recommended_next_steps',
      'customer_message_draft_de',
      'internal_notes_de',
      'confidence',
      'human_review_required',
    ],
  },
};

const CONTRACT_CHECK_SYSTEM_PROMPT =
  'Du bist ein präziser Förderberater-Assistent für einen deutschen SHK-Fachbetrieb. ' +
  'Du prüfst Liefer-/Leistungsverträge auf KfW-Konformität anhand des extrahierten Vertragstexts. ' +
  'Du garantierst keine Förderung und erfindest keine Vertragsklauseln. ' +
  'Du zitierst ausschließlich Passagen, die tatsächlich im extrahierten Text vorkommen. ' +
  'Rufe ausschließlich das bereitgestellte Tool auf – keinen Freitext ausgeben. ' +
  'Alle Texte müssen auf Deutsch sein. ' +
  'Die Heizungsförderung läuft über KfW / Meine KfW – NICHT über das BAFA-Portal. ' +
  'human_review_required ist immer true.';

// ─── Offer check tool definition ─────────────────────────────────────────────

const OFFER_CHECK_TOOL: Anthropic.Tool = {
  name: 'report_offer_check',
  description:
    'Gibt das strukturierte Ergebnis der KfW-Angebotsprüfung (Wärmepumpe/Heizungsangebot) zurück.',
  input_schema: {
    type: 'object' as const,
    properties: {
      overall_assessment: {
        type: 'string',
        enum: ['pass', 'needs_revision', 'critical'],
      },
      risk_level: {
        type: 'string',
        enum: ['green', 'yellow', 'red'],
      },
      summary_de: { type: 'string' },
      detected_document_type: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      project_parties: {
        type: 'object',
        properties: {
          customer_name:    { anyOf: [{ type: 'string' }, { type: 'null' }] },
          contractor_name:  { anyOf: [{ type: 'string' }, { type: 'null' }] },
          project_address:  { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
        required: ['customer_name', 'contractor_name', 'project_address'],
      },
      heat_pump: {
        type: 'object',
        properties: {
          present:       { type: 'boolean' },
          manufacturer:  { anyOf: [{ type: 'string' }, { type: 'null' }] },
          model:         { anyOf: [{ type: 'string' }, { type: 'null' }] },
          type:          { anyOf: [{ type: 'string' }, { type: 'null' }] },
          assessment_de: { type: 'string' },
        },
        required: ['present', 'manufacturer', 'model', 'type', 'assessment_de'],
      },
      costs: {
        type: 'object',
        properties: {
          net_amount:    { anyOf: [{ type: 'string' }, { type: 'null' }] },
          gross_amount:  { anyOf: [{ type: 'string' }, { type: 'null' }] },
          vat_rate:      { anyOf: [{ type: 'string' }, { type: 'null' }] },
          assessment_de: { type: 'string' },
        },
        required: ['net_amount', 'gross_amount', 'vat_rate', 'assessment_de'],
      },
      eligible_scope_indicators: {
        type: 'object',
        properties: {
          demolition_old_heating_present: { type: 'boolean' },
          hydraulic_balancing_present:    { type: 'boolean' },
          commissioning_present:          { type: 'boolean' },
          electrical_work_present:        { type: 'boolean' },
          buffer_or_storage_present:      { type: 'boolean' },
          environmental_measures_present: { type: 'boolean' },
          assessment_de:                  { type: 'string' },
        },
        required: [
          'demolition_old_heating_present',
          'hydraulic_balancing_present',
          'commissioning_present',
          'electrical_work_present',
          'buffer_or_storage_present',
          'environmental_measures_present',
          'assessment_de',
        ],
      },
      implementation_period: {
        type: 'object',
        properties: {
          present:       { type: 'boolean' },
          excerpt_de:    { anyOf: [{ type: 'string' }, { type: 'null' }] },
          assessment_de: { type: 'string' },
        },
        required: ['present', 'excerpt_de', 'assessment_de'],
      },
      missing_or_unclear_items:  { type: 'array', items: { type: 'string' } },
      critical_findings:         { type: 'array', items: { type: 'string' } },
      recommended_changes:       { type: 'array', items: { type: 'string' } },
      recommended_next_steps:    { type: 'array', items: { type: 'string' } },
      customer_message_draft_de: { type: 'string' },
      internal_notes_de:         { type: 'array', items: { type: 'string' } },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      human_review_required: { type: 'boolean' },
    },
    required: [
      'overall_assessment',
      'risk_level',
      'summary_de',
      'detected_document_type',
      'project_parties',
      'heat_pump',
      'costs',
      'eligible_scope_indicators',
      'implementation_period',
      'missing_or_unclear_items',
      'critical_findings',
      'recommended_changes',
      'recommended_next_steps',
      'customer_message_draft_de',
      'internal_notes_de',
      'confidence',
      'human_review_required',
    ],
  },
};

const OFFER_CHECK_SYSTEM_PROMPT =
  'Du bist ein präziser Förderberater-Assistent für einen deutschen SHK-Fachbetrieb. ' +
  'Du prüfst Angebote für Wärmepumpeninstallationen auf Vollständigkeit und Plausibilität ' +
  'im Hinblick auf die KfW-Heizungsförderung (KfW 458). ' +
  'Du garantierst keine Förderung und erfindest keine Angaben. ' +
  'Du zitierst ausschließlich Passagen, die tatsächlich im extrahierten Angebotstext vorkommen. ' +
  'Rufe ausschließlich das bereitgestellte Tool auf – keinen Freitext ausgeben. ' +
  'Alle Texte müssen auf Deutsch sein. ' +
  'Die Heizungsförderung läuft über KfW / Meine KfW – NICHT über das BAFA-Portal. ' +
  'human_review_required ist immer true.';

// ─── Provider ─────────────────────────────────────────────────────────────────

export class ClaudeProvider implements AIReasoningProvider {
  readonly providerName = 'anthropic';
  readonly modelName: string;
  private client: Anthropic;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.modelName = model;
  }

  async runFundingPrecheck(input: FundingPrecheckInput): Promise<FundingPrecheckResult> {
    const userPrompt = buildFundingPrecheckPrompt(input);

    // First attempt: structured tool use
    try {
      return await this.callWithTool([{ role: 'user', content: userPrompt }]);
    } catch (firstErr) {
      console.error('[ClaudeProvider] First attempt failed:', firstErr);
    }

    // Single retry with explicit repair instruction
    try {
      return await this.callWithTool([
        { role: 'user', content: userPrompt },
        {
          role: 'user' as const,
          content:
            'Bitte rufe jetzt das Tool report_funding_precheck mit vollständigen, gültigen Daten auf. ' +
            'Nur das Tool – kein Freitext.',
        },
      ]);
    } catch (retryErr) {
      console.error('[ClaudeProvider] Retry also failed:', retryErr);
      throw retryErr;
    }
  }

  private async callWithTool(
    messages: Anthropic.MessageParam[],
  ): Promise<FundingPrecheckResult> {
    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      tools: [PRECHECK_TOOL],
      tool_choice: { type: 'tool', name: 'report_funding_precheck' },
      messages,
    });

    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (!toolBlock) {
      throw new Error(
        `No tool_use block in response. stop_reason=${response.stop_reason} ` +
        `blocks=${response.content.map((b) => b.type).join(',')}`,
      );
    }

    const validated = FundingPrecheckResultSchema.parse(toolBlock.input);
    return sanitizeResult(validated);
  }

  // ─── Contract check ──────────────────────────────────────────────────────────

  async runContractCheck(input: ContractCheckInput): Promise<ContractCheckResult> {
    const userPrompt = buildContractCheckPrompt(input);

    try {
      return await this.callContractCheckTool([{ role: 'user', content: userPrompt }]);
    } catch (firstErr) {
      console.error('[ClaudeProvider] Contract check first attempt failed:', firstErr);
    }

    try {
      return await this.callContractCheckTool([
        { role: 'user', content: userPrompt },
        {
          role: 'user' as const,
          content:
            'Bitte rufe jetzt das Tool report_contract_check mit vollständigen, gültigen Daten auf. ' +
            'Nur das Tool – kein Freitext.',
        },
      ]);
    } catch (retryErr) {
      console.error('[ClaudeProvider] Contract check retry also failed:', retryErr);
      throw retryErr;
    }
  }

  private async callContractCheckTool(
    messages: Anthropic.MessageParam[],
  ): Promise<ContractCheckResult> {
    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 3500,
      system: CONTRACT_CHECK_SYSTEM_PROMPT,
      tools: [CONTRACT_CHECK_TOOL],
      tool_choice: { type: 'tool', name: 'report_contract_check' },
      messages,
    });

    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (!toolBlock) {
      throw new Error(
        `No tool_use block in response. stop_reason=${response.stop_reason} ` +
        `blocks=${response.content.map((b) => b.type).join(',')}`,
      );
    }

    return ContractCheckResultSchema.parse(toolBlock.input);
  }

  // ─── Offer check ─────────────────────────────────────────────────────────────

  async runOfferCheck(input: OfferCheckInput): Promise<OfferCheckResult> {
    const userPrompt = buildOfferCheckPrompt(input);

    try {
      return await this.callOfferCheckTool([{ role: 'user', content: userPrompt }]);
    } catch (firstErr) {
      console.error('[ClaudeProvider] Offer check first attempt failed:', firstErr);
    }

    try {
      return await this.callOfferCheckTool([
        { role: 'user', content: userPrompt },
        {
          role: 'user' as const,
          content:
            'Bitte rufe jetzt das Tool report_offer_check mit vollständigen, gültigen Daten auf. ' +
            'Nur das Tool – kein Freitext.',
        },
      ]);
    } catch (retryErr) {
      console.error('[ClaudeProvider] Offer check retry also failed:', retryErr);
      throw retryErr;
    }
  }

  private async callOfferCheckTool(
    messages: Anthropic.MessageParam[],
  ): Promise<OfferCheckResult> {
    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 3500,
      system: OFFER_CHECK_SYSTEM_PROMPT,
      tools: [OFFER_CHECK_TOOL],
      tool_choice: { type: 'tool', name: 'report_offer_check' },
      messages,
    });

    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (!toolBlock) {
      throw new Error(
        `No tool_use block in response. stop_reason=${response.stop_reason} ` +
        `blocks=${response.content.map((b) => b.type).join(',')}`,
      );
    }

    return OfferCheckResultSchema.parse(toolBlock.input);
  }
}
