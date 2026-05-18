export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface LLMChoice {
  index: number;
  message: LLMMessage;
  finish_reason: string;
}

export interface LLMResponse {
  id: string;
  object: string;
  created: number;
  choices: LLMChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LLMStreamChunk {
  id: string;
  object: string;
  created: number;
  choices: Array<{
    index: number;
    delta: Partial<LLMMessage>;
    finish_reason: string | null;
  }>;
}

export interface LLMClientConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  maxRetries?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  onStreamChunk?: (chunk: string) => void;
  onComplete?: () => void;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class LLMClient {
  private config: Required<LLMClientConfig>;
  private abortController: AbortController | null = null;

  constructor(config: LLMClientConfig) {
    this.config = {
      timeoutMs: 30000,
      maxRetries: 2,
      temperature: 0.7,
      maxTokens: 2048,
      ...config,
    };

    if (!this.config.apiKey || this.config.apiKey.trim().length === 0) {
      throw new LLMError('API key is required', 'MISSING_API_KEY');
    }
  }

  async chatCompletion(options: ChatCompletionOptions): Promise<string> {
    const { messages, temperature, maxTokens, stream, onStreamChunk, onComplete } = options;

    const requestBody: LLMRequest = {
      model: this.config.model,
      messages,
      temperature: temperature ?? this.config.temperature,
      max_tokens: maxTokens ?? this.config.maxTokens,
      stream: stream ?? false,
    };

    if (stream && onStreamChunk) {
      return this.streamCompletion(requestBody, onStreamChunk, onComplete);
    }

    return this.sendRequest(requestBody);
  }

  private async sendRequest(requestBody: LLMRequest): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await this.executeRequest(requestBody);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof LLMError) {
          if (error.code === 'UNAUTHORIZED' || error.code === 'MISSING_API_KEY') {
            throw error;
          }
          if (error.code === 'RATE_LIMIT') {
            const retryDelay = Math.min(2000 * Math.pow(2, attempt), 30000);
            await this.sleep(retryDelay);
            continue;
          }
        }

        if (attempt < this.config.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new LLMError('Request failed after retries', 'UNKNOWN');
  }

  private async executeRequest(requestBody: LLMRequest): Promise<string> {
    this.abortController = new AbortController();
    const timeoutId = setTimeout(
      () => this.abortController?.abort(),
      this.config.timeoutMs
    );

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleHttpError(response);
      }

      const data: LLMResponse = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new LLMError('Empty response from LLM', 'EMPTY_RESPONSE');
      }

      return content;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof LLMError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new LLMError('Request timeout', 'TIMEOUT');
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new LLMError('Network error', 'NETWORK_ERROR', undefined, error);
      }

      throw new LLMError(
        error instanceof Error ? error.message : 'Unknown error',
        'UNKNOWN',
        undefined,
        error
      );
    } finally {
      this.abortController = null;
    }
  }

  private async streamCompletion(
    requestBody: LLMRequest,
    onChunk: (chunk: string) => void,
    onComplete?: () => void
  ): Promise<string> {
    this.abortController = new AbortController();
    const timeoutId = setTimeout(
      () => this.abortController?.abort(),
      this.config.timeoutMs
    );

    let completeCalled = false;
    const callOnComplete = () => {
      if (!completeCalled) {
        completeCalled = true;
        onComplete?.();
      }
    };

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ ...requestBody, stream: true }),
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleHttpError(response);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new LLMError('No response body for stream', 'STREAM_ERROR');
      }

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';
      let hasReceivedData = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (!hasReceivedData) {
            throw new LLMError('Stream ended without data', 'EMPTY_STREAM');
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed === 'data: [DONE]') {
            callOnComplete();
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            try {
              const chunk: LLMStreamChunk = JSON.parse(trimmed.slice(6));
              const delta = chunk.choices[0]?.delta?.content;
              if (delta) {
                hasReceivedData = true;
                fullContent += delta;
                onChunk(delta);
              }
              if (chunk.choices[0]?.finish_reason === 'stop') {
                callOnComplete();
              }
            } catch {
              // ignore malformed stream chunks
            }
          }
        }
      }

      callOnComplete();
      return fullContent;
    } catch (error) {
      clearTimeout(timeoutId);
      callOnComplete();

      if (error instanceof LLMError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new LLMError('Stream timeout', 'TIMEOUT');
      }

      throw new LLMError(
        error instanceof Error ? error.message : 'Stream error',
        'STREAM_ERROR',
        undefined,
        error
      );
    } finally {
      this.abortController = null;
    }
  }

  private async handleHttpError(response: Response): Promise<never> {
    const status = response.status;
    let message = `HTTP ${status}`;
    let errorCode = 'HTTP_ERROR';

    try {
      const errorData = await response.json();
      message = errorData.error?.message || errorData.message || message;
    } catch {
      try {
        const text = await response.text();
        if (text) message = text;
      } catch {
        // use default message
      }
    }

    if (status === 401) {
      errorCode = 'UNAUTHORIZED';
      message = 'API密钥无效或已过期，请检查配置';
    } else if (status === 403) {
      errorCode = 'FORBIDDEN';
      message = 'API密钥权限不足，请检查密钥权限设置';
    } else if (status === 429) {
      errorCode = 'RATE_LIMIT';
      message = '请求过于频繁，请稍后再试';
    } else if (status >= 500 && status < 600) {
      errorCode = 'SERVER_ERROR';
      message = 'AI服务暂时不可用，请稍后再试';
    } else if (status === 422) {
      errorCode = 'INVALID_REQUEST';
      message = '请求参数错误，请检查输入内容';
    }

    throw new LLMError(message, errorCode, status);
  }

  abort(): void {
    this.abortController?.abort();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
