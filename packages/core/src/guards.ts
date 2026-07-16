import type { ChatCompletionRequest, ChatCompletionResponse } from './types.js';
import { RouterError } from './router.js';

export interface GuardContext {
  userId: string;
}

export interface GuardrailAdapter {
  name: string;
  
  /** 
   * Validates the incoming request before it is sent to the LLM.
   * Throws a RouterError if validation fails.
   */
  validateInput?: (request: ChatCompletionRequest, ctx: GuardContext) => Promise<void> | void;
  
  /**
   * Validates the LLM response before returning it to the client.
   * Throws a RouterError if validation fails.
   */
  validateOutput?: (response: ChatCompletionResponse, ctx: GuardContext) => Promise<void> | void;
}

export class PiiInputGuard implements GuardrailAdapter {
  name = 'PiiInputGuard';
  
  private blocklist = [
    /\\b\\d{3}-\\d{2}-\\d{4}\\b/, // SSN
    /\\b\\d{16}\\b/, // Credit Card (simple)
  ];

  validateInput(request: ChatCompletionRequest, ctx: GuardContext) {
    for (const msg of request.messages) {
      if (typeof msg.content === 'string') {
        for (const regex of this.blocklist) {
          if (regex.test(msg.content)) {
            throw new RouterError('Input contains potential Personally Identifiable Information (PII). Request blocked by Guardrail.', false);
          }
        }
      }
    }
  }
}

export class HallucinationOutputGuard implements GuardrailAdapter {
  name = 'HallucinationOutputGuard';

  validateOutput(response: ChatCompletionResponse, ctx: GuardContext) {
    for (const choice of response.choices) {
      const content = choice.message.content;
      if (typeof content === 'string') {
        // A naive check: if the model explicitly says it's hallucinating or made up a link
        if (content.toLowerCase().includes('i made this link up') || content.toLowerCase().includes('this is a fictional link')) {
          throw new RouterError('Output failed hallucination guardrail check.', false);
        }
      }
    }
  }
}
