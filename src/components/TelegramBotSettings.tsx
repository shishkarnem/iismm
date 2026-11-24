import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  Globe,
  Key,
  RefreshCw,
  Save
} from 'lucide-react';
import { PostgresBackupCenterPanel } from './database/PostgresBackupCenterPanel';

interface BotConfigData {
  botUsername: string;
  proxyType: 'dialog_ai' | 'custom_cloudflare' | 'direct';
  apiBaseUrl: string;
  adminTelegramId: string;
  isTokenConfigured: boolean;
  maskedToken: string;
}

export default function TelegramBotSettings() {
  const [config, setConfig] = useState<BotConfigData>({
    botUsername: '@IIrkiBot',
    proxyType: 'dialog_ai',
    apiBaseUrl: 'https://eu1.account.dialog.ai.atiks.org',
    adminTelegramId: '169262990',
    isTokenConfigured: true,
    maskedToken: '814246••••••••Xn_o'
  });

  const [tokenInput, setTokenInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/bot-settings');
      if (res.ok) {
        const data = await res.json();
        const nextProxyType = data.proxyType === 'direct' ? 'dialog_ai' : (data.proxyType || 'dialog_ai');
        const nextBase =
          !data.apiBaseUrl || String(data.apiBaseUrl).includes('api.telegram.org')
            ? 'https://eu1.account.dialog.ai.atiks.org'
            : data.apiBaseUrl;
        setConfig({
          ...data,
          proxyType: nextProxyType,
          apiBaseUrl: nextBase
        });
      }
    } catch (e) {
      console.error('Failed to fetch bot settings:', e);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const payload: Record<string, any> = {
        botUsername: config.botUsername,
        proxyType: config.proxyType,
        apiBaseUrl: config.apiBaseUrl,
        adminTelegramId: config.adminTelegramId
      };

      if (tokenInput.trim()) {
        payload.botToken = tokenInput.trim();
      }

      const res = await fetch('/api/admin/bot-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({
          type: 'success',
          text: 'Настройки и токен бота сохранены в облачной базе PostgreSql ProTalk (iismm2)'
        });
        setTokenInput('');
        fetchConfig();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Ошибка сохранения настроек' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Сетевая ошибка при сохранении' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-left min-w-0">
      {/* Header card */}
      <div className="rounded-3xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-md">
        <div className="bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-md p-4 sm:p-6 rounded-[22.5px]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 flex items-center justify-center text-white shadow-md shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[18px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent break-words">
                Безопасность Телеграм, прокси и резервные копии PostgreSql
              </h2>
              <p className="text-[14px] font-medium text-slate-700 break-words">
                Управление токеном бота, шлюзами доставки и мультиформатными резервными копиями базы iismm2
              </p>
            </div>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-2xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
          <div className="p-4 rounded-[14.5px] bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 flex items-center gap-3 text-[14px] font-semibold text-slate-900">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-pink-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
            )}
            <span className="break-words">{statusMessage.text}</span>
          </div>
        </div>
      )}

      {/* Multi-Format Backup & Restore Center */}
      <PostgresBackupCenterPanel
        compact={true}
        onAfterRestore={fetchConfig}
        triggerToast={(type, message) => setStatusMessage({ type, text: message })}
      />

      {/* Main Bot Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-3xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
          <div className="bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md p-4 sm:p-6 rounded-[22.5px] space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-pink-300/60">
              <Key className="w-4 h-4 text-pink-600" />
              <h3 className="text-[15px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                Токен бота и идентификация
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-slate-800">Юзернейм бота</label>
                <input
                  type="text"
                  value={config.botUsername}
                  onChange={(e) => setConfig({ ...config, botUsername: e.target.value })}
                  placeholder="@IIrkiBot"
                  className="w-full px-4 py-2.5 rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-slate-800">
                  Идентификатор администратора в Телеграм для бэкапов
                </label>
                <input
                  type="text"
                  value={config.adminTelegramId}
                  onChange={(e) => setConfig({ ...config, adminTelegramId: e.target.value })}
                  placeholder="169262990"
                  className="w-full px-4 py-2.5 rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-[14px] font-semibold text-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span>Токен бота Телеграм (хранится в защищенной таблице PostgreSql)</span>
                {config.isTokenConfigured && (
                  <span className="text-[14px] text-pink-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Установлен ({config.maskedToken})
                  </span>
                )}
              </label>
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder={
                  config.isTokenConfigured ? 'Введите новый токен для замены...' : 'Введите токен бота'
                }
                className="w-full px-4 py-2.5 rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 text-[14px] text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
              <p className="text-[14px] text-slate-700">
                Оставьте пустым, если не требуется менять текущий действующий токен.
              </p>
            </div>
          </div>
        </div>

        {/* Proxy routing */}
        <div className="rounded-3xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
          <div className="bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md p-4 sm:p-6 rounded-[22.5px] space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-pink-300/60">
              <Globe className="w-4 h-4 text-sky-600" />
              <h3 className="text-[15px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                Проксирование отправки сообщений
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label
                onClick={() =>
                  setConfig({
                    ...config,
                    proxyType: 'dialog_ai',
                    apiBaseUrl: 'https://eu1.account.dialog.ai.atiks.org'
                  })
                }
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  config.proxyType === 'dialog_ai'
                    ? 'border-pink-400 bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 shadow-xs'
                    : 'border-pink-300/70 bg-gradient-to-r from-sky-50/70 via-pink-50/70 via-orange-50/70 via-pink-50/70 to-sky-50/70'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="proxyType"
                    checked={config.proxyType !== 'custom_cloudflare'}
                    onChange={() => {}}
                    className="accent-pink-500"
                  />
                  <span className="text-[14px] font-bold text-slate-900">Европейский шлюз (рекомендуется)</span>
                </div>
                <p className="text-[14px] text-slate-700 break-words">
                  eu1.account.dialog.ai.atiks.org — единый скоростной шлюз без блокировок для всех запросов в Телеграм
                </p>
              </label>

              <label
                onClick={() => setConfig({ ...config, proxyType: 'custom_cloudflare' })}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  config.proxyType === 'custom_cloudflare'
                    ? 'border-pink-400 bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 shadow-xs'
                    : 'border-pink-300/70 bg-gradient-to-r from-sky-50/70 via-pink-50/70 via-orange-50/70 via-pink-50/70 to-sky-50/70'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="proxyType"
                    checked={config.proxyType === 'custom_cloudflare'}
                    onChange={() => {}}
                    className="accent-pink-500"
                  />
                  <span className="text-[14px] font-bold text-slate-900">Пользовательский прокси</span>
                </div>
                <p className="text-[14px] text-slate-700 break-words">
                  Собственный домен обратного прокси с автоматическим резервированием через eu1.account.dialog.ai.atiks.org
                </p>
              </label>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-[14px] font-semibold text-slate-800">
                Базовый адрес шлюза Телеграм
              </label>
              <input
                type="text"
                value={config.apiBaseUrl}
                onChange={(e) => setConfig({ ...config, apiBaseUrl: e.target.value })}
                disabled={config.proxyType !== 'custom_cloudflare'}
                placeholder="https://eu1.account.dialog.ai.atiks.org"
                className="w-full px-4 py-2.5 rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 text-[14px] text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-pink-400 disabled:opacity-70"
              />
            </div>
          </div>
        </div>

        {/* Schedule & Multi-Format Backup Info */}
        <div className="rounded-3xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
          <div className="bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md p-4 sm:p-6 rounded-[22.5px] space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-pink-300/60">
              <Database className="w-4 h-4 text-orange-600" />
              <h3 className="text-[15px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                Расписание автоматического резервного копирования PostgreSql
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[14px]">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50/75 via-pink-50/75 via-orange-50/75 via-pink-50/75 to-sky-50/75 border border-pink-300/70 space-y-1">
                <span className="text-slate-700 font-medium">Расписание выгрузки</span>
                <p className="text-[14px] font-bold text-slate-900">Ежедневно в 06:00 мск + облачный снимок</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50/75 via-pink-50/75 via-orange-50/75 via-pink-50/75 to-sky-50/75 border border-pink-300/70 space-y-1">
                <span className="text-slate-700 font-medium">Получатель файлов</span>
                <p className="text-[14px] font-bold text-slate-900">Аккаунт: {config.adminTelegramId}</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50/75 via-pink-50/75 via-orange-50/75 via-pink-50/75 to-sky-50/75 border border-pink-300/70 space-y-1">
                <span className="text-slate-700 font-medium">Формат ежедневного пакета</span>
                <p className="text-[14px] font-bold text-slate-900">Архивы .sql.gz и .json.gz (с контрольной суммой)</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white font-bold text-[14px] shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Сохранить настройки бота</span>
          </button>
        </div>
      </form>
    </div>
  );
}
