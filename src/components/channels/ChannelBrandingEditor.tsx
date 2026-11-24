import React, { useState, useEffect } from 'react';
import { Sparkles, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { Channel } from '../../types';
import { ChannelAvatarUploader } from '../selections/ChannelAvatarUploader';
import { AutoGrowVoiceTextarea } from '../ui-kit/AutoGrowVoiceTextarea';
import { usePricingConfig } from '../../hooks/usePricingConfig';
import { formatIirkyCount } from '../../shared/pricingConfig';

export interface ChannelBrandingEditorProps {
  channel: Channel;
  userId: string;
  compactMode?: boolean;
  onSaved?: (updated: Channel) => void;
  onCancel?: () => void;
  onRefreshUser?: () => void;
}

export const ChannelBrandingEditor: React.FC<ChannelBrandingEditorProps> = ({
  channel,
  userId,
  compactMode = false,
  onSaved,
  onCancel,
  onRefreshUser
}) => {
  const { pricing } = usePricingConfig(userId);
  const descCost = pricing.textAi.channelDescription;
  const descCostLabel = formatIirkyCount(descCost);
  const [name, setName] = useState(channel.name || '');
  const [username, setUsername] = useState(channel.username || '');
  const [photoUrl, setPhotoUrl] = useState(channel.photoUrl || '');
  const [description, setDescription] = useState(channel.description || '');
  const [inviteLink, setInviteLink] = useState(channel.inviteLink || '');
  const [subscribersCount, setSubscribersCount] = useState<number>(channel.subscribersCount || 0);
  const [isActive, setIsActive] = useState<boolean>(channel.isActive !== false);
  const [topicHint, setTopicHint] = useState('');
  const [syncToTelegram, setSyncToTelegram] = useState(true);

  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    setName(channel.name || '');
    setUsername(channel.username || '');
    setPhotoUrl(channel.photoUrl || '');
    setDescription(channel.description || '');
    setInviteLink(channel.inviteLink || '');
    setSubscribersCount(channel.subscribersCount || 0);
    setIsActive(channel.isActive !== false);
  }, [channel.id]);

  const handleGenerateDescription = async () => {
    setIsGeneratingDesc(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await fetch('/api/channels/generate-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({
          userId,
          channelName: name || channel.name,
          channelUsername: username || channel.username,
          topicHint,
          currentDescription: description
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось сгенерировать описание канала');
      }
      if (data.description) {
        setDescription(data.description);
        setStatusMessage(
          `Описание сгенерировано (${descCost === 0 ? 'бесплатно' : `списано: ${descCostLabel}`}). Проверьте текст и нажмите сохранить.`
        );
      }
      onRefreshUser?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка нейрогенерации описания');
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const handleSaveBranding = async () => {
    if (!name.trim()) {
      setErrorMessage('Укажите название канала');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const res = await fetch(`/api/channels/${encodeURIComponent(channel.id)}/apply-branding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({
          userId,
          name: name.trim(),
          username: username.trim(),
          description: description.slice(0, 255),
          photoUrl: photoUrl.trim(),
          inviteLink: inviteLink.trim(),
          subscribersCount,
          isActive,
          syncToTelegram,
          syncPhotoToTelegram: syncToTelegram && photoUrl.trim() !== (channel.photoUrl || '').trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка сохранения оформления канала');
      }

      const notes = Array.isArray(data.telegramSync?.notes) ? data.telegramSync.notes : [];
      setStatusMessage(
        notes.length > 0
          ? `Изменения сохранены. ${notes.join('. ')}`
          : 'Оформление и параметры канала успешно сохранены!'
      );
      onSaved?.(data.channel);
      onRefreshUser?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Не удалось сохранить оформление канала');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-sm min-w-0">
      <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-md p-4 sm:p-5 space-y-4 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-pink-300/70 pb-3">
          <div className="min-w-0">
            <h4 className="text-[16px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent break-words">
              Оформление и параметры канала «{name || channel.name}»
            </h4>
            <p className="text-[14px] text-slate-700 font-medium break-words">
              Настройте аватарку через конструктор генераций и описание канала с помощью нейросети
            </p>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 to-orange-50/90 border border-pink-300 text-slate-800 text-[14px] font-bold flex items-center gap-1 cursor-pointer hover:opacity-95"
            >
              <X className="w-4 h-4 text-pink-600" />
              <span>Закрыть</span>
            </button>
          )}
        </div>

        {/* Name & Username */}
        <div className={`grid grid-cols-1 ${compactMode ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-3 min-w-0`}>
          <div className="min-w-0">
            <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
              Название канала
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название вашего канала"
              className="w-full px-3.5 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
            />
          </div>

          <div className="min-w-0">
            <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
              Юзернейм или идентификатор
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@my_channel"
              className="w-full px-3.5 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 font-mono focus:outline-none focus:border-pink-500"
            />
          </div>

          {!compactMode && (
            <div className="min-w-0">
              <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
                Подписчики
              </label>
              <input
                type="number"
                value={subscribersCount}
                onChange={(e) => setSubscribersCount(Number(e.target.value) || 0)}
                className="w-full px-3.5 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
              />
            </div>
          )}
        </div>

        {!compactMode && (
          <div className="min-w-0">
            <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
              Пригласительная ссылка (необязательно)
            </label>
            <input
              type="url"
              value={inviteLink}
              onChange={(e) => setInviteLink(e.target.value)}
              placeholder="https://t.me/+..."
              className="w-full px-3.5 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
            />
          </div>
        )}

        {/* Channel Avatar Constructor */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 border border-pink-300 min-w-0">
          <ChannelAvatarUploader
            value={photoUrl}
            onChange={setPhotoUrl}
            channelName={name || channel.name}
            channelUsername={username || channel.username}
            userId={userId}
            label="Аватарка канала (загрузка или конструктор генераций)"
          />
        </div>

        {/* Channel Description + 1 Iirka AI Generator */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 border border-pink-300 space-y-3 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-end gap-2.5 min-w-0">
            <div className="flex-1 min-w-0">
              <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
                О чем ваш канал (подсказка для нейрогенерации описания)
              </label>
              <input
                type="text"
                value={topicHint}
                onChange={(e) => setTopicHint(e.target.value)}
                placeholder="Например: маркетинг, нейросети для бизнеса, разборы кейсов..."
                className="w-full px-3.5 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
              />
            </div>

            <button
              type="button"
              disabled={isGeneratingDesc}
              onClick={handleGenerateDescription}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 disabled:opacity-55 text-white text-[14px] font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
            >
              {isGeneratingDesc ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 shrink-0" />
              )}
              <span>
                {isGeneratingDesc ? 'Генерируем...' : `Сгенерировать описание (${descCostLabel})`}
              </span>
            </button>
          </div>

          <AutoGrowVoiceTextarea
            label="Описание канала (до 255 символов)"
            minRows={2}
            maxLength={255}
            value={description}
            onChange={setDescription}
            showClearButton={true}
            placeholder="Краткое и яркое описание вашего канала для подписчиков..."
          />

          <div className="flex items-center justify-between gap-2 flex-wrap text-[14px] text-slate-700">
            <span>Рекомендуется до 220–255 символов для полного отображения в профиле Telegram</span>
            <span className="font-bold text-pink-700">{description.length} / 255</span>
          </div>
        </div>

        {/* Telegram Sync + Active Toggles */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 text-[14px] text-slate-800 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={syncToTelegram}
                onChange={(e) => setSyncToTelegram(e.target.checked)}
                className="w-4 h-4 accent-pink-600 cursor-pointer shrink-0"
              />
              <span className="break-words">
                Передать новую аватарку и описание напрямую в Telegram (при наличии у бота права «Изменение профиля канала»)
              </span>
            </label>

            {!compactMode && (
              <label className="flex items-center gap-2.5 text-[14px] text-slate-800 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-pink-600 cursor-pointer shrink-0"
                />
                <span>Канал активен для автопубликаций</span>
              </label>
            )}
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveBranding}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 disabled:opacity-55 text-white text-[14px] font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-sm shrink-0"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Check className="w-4 h-4 shrink-0" />
            )}
            <span>{isSaving ? 'Сохраняем...' : 'Сохранить оформление канала'}</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-100/85 to-orange-100/85 border border-rose-300 text-rose-800 text-[14px] font-bold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span className="break-words">{errorMessage}</span>
          </div>
        )}

        {statusMessage && (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 to-orange-50/85 border border-pink-300 text-slate-900 text-[14px] font-bold flex items-start gap-2">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-pink-600" />
            <span className="break-words">{statusMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
