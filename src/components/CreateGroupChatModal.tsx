import React, { useState, useEffect, useRef } from 'react';
import { X, Users, Check, Sparkles, AlertCircle, Camera, Upload, Image as ImageIcon } from 'lucide-react';
import { UserAccount } from '../types';
import { useFileUpload } from '../hooks/useFileUpload';
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from '../constants/proTalkStorage';

interface SubscribedUser {
  targetId: string;
  targetName: string;
  targetUsername?: string;
  targetAvatar?: string;
}

interface CreateGroupChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  onChatCreated: (chat: any) => void;
}

export default function CreateGroupChatModal({
  isOpen,
  onClose,
  currentUser,
  onChatCreated
}: CreateGroupChatModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [subscriptions, setSubscriptions] = useState<SubscribedUser[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading: isUploadingAvatar } = useFileUpload();

  const currentUserId = String(currentUser.id || currentUser.telegramId || '16926299042');

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setDescription('');
      setAvatarUrl('');
      setSelectedMemberIds([]);
      setErrorMsg('');
      return;
    }

    const fetchSubs = async () => {
      setLoadingSubs(true);
      try {
        const res = await fetch(`/api/subscriptions?followerId=${encodeURIComponent(currentUserId)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.subscriptions)) {
          setSubscriptions(data.subscriptions);
        }
      } catch (e) {
        console.error('Error fetching subscriptions for group creation:', e);
      } finally {
        setLoadingSubs(false);
      }
    };
    fetchSubs();
  }, [isOpen, currentUserId]);

  if (!isOpen) return null;

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await upload(file);
      if (res && res.url) {
        setAvatarUrl(res.url);
      }
    } catch (err: any) {
      setErrorMsg('Не удалось загрузить аватар: ' + (err.message || 'ошибка сети'));
    }
  };

  const toggleMember = (id: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setErrorMsg('Введите название группового чата');
      return;
    }
    if (selectedMemberIds.length === 0) {
      setErrorMsg('Выберите хотя бы одного участника из ваших подписок');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/user/chats/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: currentUserId,
          title: title.trim(),
          description: description.trim(),
          avatarUrl: avatarUrl.trim() || undefined,
          memberIds: selectedMemberIds
        })
      });
      const data = await res.json();
      if (data.success && data.chat) {
        onChatCreated(data.chat);
        onClose();
      } else {
        setErrorMsg(data.error || 'Не удалось создать группу');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Ошибка при создании группового чата');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs text-left animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-gradient-to-r from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 backdrop-blur-md rounded-3xl p-6 border border-pink-300 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-pink-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs">
              <Users className="w-5 h-5" />
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">
              Создание группового чата
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/80 hover:bg-white text-slate-600 hover:text-pink-600 border border-pink-200 transition-colors cursor-pointer shadow-xs"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-pink-100/80 border border-pink-300 text-pink-700 text-[14px] font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-pink-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Avatar Upload block */}
          <div className="space-y-1.5">
            <label className="text-[14px] font-bold text-slate-800 block">
              Аватар группы
            </label>
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <img
                  src={normalizeProTalkMediaUrl(avatarUrl) || BRAND_ASSETS.logo}
                  alt="Avatar preview"
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-pink-300 shadow-xs bg-white"
                />
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-xs rounded-2xl flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="px-3.5 py-1.5 rounded-xl text-[14px] font-bold bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{isUploadingAvatar ? 'Загрузка...' : 'Загрузить файл'}</span>
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="px-2.5 py-1.5 rounded-xl text-[14px] font-semibold text-slate-600 bg-white/80 border border-pink-200 hover:bg-white cursor-pointer"
                    >
                      Сбросить
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="Или вставьте ссылку на изображение..."
                  className="w-full bg-white/90 border border-pink-200 rounded-xl px-3 py-1.5 text-[14px] font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>
          </div>

          {/* Group Title input */}
          <div className="space-y-1.5">
            <label className="text-[14px] font-bold text-slate-800 block">
              Название группы <span className="text-pink-600">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: SMM-стратегия 2026..."
              className="w-full bg-white/90 border border-pink-300 rounded-2xl px-4 py-2.5 text-[14px] font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-xs"
            />
          </div>

          {/* Group Description input */}
          <div className="space-y-1.5">
            <label className="text-[14px] font-bold text-slate-800 block">
              Описание группы
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Опишите цели, тему и правила группового чата..."
              className="w-full bg-white/90 border border-pink-300 rounded-2xl px-4 py-2.5 text-[14px] font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-xs resize-none"
            />
          </div>

          {/* Subscriptions member picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[14px] font-bold text-slate-800">
                Участники из ваших подписок <span className="text-pink-600">*</span>
              </label>
              <span className="text-[14px] font-bold text-pink-600">
                Выбрано: {selectedMemberIds.length}
              </span>
            </div>
            <p className="text-[14px] text-slate-600 font-normal">
              Групповые чаты можно создавать только из пользователей, на которых вы подписаны.
            </p>

            {loadingSubs ? (
              <div className="p-6 text-center text-[14px] font-bold text-slate-700">
                Загрузка ваших подписок...
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white/80 border border-pink-200 text-center space-y-2">
                <p className="text-[14px] font-semibold text-slate-800">
                  У вас пока нет подписок на соавторов
                </p>
                <p className="text-[14px] text-slate-600">
                  Чтобы добавить участников в группу, сначала подпишитесь на них в каталоге авторов.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    window.history.pushState(null, '', '/social/users');
                    window.dispatchEvent(new Event('popstate'));
                  }}
                  className="mt-2 px-4 py-2 rounded-xl text-[14px] font-bold bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs hover:opacity-95 cursor-pointer"
                >
                  Перейти в каталог авторов
                </button>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {subscriptions.map(sub => {
                  const isChecked = selectedMemberIds.includes(sub.targetId);
                  return (
                    <div
                      key={sub.targetId}
                      onClick={() => toggleMember(sub.targetId)}
                      className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer select-none ${
                        isChecked
                          ? 'bg-white border-pink-400 shadow-xs'
                          : 'bg-white/60 border-pink-200 hover:bg-white/80'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={normalizeProTalkMediaUrl(sub.targetAvatar) || BRAND_ASSETS.heartAvatar}
                          alt={sub.targetName}
                          className="w-10 h-10 rounded-full object-cover border border-pink-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-[14px] font-bold text-slate-900 truncate">
                            {sub.targetName}
                          </p>
                          {sub.targetUsername && (
                            <p className="text-[14px] text-slate-500 font-mono truncate">
                              {sub.targetUsername}
                            </p>
                          )}
                        </div>
                      </div>

                      <div
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          isChecked
                            ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 border-transparent text-white'
                            : 'border-pink-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check className="w-4 h-4 text-white stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t border-pink-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[14px] font-bold bg-white/90 text-slate-700 hover:bg-white border border-pink-200 shadow-xs cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={isSubmitting || !title.trim() || selectedMemberIds.length === 0}
            onClick={handleCreate}
            className="px-5 py-2 rounded-xl text-[14px] font-bold bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-md border border-white/20 hover:opacity-95 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>{isSubmitting ? 'Создание...' : 'Создать чат'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
