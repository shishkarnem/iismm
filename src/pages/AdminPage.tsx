import React, { useState, useEffect, useCallback } from 'react';
import SuperadminPanel from '../components/SuperadminPanel';
import { PostgresTableManager } from '../components/PostgresTableManager';
import GalleryView from '../components/GalleryView';
import FileUpload from '../components/FileUpload';
import TelegramBotSettings from '../components/TelegramBotSettings';
import { AdminAcademyManager } from '../components/academy/AdminAcademyManager';
import { AdminPricingPanel } from '../components/admin/pricing/AdminPricingPanel';
import { AdminPromptsTab } from '../components/admin/prompts/AdminPromptsTab';
import AdminAppVersionBar from '../components/footer/AdminAppVersionBar';
import { UserAccount } from '../types';
import { Users, FolderGit2, Clock, Bot, Sparkles, Filter, RefreshCw, Coins, BookOpen, ChevronDown, SlidersHorizontal, CheckCircle2, AlertCircle } from 'lucide-react';
import { NeurosphereLoader } from '../components/loaders/NeurosphereLoader';

interface AdminPageProps {
  currentUser: UserAccount;
  onUpdateCurrentUser: (updated: UserAccount) => void;
  allChannelsCount: number;
  currentPath?: string;
  defaultTab?: 'users' | 'pricing' | 'prompts' | 'cron' | 'bot' | 'gallery' | 'logs' | 'academy';
}

export default function AdminPage({
  currentUser,
  onUpdateCurrentUser,
  allChannelsCount,
  currentPath: propPath
}: AdminPageProps) {
  const currentPath = propPath || (typeof window !== 'undefined' ? window.location.pathname : '/admin');

  // Helper for route push
  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('popstate'));
  };

  // Determine active main section
  let activeSection: 'users' | 'pricing' | 'prompts' | 'cron' | 'bot' | 'gallery' | 'logs' | 'academy' = 'users';

  if (currentPath.startsWith('/admin/prompts')) {
    activeSection = 'prompts';
  } else if (currentPath.startsWith('/admin/academy')) {
    activeSection = 'academy';
  } else if (currentPath.startsWith('/admin/pricing')) {
    activeSection = 'pricing';
  } else if (currentPath.startsWith('/admin/bot') || currentPath.startsWith('/admin/settings')) {
    activeSection = 'bot';
  } else if (currentPath.startsWith('/admin/cron') || currentPath.startsWith('/admin/postgres/cron')) {
    activeSection = 'cron';
  } else if (currentPath.startsWith('/admin/gallery')) {
    activeSection = 'gallery';
  } else if (currentPath.startsWith('/admin/logs') || currentPath.startsWith('/admin/costs')) {
    activeSection = 'logs';
  } else {
    activeSection = 'users';
  }

  const [mobileAdminNavOpen, setMobileAdminNavOpen] = useState(false);
  const [adminToast, setAdminToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showAdminToast = useCallback((type: 'success' | 'error', message: string) => {
    setAdminToast({ type, message });
  }, []);

  useEffect(() => {
    if (!adminToast) return;
    const timer = window.setTimeout(() => setAdminToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [adminToast]);

  // Logs stats state for Task 9
  const [logsStats, setLogsStats] = useState<{
    totalCostRub: number;
    totalTokensUsed: number;
    totalRequests: number;
    avgCostPerUser: number;
    uniqueUsers: string[];
    logs: any[];
  } | null>(null);
  const [logsFilterUser, setLogsFilterUser] = useState<string>('all');
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);

  const fetchLogsStats = useCallback(async (userId = logsFilterUser) => {
    setIsLoadingLogs(true);
    try {
      const url = userId && userId !== 'all' ? `/api/admin/logs-stats?userId=${encodeURIComponent(userId)}` : '/api/admin/logs-stats';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setLogsStats(data);
      }
    } catch (e) {
      console.error('Error fetching logs stats:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [logsFilterUser]);

  useEffect(() => {
    if (activeSection === 'logs') {
      fetchLogsStats();
    }
  }, [activeSection, fetchLogsStats]);

  return (
    <div className="space-y-6 text-left">
      {/* Mobile Admin Navigation Dropdown (no horizontal scroll) */}
      <div className="md:hidden relative">
        <button
          type="button"
          onClick={() => setMobileAdminNavOpen(prev => !prev)}
          className="w-full px-4 py-3 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white font-bold text-[14px] shadow-sm flex items-center justify-between gap-2 cursor-pointer"
        >
          <span className="truncate">
            Раздел: {activeSection === 'prompts' ? 'Промпты ИИ и сценарии' : activeSection === 'pricing' ? 'Цены и ИИрки' : activeSection === 'academy' ? 'Академия (статьи Rich)' : activeSection === 'bot' ? 'Бот, прокси и бэкапы' : activeSection === 'cron' ? 'Триггеры и крон' : activeSection === 'gallery' ? 'Галерея и файлы' : activeSection === 'logs' ? 'Расход и логи затрат' : 'Пользователи и статистика'}
          </span>
          <ChevronDown className={`w-5 h-5 shrink-0 transition-transform ${mobileAdminNavOpen ? 'rotate-180' : ''}`} />
        </button>

        {mobileAdminNavOpen && (
          <div className="mt-2 p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-lg">
            <div className="rounded-[14.5px] p-2 space-y-1.5 bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md">
              {[
                { key: 'users', path: '/admin', label: 'Пользователи и статистика' },
                { key: 'prompts', path: '/admin/prompts', label: 'Промпты ИИ и сценарии' },
                { key: 'pricing', path: '/admin/pricing', label: 'Цены и ИИрки' },
                { key: 'academy', path: '/admin/academy', label: 'Академия (статьи Rich)' },
                { key: 'bot', path: '/admin/bot', label: 'Бот, прокси и бэкапы' },
                { key: 'cron', path: '/admin/cron', label: 'Триггеры и крон' },
                { key: 'gallery', path: '/admin/gallery', label: 'Галерея и файлы' },
                { key: 'logs', path: '/admin/logs', label: 'Расход и логи затрат' }
              ].map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    navigateTo(item.path);
                    setMobileAdminNavOpen(false);
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-[14px] font-bold text-left cursor-pointer ${
                    activeSection === item.key
                      ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white'
                      : 'text-slate-800 hover:bg-pink-100/60'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Desktop Admin Subpages Header Navigation */}
      <div className="hidden md:flex flex-wrap items-center gap-2 p-2 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md rounded-2xl border border-pink-300/80 shadow-xs">
        {/* 1. Пользователи & Статистика - /admin */}
        <button
          onClick={() => navigateTo('/admin')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[14px] transition-all cursor-pointer ${
            activeSection === 'users'
              ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-md scale-[1.02]'
              : 'text-slate-800 hover:bg-pink-100/60 border border-pink-300/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Пользователи и статистика</span>
        </button>

        {/* 1.2 Промпты ИИ и сценарии - /admin/prompts */}
        <button
          onClick={() => navigateTo('/admin/prompts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[14px] transition-all cursor-pointer ${
            activeSection === 'prompts'
              ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-md scale-[1.02]'
              : 'text-slate-800 hover:bg-pink-100/60 border border-pink-300/60'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Промпты ИИ и сценарии</span>
        </button>

        {/* 1.5 Цены и ИИрки - /admin/pricing */}
        <button
          onClick={() => navigateTo('/admin/pricing')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[14px] transition-all cursor-pointer ${
            activeSection === 'pricing'
              ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-md scale-[1.02]'
              : 'text-slate-800 hover:bg-pink-100/60 border border-pink-300/60'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Цены и ИИрки</span>
        </button>

        {/* 2. Академия (Markdown Rich) - /admin/academy */}
        <button
          onClick={() => navigateTo('/admin/academy')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[14px] transition-all cursor-pointer ${
            activeSection === 'academy'
              ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-md scale-[1.02]'
              : 'text-slate-800 hover:bg-pink-100/60 border border-pink-300/60'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Академия (статьи Rich)</span>
        </button>

        {/* 3. Бот & Прокси & Бэкапы - /admin/bot */}
        <button
          onClick={() => navigateTo('/admin/bot')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[14px] transition-all cursor-pointer ${
            activeSection === 'bot'
              ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-md scale-[1.02]'
              : 'text-slate-800 hover:bg-pink-100/60 border border-pink-300/60'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Бот, прокси и бэкапы</span>
        </button>

        {/* 4. Триггеры & Крон - /admin/cron */}
        <button
          onClick={() => navigateTo('/admin/cron')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[14px] transition-all cursor-pointer ${
            activeSection === 'cron'
              ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-md scale-[1.02]'
              : 'text-slate-800 hover:bg-pink-100/60 border border-pink-300/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Триггеры и крон</span>
        </button>

        {/* 5. Галерея Всех Пользователей - /admin/gallery */}
        <button
          onClick={() => navigateTo('/admin/gallery')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[14px] transition-all cursor-pointer ${
            activeSection === 'gallery'
              ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-md scale-[1.02]'
              : 'text-slate-800 hover:bg-pink-100/60 border border-pink-300/60'
          }`}
        >
          <FolderGit2 className="w-4 h-4" />
          <span>Галерея и файлы</span>
        </button>

        {/* 6. Расход ИИ & Логи затрат - /admin/logs */}
        <button
          onClick={() => navigateTo('/admin/logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[14px] transition-all cursor-pointer ${
            activeSection === 'logs'
              ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-md scale-[1.02]'
              : 'text-slate-800 hover:bg-pink-100/60 border border-pink-300/60'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Расход и логи затрат</span>
        </button>
      </div>

      {/* Centralized Build Version Control (propagates across all pages automatically) */}
      <AdminAppVersionBar />

      {/* Inline Gradient Toast Feedback */}
      {adminToast && (
        <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm">
          <div className="rounded-[14.5px] bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-md px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {adminToast.type === 'success' ? (
                <CheckCircle2 size={18} className="text-sky-600 shrink-0" />
              ) : (
                <AlertCircle size={18} className="text-rose-600 shrink-0" />
              )}
              <span className="text-[14px] font-semibold text-slate-900 break-words">
                {adminToast.message}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAdminToast(null)}
              className="px-3 py-1 rounded-xl bg-white/85 border border-pink-300 text-[14px] font-bold text-slate-800 cursor-pointer shrink-0"
            >
              Скрыть
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="transition-all">
        {activeSection === 'prompts' && (
          <AdminPromptsTab triggerToast={showAdminToast} />
        )}

        {activeSection === 'pricing' && (
          <AdminPricingPanel />
        )}

        {activeSection === 'academy' && (
          <AdminAcademyManager currentUser={currentUser} />
        )}

        {activeSection === 'users' && (
          <SuperadminPanel
            currentUser={currentUser}
            onUpdateCurrentUser={onUpdateCurrentUser}
            allChannelsCount={allChannelsCount}
          />
        )}

        {activeSection === 'bot' && (
          <TelegramBotSettings />
        )}

        {activeSection === 'cron' && (
          <div className="bg-gradient-to-r from-sky-100 via-pink-100 via-orange-100 via-pink-100 to-sky-100 backdrop-blur-md p-6 rounded-3xl border border-pink-200/80 shadow-md">
            <PostgresTableManager initialTable="cron" />
          </div>
        )}

        {activeSection === 'gallery' && (
          <GalleryView currentUser={{ role: currentUser.role || 'admin', createdAt: currentUser.createdAt || new Date().toISOString(), ...currentUser }} channels={[]} isAdminView={true} />
        )}

        {activeSection === 'logs' && (
          <div className="space-y-6">
            {/* Header & Metrics Cards */}
            <div className="bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 backdrop-blur-md border border-pink-300 rounded-3xl p-5 md:p-6 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pink-200/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2.5 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs">
                    <Coins size={20} />
                  </span>
                  <div>
                    <h2 className="text-[18px] md:text-[20px] font-bold bg-gradient-to-r from-sky-500 via-pink-600 via-orange-500 to-pink-600 bg-clip-text text-transparent">
                      Расход ИИ и затраты ProTalk (Таблица logs)
                    </h2>
                    <p className="text-[14px] text-slate-600 font-medium">
                      Учет затрат в рублях (cost_rub), токенов (tokens_used), средний расход на пользователя и фильтры
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fetchLogsStats()}
                  disabled={isLoadingLogs}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 hover:opacity-95 text-white font-bold text-[14px] shadow-xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
                >
                  <RefreshCw size={16} className={isLoadingLogs ? 'animate-spin' : ''} />
                  <span>Обновить данные</span>
                </button>
              </div>

              {/* 4 Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-white/90 border border-pink-200/90 shadow-2xs space-y-1">
                  <span className="text-[14px] font-bold text-slate-600">Сумма затрат (cost_rub):</span>
                  <div className="text-[22px] font-black bg-gradient-to-r from-sky-500 via-pink-600 to-orange-500 bg-clip-text text-transparent">
                    {logsStats ? `${logsStats.totalCostRub} ₽` : '...'}
                  </div>
                  <span className="text-[12px] text-slate-500 font-medium">Всего списано сервисами ProTalk</span>
                </div>

                <div className="p-4 rounded-2xl bg-white/90 border border-pink-200/90 shadow-2xs space-y-1">
                  <span className="text-[14px] font-bold text-slate-600">Всего токенов (tokens_used):</span>
                  <div className="text-[22px] font-black text-slate-800 font-mono">
                    {logsStats ? logsStats.totalTokensUsed.toLocaleString('ru-RU') : '...'}
                  </div>
                  <span className="text-[12px] text-slate-500 font-medium">Модерация умножается x2</span>
                </div>

                <div className="p-4 rounded-2xl bg-white/90 border border-pink-200/90 shadow-2xs space-y-1">
                  <span className="text-[14px] font-bold text-slate-600">Средний расход на пользователя:</span>
                  <div className="text-[22px] font-black text-pink-600">
                    {logsStats ? `${logsStats.avgCostPerUser} ₽` : '...'}
                  </div>
                  <span className="text-[12px] text-slate-500 font-medium">Сумма / активных пользователей</span>
                </div>

                <div className="p-4 rounded-2xl bg-white/90 border border-pink-200/90 shadow-2xs space-y-1">
                  <span className="text-[14px] font-bold text-slate-600">Всего операций в логах:</span>
                  <div className="text-[22px] font-black text-slate-800 font-mono">
                    {logsStats ? logsStats.totalRequests : '...'}
                  </div>
                  <span className="text-[12px] text-slate-500 font-medium">Генерации, модерация, картинки</span>
                </div>
              </div>

              {/* User Filter Dropdown */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter size={16} className="text-pink-600 shrink-0" />
                  <span className="text-[14px] font-bold text-slate-800 shrink-0">Фильтр по пользователю:</span>
                  <select
                    value={logsFilterUser}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLogsFilterUser(val);
                      fetchLogsStats(val);
                    }}
                    className="flex-1 sm:w-64 bg-white border border-pink-300 rounded-xl px-3 py-2 text-[14px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-2xs cursor-pointer"
                  >
                    <option value="all">Все пользователи</option>
                    {logsStats?.uniqueUsers?.map(uId => (
                      <option key={uId} value={uId}>Пользователь ID: {uId}</option>
                    ))}
                  </select>
                </div>

                {logsFilterUser !== 'all' && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogsFilterUser('all');
                      fetchLogsStats('all');
                    }}
                    className="text-[14px] font-bold text-pink-600 hover:underline cursor-pointer"
                  >
                    Сбросить фильтр
                  </button>
                )}
              </div>
            </div>

            {/* Logs Table */}
            <div className="bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 backdrop-blur-md border border-pink-300 rounded-3xl p-5 md:p-6 space-y-4 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-slate-800">
                  Записи журнала логов ({logsStats?.logs?.length || 0})
                </h3>
              </div>

              {isLoadingLogs ? (
                <NeurosphereLoader variant="inline" label="Загрузка логов..." />
              ) : !logsStats || logsStats.logs.length === 0 ? (
                <div className="py-10 text-center text-slate-500 font-medium text-[14px]">
                  Логов по выбранному фильтру не найдено
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-pink-200/80 bg-white/90 shadow-2xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-pink-200/80 bg-pink-50/50 text-[14px] font-bold text-slate-800">
                        <th className="p-3.5">Время</th>
                        <th className="p-3.5">Пользователь</th>
                        <th className="p-3.5">Функция</th>
                        <th className="p-3.5">Действие / Сообщение</th>
                        <th className="p-3.5">Токены</th>
                        <th className="p-3.5">Стоимость (cost_rub)</th>
                        <th className="p-3.5">Статус</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-pink-100 text-[14px] font-medium text-slate-700">
                      {logsStats.logs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-pink-50/30 transition-colors">
                          <td className="p-3.5 text-slate-500 text-xs font-mono whitespace-nowrap">
                            {new Date(log.created_at || Date.now()).toLocaleString('ru-RU')}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-pink-700 text-xs">
                            {log.user_id || '—'}
                          </td>
                          <td className="p-3.5 font-mono text-xs">
                            {log.function_id ? `№${log.function_id}` : 'ProTalk'}
                          </td>
                          <td className="p-3.5 text-slate-800 max-w-md break-words">
                            {log.message}
                          </td>
                          <td className="p-3.5 font-mono text-xs font-bold text-slate-800 whitespace-nowrap">
                            {log.tokens_used || 0}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-pink-600 whitespace-nowrap">
                            {log.cost_rub !== undefined ? `${Number(log.cost_rub).toFixed(2)} ₽` : '0.00 ₽'}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                              {log.decision || log.level || 'OK'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
