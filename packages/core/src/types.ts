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
  /** Free tier available — no payment or card required. false = needs billing. */
  freeTier: boolean;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | MessageContentPart[] | null;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
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
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  /** Set by UI when request contains image_url parts or inlined documents */
  hasAttachments?: boolean;
  /** Specific attachment types present in the request */
  attachmentTypes?: ('image' | 'document')[];
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

export interface RateLimitSnapshot {
  limitRequests?: number;
  remainingRequests?: number;
  resetRequests?: number;
  limitTokens?: number;
  remainingTokens?: number;
  resetTokens?: number;
  fetchedAt: number;
}

export interface RouteAttempt {
  provider: ProviderId;
  model: string;
  result: 'success' | 'error' | 'skipped';
  /** Error message if result is 'error'. */
  error?: string;
  /** Reason if skipped (cooldown, unhealthy, no key). */
  skipped?: string;
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
    rateLimit?: RateLimitSnapshot;
    routeTrail?: RouteAttempt[];
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

export interface AttachmentCapabilityCheck {
  (providerId: ProviderId, model: string): { images: boolean; documents: boolean };
}

export interface RouterContext {
  userId: string;
  fallbackChain: FallbackChainEntry[];
  providerKeys: ProviderKeyRecord[];
  decryptKey: (encrypted: string) => string;
  maxAttempts?: number;
  /** Skip keys that are over RPM/RPD caps or marked unhealthy */
  isKeyAvailable?: KeyAvailabilityCheck;
  /** Check model attachment capabilities for vision auto-routing */
  getAttachmentCapabilities?: AttachmentCapabilityCheck;
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

export interface EmbeddingRequest {
  model?: string;
  providerId?: ProviderId;
  input: string | string[];
  dimensions?: number;
  encoding_format?: 'float' | 'base64';
}

export interface EmbeddingData {
  object: 'embedding';
  index: number;
  embedding: number[];
}

export interface EmbeddingUsage {
  prompt_tokens: number;
  total_tokens: number;
}

export interface EmbeddingResponse {
  object: 'list';
  data: EmbeddingData[];
  model: string;
  usage: EmbeddingUsage;
  precious?: {
    provider: ProviderId;
    model: string;
    attempts: number;
    failoverFrom?: ProviderId;
  };
}

export interface AuditLogEntry {
  userId: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
