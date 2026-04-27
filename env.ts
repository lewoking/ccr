export interface Env {
  // Optional: can be used for local development or overriding defaults
  OPENROUTER_BASE_URL?: string;
  GEMINI_BASE_URL?: string;
  
  // Gemini model mapping configuration (JSON string)
  // OpenRouter natively supports Claude, no mapping needed
  // Format: {"opus":"gemini-3-pro","sonnet":"gemini-3-flash","haiku":"gemini-3-flash-lite"}
  GEMINI_MODEL_MAPPING?: string;
}
