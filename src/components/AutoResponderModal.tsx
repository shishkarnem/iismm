import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  X, 
  Check, 
  Sparkles, 
  Lock, 
  Settings2, 
  MessageSquare, 
  Globe,
  Radio,
  Zap,
  Moon,
  Clock
} from 'lucide-react';

export interface AutoResponderModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  activeChatId?: string;
  activeChatPartnerName?: string;
  activeChatPartnerId?: string;
}

export type ResponderMode = 'always' | 'offline' | 'online';

export const AutoResponderModal: React.FC<AutoResponderModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  activeChatId,
  activeChatPartnerName,
  activeChatPartnerId
}) => {
  const isGroupChat = Boolean(
    activeChatId === 'group-smm' || 
    activeChatId === 'group-iismm' || 
    activeChatId === 'gr_iismm_chat' ||
    (activeChatId && (activeChatId.startsWith('group') || activeChatId.startsWith('gr')))
  );
  const isSavedMessages = Boolean(
    activeChatId === 'saved_messages' ||
    activeChatId === 'saved' ||
    activeChatId === currentUser?.id ||
    activeChatPartnerName?.toLowerCase().includes('избранное')
  );
  const canConfigurePersonal = Boolean(activeChatId && !isGroupChat && !isSavedMessages);

  const [scope, setScope] = useState<'global' | 'personal'>(canConfigurePersonal ? 'personal' : 'global');
  
  // Global autoresponder state
  const [globalEnabled, setGlobalEnabled] = useState<boolean>(false);
  const [globalPrompt, setGlobalPrompt] = useState<string>('');
  const [globalMode, setGlobalMode] = useState<ResponderMode>('always');

  // Personal autoresponder state for specific chat
  const [personalEnabled, setPersonalEnabled] = useState<boolean>(false);
  const [personalPrompt, setPersonalPrompt] = useState<string>('');
  const [personalMode, setPersonalMode] = useState<ResponderMode>('always');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const userTariff = String(currentUser?.tariff || '').toLowerCase();
  const hasOtryvTariff = 
    userTariff.includes('отрыв') || 
    userTariff.includes('otryv') || 
    currentUser?.role === 'admin';

  // Resolved chat ID and display title for "Для этого чата"
  const resolvedChatId = activeChatId || 'current_chat';
  const resolvedPartnerName = activeChatPartnerName || 'Текущий диалог';

  useEffect(() => {
    if (!isOpen || !currentUser?.id) return;
    setIsLoading(true);
    setStatusMessage('');

    fetch(`/api/auto-responder?userId=${encodeURIComponent(currentUser.id)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.global) {
            setGlobalEnabled(Boolean(data.global.enabled));
            setGlobalPrompt(data.global.prompt || '');
            if (data.global.mode) {
              setGlobalMode(data.global.mode as ResponderMode);
            }
          }
          if (resolvedChatId && data.personal && data.personal[resolvedChatId]) {
            setPersonalEnabled(Boolean(data.personal[resolvedChatId].enabled));
            setPersonalPrompt(data.personal[resolvedChatId].prompt || '');
            if (data.personal[resolvedChatId].mode) {
              setPersonalMode(data.personal[resolvedChatId].mode as ResponderMode);
            }
          } else {
            setPersonalEnabled(false);
            setPersonalPrompt('');
            setPersonalMode('always');
          }
        }
      })
      .catch(e => {
        console.error('Failed to load auto-responder settings:', e);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, currentUser?.id, resolvedChatId]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!currentUser?.id || !hasOtryvTariff) return;
    setIsSaving(true);
    setStatusMessage('');

    try {
      // Save global configuration
      await fetch('/api/auto-responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          chatId: 'all',
          enabled: globalEnabled,
          prompt: globalPrompt,
          mode: globalMode
        })
      });

      // Save personal configuration for resolved chat
      if (resolvedChatId) {
        await fetch('/api/auto-responder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            chatId: resolvedChatId,
            enabled: personalEnabled,
            prompt: personalPrompt,
            mode: personalMode
          })
        });
      }

      setStatusMessage('Настройки автоответчика успешно сохранены');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (e) {
      setStatusMessage('Ошибка при сохранении настроек');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/30 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative max-w-lg w-full bg-gradient-to-r from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 backdrop-blur-md rounded-3xl p-5 sm:p-6 border-2 border-pink-300 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-pink-200 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                ИИ-автоответчик ИИSMM
              </h3>
              <p className="text-[14px] text-slate-600 font-medium mt-0.5">
                Интеллектуальные автоответы соавторам и клиентам
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 rounded-xl text-slate-500 hover:text-pink-600 hover:bg-white/80 border border-pink-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tariff lock banner if not "Отрыв" */}
        {!hasOtryvTariff && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-100/80 via-orange-100/80 to-pink-100/80 border-2 border-pink-300 space-y-2">
            <div className="flex items-center gap-2 text-pink-700 font-bold text-[14px]">
              <Lock className="w-4 h-4" />
              <span>Доступно только на тарифе «Отрыв»</span>
            </div>
            <p className="text-[14px] text-slate-700 leading-relaxed font-normal">
              Функция умного автоответчика ИИSMM с персональными промптами и режимами онлайн/офлайн доступна пользователям с активным тарифом «Отрыв».
            </p>
            <div className="pt-1">
              <span className="inline-block px-3 py-1.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] font-bold text-slate-800">
                Ваш текущий тариф: {currentUser?.tariff || 'Базовый'}
              </span>
            </div>
          </div>
        )}

        {/* Scope tabs */}
        {hasOtryvTariff && (
          <div className="space-y-4">
            {canConfigurePersonal ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('personal')}
                  className={`py-2 px-3 rounded-2xl flex items-center justify-center gap-2 text-[14px] font-bold transition-all cursor-pointer ${
                    scope === 'personal'
                      ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs border-2 border-pink-400'
                      : 'bg-white/80 text-slate-700 border border-pink-200 hover:bg-white'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span className="truncate">Для {resolvedPartnerName}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setScope('global')}
                  className={`py-2 px-3 rounded-2xl flex items-center justify-center gap-2 text-[14px] font-bold transition-all cursor-pointer ${
                    scope === 'global'
                      ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs border-2 border-pink-400'
                      : 'bg-white/80 text-slate-700 border border-pink-200 hover:bg-white'
                  }`}
                >
                  <Globe className="w-4 h-4 shrink-0" />
                  <span className="truncate">Все личные чаты</span>
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-white/80 border border-pink-200 text-slate-700 text-[14px] font-medium text-center">
                Настройка автоответа для всех личных диалогов с пользователями
              </div>
            )}

            {/* Global Scope Content */}
            {scope === 'global' && (
              <div className="space-y-3.5 bg-white/80 p-4 rounded-2xl border border-pink-200 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-[14px] font-bold text-slate-800">
                      Единый автоответчик
                    </span>
                    <span className="text-[14px] text-slate-600 font-normal">
                      Работает только в личных диалогах (в группах и избранном отключен)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGlobalEnabled(!globalEnabled)}
                    className={`px-4 py-1.5 rounded-2xl text-[14px] font-bold transition-all cursor-pointer ${
                      globalEnabled
                        ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {globalEnabled ? 'Включен' : 'Выключен'}
                  </button>
                </div>

                {/* Mode Selector: Always / Offline / Online */}
                <div className="pt-2 border-t border-pink-200/60">
                  <label className="block text-[14px] font-bold text-slate-800 mb-2">
                    Режим срабатывания автоответчика:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setGlobalMode('always')}
                      className={`p-2.5 rounded-xl border text-[14px] font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        globalMode === 'always'
                          ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white border-pink-400 shadow-xs'
                          : 'bg-white text-slate-700 border-pink-200 hover:bg-pink-50/50'
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                      <span>Всегда</span>
                      <span className="text-[12px] opacity-90">В сети и офлайн</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGlobalMode('offline')}
                      className={`p-2.5 rounded-xl border text-[14px] font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        globalMode === 'offline'
                          ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white border-pink-400 shadow-xs'
                          : 'bg-white text-slate-700 border-pink-200 hover:bg-pink-50/50'
                      }`}
                    >
                      <Moon className="w-4 h-4" />
                      <span>Только офлайн</span>
                      <span className="text-[12px] opacity-90">Когда я не в сети</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGlobalMode('online')}
                      className={`p-2.5 rounded-xl border text-[14px] font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        globalMode === 'online'
                          ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white border-pink-400 shadow-xs'
                          : 'bg-white text-slate-700 border-pink-200 hover:bg-pink-50/50'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      <span>Только онлайн</span>
                      <span className="text-[12px] opacity-90">Когда я в сети</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[14px] font-bold text-slate-800 mb-1">
                    Инструкция / промпт для автоответа:
                  </label>
                  <textarea
                    rows={4}
                    value={globalPrompt}
                    onChange={(e) => setGlobalPrompt(e.target.value)}
                    placeholder="Например: Здравствуйте! Сейчас я занят на съемках контента. Напишите суть вопроса, и я свяжусь с вами в течение часа."
                    className="w-full bg-white border border-pink-200 focus:border-pink-400 p-3 rounded-2xl text-[14px] text-slate-800 focus:outline-none shadow-xs font-normal"
                  />
                  <p className="text-[14px] text-slate-500 mt-1">
                    ИИSMM сгенерирует ответ в вашем авторском стиле, опираясь на эту инструкцию.
                  </p>
                </div>
              </div>
            )}

            {/* Personal Scope Content */}
            {scope === 'personal' && (
              <div className="space-y-3.5 bg-white/80 p-4 rounded-2xl border border-pink-200 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-[14px] font-bold text-slate-800">
                      Индивидуальный автоответчик
                    </span>
                    <span className="text-[14px] text-slate-600 font-normal">
                      Для чата с: <strong className="text-pink-600">{resolvedPartnerName}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPersonalEnabled(!personalEnabled)}
                    className={`px-4 py-1.5 rounded-2xl text-[14px] font-bold transition-all cursor-pointer ${
                      personalEnabled
                        ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {personalEnabled ? 'Включен' : 'Выключен'}
                  </button>
                </div>

                {/* Mode Selector for Personal Chat */}
                <div className="pt-2 border-t border-pink-200/60">
                  <label className="block text-[14px] font-bold text-slate-800 mb-2">
                    Режим срабатывания для этого чата:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPersonalMode('always')}
                      className={`p-2.5 rounded-xl border text-[14px] font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        personalMode === 'always'
                          ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white border-pink-400 shadow-xs'
                          : 'bg-white text-slate-700 border-pink-200 hover:bg-pink-50/50'
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                      <span>Всегда</span>
                      <span className="text-[12px] opacity-90">В сети и офлайн</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPersonalMode('offline')}
                      className={`p-2.5 rounded-xl border text-[14px] font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        personalMode === 'offline'
                          ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white border-pink-400 shadow-xs'
                          : 'bg-white text-slate-700 border-pink-200 hover:bg-pink-50/50'
                      }`}
                    >
                      <Moon className="w-4 h-4" />
                      <span>Только офлайн</span>
                      <span className="text-[12px] opacity-90">Когда я не в сети</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPersonalMode('online')}
                      className={`p-2.5 rounded-xl border text-[14px] font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        personalMode === 'online'
                          ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white border-pink-400 shadow-xs'
                          : 'bg-white text-slate-700 border-pink-200 hover:bg-pink-50/50'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      <span>Только онлайн</span>
                      <span className="text-[12px] opacity-90">Когда я в сети</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[14px] font-bold text-slate-800 mb-1">
                    Персональный промпт для этого контакта:
                  </label>
                  <textarea
                    rows={4}
                    value={personalPrompt}
                    onChange={(e) => setPersonalPrompt(e.target.value)}
                    placeholder="Например: Привет! По нашему проекту я подготовлю отчет к вечеру..."
                    className="w-full bg-white border border-pink-200 focus:border-pink-400 p-3 rounded-2xl text-[14px] text-slate-800 focus:outline-none shadow-xs font-normal"
                  />
                  <p className="text-[14px] text-slate-500 mt-1">
                    Персональный промпт имеет приоритет над единым автоответчиком.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status message */}
        {statusMessage && (
          <div className="p-3 rounded-2xl bg-white/90 border border-pink-300 text-[14px] font-bold text-pink-700 shadow-xs">
            {statusMessage}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-pink-200">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 rounded-2xl text-[14px] font-bold text-slate-700 bg-white/80 hover:bg-white border border-pink-200 transition-all cursor-pointer"
          >
            Закрыть
          </button>
          {hasOtryvTariff && (
            <button 
              type="button" 
              onClick={handleSave} 
              disabled={isSaving}
              className="px-5 py-2 rounded-2xl text-[14px] font-bold text-white bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 text-white" />
              <span>{isSaving ? 'Сохранение...' : 'Сохранить'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutoResponderModal;
