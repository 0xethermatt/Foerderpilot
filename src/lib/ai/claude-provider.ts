import Anthropic from '@anthropic-ai/sdk';
import type { AIReasoningProvider, FundingPrecheckInput, FundingPrecheckResult } from './types';
import { FundingPrecheckResultSchema } from './types';
import { buildFundingPrecheckPrompt } from './prompts/funding-precheck';

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

    const message = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 2048,
      system:
        'Du bist ein präziser Förderberater-Assistent. ' +
        'Antworte ausschließlich mit dem angeforderten JSON-Objekt. ' +
        'Kein Text davor oder danach. Kein Markdown.',
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    // Strip accidental markdown fences
    const cleaned = raw
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim();

    const parsed: unknown = JSON.parse(cleaned);
    return FundingPrecheckResultSchema.parse(parsed);
  }
}
