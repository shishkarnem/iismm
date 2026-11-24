import React, { useEffect, useRef, useState } from 'react';
import {
  Cloud,
  Download,
  FileArchive,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  Users
} from 'lucide-react';
import { GradientSelect } from '../ui-kit/GradientDropdown';
import { fetchCurrentAppVersion, useAppVersion } from '../footer/useAppVersion';
import JsonRestoreProgressModal from './JsonRestoreProgressModal';
import {
  downloadFileViaFetch,
  JsonRestoreProgressState,
  runMultiFormatDatabaseRestore
} from './jsonRestoreRunner';

interface PostgresBackupCenterPanelProps {
  selectedTable?: string;
  onAfterRestore?: () => void;
  onSyncReferrals?: () => void;
  isSyncingReferrals?: boolean;
  onOpenCustomTariff?: () => void;
  triggerToast?: (type: 'success' | 'error', message: string) => void;
  compact?: boolean;
}

const EXPORT_FORMAT_OPTIONS = [
  {
    value: 'sql.gz',
    label: 'Дамп PostgreSql сжатый (.sql.gz)',
    sublabel: 'Оптимальный полный снимок таблиц и данных'
  },
  {
    value: 'sql',
    label: 'Классический дамп PostgreSql (.sql)',
    sublabel: 'Текстовый сценарий со всеми записями'
  },
  {
    value: 'json.gz',
    label: 'Сжатый архив таблиц (.json.gz)',
    sublabel: 'Компактный структурированный снимок'
  },
  {
    value: 'json',
    label: 'Структурированный снимок (.json)',
    sublabel: 'Полная выгрузка всех 50 таблиц'
  },
  {
    value: 'ndjson',
    label: 'Построчный поток записей (.ndjson)',
    sublabel: 'Удобен для потоковой обработки и аудита'
  },
  {
    value: 'csv',
    label: 'Таблица электронных таблиц (.csv)',
    sublabel: 'Экспорт выбранной таблицы с заголовками'
  }
];

const TELEGRAM_BACKUP_OPTIONS = [
  {
    value: 'bundle_gz',
    label: 'Двойной пакет (.sql.gz + .json.gz)',
    sublabel: 'Рекомендуемый ежедневный комплект в Телеграм'
  },
  {
    value: 'sql.gz',
    label: 'Сжатый дамп PostgreSql (.sql.gz)',
    sublabel: 'Транзакционный дамп в одном архиве'
  },
  {
    value: 'sql',
    label: 'Текстовый дамп PostgreSql (.sql)',
    sublabel: 'Без сжатия для прямого чтения'
  },
  {
    value: 'json.gz',
    label: 'Сжатый снимок (.json.gz)',
    sublabel: 'Структурированный архив всех таблиц'
  },
  {
    value: 'json',
    label: 'Полный снимок (.json)',
    sublabel: 'Классический формат выгрузки'
  },
  {
    value: 'ndjson',
    label: 'Потоковый дамп (.ndjson)',
    sublabel: 'Построчный экспорт всех записей'
  }
];

const RESTORE_MODE_OPTIONS = [
  {
    value: 'merge',
    label: 'Безопасное слияние и обновление записей',
    sublabel: 'Обновляет совпадения и добавляет новые строки без потери данных'
  },
  {
    value: 'replace',
    label: 'Полная перезапись восстанавливаемых таблиц',
    sublabel: 'Очищает целевые таблицы перед загрузкой из файла'
  }
];

export const PostgresBackupCenterPanel: React.FC<PostgresBackupCenterPanelProps> = ({
  selectedTable = 'users',
  onAfterRestore,
  onSyncReferrals,
  isSyncingReferrals = false,
  onOpenCustomTariff,
  triggerToast = (_type: 'success' | 'error', _message: string) => {},
  compact = false
}) => {
  const [exportFormat, setExportFormat] = useState<string>('sql.gz');
  const [telegramFormat, setTelegramFormat] = useState<string>('bundle_gz');
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [includeNativeProTalkBackup, setIncludeNativeProTalkBackup] = useState<boolean>(false);

  const appVersion = useAppVersion();
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState<boolean>(false);
  const [isCreatingCloudSnap, setIsCreatingCloudSnap] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreProgress, setRestoreProgress] = useState<JsonRestoreProgressState | null>(null);

  const [overview, setOverview] = useState<{
    snapshotsCount: number;
    triggersCount: number;
    cronCount: number;
    edgeCount: number;
  } | null>(null);

  const restoreInputRef = useRef<HTMLInputElement>(null);

  const loadProTalkOverview = async () => {
    try {
      const res = await fetch('/api/admin/db/protalk-overview');
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success) {
        setOverview({
          snapshotsCount: Array.isArray(data.snapshots) ? data.snapshots.length : 0,
          triggersCount: Array.isArray(data.triggers) ? data.triggers.length : 0,
          cronCount: Array.isArray(data.cronJobs) ? data.cronJobs.length : 0,
          edgeCount: Array.isArray(data.edgeFunctions) ? data.edgeFunctions.length : 0
        });
      }
    } catch {
      // Ignore transient network errors
    }
  };

  useEffect(() => {
    loadProTalkOverview();
  }, []);

  const handleDownloadBackup = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const tableParam =
        exportFormat === 'csv' && selectedTable
          ? `&table=${encodeURIComponent(selectedTable)}`
          : '';
      const url = `/api/admin/db/export?format=${encodeURIComponent(exportFormat)}${tableParam}`;
      const fallbackExt = exportFormat.startsWith('.') ? exportFormat : `.${exportFormat}`;
      const fallbackBase =
        exportFormat === 'csv' && selectedTable
          ? `iismm2_${selectedTable}${fallbackExt}`
          : `iismm2_backup${fallbackExt}`;
      const { filename } = await downloadFileViaFetch(url, fallbackBase);
      triggerToast('success', `Файл резервной копии «${filename}» скачан`);
    } catch (err: any) {
      triggerToast('error', err?.message || `Ошибка скачивания резервной копии (${exportFormat})`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendBackupToTelegram = async () => {
    setIsSendingTelegram(true);
    try {
      const res = await fetch('/api/admin/db/telegram-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: telegramFormat,
          triggerNative: includeNativeProTalkBackup,
          reason: `Ручная выгрузка из панели администратора (${telegramFormat})`
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        triggerToast(
          'success',
          `Бэкап отправлен в Телеграм: таблиц ${data.tablesCount || 50}, записей ${Number(
            data.totalRows || 0
          ).toLocaleString('ru-RU')}`
        );
        loadProTalkOverview();
      } else {
        triggerToast('error', data.error || 'Не удалось отправить бэкап в Телеграм');
      }
    } catch (err: any) {
      triggerToast('error', err?.message || 'Ошибка соединения при отправке бэкапа');
    } finally {
      setIsSendingTelegram(false);
    }
  };

  const handleCreateCloudSnapshot = async () => {
    setIsCreatingCloudSnap(true);
    try {
      const res = await fetch('/api/admin/db/snapshots/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        triggerToast('success', 'Облачный снимок PostgreSql ProTalk (iismm2) успешно зафиксирован');
        loadProTalkOverview();
      } else {
        triggerToast('error', data.error || 'Ошибка создания облачного снимка');
      }
    } catch (err: any) {
      triggerToast('error', err?.message || 'Ошибка сети при создании снимка');
    } finally {
      setIsCreatingCloudSnap(false);
    }
  };

  const handleRestoreFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsRestoring(true);
    try {
      const stats = await runMultiFormatDatabaseRestore(
        file,
        (nextState) => setRestoreProgress(nextState),
        {
          mode: restoreMode,
          targetTable: file.name.toLowerCase().endsWith('.csv') ? selectedTable : undefined
        }
      );
      triggerToast(
        'success',
        `База PostgreSql ProTalk восстановлена: таблиц ${stats.importedTables}, записей ${stats.importedRows.toLocaleString('ru-RU')}`
      );
      onAfterRestore?.();
      fetchCurrentAppVersion(true);
      loadProTalkOverview();
    } catch (err: any) {
      triggerToast('error', err?.message || 'Ошибка восстановления базы данных');
    } finally {
      setIsRestoring(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="rounded-3xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-md w-full min-w-0">
      <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md p-4 sm:p-6 space-y-5 min-w-0">
        <input
          ref={restoreInputRef}
          type="file"
          accept=".sql,.gz,.json,.ndjson,.jsonl,.csv"
          onChange={handleRestoreFileSelected}
          className="hidden"
        />

        {/* Header Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-pink-300/60 pb-4 min-w-0">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-sm shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[16px] sm:text-[18px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent break-words">
                  Облачное резервное копирование PostgreSql ProTalk
                </h3>
                <span className="px-2.5 py-0.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold shadow-2xs">
                  iismm2 · {appVersion}
                </span>
              </div>
              <p className="text-[14px] text-slate-700 font-medium mt-0.5 break-words">
                Мультиформатные дампы (.sql, .sql.gz, .json, .json.gz, .ndjson, .csv), авто-бэкап в Телеграм в 06:00 мск и облачные снимки
              </p>
            </div>
          </div>

          {!compact && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onSyncReferrals && (
                <button
                  type="button"
                  onClick={onSyncReferrals}
                  disabled={isSyncingReferrals}
                  className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-60"
                >
                  <Users size={16} className={isSyncingReferrals ? 'animate-spin' : ''} />
                  <span>{isSyncingReferrals ? 'Синхронизация...' : 'Сверка рефералов'}</span>
                </button>
              )}

              {onOpenCustomTariff && (
                <button
                  type="button"
                  onClick={onOpenCustomTariff}
                  className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Sparkles size={16} />
                  <span>+ Индив. тариф</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* ProTalk Cloud Platform Metrics */}
        {overview && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 min-w-0">
            <div className="p-[1px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
              <div className="rounded-[15px] bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 p-3 flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-slate-700">Облачные снимки</span>
                <span className="text-[15px] font-extrabold text-slate-900">{overview.snapshotsCount}</span>
              </div>
            </div>
            <div className="p-[1px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
              <div className="rounded-[15px] bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 p-3 flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-slate-700">Триггеры базы</span>
                <span className="text-[15px] font-extrabold text-slate-900">{overview.triggersCount}</span>
              </div>
            </div>
            <div className="p-[1px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
              <div className="rounded-[15px] bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 p-3 flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-slate-700">Задачи ProTalk Cron</span>
                <span className="text-[15px] font-extrabold text-slate-900">{overview.cronCount}</span>
              </div>
            </div>
            <div className="p-[1px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
              <div className="rounded-[15px] bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 p-3 flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-slate-700">Облачные функции</span>
                <span className="text-[15px] font-extrabold text-slate-900">{overview.edgeCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* 3 Action Columns: Download / Telegram / Restore */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
          {/* 1. Download Multi-format */}
          <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 min-w-0">
            <div className="h-full rounded-[14.5px] bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 p-4 flex flex-col justify-between gap-3 min-w-0">
              <div className="space-y-2.5 min-w-0">
                <div className="flex items-center gap-2">
                  <FileArchive size={18} className="text-pink-600 shrink-0" />
                  <span className="text-[15px] font-bold text-slate-900 break-words">
                    Скачать дамп на устройство
                  </span>
                </div>
                <GradientSelect
                  value={exportFormat}
                  onChange={setExportFormat}
                  options={EXPORT_FORMAT_OPTIONS}
                  buttonVariant="translucent"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={isDownloading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
                >
                  {isDownloading ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                  <span>{isDownloading ? 'Скачивание...' : `Скачать (${exportFormat})`}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCreateCloudSnapshot}
                  disabled={isCreatingCloudSnap}
                  title="Зафиксировать облачный снимок в инфраструктуре ProTalk"
                  className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-60"
                >
                  {isCreatingCloudSnap ? <RefreshCw size={16} className="animate-spin" /> : <Cloud size={16} />}
                  <span>Снимок</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Send Backup to Telegram */}
          <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 min-w-0">
            <div className="h-full rounded-[14.5px] bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 p-4 flex flex-col justify-between gap-3 min-w-0">
              <div className="space-y-2.5 min-w-0">
                <div className="flex items-center gap-2">
                  <Send size={18} className="text-sky-600 shrink-0" />
                  <span className="text-[15px] font-bold text-slate-900 break-words">
                    Отправка бэкапа в Телеграм
                  </span>
                </div>
                <GradientSelect
                  value={telegramFormat}
                  onChange={setTelegramFormat}
                  options={TELEGRAM_BACKUP_OPTIONS}
                  buttonVariant="translucent"
                />
                <label className="flex items-center gap-2 text-[14px] text-slate-800 font-medium cursor-pointer select-none pt-0.5">
                  <input
                    type="checkbox"
                    checked={includeNativeProTalkBackup}
                    onChange={(e) => setIncludeNativeProTalkBackup(e.target.checked)}
                    className="w-4 h-4 rounded accent-pink-500 cursor-pointer shrink-0"
                  />
                  <span className="break-words">Дублировать штатным облачным бэкапом ProTalk</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleSendBackupToTelegram}
                disabled={isSendingTelegram}
                className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
              >
                {isSendingTelegram ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                <span>{isSendingTelegram ? 'Отправка в Телеграм...' : 'Отправить в Телеграм сейчас'}</span>
              </button>
            </div>
          </div>

          {/* 3. Multi-format Restore */}
          <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 min-w-0">
            <div className="h-full rounded-[14.5px] bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 p-4 flex flex-col justify-between gap-3 min-w-0">
              <div className="space-y-2.5 min-w-0">
                <div className="flex items-center gap-2">
                  <Upload size={18} className="text-orange-600 shrink-0" />
                  <span className="text-[15px] font-bold text-slate-900 break-words">
                    Восстановление из любого формата
                  </span>
                </div>
                <GradientSelect
                  value={restoreMode}
                  onChange={(v) => setRestoreMode(v as 'merge' | 'replace')}
                  options={RESTORE_MODE_OPTIONS}
                  buttonVariant="translucent"
                />
                <p className="text-[14px] text-slate-700 break-words">
                  Поддерживаются файлы .sql, .sql.gz, .json, .json.gz, .ndjson и .csv
                </p>
              </div>

              <button
                type="button"
                onClick={() => restoreInputRef.current?.click()}
                disabled={isRestoring}
                className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
              >
                {isRestoring ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
                <span>{isRestoring ? 'Восстановление...' : 'Загрузить файл бэкапа'}</span>
              </button>
            </div>
          </div>
        </div>

        <JsonRestoreProgressModal
          state={restoreProgress}
          onClose={() => setRestoreProgress(null)}
        />
      </div>
    </div>
  );
};
