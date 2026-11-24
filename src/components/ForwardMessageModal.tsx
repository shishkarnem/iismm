import React, { useState, useMemo } from 'react';
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from '../constants/proTalkStorage';
import { 
  X, 
  Search, 
  SendHorizontal, 
  Check, 
  Users, 
  User, 
  MessageSquare, 
  AlertCircle,
  CheckSquare,
  Square
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatChatLastMessagePreview } from '../utils/chat/chatPreviewFormatter';

export interface ForwardMessageData {
  id?: string;
  text: string;
  images?: string[];
  mediaUrl?: string;
  mediaType?: string;
  messageFormat?: string;
  originalSenderName?: string;
  originalChatName?: string;
  originalId?: string;
  inlineButtons?: Array<Array<{ text: string; url?: string; callback_data?: string; callbackData?: string; style?: string; color?: string; type?: string }>>;
}

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: ForwardMessageData | null;
  chats: Array<{
    id: string;
    name: string;
    username: string;
    avatar: string;
    isGroup?: boolean;
    bio?: string;
    status?: string;
  }>;
  currentUser?: any;
  onForwardSuccess: (targetChatIds: string[], firstChatId: string) => void;
}

export default function ForwardMessageModal({
  isOpen,
  onClose,
  message,
  chats,
  currentUser,
  onForwardSuccess
}: ForwardMessageModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter chats by name or username
  const filteredChats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.username.toLowerCase().includes(q)
    );
  }, [chats, searchQuery]);

  if (!isOpen || !message) return null;

  const toggleChatSelection = (chatId: string) => {
    setSelectedChatIds(prev => 
      prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId]
    );
  };

  const handleSelectAll = () => {
    if (selectedChatIds.length === filteredChats.length) {
      setSelectedChatIds([]);
    } else {
      setSelectedChatIds(filteredChats.map(c => c.id));
    }
  };

  const executeForward = async (targetIds: string[]) => {
    if (targetIds.length === 0) return;
    setIsSending(true);
    setErrorMessage(null);

    const myId = String(currentUser?.id || '16926299042');
    const myName = currentUser?.name || currentUser?.firstName || 'Вы';
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      // Send to each target chat sequentially or in parallel
      for (const targetId of targetIds) {
        const tempMsgId = `full-m-fwd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const forwardText = message.text || '';
        const targetChatObj = chats.find(c => c.id === targetId);
        const isGroup = targetId.startsWith('gr') || targetId === 'group-smm' || targetId === 'group-iismm' || Boolean(targetChatObj?.isGroup);
        const isSaved = targetId === 'saved_messages' || targetId === 'saved' || targetId === myId || targetChatObj?.username === 'saved_messages';
        const partnerName = isSaved ? 'Избранное (Чат с собой)' : (targetChatObj?.name || 'Соавтор');
        const finalChatId = isSaved ? 'saved_messages' : targetId;

        // Ensure user_chats entry is created for personal or saved chat
        if (!isGroup) {
          await fetch('/api/user/chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: myId,
              partnerId: isSaved ? myId : targetId,
              partnerName,
              partnerUsername: isSaved ? 'saved_messages' : (targetChatObj?.username || ''),
              partnerAvatar: normalizeProTalkMediaUrl(targetChatObj?.avatar) || BRAND_ASSETS.heartAvatar
            })
          }).catch(() => {});
        }

        const origSender = message.originalSenderName || (message as any).senderName || 'Соавтор';
        const payload = {
          id: tempMsgId,
          chatId: finalChatId,
          sender: 'me',
          userId: myId,
          senderId: myId,
          senderName: myName,
          recipientName: partnerName,
          forwardedFrom: {
            senderName: origSender,
            originalChatName: message.originalChatName,
            originalId: message.originalId || message.id,
            text: forwardText,
            images: message.images,
            mediaUrl: message.mediaUrl,
            mediaType: message.mediaType
          },
          inlineButtons: message.inlineButtons,
          text: forwardText,
          messageFormat: message.messageFormat || 'v2',
          images: message.images && message.images.length > 0 ? JSON.stringify(message.images) : null,
          mediaUrl: message.mediaUrl || null,
          mediaType: message.mediaType || null,
          time: timeNow
        };

        const res = await fetch('/api/chat/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          console.warn(`Failed to forward message to chat ${targetId}`);
        }
      }

      const firstTargetId = targetIds[0];
      onForwardSuccess(targetIds, firstTargetId);
      onClose();
    } catch (err: any) {
      console.error('Forwarding error:', err);
      setErrorMessage(err.message || 'Ошибка при пересылке сообщения');
      setIsSending(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-gradient-to-br from-sky-200/45 via-pink-200/45 via-orange-200/45 via-pink-200/45 to-sky-200/45 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-lg rounded-3xl p-5 sm:p-6 border-2 border-pink-400 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          background: 'linear-gradient(135deg, rgba(224,242,254,0.94) 0%, rgba(252,231,243,0.94) 25%, rgba(254,237,213,0.94) 50%, rgba(252,231,243,0.94) 75%, rgba(224,242,254,0.94) 100%)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-pink-200/80 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 flex items-center justify-center text-white shadow-xs shrink-0">
              <SendHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-slate-900 leading-tight">
                Переслать сообщение
              </h3>
              <p className="text-[14px] text-slate-600 font-medium">
                Выберите один или несколько чатов для отправки
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/80 hover:bg-white text-slate-500 hover:text-pink-600 flex items-center justify-center border border-pink-200 transition-colors cursor-pointer shrink-0"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message preview snippet */}
        <div className="mt-3 p-3 rounded-2xl bg-white/80 border border-pink-200 text-left shrink-0 shadow-2xs">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[14px] font-bold text-pink-700 flex items-center gap-1.5">
              <MessageSquare size={15} />
              <span>Пересылаемое сообщение</span>
            </span>
            {message.originalSenderName && (
              <span className="text-[14px] font-medium text-slate-500 truncate">
                От: {message.originalSenderName}
              </span>
            )}
          </div>
          <p className="text-[14px] text-slate-800 font-medium line-clamp-2 leading-relaxed break-words">
            {formatChatLastMessagePreview({
              text: message.text,
              images: message.images,
              mediaType: message.mediaType,
              mediaUrl: message.mediaUrl,
              fallback: 'Пересылаемое сообщение',
              maxLength: 140
            })}
          </p>
          {message.images && message.images.length > 0 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar">
              {message.images.map((img, idx) => (
                <img 
                  key={idx} 
                  src={img} 
                  alt="attached" 
                  className="w-12 h-12 rounded-xl object-cover border border-pink-200 shrink-0" 
                />
              ))}
            </div>
          )}
        </div>

        {/* Search & Select All controls */}
        <div className="mt-3 flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-pink-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по чатам и соавторам..."
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-800 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
          </div>

          {filteredChats.length > 1 && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-3 py-2.5 rounded-xl bg-white/80 hover:bg-white border border-pink-200 text-slate-700 text-[14px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Выбрать все или снять выбор"
            >
              {selectedChatIds.length === filteredChats.length ? (
                <>
                  <CheckSquare size={16} className="text-pink-600" />
                  <span className="hidden sm:inline">Снять</span>
                </>
              ) : (
                <>
                  <Square size={16} className="text-slate-400" />
                  <span className="hidden sm:inline">Все</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mt-2 p-2.5 rounded-xl bg-pink-100/90 border border-pink-300 text-rose-700 text-[14px] font-bold flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="break-words">{errorMessage}</span>
          </div>
        )}

        {/* Chats list */}
        <div className="mt-3 overflow-y-auto space-y-1.5 pr-1 flex-1 min-h-36">
          {filteredChats.length > 0 ? (
            filteredChats.map((chat) => {
              const isSelected = selectedChatIds.includes(chat.id);
              return (
                <div
                  key={chat.id}
                  onClick={() => toggleChatSelection(chat.id)}
                  className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-pink-100/80 border-pink-400 shadow-2xs'
                      : 'bg-white/80 border-pink-100 hover:border-pink-300 hover:bg-white/95'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    {/* Checkbox indicator */}
                    <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 border-transparent text-white' : 'border-pink-300 bg-white'
                    }`}>
                      {isSelected && <Check size={13} strokeWidth={3} />}
                    </div>

                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <img 
                        src={chat.avatar} 
                        alt={chat.name} 
                        className="w-10 h-10 rounded-full object-cover border border-pink-300" 
                      />
                      {chat.isGroup && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white flex items-center justify-center text-[14px] shadow-2xs">
                          <Users size={12} />
                        </div>
                      )}
                    </div>

                    {/* Text info */}
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-[14px] truncate leading-tight">
                          {chat.name}
                        </span>
                        {chat.isGroup && (
                          <span className="px-1.5 py-0.5 rounded-md bg-pink-100 text-pink-700 text-[14px] font-bold shrink-0">
                            группа
                          </span>
                        )}
                      </div>
                      <span className="text-[14px] font-medium text-slate-500 truncate block">
                        {chat.username}
                      </span>
                    </div>
                  </div>

                  {/* Single-click quick send button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      executeForward([chat.id]);
                    }}
                    disabled={isSending}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white text-[14px] font-bold shadow-2xs hover:opacity-95 active:scale-95 transition-all shrink-0 cursor-pointer disabled:opacity-50"
                    title="Переслать сразу в этот диалог"
                  >
                    Отправить
                  </button>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-slate-500 bg-white/70 rounded-2xl border border-pink-200 text-[14px]">
              {searchQuery ? 'Ни один чат не найден по запросу' : 'Список чатов пуст'}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-4 pt-3.5 border-t border-pink-200/80 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="text-[14px] font-bold text-slate-700">
            {selectedChatIds.length > 0 ? (
              <span>Выбрано чатов: <span className="text-pink-600 font-mono">{selectedChatIds.length}</span></span>
            ) : (
              <span className="text-slate-500 font-medium">Выберите чаты для пересылки</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2.5 rounded-xl bg-white/80 hover:bg-white text-slate-700 font-bold text-[14px] border border-pink-200 transition-colors cursor-pointer"
            >
              Отмена
            </button>

            <button
              type="button"
              onClick={() => executeForward(selectedChatIds)}
              disabled={isSending || selectedChatIds.length === 0}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white font-bold text-[14px] shadow-md hover:opacity-90 active:scale-98 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <SendHorizontal className="w-4 h-4" />
              <span>{isSending ? 'Пересылка...' : `Переслать (${selectedChatIds.length})`}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
