import type { AIReasoningProvider } from './types';

// Called only from server-side code (Server Actions).
// ANTHROPIC_API_KEY must never be read client-side.
export function getAIProvider(): AIReasoningProvider {
  const providerEnv = process.env.AI_PROVIDER ?? 'mock';
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.AI_MODEL ?? 'claude-sonnet-4-6';

  if (providerEnv === 'anthropic' && apiKey) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ClaudeProvider } = require('./claude-provider') as typeof import('./claude-provider');
    return new ClaudeProvider(apiKey, model);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MockAIProvider } = require('./mock-provider') as typeof import('./mock-provider');
  return new MockAIProvider();
}
