import React, { useEffect, useState } from 'react';
import { Activity, Bot, Coins, Database, FileText, Settings as SettingsIcon, Shield, Sparkles, Users } from 'lucide-react';
import { PostgresTableManager } from './PostgresTableManager';
import TelegramBotSettings from './TelegramBotSettings';
import { Settings, User } from '../types';
import { GradientSelect } from './ui-kit/GradientDropdown';
import { AdminSettingsTab } from './admin/AdminSettingsTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminPostsDbTab, AdminTriggersTab } from './admin/AdminTriggersAndPostsTabs';
import { AdminPricingPanel } from './admin/pricing/AdminPricingPanel';
import { AdminPromptsTab } from './admin/prompts/AdminPromptsTab';
import { notifyPricingConfigUpdated } from '../hooks/usePricingConfig';

interface SystemAdminProps {
  currentUserEmail: string;
  triggerToast: (type: 'success' | 'error', message: string) => void;
  onDeleteDayRequest?: (id: string) => Promise<void>;
  onEditPost?: (id: string) => void;
}

type AdminSubTab = 'sql' | 'prompts' | 'bot' | 'triggers' | 'posts' | 'settings' | 'pricing' | 'users';

export default function SystemAdmin({
  currentUserEmail = 'shishkarnem@gmail.com',
  triggerToast = (type, msg) => console.log(type, msg),
  onDeleteDayRequest,
  onEditPost
}: Partial<SystemAdminProps>) {
  const [systemPasswordInput, setSystemPasswordInput] = useState('');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('system_admin_unlocked') === 'true';
    }
    return false;
  });
  const [passwordError, setPasswordError] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<AdminSubTab>('sql');

  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const [posts, setPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [dbCronList, setDbCronList] = useState<any[]>([]);
  const [cronLoading, setCronLoading] = useState(false);
  const [runningCronId, setRunningCronId] = useState<string | null>(null);

  const handleUnlockSystemAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (systemPasswordInput.trim() === 'wkL35eTm') {
      setIsUnlocked(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('system_admin_unlocked', 'true');
      }
      setPasswordError('');
    } else {
      setPasswordError('Неверный системный пароль доступа');
    }
  };

  const fetchPosts = async () => {
    setPostsLoading(true);
    try {
      const res = await fetch('/api/day-requests');
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPostsLoading(false);
    }
  };

  const fetchCronList = async () => {
    setCronLoading(true);
    try {
      const res = await fetch('/api/cron');
      if (res.ok) {
        const data = await res.json();
        setDbCronList(data.items || []);
      }
    } catch (e) {
      console.error('Failed to load cron list:', e);
    } finally {
      setCronLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        triggerToast('error', 'Не удалось загрузить пользователей системы.');
      }
    } catch {
      triggerToast('error', 'Ошибка сети при загрузке пользователей.');
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      } else {
        triggerToast('error', 'Не удалось загрузить настройки системы.');
      }
    } catch {
      triggerToast('error', 'Ошибка сети при получении настроек.');
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSettings();
    fetchCronList();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'posts') {
      fetchPosts();
    }
  }, [activeSubTab]);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        notifyPricingConfigUpdated();
        triggerToast('success', 'Настройки системы успешно применены и сохранены');
      } else {
        triggerToast('error', 'Ошибка сохранения настроек.');
      }
    } catch {
      triggerToast('error', 'Ошибка сети при сохранении настроек.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleRunCronTask = async (cronId: string) => {
    setRunningCronId(cronId);
    try {
      const res = await fetch(`/api/cron/${cronId}/run`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast('success', data.result?.message || 'Фоновая задача успешно выполнена');
        await fetchCronList();
      } else {
        triggerToast('error', data.error || 'Ошибка при запуске задачи');
      }
    } catch {
      triggerToast('error', 'Ошибка сети при запуске задачи');
    } finally {
      setRunningCronId(null);
    }
  };

  const handleConfirmDeletePost = async (id: string, title: string) => {
    try {
      const cleanId = String(id || '').trim();
      if (onDeleteDayRequest) {
        await onDeleteDayRequest(cleanId);
      } else {
        const res = await fetch(`/api/day-requests/${cleanId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Ошибка при удалении');
      }
      setPosts((prev) => prev.filter((p) => String(p.id || '').trim() !== cleanId));
      triggerToast('success', `Публикация «${title}» удалена из базы данных.`);
      await fetchPosts();
    } catch {
      triggerToast('error', 'Ошибка сети при удалении публикации.');
    }
  };

  const handlePublishNow = async (post: any) => {
    try {
      const targetChannels =
        post.channels && post.channels.length > 0 ? post.channels : [post.channel || '@IIrkiBot'];
      let lastErr = '';
      let success = true;
      let fallbackNoticeMsg = '';

      for (const ch of targetChannels) {
        const res = await fetch('/api/telegram/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: ch,
            title: post.title || 'Публикация из базы',
            rawText: post.postText || post.requestTemplate || post.content || post.title || '',
            format: post.messageFormat || 'rich',
            signature: post.signature,
            attachmentType: post.attachmentType,
            attachmentUrl: post.attachmentUrl,
            attachmentUrls: post.attachmentUrls,
            inlineButtons: post.inlineButtons,
            telegramId: 169262990
          })
        });
        const data = await res.json();
        if (!data.success) {
          success = false;
          lastErr = data.error || 'Ошибка отправки';
        } else if (data.fallbackNotice) {
          fallbackNoticeMsg = data.fallbackNotice;
        }
      }

      if (success) {
        triggerToast('success', fallbackNoticeMsg || `Публикация «${post.title}» успешно отправлена`);
        await fetch(`/api/day-requests/${post.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'sent' })
        });
        await fetchPosts();
      } else {
        triggerToast('error', `Ошибка отправки: ${lastErr}`);
      }
    } catch {
      triggerToast('error', 'Ошибка сети при публикации.');
    }
  };

  const handleTestSendDM = async (post: any) => {
    try {
      const res = await fetch('/api/telegram/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: post.title || 'Публикация из базы',
          text: post.postText || post.requestTemplate || post.content || post.title || '',
          format: post.messageFormat || 'rich',
          signature: post.signature,
          attachmentType: post.attachmentType,
          attachmentUrl: post.attachmentUrl,
          attachmentUrls: post.attachmentUrls,
          inlineButtons: post.inlineButtons,
          telegramId: 169262990
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('success', `Публикация «${post.title || 'без названия'}» отправлена в личные сообщения`);
      } else {
        triggerToast('error', `Ошибка отправки: ${data.error}`);
      }
    } catch {
      triggerToast('error', 'Ошибка сети при тестовой отправке.');
    }
  };

  const adminTabOptions = [
    { value: 'sql', label: 'Инспектор базы данных', icon: <Database size={16} /> },
    { value: 'prompts', label: 'Промпты и шаблоны ИИ', icon: <Sparkles size={16} /> },
    { value: 'pricing', label: 'Цены, ИИрки и тарифы', icon: <Coins size={16} /> },
    { value: 'bot', label: 'Бот, прокси и резервные копии', icon: <Bot size={16} /> },
    { value: 'triggers', label: 'Триггеры и расписания', icon: <Activity size={16} /> },
    { value: 'posts', label: 'База публикаций', icon: <FileText size={16} /> },
    { value: 'settings', label: 'Интеграции, сборка и нейромодели', icon: <SettingsIcon size={16} /> },
    { value: 'users', label: 'Пользователи и балансы', icon: <Users size={16} /> }
  ];

  if (!isUnlocked) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-xl">
          <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-xl p-6 sm:p-8 space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 flex items-center justify-center mx-auto text-white shadow-md">
              <Shield className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-[20px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                Вход в системное администрирование
              </h2>
              <p className="text-[14px] text-slate-700 font-medium">
                Для доступа к системным параметрам введите главный пароль
              </p>
            </div>
            <form onSubmit={handleUnlockSystemAdmin} className="space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="text-[14px] text-slate-800 font-bold block">Пароль доступа</label>
                <input
                  type="password"
                  value={systemPasswordInput}
                  onChange={(e) => setSystemPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 bg-white/85 border border-pink-300 rounded-xl text-[14px] text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
              </div>
              {passwordError && (
                <p className="text-[14px] text-rose-600 font-semibold text-center">{passwordError}</p>
              )}
              <button
                type="submit"
                className="w-full py-3 px-6 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold rounded-xl shadow-md hover:brightness-105 transition-all cursor-pointer"
              >
                Войти в панель
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 min-w-0">
      {/* Переключатель разделов: вертикальный выпадающий список на мобильных и градиентные вкладки на десктопе */}
      <div className="lg:hidden">
        <GradientSelect
          label="Раздел системного администрирования"
          value={activeSubTab}
          onChange={(val) => setActiveSubTab(val as AdminSubTab)}
          options={adminTabOptions}
          buttonVariant="vivid"
        />
      </div>

      <div className="hidden lg:block p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm">
        <div className="rounded-[14.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md p-2 flex flex-wrap gap-1.5">
          {adminTabOptions.map((tab) => {
            const active = activeSubTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveSubTab(tab.value as AdminSubTab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-sm'
                    : 'text-slate-800 hover:bg-white/60'
                }`}
              >
                <span className={active ? 'text-white' : 'text-pink-600'}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeSubTab === 'sql' && <PostgresTableManager triggerToast={triggerToast} />}

      {activeSubTab === 'prompts' && <AdminPromptsTab triggerToast={triggerToast} />}

      {activeSubTab === 'bot' && (
        <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm">
          <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md p-4 sm:p-6">
            <TelegramBotSettings />
          </div>
        </div>
      )}

      {activeSubTab === 'pricing' && (
        <AdminPricingPanel triggerToast={triggerToast} />
      )}

      {activeSubTab === 'settings' && (
        <AdminSettingsTab
          settings={settings}
          settingsLoading={settingsLoading}
          isSavingSettings={isSavingSettings}
          onChangeSettings={setSettings}
          onSaveSettings={handleSaveSettings}
          triggerToast={triggerToast}
        />
      )}

      {activeSubTab === 'users' && (
        <AdminUsersTab
          users={users}
          usersLoading={usersLoading}
          currentUserEmail={currentUserEmail}
          onRefreshUsers={fetchUsers}
          triggerToast={triggerToast}
        />
      )}

      {activeSubTab === 'triggers' && (
        <AdminTriggersTab
          dbCronList={dbCronList}
          cronLoading={cronLoading}
          runningCronId={runningCronId}
          onRunCronTask={handleRunCronTask}
        />
      )}

      {activeSubTab === 'posts' && (
        <AdminPostsDbTab
          posts={posts}
          postsLoading={postsLoading}
          onRefreshPosts={fetchPosts}
          onEditPost={onEditPost}
          onTestSendDM={handleTestSendDM}
          onPublishNow={handlePublishNow}
          onConfirmDeletePost={handleConfirmDeletePost}
        />
      )}
    </div>
  );
}
