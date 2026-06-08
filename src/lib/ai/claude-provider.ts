import Anthropic from '@anthropic-ai/sdk';
import type { AIReasoningProvider, FundingPrecheckInput, FundingPrecheckResult } from './types';
import { FundingPrecheckResultSchema } from './types';
import { buildFundingPrecheckPrompt } from './prompts/funding-precheck';

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
  'Alle Texte müssen auf Deutsch sein.';

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

    return FundingPrecheckResultSchema.parse(toolBlock.input);
  }
}
