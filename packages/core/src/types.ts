export type RiskLevel = 'low' | 'medium' | 'high';

export type ProviderId =
  | 'groq'
  | 'google-gemini'
  | 'openrouter'
  | 'mistral'
  | 'openai'
  | 'openai-compat'
  | 'cerebras'
  | 'cloudflare'
  | 'github-models'
  | 'huggingface'
  | 'cohere'
  | 'ollama-cloud'
  | 'zhipu'
  | 'opencode'
  | 'llm7'
  | 'nvidia'
  | 'pollinations'
  | 'kilo';

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  riskLevel: RiskLevel;
  cloudSafe: boolean;
  defaultBaseUrl?: string;
  /** Where to create an API key for this provider */
  keySetupUrl?: string;
  keySetupHint?: string;
  /** Override default “Get API key” link text (e.g. local servers have no key portal). */
  keySetupLinkLabel?: string;
  /** Anonymous tier — no upstream API key required. */
  keyless?: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | MessageContentPart[] | null;
  name?: string;
}

export type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

export interface ChatCompletionRequest {
  model?: string;
  /** Pin routing to this provider when model exists on multiple chains */
  providerId?: ProviderId;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string | string[];
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string | null;
}

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: ChatCompletionUsage;
  precious?: {
    provider: ProviderId;
    model: string;
    attempts: number;
    failoverFrom?: ProviderId;
  };
}

export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<ChatMessage>;
    finish_reason: string | null;
  }>;
  precious?: {
    provider: ProviderId;
    model: string;
  };
}

export interface FallbackChainEntry {
  providerId: ProviderId;
  model: string;
  priority: number;
  enabled: boolean;
}

export interface ProviderKeyRecord {
  id: string;
  providerId: ProviderId;
  label: string;
  encryptedKey: string;
  customBaseUrl?: string | null;
}

export const AUTO_MODEL = 'auto';

export interface KeyAvailabilityCheck {
  (providerId: ProviderId, model: string, keyId: string): boolean;
}

export interface RouterContext {
  userId: string;
  fallbackChain: FallbackChainEntry[];
  providerKeys: ProviderKeyRecord[];
  decryptKey: (encrypted: string) => string;
  maxAttempts?: number;
  /** Skip keys that are over RPM/RPD caps or marked unhealthy */
  isKeyAvailable?: KeyAvailabilityCheck;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerDay?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

export type AuditAction =
  | 'key_created'
  | 'key_updated'
  | 'key_deleted'
  | 'key_accessed'
  | 'unified_key_created'
  | 'login'
  | 'setup'
  | 'chat_request';

export interface AuditLogEntry {
  userId: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
