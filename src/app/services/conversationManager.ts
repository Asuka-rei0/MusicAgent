import type { LLMMessage, LLMClient } from './llmClient';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status: 'sending' | 'streaming' | 'completed' | 'error';
  errorMessage?: string;
}

export interface ConversationSession {
  id: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ConversationOptions {
  systemPrompt?: string;
  maxContextMessages?: number;
  enableStreaming?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface ConversationCallbacks {
  onMessageUpdate?: (message: ConversationMessage) => void;
  onStreamChunk?: (messageId: string, chunk: string) => void;
  onError?: (messageId: string, error: Error) => void;
  onStatusChange?: (messageId: string, status: ConversationMessage['status']) => void;
}

const DEFAULT_SYSTEM_PROMPT = `You are an AI music assistant for MusicAgent. You help users discover music based on their mood, preferences, and listening habits. You can:
- Recommend songs, albums, and playlists
- Explain why certain music fits a mood
- Suggest artists and genres
- Answer questions about music theory and history
- Help users explore new music

Keep responses concise, friendly, and music-focused. When recommending, mention specific songs or artists when possible.`;

const STORAGE_KEY = 'musicagent_conversations';
const MAX_STORED_CONVERSATIONS = 50;

export class ConversationManager {
  private sessions: Map<string, ConversationSession> = new Map();
  private currentSessionId: string | null = null;
  private llmClient: LLMClient;
  private options: Required<ConversationOptions>;
  private callbacks: ConversationCallbacks = {};
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(llmClient: LLMClient, options: ConversationOptions = {}) {
    this.llmClient = llmClient;
    this.options = {
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      maxContextMessages: 20,
      enableStreaming: true,
      temperature: 0.7,
      maxTokens: 2048,
      ...options,
    };
    this.loadFromStorage();
  }

  setCallbacks(callbacks: ConversationCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  getCallbacks(): ConversationCallbacks {
    return this.callbacks;
  }

  createSession(title?: string): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const session: ConversationSession = {
      id: sessionId,
      title: title || 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    this.saveToStorage();

    return sessionId;
  }

  switchSession(sessionId: string): boolean {
    if (!this.sessions.has(sessionId)) return false;
    this.currentSessionId = sessionId;
    return true;
  }

  getCurrentSession(): ConversationSession | null {
    if (!this.currentSessionId) return null;
    return this.sessions.get(this.currentSessionId) ?? null;
  }

  getAllSessions(): ConversationSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  }

  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted && this.currentSessionId === sessionId) {
      const remaining = this.getAllSessions();
      this.currentSessionId = remaining.length > 0 ? remaining[0].id : null;
    }
    this.saveToStorage();
    return deleted;
  }

  async sendMessage(content: string): Promise<ConversationMessage | null> {
    const session = this.getCurrentSession();
    if (!session) {
      this.createSession();
    }

    const currentSession = this.getCurrentSession()!;

    const userMessage: ConversationMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'completed',
    };

    currentSession.messages.push(userMessage);
    currentSession.updatedAt = Date.now();

    if (!currentSession.title || currentSession.title === 'New Conversation') {
      currentSession.title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
    }

    this.callbacks.onMessageUpdate?.(userMessage);
    this.saveToStorage();

    const assistantMessage = await this.callLLM(currentSession);
    return assistantMessage;
  }

  private async callLLM(
    session: ConversationSession
  ): Promise<ConversationMessage | null> {
    const messageId = `msg_${Date.now()}_assistant`;
    const abortController = new AbortController();
    this.abortControllers.set(messageId, abortController);

    const assistantMessage: ConversationMessage = {
      id: messageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'sending',
    };

    session.messages.push(assistantMessage);
    this.callbacks.onMessageUpdate?.(assistantMessage);
    this.callbacks.onStatusChange?.(messageId, 'sending');

    try {
      const contextMessages = this.buildContextMessages(session);

      assistantMessage.status = 'streaming';
      this.callbacks.onStatusChange?.(messageId, 'streaming');

      let streamedContent = '';
      let streamEnded = false;

      const onComplete = () => {
        if (streamEnded) return;
        streamEnded = true;
        assistantMessage.status = 'completed';
        session.updatedAt = Date.now();
        this.callbacks.onStatusChange?.(messageId, 'completed');
        this.callbacks.onMessageUpdate?.(assistantMessage);
        this.saveToStorage();
      };

      const response = await this.llmClient.chatCompletion({
        messages: contextMessages,
        temperature: this.options.temperature,
        maxTokens: this.options.maxTokens,
        stream: this.options.enableStreaming,
        onStreamChunk: this.options.enableStreaming
          ? (chunk) => {
              streamedContent += chunk;
              assistantMessage.content = streamedContent;
              this.callbacks.onStreamChunk?.(messageId, chunk);
              this.callbacks.onMessageUpdate?.(assistantMessage);
            }
          : undefined,
        onComplete: this.options.enableStreaming ? onComplete : undefined,
      });

      if (!this.options.enableStreaming) {
        assistantMessage.content = response;
        onComplete();
      }

      return assistantMessage;
    } catch (error) {
      assistantMessage.status = 'error';
      assistantMessage.errorMessage = this.formatError(error);
      this.callbacks.onStatusChange?.(messageId, 'error');
      this.callbacks.onError?.(messageId, error instanceof Error ? error : new Error(String(error)));
      this.callbacks.onMessageUpdate?.(assistantMessage);
      this.saveToStorage();

      return assistantMessage;
    } finally {
      this.abortControllers.delete(messageId);
    }
  }

  private buildContextMessages(session: ConversationSession): LLMMessage[] {
    const messages: LLMMessage[] = [
      { role: 'system', content: this.options.systemPrompt },
    ];

    const relevantMessages = session.messages
      .filter((m) => m.status === 'completed')
      .slice(-this.options.maxContextMessages);

    for (const msg of relevantMessages) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    return messages;
  }

  abortMessage(messageId: string): boolean {
    const controller = this.abortControllers.get(messageId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(messageId);
      return true;
    }

    this.llmClient.abort();
    return true;
  }

  clearCurrentSession(): void {
    const session = this.getCurrentSession();
    if (session) {
      session.messages = [];
      session.updatedAt = Date.now();
      this.saveToStorage();
    }
  }

  renameSession(sessionId: string, newTitle: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.title = newTitle;
    session.updatedAt = Date.now();
    this.saveToStorage();
    return true;
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('timeout')) {
        return '请求超时，请检查网络连接后重试';
      }
      if (message.includes('network') || message.includes('fetch')) {
        return '网络连接异常，请检查网络设置';
      }
      if (message.includes('unauthorized') || message.includes('401')) {
        return 'API密钥无效，请检查配置';
      }
      if (message.includes('rate limit') || message.includes('429')) {
        return '请求过于频繁，请稍后再试';
      }
      if (message.includes('server') || message.includes('500')) {
        return '服务器暂时不可用，请稍后再试';
      }
      return error.message;
    }
    return '未知错误';
  }

  private saveToStorage(): void {
    try {
      const sessionsArray = Array.from(this.sessions.values());
      const trimmed = sessionsArray.slice(-MAX_STORED_CONVERSATIONS);
      const data = JSON.stringify(trimmed);
      localStorage.setItem(STORAGE_KEY, data);
    } catch {
      // ignore storage errors
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return;

      const sessions: ConversationSession[] = JSON.parse(data);
      for (const session of sessions) {
        this.sessions.set(session.id, session);
      }

      if (sessions.length > 0) {
        this.currentSessionId = sessions[sessions.length - 1].id;
      }
    } catch {
      // ignore storage errors
    }
  }

  exportSession(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return JSON.stringify(session, null, 2);
  }

  importSession(json: string): string | null {
    try {
      const session: ConversationSession = JSON.parse(json);
      if (!session.id || !Array.isArray(session.messages)) return null;

      session.id = `imported_${Date.now()}`;
      session.createdAt = Date.now();
      session.updatedAt = Date.now();

      this.sessions.set(session.id, session);
      this.currentSessionId = session.id;
      this.saveToStorage();

      return session.id;
    } catch {
      return null;
    }
  }
}
