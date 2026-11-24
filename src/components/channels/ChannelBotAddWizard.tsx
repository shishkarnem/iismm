import React, { useState, useEffect } from 'react';
import { Bot, CheckCircle2, Copy, Check, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { Channel } from '../../types';
import { ChannelBrandingEditor } from './ChannelBrandingEditor';
import { usePricingConfig } from '../../hooks/usePricingConfig';
import { formatIirkyCount } from '../../shared/pricingConfig';

export interface ChannelBotAddWizardProps {
  userId: string;
  onChannelConnected?: (channel: Channel) => void;
  onChannelBrandingSaved?: (channel: Channel) => void;
  onRefresh?: () => Promise<void> | void;
}

export const ChannelBotAddWizard: React.FC<ChannelBotAddWizardProps> = ({
  userId,
  onChannelConnected,
  onChannelBrandingSaved,
  onRefresh
}) => {
  const { pricing } = usePricingConfig(userId);
  const [botUsername, setBotUsername] = useState<string>('IIrkiBot');
  const [copiedBot, setCopiedBot] = useState(false);
  const [checkUsername, setCheckUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [connectedChannel, setConnectedChannel] = useState<Channel | null>(null);

  useEffect(() => {
    fetch('/api/telegram/bot-info')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.bot_username) {
          setBotUsername(String(data.bot_username).replace(/^@/, ''));
        }
      })
      .catch(() => null);
  }, []);

  const handleCopyBot = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    navigator.clipboard?.writeText('@' + botUsername);
    setCopiedBot(true);
    setTimeout(() => setCopiedBot(false), 2000);
  };

  const handleCheckBot = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckError(null);

    const cleanInput = checkUsername.trim();
    if (!cleanInput) {
      setCheckError('Введите юзернейм канала (например @my_channel) или числовой идентификатор');
      return;
    }

    setIsChecking(true);
    try {
      const response = await fetch('/api/channels/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId || '16926299042'
        },
        body: JSON.stringify({
          username: cleanInput,
          userId: userId || '16926299042'
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Не удалось проверить бота на канале');
      }

      if (data.channel) {
        setConnectedChannel(data.channel);
        setCheckUsername('');
        onChannelConnected?.(data.channel);
      }

      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      setCheckError(
        err.message ||
          'Бот пока не найден в администраторах канала. Проверьте, что вы назначили бота администратором.'
      );
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0">
        {/* Step 1: Instructions to add bot */}
        <div className="lg:col-span-5 p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-xs min-w-0">
          <div className="h-full rounded-[22.5px] bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-md p-5 flex flex-col justify-between gap-4 min-w-0">
            <div className="space-y-3 min-w-0">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0 shadow-xs">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[16px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent break-words">
                    Шаг 1: Добавьте бота в администраторы канала
                  </h3>
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[14px] text-slate-700 font-semibold">Официальный бот:</span>
                    <button
                      type="button"
                      onClick={handleCopyBot}
                      className="inline-flex items-center gap-1.5 bg-white/90 hover:bg-white text-pink-700 border border-pink-300 px-2.5 py-0.5 rounded-xl font-mono text-[14px] font-bold cursor-pointer shadow-2xs"
                      title="Скопировать юзернейм бота"
                    >
                      <span>@{botUsername}</span>
                      {copiedBot ? (
                        <Check className="w-3.5 h-3.5 text-pink-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-pink-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <ol className="space-y-2 text-[14px] text-slate-800 font-medium leading-snug">
                <li className="flex items-start gap-2">
                  <span className="font-extrabold text-pink-600 shrink-0">1.</span>
                  <span className="break-words">
                    Откройте ваш канал в Telegram (или нажмите кнопку быстрого добавления ниже).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-extrabold text-pink-600 shrink-0">2.</span>
                  <span className="break-words">
                    Добавьте <strong>@{botUsername}</strong> в <strong>Администраторы</strong> канала.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-extrabold text-pink-600 shrink-0">3.</span>
                  <span className="break-words">
                    Включите права <strong>Публикация сообщений</strong> и <strong>Изменение профиля канала</strong> (чтобы менять аватарку и описание прямо из сервиса).
                  </span>
                </li>
              </ol>
            </div>

            <a
              href={`https://t.me/${botUsername}?startchannel`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white font-extrabold text-[14px] flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <Bot className="w-4 h-4 shrink-0" />
              <span>Открыть Telegram и добавить бота</span>
            </a>
          </div>
        </div>

        {/* Step 2: Verify Bot & Connect Channel */}
        <div className="lg:col-span-7 p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-xs min-w-0">
          <div className="h-full rounded-[22.5px] bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-md p-5 flex flex-col justify-between gap-4 min-w-0">
            <div className="space-y-3.5 min-w-0">
              <div className="flex items-center gap-2 border-b border-pink-300/70 pb-2.5">
                <CheckCircle2 className="w-5 h-5 text-pink-600 shrink-0" />
                <h3 className="text-[16px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent break-words">
                  Шаг 2: Проверьте подключение канала
                </h3>
              </div>

              <p className="text-[14px] text-slate-800 leading-relaxed font-medium break-words">
                Укажите публичный юзернейм вашего канала (например, <span className="font-mono font-bold text-pink-700">@my_blog</span>) или числовой идентификатор закрытого канала (начинается с <span className="font-mono font-bold text-pink-700">-100</span>). Система проверит права бота и подключит канал к вашему аккаунту.
              </p>

              <form onSubmit={handleCheckBot} className="space-y-3 min-w-0">
                <label className="block text-[14px] font-extrabold text-slate-800">
                  Юзернейм или идентификатор вашего канала
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5 min-w-0">
                  <div className="relative flex-1 min-w-0">
                    <span className="absolute left-3.5 top-2.5 text-pink-600 text-[14px] font-mono font-bold">
                      @
                    </span>
                    <input
                      type="text"
                      value={checkUsername.startsWith('@') ? checkUsername.substring(1) : checkUsername}
                      onChange={(e) => setCheckUsername(e.target.value)}
                      placeholder="username_вашего_канала или -100..."
                      className="w-full bg-white/90 border border-pink-300 rounded-2xl pl-8 pr-3.5 py-2.5 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500 placeholder-slate-400 font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isChecking}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 disabled:opacity-55 text-white font-extrabold text-[14px] shadow-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                  >
                    {isChecking ? (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    )}
                    <span>{isChecking ? 'Проверяем...' : 'Проверить и подключить'}</span>
                  </button>
                </div>
              </form>

              {checkError && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-100/85 to-orange-100/85 border border-rose-300 text-rose-800 text-[14px] flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-extrabold">Не удалось подключить канал</div>
                    <div className="font-medium break-words">{checkError}</div>
                  </div>
                </div>
              )}

              {connectedChannel && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 to-orange-50/90 border border-pink-300 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <Sparkles className="w-5 h-5 text-pink-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[14px] font-extrabold text-slate-900 break-words">
                        Канал «{connectedChannel.name}» успешно подключен!
                      </div>
                      <div className="text-[14px] text-slate-700 font-medium break-words">
                        Ниже вы можете сразу сгенерировать аватарку и описание канала ({formatIirkyCount(pricing.textAi.channelDescription)}).
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Step 3 immediately after channel connection: Avatar Constructor & 1-Iirka Description Editor */}
      {connectedChannel && (
        <ChannelBrandingEditor
          channel={connectedChannel}
          userId={userId}
          compactMode={true}
          onSaved={async (updated) => {
            setConnectedChannel(updated);
            onChannelBrandingSaved?.(updated);
            if (onRefresh) await onRefresh();
          }}
          onCancel={() => setConnectedChannel(null)}
          onRefreshUser={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
};
