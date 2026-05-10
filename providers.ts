export type ProviderType = 'openrouter' | 'gemini';

/**
 * Detects provider from API key prefix
 * OpenRouter: sk-or-v1-*
 * Gemini: AI*
 */
export function detectProvider(apiKey: string): ProviderType {
  if (apiKey.startsWith('sk-or-v1-')) {
    return 'openrouter';
  }
  if (apiKey.startsWith('AI')) {
    return 'gemini';
  }
  return 'openrouter';
}
