/**
 * Provider detection and model mapping
 * Supports OpenRouter and Gemini based on API key prefix
 * Model mapping can be customized via environment variables
 */

export type ProviderType = 'openrouter' | 'gemini';

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * Default Gemini model mapping - only Gemini needs model translation
 * OpenRouter natively supports Claude models, no translation needed
 * 
 * Can be overridden via GEMINI_MODEL_MAPPING environment variable
 */
export const DEFAULT_GEMINI_MODEL_MAPPING = {
  opus: 'gemini-2.5-pro',
  sonnet: 'gemini-2.5-flash',
  haiku: 'gemini-2.5-flash-lite',
};

/**
 * Parses Gemini model mapping from environment variable
 * Falls back to default mapping if not provided or invalid
 * 
 * Only Gemini needs model mapping - OpenRouter natively supports Claude
 */
export function parseGeminiModelMapping(geminiModelMappingEnv?: string): typeof DEFAULT_GEMINI_MODEL_MAPPING {
  if (!geminiModelMappingEnv) {
    return DEFAULT_GEMINI_MODEL_MAPPING;
  }

  try {
    const parsed = JSON.parse(geminiModelMappingEnv);
    // Deep merge with defaults to ensure all required fields exist
    return { ...DEFAULT_GEMINI_MODEL_MAPPING, ...parsed };
  } catch (e) {
    console.warn('Invalid GEMINI_MODEL_MAPPING JSON, using defaults:', e);
    return DEFAULT_GEMINI_MODEL_MAPPING;
  }
}

/**
 * Detects model tier (opus/sonnet/haiku) from model name
 */
export function detectModelTier(model: string): 'opus' | 'sonnet' | 'haiku' {
  const lower = model.toLowerCase();
  
  if (lower.includes('opus')) {
    return 'opus';
  } else if (lower.includes('sonnet')) {
    return 'sonnet';
  } else if (lower.includes('haiku')) {
    return 'haiku';
  }
  
  // Default to sonnet for unknown models
  return 'sonnet';
}

/**
 * Detects provider from API key prefix
 * OpenRouter: sk-or-v1-*
 * Gemini: AI*
 */
export function detectProvider(apiKey: string): ProviderType {
  if (apiKey.startsWith('sk-or-v1-')) {
    return 'openrouter';
  } else if (apiKey.startsWith('AI')) {
    return 'gemini';
  }
  // Default to openrouter
  return 'openrouter';
}

/**
 * Maps Claude model names to provider-specific equivalent models
 * 
 * - OpenRouter: Adds "anthropic/" prefix to Claude models (e.g., claude-opus-4 -> anthropic/claude-opus-4)
 * - Gemini: Maps to equivalent Gemini model (different naming scheme)
 */
export function mapModelForProvider(
  model: string,
  provider: ProviderType,
  geminiModelMapping?: typeof DEFAULT_GEMINI_MODEL_MAPPING,
): string {
  // If model already has provider prefix, return as-is
  if (model.includes('/')) {
    return model;
  }

  if (provider === 'openrouter') {
    // OpenRouter requires "anthropic/" prefix for Claude models
    if (model.toLowerCase().includes('claude')) {
      return `anthropic/${model}`;
    }
    return model;
  }

  if (provider === 'gemini') {
    // Gemini needs model mapping
    const mapping = geminiModelMapping || DEFAULT_GEMINI_MODEL_MAPPING;
    const tier = detectModelTier(model);
    
    return mapping[tier] || model;
  }

  return model;
}

/**
 * Resolves provider configuration
 */
export function resolveProviderConfig(provider: ProviderType, apiKey: string): ProviderConfig {
  if (provider === 'gemini') {
    return {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      apiKey,
    };
  }
  // Default to OpenRouter
  return {
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey,
  };
}
