import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  RefreshCw,
  Check,
  Radio,
  Users,
  Link as LinkIcon,
  FileText,
  AlertCircle,
  Sparkles,
  Edit3,
  User,
  Trophy,
  Award,
  ShieldCheck,
  LayoutGrid,
  Save,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Channel, UserAccount } from '../types';
import ProfileHeader from '../components/ProfileHeader';
import { ChannelBotAddWizard } from '../components/channels/ChannelBotAddWizard';
import { ChannelBrandingEditor } from '../components/channels/ChannelBrandingEditor';
import { ChannelAvatarUploader } from '../components/selections/ChannelAvatarUploader';
import { AutoGrowVoiceTextarea } from '../components/ui-kit/AutoGrowVoiceTextarea';
import { usePricingConfig } from '../hooks/usePricingConfig';
import { formatIirkyCount } from '../shared/pricingConfig';

interface ChannelsProps {
  channels: Channel[];
  currentUser?: UserAccount | any;
  onAddChannel: (channel: Omit<Channel, 'id'>) => Promise<void>;
  onUpdateChannel: (id: string, updated: Partial<Channel>) => Promise<void>;
  onDeleteChannel: (id: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
  onLogout?: () => void;
  onAvatarFileUpload?: (e: React.ChangeEvent<React.HTMLInputElement>) => void;
}

export default function Channels({
  channels,
  currentUser,
  onAddChannel,
  onUpdateChannel,
  onDeleteChannel,
  onRefresh,
  onLogout,
  onAvatarFileUpload
}: ChannelsProps) {
  const activeUserId = currentUser?.id || '16926299042';
  const { pricing } = usePricingConfig(activeUserId);
  const descCostLabel = formatIirkyCount(pricing.textAi.channelDescription);

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isMobileTabModalOpen, setIsMobileTabModalOpen] = useState(false);

  // Manual creation states
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newIsActive, setNewIsActive] = useState(true);
  const [newSubscribers, setNewSubscribers] = useState<number>(0);
  const [newInviteLink, setNewInviteLink] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTopicHint, setNewTopicHint] = useState('');
  const [isGeneratingNewDesc, setIsGeneratingNewDesc] = useState(false);
  const [manualFormError, setManualFormError] = useState('');

  const [verificationNotice, setVerificationNotice] = useState<{
    id?: string;
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [updatingChannelId, setUpdatingChannelId] = useState<string | null>(null);
  const [deletingChannel, setDeletingChannel] = useState<{ id: string; name: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleTabClick = (tabId: string) => {
    const routeByTab: Record<string, string> = {
      profile: '/profile',
      channels: '/channels',
      tariffs: '/tarif',
      referrals: '/partner',
      multiplayer: '/teams',
      branding: '/brand',
      api_keys: '/api-keys',
      roundtable: '/roundtable',
      enterprise: '/enterprise',
      admin: '/admin'
    };
    const targetPath = routeByTab[tabId] || '/profile';
    window.history.pushState(null, '', targetPath);
    window.dispatchEvent(new Event('popstate'));
  };

  const handleUpdateChannelData = async (ch: Channel) => {
    setUpdatingChannelId(ch.id);
    setVerificationNotice(null);
    try {
      const response = await fetch(`/api/channels/${ch.id}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': activeUserId
        },
        body: JSON.stringify({ userId: activeUserId })
      });
      const data = await response.json();

      if (data.isActive) {
        setVerificationNotice({
          id: ch.id,
          type: 'success',
          message:
            data.message ||
            `Бот найден на канале «${ch.name}» и имеет права администратора! Статус обновлен на «Активен».`
        });
        await onUpdateChannel(ch.id, {
          isActive: true,
          name: data.channel?.name || ch.name,
          subscribersCount: data.channel?.subscribersCount ?? ch.subscribersCount,
          photoUrl:
            data.channel?.photoUrl ||
            ch.photoUrl ||
            `/api/channel-avatar/${encodeURIComponent((ch.username || ch.id).replace('@', ''))}`,
          description: data.channel?.description || ch.description
        });
      } else {
        setVerificationNotice({
          id: ch.id,
          type: 'error',
          message:
            data.error ||
            `Бот не найден на канале «${ch.name}» или не имеет прав администратора. Статус переключен на «Отключен».`
        });
        await onUpdateChannel(ch.id, {
          isActive: false,
          photoUrl:
            data.channel?.photoUrl ||
            ch.photoUrl ||
            `/api/channel-avatar/${encodeURIComponent((ch.username || ch.id).replace('@', ''))}`
        });
      }

      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      setVerificationNotice({
        id: ch.id,
        type: 'error',
        message:
          err.message ||
          `Ошибка проверки канала «${ch.name}». Проверьте, добавлен ли бот администратором.`
      });
      await onUpdateChannel(ch.id, { isActive: false });
      if (onRefresh) {
        await onRefresh();
      }
    } finally {
      setUpdatingChannelId(null);
    }
  };

  const handleGenerateManualDesc = async () => {
    setIsGeneratingNewDesc(true);
    setManualFormError('');
    try {
      const res = await fetch('/api/channels/generate-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': activeUserId
        },
        body: JSON.stringify({
          userId: activeUserId,
          channelName: newName || 'Мой канал',
          channelUsername: newUsername,
          topicHint: newTopicHint,
          currentDescription: newDescription
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось сгенерировать описание');
      }
      if (data.description) {
        setNewDescription(data.description);
      }
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      setManualFormError(err.message || 'Ошибка нейрогенерации описания');
    } finally {
      setIsGeneratingNewDesc(false);
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualFormError('');
    if (!newName.trim() || !newUsername.trim()) {
      setManualFormError('Пожалуйста, заполните название и юзернейм канала');
      return;
    }

    let formattedUsername = newUsername.trim();
    if (
      !formattedUsername.startsWith('@') &&
      !formattedUsername.startsWith('-100') &&
      !/^\d+$/.test(formattedUsername)
    ) {
      formattedUsername = '@' + formattedUsername;
    }

    await onAddChannel({
      userId: activeUserId,
      name: newName.trim(),
      username: formattedUsername,
      photoUrl: newPhotoUrl.trim() || undefined,
      isActive: newIsActive,
      subscribersCount: newSubscribers,
      inviteLink: newInviteLink.trim(),
      description: newDescription.trim()
    });

    setIsAddingNew(false);
    setNewName('');
    setNewUsername('');
    setNewPhotoUrl('');
    setNewIsActive(true);
    setNewSubscribers(0);
    setNewInviteLink('');
    setNewDescription('');
    setNewTopicHint('');

    if (onRefresh) {
      await onRefresh();
    }
  };

  const confirmExecuteDelete = async () => {
    if (!deletingChannel) return;
    const channelId = deletingChannel.id;
    setDeletingChannel(null);
    await onDeleteChannel(channelId);
    if (onRefresh) {
      await onRefresh();
    }
  };

  const isAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'superadmin' ||
    currentUser?.email === 'shishkarnem@gmail.com' ||
    currentUser?.email === 'airoborent@gmail.com' ||
    currentUser?.id === '169262990' ||
    currentUser?.id === '16926299042' ||
    currentUser?.telegramId === 169262990 ||
    Boolean(currentUser?.name && currentUser.name.toLowerCase().includes('шишкар'));

  const profileTabs = [
    { id: 'profile', label: 'Профиль', icon: User, color: 'text-orange-500' },
    { id: 'channels', label: 'Каналы', icon: Radio, color: 'text-pink-500' },
    { id: 'tariffs', label: 'Тарифы', icon: Trophy, color: 'text-amber-500' },
    { id: 'referrals', label: 'Партнерка', icon: Award, color: 'text-sky-500' },
    { id: 'multiplayer', label: 'Команды', icon: Users, color: 'text-purple-500' },
    ...(isAdmin ? [{ id: 'admin', label: 'Админка 👑', icon: ShieldCheck, color: 'text-pink-500' }] : [])
  ];

  return (
    <div className="space-y-6 min-w-0">
      {currentUser && (
        <ProfileHeader
          user={currentUser}
          onLogout={onLogout}
          onAvatarFileUpload={onAvatarFileUpload}
          academySectionSlug="profile-channels-teams"
        />
      )}

      {/* Mobile Vertical Dropdown Navigation (< sm) */}
      <div className="sm:hidden w-full relative min-w-0">
        <button
          onClick={() => setIsMobileTabModalOpen(true)}
          className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-md border border-pink-300 shadow-xs flex items-center justify-between text-left font-extrabold text-[14px] text-slate-900 cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-slate-600 text-[14px] font-bold">Раздел:</span>
            <span className="flex items-center gap-1.5 font-extrabold text-slate-900 text-[14px]">
              <Radio className="w-4 h-4 text-pink-600 shrink-0" />
              <span>Каналы</span>
            </span>
          </div>
          <div className="px-3 py-1 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold flex items-center gap-1 shadow-xs shrink-0">
            <span>Сменить</span>
          </div>
        </button>

        <AnimatePresence>
          {isMobileTabModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-br from-sky-200/45 via-pink-200/45 via-orange-200/45 via-pink-200/45 to-sky-200/45 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="bg-gradient-to-br from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-md rounded-3xl p-5 max-w-sm w-full border border-pink-300 shadow-xl space-y-3 text-left"
              >
                <div className="flex justify-between items-center border-b border-pink-300/70 pb-2.5">
                  <h3 className="font-extrabold text-[15px] text-slate-900 flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-pink-600" />
                    <span>Выберите раздел</span>
                  </h3>
                  <button
                    onClick={() => setIsMobileTabModalOpen(false)}
                    className="text-slate-600 hover:text-slate-900 font-bold px-2 py-1 text-[14px] cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2">
                  {profileTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        handleTabClick(tab.id);
                        setIsMobileTabModalOpen(false);
                      }}
                      className={`w-full p-3 rounded-2xl text-[14px] font-extrabold transition-all flex items-center justify-between cursor-pointer border ${
                        tab.id === 'channels'
                          ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-pink-400 shadow-sm'
                          : 'bg-white/85 hover:bg-white text-slate-800 border-pink-300/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <tab.icon
                          className={`w-4 h-4 ${tab.id === 'channels' ? 'text-white' : tab.color}`}
                        />
                        <span>{tab.label}</span>
                      </div>
                      {tab.id === 'channels' && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop Tabs Switcher */}
      <div className="hidden sm:flex flex-wrap gap-2.5 border-b border-pink-200/70 pb-3">
        {profileTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`px-4 py-2.5 rounded-2xl text-[14px] font-extrabold transition-all flex items-center gap-2 cursor-pointer border ${
              tab.id === 'channels'
                ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-sm border-pink-400'
                : 'bg-white/85 hover:bg-white text-slate-800 border-pink-200/90 shadow-2xs'
            }`}
          >
            <tab.icon className={`w-4 h-4 ${tab.id === 'channels' ? 'text-white' : tab.color}`} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Verification Notice Banner */}
      {verificationNotice && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-md border border-pink-300 shadow-xs flex items-start gap-3">
          {verificationNotice.type === 'success' ? (
            <Sparkles className="w-5 h-5 text-pink-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-[14px] font-bold text-slate-900 leading-relaxed break-words">
            {verificationNotice.message}
          </div>
          <button
            onClick={() => setVerificationNotice(null)}
            className="text-slate-600 hover:text-slate-900 px-2 py-0.5 font-bold text-[14px] cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bot Connection + Immediate Post-Connect Avatar & 1-Iirka Description Editor */}
      <ChannelBotAddWizard
        userId={activeUserId}
        onRefresh={onRefresh}
        onChannelBrandingSaved={async () => {
          if (onRefresh) await onRefresh();
        }}
      />

      {/* Manual Channel Addition Toggle & Form */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-[16px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent">
          Мои подключенные каналы ({channels.length})
        </h3>
        <button
          type="button"
          onClick={() => setIsAddingNew((prev) => !prev)}
          className="px-4 py-2 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>{isAddingNew ? 'Скрыть ручное добавление' : 'Добавить канал вручную'}</span>
        </button>
      </div>

      {isAddingNew && (
        <form
          onSubmit={handleCreateManual}
          className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-sm"
        >
          <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-md p-5 space-y-4">
            <h3 className="text-[16px] font-extrabold text-slate-900 border-b border-pink-300/70 pb-2">
              Добавить канал вручную и оформить аватарку с описанием
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
                  Название канала
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Например: Мой экспертный блог"
                  className="w-full bg-white/90 border border-pink-300 rounded-xl px-3.5 py-2 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
                  Юзернейм канала
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Например: @my_channel"
                  className="w-full bg-white/90 border border-pink-300 rounded-xl px-3.5 py-2 text-[14px] text-slate-900 font-mono focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
                  Количество подписчиков
                </label>
                <input
                  type="number"
                  value={newSubscribers}
                  onChange={(e) => setNewSubscribers(Number(e.target.value))}
                  className="w-full bg-white/90 border border-pink-300 rounded-xl px-3.5 py-2 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
                  Пригласительная ссылка
                </label>
                <input
                  type="url"
                  value={newInviteLink}
                  onChange={(e) => setNewInviteLink(e.target.value)}
                  placeholder="https://t.me/+..."
                  className="w-full bg-white/90 border border-pink-300 rounded-xl px-3.5 py-2 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 border border-pink-300">
              <ChannelAvatarUploader
                value={newPhotoUrl}
                onChange={setNewPhotoUrl}
                channelName={newName || 'Новый канал'}
                channelUsername={newUsername}
                userId={activeUserId}
                label="Аватарка канала (загрузка или конструктор генераций)"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 border border-pink-300 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-end gap-2.5">
                <div className="flex-1 min-w-0">
                  <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
                    Тематика канала для генерации описания
                  </label>
                  <input
                    type="text"
                    value={newTopicHint}
                    onChange={(e) => setNewTopicHint(e.target.value)}
                    placeholder="Например: авторский блог про дизайн и продвижение..."
                    className="w-full bg-white/90 border border-pink-300 rounded-xl px-3.5 py-2 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
                  />
                </div>
                <button
                  type="button"
                  disabled={isGeneratingNewDesc}
                  onClick={handleGenerateManualDesc}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 disabled:opacity-55 text-white text-[14px] font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  {isGeneratingNewDesc ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>Сгенерировать описание ({descCostLabel})</span>
                </button>
              </div>

              <AutoGrowVoiceTextarea
                label="Описание канала"
                minRows={2}
                maxLength={255}
                value={newDescription}
                onChange={setNewDescription}
                showClearButton={true}
                placeholder="Описание канала..."
              />
            </div>

            <label className="flex items-center gap-2 text-[14px] text-slate-800 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={newIsActive}
                onChange={(e) => setNewIsActive(e.target.checked)}
                className="w-4 h-4 accent-pink-600 cursor-pointer"
              />
              <span>Канал активен (разрешен для автопубликаций)</span>
            </label>

            {manualFormError && (
              <div className="p-3 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-100/85 to-orange-100/85 border border-rose-300 text-rose-800 text-[14px] font-bold">
                {manualFormError}
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-1 flex-wrap">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="bg-white/85 hover:bg-white border border-pink-300 text-slate-800 px-4 py-2 rounded-2xl text-[14px] font-bold cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white px-5 py-2 rounded-2xl text-[14px] font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Сохранить канал</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Channels List Grid */}
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-xs overflow-hidden">
        <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-md overflow-hidden">
          <div className="divide-y divide-pink-200/80">
            {channels.map((ch) => {
              const isEditing = editingId === ch.id;
              const isUpdating = updatingChannelId === ch.id;

              return (
                <div key={ch.id} className="p-4 sm:p-6 hover:bg-white/35 transition-all min-w-0">
                  {isEditing ? (
                    <ChannelBrandingEditor
                      channel={ch}
                      userId={activeUserId}
                      onSaved={async (updated) => {
                        await onUpdateChannel(ch.id, updated);
                        setEditingId(null);
                        if (onRefresh) await onRefresh();
                      }}
                      onCancel={() => setEditingId(null)}
                      onRefreshUser={() => {
                        if (onRefresh) onRefresh();
                      }}
                    />
                  ) : (
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5 min-w-0">
                      <div className="space-y-3.5 flex-1 min-w-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-pink-400 bg-white shrink-0 shadow-xs flex items-center justify-center">
                            <img
                              src={
                                ch.photoUrl ||
                                `/api/channel-avatar/${encodeURIComponent(
                                  (ch.username || ch.id || '').replace('@', '')
                                )}`
                              }
                              alt={ch.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.onerror = null;
                                target.src = `/api/channel-avatar/${encodeURIComponent(
                                  (ch.username || ch.id || 'chan').replace('@', '')
                                )}`;
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold text-slate-900 text-[16px] break-words">
                                {ch.name}
                              </h4>
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-xl text-[14px] font-bold border ${
                                  ch.isActive
                                    ? 'bg-sky-100/90 text-sky-900 border-sky-300'
                                    : 'bg-pink-50/90 text-slate-700 border-pink-200'
                                }`}
                              >
                                {ch.isActive ? 'Активен' : 'Отключен'}
                              </span>
                            </div>
                            <span className="text-[14px] text-pink-700 font-mono font-bold block break-all">
                              {ch.username}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300/80 p-3.5 rounded-2xl">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 p-2 rounded-xl text-white shrink-0">
                              <Users className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[14px] text-slate-600 block font-bold">
                                Подписчики
                              </span>
                              <span className="text-[14px] font-extrabold text-slate-900">
                                {ch.subscribersCount
                                  ? ch.subscribersCount.toLocaleString('ru-RU')
                                  : '0'}{' '}
                                чел.
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 p-2 rounded-xl text-white shrink-0">
                              <LinkIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[14px] text-slate-600 block font-bold">
                                Ссылка канала
                              </span>
                              {ch.inviteLink ? (
                                <a
                                  href={ch.inviteLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[14px] text-pink-700 hover:underline font-bold font-mono truncate block"
                                >
                                  {ch.inviteLink}
                                </a>
                              ) : (
                                <span className="text-[14px] text-slate-600">Не указана</span>
                              )}
                            </div>
                          </div>

                          <div className="sm:col-span-2 border-t border-pink-200/80 pt-3 flex items-start gap-2.5 min-w-0">
                            <div className="bg-pink-100/90 p-2 rounded-xl text-pink-700 shrink-0 border border-pink-300">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-[14px] text-slate-600 block font-bold">
                                Описание канала
                              </span>
                              <p className="text-[14px] text-slate-900 leading-relaxed font-medium break-words">
                                {ch.description ||
                                  `Описание пока не заполнено. Нажмите «Оформить», чтобы сгенерировать описание (${descCostLabel}) и аватарку в конструкторе.`}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap lg:self-center justify-end border-t lg:border-t-0 border-pink-200/70 pt-3 lg:pt-0">
                        <button
                          onClick={() => setEditingId(ch.id)}
                          className="px-3.5 py-2 border border-pink-300 bg-white/90 hover:bg-white text-slate-900 rounded-2xl text-[14px] font-extrabold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Отредактировать аватарку, описание с нейросетью и параметры канала"
                        >
                          <Edit3 className="w-4 h-4 text-pink-600" />
                          <span>Оформить и изменить</span>
                        </button>

                        <button
                          onClick={() => handleUpdateChannelData(ch)}
                          disabled={isUpdating}
                          className="px-4 py-2 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 disabled:opacity-55 text-white text-[14px] font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
                          title="Проверить бота и обновить данные из Telegram"
                        >
                          <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
                          <span>{isUpdating ? 'Проверка...' : 'Проверить'}</span>
                        </button>

                        <button
                          onClick={() => setDeletingChannel({ id: ch.id, name: ch.name })}
                          className="px-3.5 py-2 rounded-2xl bg-white/90 hover:bg-white text-rose-700 border border-pink-300 text-[14px] font-extrabold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Удалить канал"
                        >
                          <Trash2 className="w-4 h-4 text-orange-600" />
                          <span>Удалить</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {channels.length === 0 && (
              <div className="p-10 text-center text-slate-800 text-[15px] font-bold">
                У вас пока нет подключенных каналов. Добавьте бота в свой канал по инструкции выше и нажмите «Проверить и подключить».
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal (light translucent gradient, zero dark overlay) */}
      {deletingChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-br from-sky-200/45 via-pink-200/45 via-orange-200/45 via-pink-200/45 to-sky-200/45 backdrop-blur-sm">
          <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 max-w-md w-full shadow-xl">
            <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-md p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/90 rounded-2xl border border-pink-300 shrink-0">
                  <Trash2 className="w-5 h-5 text-orange-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[16px] font-extrabold text-slate-900">
                    Удаление канала
                  </h3>
                  <p className="text-[14px] text-slate-700 break-words">
                    Канал: <span className="font-bold text-slate-900">{deletingChannel.name}</span>
                  </p>
                </div>
              </div>

              <p className="text-[14px] text-slate-900 leading-relaxed font-semibold bg-white/85 p-3.5 rounded-2xl border border-pink-300 break-words">
                Вы действительно хотите отключить и удалить канал{' '}
                <strong className="text-pink-700">«{deletingChannel.name}»</strong> из списка ваших каналов?
              </p>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-pink-300/70 flex-wrap">
                <button
                  type="button"
                  onClick={() => setDeletingChannel(null)}
                  className="bg-white/85 hover:bg-white text-slate-900 text-[14px] font-bold px-4 py-2 rounded-2xl border border-pink-300 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={confirmExecuteDelete}
                  className="bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-extrabold px-5 py-2 rounded-2xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Да, удалить</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
