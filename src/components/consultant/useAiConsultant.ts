import { useState, useEffect, useCallback, useRef } from 'react';
import { UserAccount } from '../../types';

export interface ConsultantUiMessage {
  id: string;
  chatId: string;
  sender: 'user' | 'assistant';
  text: string;
  images: string[];
  dbSource?: string;
  dbSummary?: string;
  createdAt: string;
}

const SESSION_STORAGE_KEY = 'iismm_consultant_guest_session_v1';

function getOrCreateGuestSessionKey(): string {
  try {
    const existing = localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && existing.trim().length >= 6) {
      return existing.trim();
    }
    const generated = `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(SESSION_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `s_${Date.now()}`;
  }
}

export function isConsultantDisabledOnRoute(path: string): boolean {
  const clean = String(path || '').trim().toLowerCase();
  if (!clean) return false;
  if (clean === '/chat' || clean.startsWith('/chat/')) return true;
  if (clean === '/social/messages' || clean.startsWith('/social/messages/')) return true;
  if (clean.includes('tab=messages')) return true;
  return false;
}

const WELCOME_MESSAGE_TEXT =
  'Привет! Я ваш Ии-консультант по платформе ИиSMM.\n\nЗадайте любой вопрос текстом или голосом — я проверю нужный раздел в базе данных (Академия, тарифы, ваш баланс Иирок, каналы, сценарии или папки) и дам точный ответ.';

export function useAiConsultant(params: {
  currentPath: string;
  currentUser?: UserAccount | null;
  isLoggedIn?: boolean;
}) {
  const { currentPath, currentUser, isLoggedIn } = params;
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [chatId, setChatId] = useState<string>('');
  const [messages, setMessages] = useState<ConsultantUiMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<string>('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const stageTimerRef = useRef<number | null>(null);

  const isHiddenOnCurrentRoute = isConsultantDisabledOnRoute(currentPath);

  // Automatically close if user navigates into Chats
  useEffect(() => {
    if (isHiddenOnCurrentRoute && isOpen) {
      setIsOpen(false);
    }
  }, [isHiddenOnCurrentRoute, isOpen]);

  const effectiveUserId =
    isLoggedIn && currentUser?.id ? String(currentUser.id).trim() : 'guest';

  const loadHistory = useCallback(async () => {
    try {
      const sessionKey = getOrCreateGuestSessionKey();
      const query = new URLSearchParams({
        userId: effectiveUserId,
        sessionKey
      });
      const res = await fetch(`/api/consultant/history?${query.toString()}`, {
        headers: effectiveUserId !== 'guest' ? { 'x-user-id': effectiveUserId } : {}
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success) {
        if (data.chatId) setChatId(String(data.chatId));
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages);
        } else {
          setMessages([
            {
              id: 'welcome_init',
              chatId: String(data.chatId || ''),
              sender: 'assistant',
              text: WELCOME_MESSAGE_TEXT,
              images: [],
              dbSummary: 'Нейросфера ИиSMM',
              createdAt: new Date().toISOString()
            }
          ]);
        }
      }
    } catch (err) {
      console.warn('[AiConsultant] History load warning:', err);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const finalText = String(overrideText !== undefined ? overrideText : inputText).trim();
      if (!finalText && attachedImages.length === 0) return;
      if (isLoading) return;

      setErrorText(null);
      const imagesToSend = attachedImages.slice(0, 4);
      if (overrideText === undefined) {
        setInputText('');
      }
      setAttachedImages([]);

      const optimisticUserMsg: ConsultantUiMessage = {
        id: `temp_u_${Date.now()}`,
        chatId: chatId || 'pending',
        sender: 'user',
        text: finalText || 'Прикреплено изображение для анализа',
        images: imagesToSend,
        createdAt: new Date().toISOString()
      };

      setMessages((prev) => [...prev, optimisticUserMsg]);
      setIsLoading(true);
      setLoadingStage('Анализирую вопрос через функцию 763...');

      if (stageTimerRef.current) window.clearTimeout(stageTimerRef.current);
      stageTimerRef.current = window.setTimeout(() => {
        setLoadingStage('Ищу нужную строку и колонку в базе данных...');
        stageTimerRef.current = window.setTimeout(() => {
          setLoadingStage('Формирую ответ нейросетью ProTalk...');
        }, 2600);
      }, 1900);

      try {
        const sessionKey = getOrCreateGuestSessionKey();
        const res = await fetch('/api/consultant/ask', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(effectiveUserId !== 'guest' ? { 'x-user-id': effectiveUserId } : {})
          },
          body: JSON.stringify({
            text: finalText,
            images: imagesToSend,
            userId: effectiveUserId,
            sessionKey,
            chatId: chatId || undefined,
            currentPath
          })
        });

        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Не удалось получить ответ консультанта');
        }

        if (data.chatId) {
          setChatId(String(data.chatId));
        }

        setMessages((prev) => {
          const withoutOptimistic = prev.filter((m) => m.id !== optimisticUserMsg.id);
          const next = [...withoutOptimistic];
          if (data.userMessage) next.push(data.userMessage);
          if (data.assistantMessage) next.push(data.assistantMessage);
          return next;
        });
      } catch (err: any) {
        setErrorText(err?.message || 'Ошибка соединения с сервером консультанта');
      } finally {
        if (stageTimerRef.current) {
          window.clearTimeout(stageTimerRef.current);
          stageTimerRef.current = null;
        }
        setIsLoading(false);
        setLoadingStage('');
      }
    },
    [inputText, attachedImages, isLoading, chatId, effectiveUserId, currentPath]
  );

  const clearHistory = useCallback(async () => {
    try {
      const sessionKey = getOrCreateGuestSessionKey();
      await fetch('/api/consultant/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: effectiveUserId,
          sessionKey,
          chatId: chatId || undefined
        })
      });
      setMessages([
        {
          id: `welcome_${Date.now()}`,
          chatId,
          sender: 'assistant',
          text: WELCOME_MESSAGE_TEXT,
          images: [],
          dbSummary: 'Нейросфера ИиSMM',
          createdAt: new Date().toISOString()
        }
      ]);
      setErrorText(null);
    } catch (err) {
      console.warn('[AiConsultant] Clear history error:', err);
    }
  }, [effectiveUserId, chatId]);

  const addAttachedImages = useCallback((urls: string[]) => {
    const valid = urls.map((u) => String(u || '').trim()).filter(Boolean);
    if (valid.length === 0) return;
    setAttachedImages((prev) => Array.from(new Set([...prev, ...valid])).slice(0, 4));
  }, []);

  const removeAttachedImage = useCallback((index: number) => {
    setAttachedImages((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  return {
    isOpen,
    setIsOpen,
    isHiddenOnCurrentRoute,
    chatId,
    messages,
    inputText,
    setInputText,
    attachedImages,
    addAttachedImages,
    removeAttachedImage,
    isLoading,
    loadingStage,
    errorText,
    sendMessage,
    clearHistory
  };
}
