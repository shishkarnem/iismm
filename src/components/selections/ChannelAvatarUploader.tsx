import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Sparkles, Loader2, Check } from 'lucide-react';
import { GallerySelectModal } from '../GallerySelectModal';
import { ImageBuilderModal } from '../image-builder';

export interface ChannelAvatarUploaderProps {
  value: string;
  onChange: (url: string) => void;
  channelName?: string;
  channelUsername?: string;
  userId?: string;
  label?: string;
  onGenerateAi?: () => void;
  isGeneratingAi?: boolean;
}

export const ChannelAvatarUploader: React.FC<ChannelAvatarUploaderProps> = ({
  value,
  onChange,
  channelName = 'Канал',
  channelUsername = '',
  userId = '16926299042',
  label = 'Аватар / картинка канала (полная прямая ссылка)',
  onGenerateAi,
  isGeneratingAi = false
}) => {
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isImageBuilderOpen, setIsImageBuilderOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncingTg, setIsSyncingTg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload file from local device to our ProTalk media gallery via /api/upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', userId);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'x-user-id': userId },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const uploadedUrl = data.url || data.fullUrl || data.originalUrl || '';
        if (uploadedUrl) {
          onChange(uploadedUrl);
        }
      }
    } catch (err) {
      console.error('[ChannelAvatarUploader] Upload error:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Sync avatar directly from Telegram Bot API via /api/channel-avatar/:username
  const handleSyncFromTelegram = async () => {
    const rawU = channelUsername || channelName;
    const cleanU = rawU.replace(/^@/, '').trim();
    if (!cleanU) return;

    setIsSyncingTg(true);
    try {
      const res = await fetch(`/api/channel-avatar/${encodeURIComponent(cleanU)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.avatarUrl) {
          onChange(data.avatarUrl);
        }
      }
    } catch (err) {
      console.error('[ChannelAvatarUploader] Telegram sync error:', err);
    } finally {
      setIsSyncingTg(false);
    }
  };

  const cleanUserDisplay = channelUsername ? `@${channelUsername.replace(/^@/, '')}` : '';

  return (
    <div className="space-y-2.5">
      {/* Label */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-[14px] font-extrabold text-slate-800">
          {label}
        </label>
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Row 1: Input URL Box + Thumbnail */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://file.pro-talk.ru/tgf/..."
          className="flex-1 min-w-0 px-3.5 py-2 bg-white border border-pink-200 rounded-xl text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
        />
        {value ? (
          <div className="relative group shrink-0">
            <img
              src={value}
              alt=""
              className="w-11 h-11 rounded-xl object-cover border border-pink-200 shadow-2xs"
            />
          </div>
        ) : (
          <div className="w-11 h-11 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-[14px] shrink-0 border border-pink-200">
            {channelName?.slice(0, 2) || '📢'}
          </div>
        )}
      </div>

      {/* Row 2: Action Toolbar with standard Генерация картинки button */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 1. Upload from Device */}
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white border border-pink-300 text-[14px] font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
          title="Загрузить аватар с устройства в нашу галерею"
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-pink-600" /> : <Upload className="w-4 h-4 text-sky-600" />}
          <span>Загрузить</span>
        </button>

        {/* 2. Choose from Gallery */}
        <button
          type="button"
          onClick={() => setIsGalleryOpen(true)}
          className="px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white border border-pink-300 text-[14px] font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer shadow-2xs"
          title="Выбрать картинку из нашей медиа-галереи"
        >
          <ImageIcon className="w-4 h-4 text-pink-600" />
          <span>Из галереи</span>
        </button>

        {/* 3. Sync from Telegram */}
        {cleanUserDisplay && (
          <button
            type="button"
            disabled={isSyncingTg}
            onClick={handleSyncFromTelegram}
            className="px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white border border-pink-300 text-[14px] font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
            title="Подтянуть оригинальный аватар из Telegram и сохранить в галерею"
          >
            {isSyncingTg ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>Из Telegram</span>
          </button>
        )}

        {/* 4. Standard AI Image Generation Button */}
        <button
          type="button"
          onClick={() => setIsImageBuilderOpen(true)}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
          title="Генерация картинки через конструктор ИИ"
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>Генерация картинки</span>
        </button>
      </div>

      {/* Normal View Preview on Full Image */}
      {value && (
        <div className="p-3 rounded-2xl bg-white/90 border border-pink-200 shadow-2xs flex items-center gap-3">
          <div className="relative shrink-0">
            <img
              src={value}
              alt={channelName}
              className="w-16 h-16 rounded-2xl object-cover border border-pink-300 shadow-xs"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-[14px] text-slate-900">
                {channelName}
              </span>
              {cleanUserDisplay && (
                <span className="text-[14px] text-sky-700 font-bold">
                  {cleanUserDisplay}
                </span>
              )}
            </div>
            <p className="text-[14px] text-slate-500 truncate mt-0.5" title={value}>
              Прямая ссылка: <span className="font-mono text-slate-700">{value}</span>
            </p>
            <div className="flex items-center gap-1 mt-1 text-[14px] text-sky-800 font-bold">
              <Check className="w-3.5 h-3.5 text-sky-600" />
              <span>Корректная полная ссылка для Telegram Rich-поста</span>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Select Modal */}
      <GallerySelectModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        userId={userId}
        title="Выбор аватара канала из галереи"
        onSelect={(urls) => {
          if (urls.length > 0) {
            onChange(urls[0]);
          }
          setIsGalleryOpen(false);
        }}
      />
      {/* Image Builder Modal */}
      <ImageBuilderModal
        isOpen={isImageBuilderOpen}
        onClose={() => setIsImageBuilderOpen(false)}
        title="Генерация картинки"
        allowMultiple={false}
        initialPrompt={`Стильный профессиональный логотип и аватар Telegram канала «${channelName}». Экспертный контент, чистый дизайн.`}
        initialAspectRatio="1:1"
        initialMode="func_621"
        userId={userId}
        onSelectImage={(url) => {
          onChange(url);
          setIsImageBuilderOpen(false);
        }}
      />
    </div>
  );
};
