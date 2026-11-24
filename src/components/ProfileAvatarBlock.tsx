import React, { useState } from 'react';
import { Camera, Sparkles } from 'lucide-react';
import { UserAccount } from '../types';
import NeuralSphere from './NeuralSphere';
import { ImageBuilderModal } from './image-builder';
import { getNormalizedTariffName, hasRainbowHeart } from '../utils/tariff/tariffUtils';
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from '../constants/proTalkStorage';

interface ProfileAvatarBlockProps {
  user: UserAccount;
  uploadingAvatar?: boolean;
  onAvatarFileUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAvatarGenerated?: (url: string) => void;
  onNavigateToSocial?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function ProfileAvatarBlock({
  user,
  uploadingAvatar = false,
  onAvatarFileUpload,
  onAvatarGenerated,
  onNavigateToSocial,
  className = '',
  size = 'md'
}: ProfileAvatarBlockProps) {
  const [imageLoading, setImageLoading] = useState(false);
  const [isAvatarBuilderOpen, setIsAvatarBuilderOpen] = useState(false);
  const tariffName = getNormalizedTariffName(user.tariff);
  const showRainbowHeart = Boolean((user as any).hasRainbowHeart) || hasRainbowHeart(user.tariff, user.role);

  let tariffIcon = '✨';
  if (tariffName === 'Космос') {
    tariffIcon = '👑';
  } else if (tariffName === 'Отрыв') {
    tariffIcon = '🔥';
  } else if (tariffName === 'Разгон') {
    tariffIcon = '⚡';
  }

  const handleSocialClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onNavigateToSocial) {
      onNavigateToSocial();
    } else {
      const targetPath = `/social/${user.id || user.telegramId || '16926299042'}`;
      window.history.pushState(null, '', targetPath);
      window.dispatchEvent(new Event('popstate'));
    }
  };

  const rawCandidates = [
    user.userAvatar,
    (user as any).user_avatar,
    user.photoUrl,
    (user as any).photo_url,
    user.avatarUrl
  ]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => normalizeProTalkMediaUrl(v));
  const fullGalleryCandidate = rawCandidates.find((u) => u.startsWith('https://file.pro-talk.ru/tgf/'));
  const nonLegacyCandidate = rawCandidates.find((u) => !u.includes('unsplash.com') && !u.includes('/api/avatar/'));
  const isOwnerUser = String(user.id || '').startsWith('169262990') || String(user.telegramId || '') === '169262990';
  const imageSrc =
    fullGalleryCandidate ||
    nonLegacyCandidate ||
    (isOwnerUser ? BRAND_ASSETS.ownerAvatar : BRAND_ASSETS.heartAvatar);

  const sizeClasses = {
    sm: 'w-28 h-28',
    md: 'w-40 h-40 sm:w-48 sm:h-48',
    lg: 'w-52 h-52 sm:w-60 sm:h-60'
  }[size];

  const sphereSize = size === 'sm' ? 70 : size === 'lg' ? 120 : 96;

  return (
    <div className={`relative shrink-0 ${className}`}>
      <img 
        referrerPolicy="no-referrer"
        src={imageSrc} 
        alt={user.name || user.firstName || 'Аватар'} 
        onClick={handleSocialClick}
        onLoadStart={() => setImageLoading(true)}
        onLoad={() => setImageLoading(false)}
        onError={() => setImageLoading(false)}
        className={`${sizeClasses} rounded-3xl object-cover border-4 border-orange-400 shadow-md cursor-pointer hover:opacity-95 transition-opacity`}
      />

      {/* Neural Sphere Avatar Loading / Uploading Overlay */}
      {(uploadingAvatar || imageLoading) && (
        <div className={`absolute inset-0 ${sizeClasses} rounded-3xl bg-white/75 backdrop-blur-xs flex flex-col items-center justify-center z-20 transition-all border border-pink-300 shadow-inner`}>
          <NeuralSphere size={sphereSize} />
          <span className="text-[14px] font-bold text-slate-800 mt-1 bg-white/85 px-2.5 py-0.5 rounded-full border border-pink-200 shadow-2xs">
            {uploadingAvatar ? 'Загрузка...' : 'Синхронизация...'}
          </span>
        </div>
      )}

      {/* Top-Left Edit & AI Generate Avatar Controls */}
      {(onAvatarFileUpload || onAvatarGenerated) && (
        <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5">
          {onAvatarFileUpload && (
            <label
              className="p-2 rounded-xl bg-white/85 hover:bg-white border border-pink-300 text-pink-700 cursor-pointer flex items-center justify-center active:scale-95 shadow-xs transition-all"
              title="Загрузить фото профиля с устройства"
            >
              {uploadingAvatar ? (
                <NeuralSphere size={18} glow={false} />
              ) : (
                <Camera className="w-4 h-4 text-pink-600" />
              )}
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                disabled={uploadingAvatar}
                onChange={onAvatarFileUpload} 
              />
            </label>
          )}
          {onAvatarGenerated && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsAvatarBuilderOpen(true);
              }}
              disabled={uploadingAvatar}
              className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white cursor-pointer flex items-center justify-center active:scale-95 shadow-xs transition-all"
              title="Генерация картинки для аватара профиля"
            >
              <Sparkles className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      )}

      {/* Bottom-Left Tariff Badge */}
      <button 
        type="button"
        onClick={() => {
          window.history.pushState(null, '', '/tarif');
          window.dispatchEvent(new Event('popstate'));
        }}
        className="absolute bottom-2 left-2 z-30 px-2.5 py-0.5 text-[14px] font-black text-slate-900 bg-white/80 backdrop-blur-xs rounded-xl border border-pink-200 flex items-center gap-1 shadow-2xs cursor-pointer hover:bg-white active:scale-95 transition-all"
        title={`Ваш текущий тариф: ${tariffName}. Нажмите для перехода к тарифам.`}
      >
        <span className="text-[14px]">{tariffIcon}</span>
        <span>{tariffName}</span>
      </button>

      {/* Pinned Rainbow Heart Icon (only for Razgon, Otryv, Cosmos) */}
      {showRainbowHeart && (
        <div className="absolute -top-3 -right-3 z-30 bg-transparent p-0 border-none shadow-none backdrop-blur-none cursor-pointer" title={`Значок радужного сердца — тариф ${tariffName}`}>
          <img 
            src={BRAND_ASSETS.heartAvatar} 
            alt="Радужное сердце" 
            className="w-9 h-9 sm:w-10 sm:h-10 animate-pulse drop-shadow-md object-contain"
          />
        </div>
      )}

      {onAvatarGenerated && (
        <ImageBuilderModal
          isOpen={isAvatarBuilderOpen}
          onClose={() => setIsAvatarBuilderOpen(false)}
          title="Генерация картинки"
          allowMultiple={false}
          initialAspectRatio="1:1"
          initialMode="func_621"
          initialPrompt={`Стильный современный портрет-аватар для профиля «${user.name || user.firstName || 'Автор'}», выразительное мягкое освещение, высокое качество`}
          userId={String(user.id || user.telegramId || '16926299042')}
          userBalance={Number(user.balance ?? user.pointsBalance ?? 0)}
          onSelectImage={(url) => {
            onAvatarGenerated(url);
            setIsAvatarBuilderOpen(false);
          }}
        />
      )}
    </div>
  );
}
