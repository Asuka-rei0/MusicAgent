import { useState, useEffect, useCallback, useRef } from 'react';
import { AIChatService, type AIChatConfig } from '../services/aiChatService';
import type { AIChatState } from '../services/aiChatService';
import type { ConversationMessage, ConversationSession } from '../services/conversationManager';

export interface UseAIChatReturn {
  messages: ConversationMessage[];
  sessions: ConversationSession[];
  currentSession: ConversationSession | null;
  isLoading: boolean;
  isStreaming: boolean;
  isConfigured: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  abortRequest: () => void;
  createSession: (title?: string) => void;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  clearCurrentSession: () => void;
  renameSession: (sessionId: string, newTitle: string) => void;
}

export function useAIChat(initialConfig?: AIChatConfig): UseAIChatReturn {
  const serviceRef = useRef<AIChatService | null>(null);

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ConversationSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const service = new AIChatService(initialConfig);
    serviceRef.current = service;

    const unsubscribe = service.subscribe((state: AIChatState) => {
      setIsLoading(state.isLoading);
      setIsStreaming(state.isStreaming);
      setIsConfigured(state.isConfigured);
      setError(state.error);
    });

    service.setConversationCallbacks({
      onMessageUpdate: () => {
        const session = service.getCurrentSession();
        if (session) {
          setMessages([...session.messages]);
          setCurrentSession({ ...session });
        }
        setSessions(service.getAllSessions());
      },
    });

    const initialSession = service.getCurrentSession();
    if (initialSession) {
      setMessages(initialSession.messages);
      setCurrentSession(initialSession);
    }
    setSessions(service.getAllSessions());

    return () => {
      unsubscribe();
      serviceRef.current = null;
    };
  }, [initialConfig?.baseUrl, initialConfig?.apiKey, initialConfig?.model]);

  const sendMessage = useCallback(async (content: string) => {
    if (!serviceRef.current || !content.trim()) return;
    await serviceRef.current.sendMessage(content);
  }, []);

  const abortRequest = useCallback(() => {
    serviceRef.current?.abortCurrentRequest();
  }, []);

  const createSession = useCallback((title?: string) => {
    const id = serviceRef.current?.createSession(title);
    if (id) {
      const session = serviceRef.current?.getCurrentSession();
      if (session) {
        setMessages(session.messages);
        setCurrentSession(session);
      }
      setSessions(serviceRef.current?.getAllSessions() ?? []);
    }
  }, []);

  const switchSession = useCallback((sessionId: string) => {
    const success = serviceRef.current?.switchSession(sessionId);
    if (success) {
      const session = serviceRef.current?.getCurrentSession();
      if (session) {
        setMessages(session.messages);
        setCurrentSession(session);
      }
    }
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    serviceRef.current?.deleteSession(sessionId);
    const session = serviceRef.current?.getCurrentSession();
    if (session) {
      setMessages(session.messages);
      setCurrentSession(session);
    } else {
      setMessages([]);
      setCurrentSession(null);
    }
    setSessions(serviceRef.current?.getAllSessions() ?? []);
  }, []);

  const clearCurrentSession = useCallback(() => {
    serviceRef.current?.clearCurrentSession();
    const session = serviceRef.current?.getCurrentSession();
    if (session) {
      setMessages(session.messages);
      setCurrentSession(session);
    }
  }, []);

  const renameSession = useCallback((sessionId: string, newTitle: string) => {
    serviceRef.current?.renameSession(sessionId, newTitle);
    setSessions(serviceRef.current?.getAllSessions() ?? []);
    const session = serviceRef.current?.getCurrentSession();
    if (session && session.id === sessionId) {
      setCurrentSession(session);
    }
  }, []);

  return {
    messages,
    sessions,
    currentSession,
    isLoading,
    isStreaming,
    isConfigured,
    error,
    sendMessage,
    abortRequest,
    createSession,
    switchSession,
    deleteSession,
    clearCurrentSession,
    renameSession,
  };
}
