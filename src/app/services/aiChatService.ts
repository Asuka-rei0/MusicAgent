import { LLMClient, LLMError } from './llmClient';
import { ConversationManager } from './conversationManager';
import { apiKeyManager, type ApiKeyConfig } from './apiKeyManager';
import type { ConversationCallbacks, ConversationMessage, ConversationSession } from './conversationManager';

export interface AIChatConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  maxRetries?: number;
  temperature?: number;
  maxTokens?: number;
  enableStreaming?: boolean;
  maxContextMessages?: number;
}

export interface AIChatState {
  isLoading: boolean;
  isStreaming: boolean;
  currentMessageId: string | null;
  error: string | null;
  isConfigured: boolean;
}

export type AIChatStateListener = (state: AIChatState) => void;

const DEFAULT_CONFIG: AIChatConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-3.5-turbo',
  timeoutMs: 30000,
  maxRetries: 2,
  temperature: 0.7,
  maxTokens: 2048,
  enableStreaming: true,
  maxContextMessages: 20,
};

const BUILTIN_API_CONFIG: ApiKeyConfig = {
  key: 'sk-a56c2e48284347edb9e61a8e641652f6',
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
};

export class AIChatService {
  private llmClient: LLMClient | null = null;
  private conversationManager: ConversationManager | null = null;
  private state: AIChatState;
  private stateListeners: Set<AIChatStateListener> = new Set();
  private config: AIChatConfig;
  private initialized: boolean = false;

  constructor(config?: Partial<AIChatConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      isLoading: false,
      isStreaming: false,
      currentMessageId: null,
      error: null,
      isConfigured: false,
    };

    this.tryAutoInitialize();
  }

  private tryAutoInitialize(): void {
    this.config = {
      ...this.config,
      baseUrl: BUILTIN_API_CONFIG.baseUrl,
      apiKey: BUILTIN_API_CONFIG.key,
      model: BUILTIN_API_CONFIG.model,
    };
    this.setupLLMClient();
  }

  private setupLLMClient(): void {
    if (!this.config.apiKey) {
      this.updateState({ isConfigured: false, error: 'API密钥未配置' });
      return;
    }

    try {
      this.llmClient = new LLMClient({
        baseUrl: this.config.baseUrl,
        apiKey: this.config.apiKey,
        model: this.config.model,
        timeoutMs: this.config.timeoutMs,
        maxRetries: this.config.maxRetries,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      });

      this.conversationManager = new ConversationManager(this.llmClient, {
        enableStreaming: this.config.enableStreaming ?? true,
        maxContextMessages: this.config.maxContextMessages ?? 20,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      });

      this.conversationManager.setCallbacks({
        onMessageUpdate: () => {
          this.notifyStateListeners();
        },
        onStatusChange: (messageId, status) => {
          if (status === 'sending') {
            this.updateState({ isLoading: true, currentMessageId: messageId, error: null });
          } else if (status === 'streaming') {
            this.updateState({ isLoading: true, isStreaming: true, currentMessageId: messageId });
          } else if (status === 'completed') {
            this.updateState({ isLoading: false, isStreaming: false, currentMessageId: null });
          } else if (status === 'error') {
            this.updateState({ isLoading: false, isStreaming: false, currentMessageId: null });
          }
        },
        onError: (_messageId, error) => {
          this.updateState({
            isLoading: false,
            isStreaming: false,
            currentMessageId: null,
            error: this.formatErrorForDisplay(error),
          });
        },
      });

      this.initialized = true;
      this.updateState({ isConfigured: true, error: null });
    } catch (error) {
      const message = error instanceof LLMError ? error.message : '初始化AI服务失败';
      this.updateState({ isConfigured: false, error: message });
    }
  }

  subscribe(listener: AIChatStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private updateState(partial: Partial<AIChatState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyStateListeners();
  }

  private notifyStateListeners(): void {
    for (const listener of this.stateListeners) {
      listener(this.state);
    }
  }

  async sendMessage(content: string): Promise<ConversationMessage | null> {
    if (!this.initialized || !this.conversationManager) {
      this.updateState({ isLoading: false, error: 'AI服务初始化失败，请刷新页面重试' });
      return null;
    }

    this.updateState({ isLoading: true, error: null });

    try {
      const result = await this.conversationManager.sendMessage(content);
      return result;
    } catch (error) {
      const message = this.formatErrorForDisplay(error);
      this.updateState({ isLoading: false, error: message });
      return null;
    }
  }

  abortCurrentRequest(): void {
    const { currentMessageId } = this.state;
    if (currentMessageId && this.conversationManager) {
      this.conversationManager.abortMessage(currentMessageId);
    }
    this.llmClient?.abort();
    this.updateState({ isLoading: false, isStreaming: false, currentMessageId: null });
  }

  getCurrentSession(): ConversationSession | null {
    return this.conversationManager?.getCurrentSession() ?? null;
  }

  getAllSessions(): ConversationSession[] {
    return this.conversationManager?.getAllSessions() ?? [];
  }

  createSession(title?: string): string {
    return this.conversationManager?.createSession(title) ?? '';
  }

  switchSession(sessionId: string): boolean {
    return this.conversationManager?.switchSession(sessionId) ?? false;
  }

  deleteSession(sessionId: string): boolean {
    return this.conversationManager?.deleteSession(sessionId) ?? false;
  }

  clearCurrentSession(): void {
    this.conversationManager?.clearCurrentSession();
  }

  renameSession(sessionId: string, newTitle: string): boolean {
    return this.conversationManager?.renameSession(sessionId, newTitle) ?? false;
  }

  getState(): AIChatState {
    return { ...this.state };
  }

  setConversationCallbacks(callbacks: ConversationCallbacks): void {
    if (!this.conversationManager) return;
    const currentCallbacks = this.conversationManager.getCallbacks();
    this.conversationManager.setCallbacks({ ...currentCallbacks, ...callbacks });
  }

  private formatErrorForDisplay(error: unknown): string {
    if (error instanceof LLMError) {
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return '未知错误';
  }
}
