import {
  BaseLLMClient,
  LLMMessage,
  LLMRequestOptions,
  LLMResponse,
  LLMStreamCallback,
  LLMError,
} from './llmClient';

interface OpenAIChatMessage {
  role: string;
  content: string;
}

interface OpenAIChatRequest {
  model: string;
  messages: OpenAIChatMessage[];
  temperature: number;
  max_tokens: number;
  top_p: number;
  stream?: boolean;
}

interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

export class OpenAIClient extends BaseLLMClient {
  constructor(
    apiKey: string,
    baseUrl: string = 'https://api.openai.com/v1',
    defaultModel: string = 'gpt