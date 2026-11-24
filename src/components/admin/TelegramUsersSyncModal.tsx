import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  RefreshCw,
  CheckCircle2,
  UserCheck,
  UserX,
  Image as ImageIcon,
  X,
  AlertCircle,
  Loader2,
  Square
} from 'lucide-react';

export interface TelegramSyncStats {
  total: number;
  withTelegramCount?: number;
  active: number;
  blocked: number;
  deleted: number;
  admins?: number;
  fullGalleryPhotos?: number;
}

interface BatchLogEntry {
  userId: string;
  telegramId: number | null;
  label: string;
  status: string;
  photoUpdated?: boolean;
  note?: string;
}

export interface TelegramUsersSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: (stats: TelegramSyncStats) => void;
}

export const TelegramUsersSyncModal: React.FC<TelegramUsersSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [percent, setPercent] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [photosUploadedCount, setPhotosUploadedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [stats, setStats] = useState<TelegramSyncStats>({
    total: 0,
    withTelegramCount: 0,
    active: 0,
    blocked: 0,
    deleted: 0,
    admins: 1,
    fullGalleryPhotos: 0
  });
  const [logs, setLogs] = useState<BatchLogEntry[]>([]);
  const abortRef = useRef(false);

  const runCascadingSync = async () => {
    abortRef.current = false;
    setIsRunning(true);
    setIsFinished(false);
    setErrorMsg('');
    setPercent(0);
    setProcessedCount(0);
    setPhotosUploadedCount(0);
    setLogs([]);

    try {
      const initRes = await fetch('/api/admin/tg-users-sync/init');
      const initData = await initRes.json();
      if (!initRes.ok || !initData?.success) {
        throw new Error(initData?.error || 'Не удалось инициализировать каскадную проверку');
      }

      const total = Number(initData.totalUsers || 0);
      const batchSize = Number(initData.recommendedBatchSize || 8);
      setTotalUsers(total);
      if (initData.stats) {
        setStats(initData.stats);
      }

      if (total === 0) {
        setPercent(100);
        setIsFinished(true);
        setIsRunning(false);
        return;
      }

      let offset = 0;
      let latestStats: TelegramSyncStats = initData.stats || stats;

      while (offset < total && !abortRef.current) {
        const batchRes = await fetch('/api/admin/tg-users-sync/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offset,
            batchSize,
            syncPhotos: true
          })
        });
        const batchData = await batchRes.json();
        if (!batchRes.ok || !batchData?.success) {
          throw new Error(batchData?.error || 'Ошибка при обработке пакета пользователей');
        }

        const nextOffset = Number(batchData.nextOffset ?? offset + batchSize);
        const pct = Number(batchData.percent ?? Math.min(100, Math.round((nextOffset / total) * 100)));
        setProcessedCount(nextOffset);
        setPercent(pct);

        if (batchData.stats) {
          latestStats = batchData.stats;
          setStats(batchData.stats);
        }

        if (Array.isArray(batchData.batchLogs) && batchData.batchLogs.length > 0) {
          const uploadedHere = batchData.batchLogs.filter((b: BatchLogEntry) => b.photoUpdated).length;
          if (uploadedHere > 0) {
            setPhotosUploadedCount((prev) => prev + uploadedHere);
          }
          setLogs((prev) => [...batchData.batchLogs, ...prev].slice(0, 120));
        }

        offset = nextOffset;
        if (!batchData.hasMore) break;
      }

      if (!abortRef.current) {
        setPercent(100);
        setIsFinished(true);
      }
      onSyncComplete(latestStats);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Ошибка сети при каскадной проверке пользователей');
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runCascadingSync();
    } else {
      abortRef.current = true;
    }
    return () => {
      abortRef.current = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-gradient-to-br from-sky-200/50 via-pink-200/50 via-orange-200/50 via-pink-200/50 to-sky-200/50 backdrop-blur-sm overflow-y-auto">
      <div className="my-auto w-full max-w-2xl p-[2px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-2xl min-w-0">
        <div className="rounded-[22px] bg-gradient-to-r from-sky-100/88 via-pink-100/88 via-orange-100/88 via-pink-100/88 to-sky-100/88 backdrop-blur-xl p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-pink-300/80 pb-3.5 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[17px] sm:text-[18px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent break-words">
                  Каскадное обновление пользователей Telegram
                </h3>
                <p className="text-[14px] text-slate-700 font-medium break-words">
                  Пакетная проверка диалогов и загрузка полных ссылок на фото в галерею без таймаутов
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                abortRef.current = true;
                onClose();
              }}
              className="px-3 py-1.5 rounded-2xl bg-white/85 hover:bg-white border border-pink-300 text-slate-800 text-[14px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4 text-pink-600" />
              <span>Закрыть</span>
            </button>
          </div>

          {/* Live Progress Bar */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300 space-y-2.5 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-[14px] font-extrabold text-slate-900 min-w-0">
                {isRunning ? (
                  <Loader2 className="w-4 h-4 text-pink-600 animate-spin shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-pink-600 shrink-0" />
                )}
                <span className="break-words">
                  {isRunning
                    ? `Обработано ${processedCount} из ${totalUsers} пользователей...`
                    : isFinished
                    ? `Проверка завершена и сохранена в базе (${processedCount} из ${totalUsers})`
                    : `Остановлено на ${processedCount} из ${totalUsers}`}
                </span>
              </div>
              <span className="px-3 py-0.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-extrabold font-mono shrink-0">
                {percent}%
              </span>
            </div>

            <div className="w-full h-3.5 rounded-full bg-white/85 border border-pink-300 overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 transition-all duration-300"
                style={{ width: `${Math.max(4, percent)}%` }}
              />
            </div>

            <div className="text-[14px] text-slate-700 font-medium flex flex-wrap items-center justify-between gap-2">
              <span>Пакеты по 8 аккаунтов • автосохранение на диск после каждого пакета</span>
              {photosUploadedCount > 0 && (
                <span className="text-pink-700 font-bold">
                  Новых фото в галерее: +{photosUploadedCount}
                </span>
              )}
            </div>
          </div>

          {/* Live Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 min-w-0">
            <div className="p-3 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300 min-w-0">
              <div className="text-[14px] font-bold text-sky-800">Всего в базе</div>
              <div className="text-[20px] font-extrabold text-slate-900 font-mono mt-0.5">
                {stats.total}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 to-orange-100/80 border border-pink-300 min-w-0">
              <div className="text-[14px] font-bold text-pink-800 flex items-center gap-1">
                <UserCheck className="w-4 h-4 text-pink-600 shrink-0" />
                <span>Активные</span>
              </div>
              <div className="text-[20px] font-extrabold text-slate-900 font-mono mt-0.5">
                {stats.active}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-gradient-to-r from-pink-100/80 via-orange-100/80 to-pink-100/80 border border-pink-300 min-w-0">
              <div className="text-[14px] font-bold text-orange-800 flex items-center gap-1">
                <UserX className="w-4 h-4 text-orange-600 shrink-0" />
                <span>Блок / Удален</span>
              </div>
              <div className="text-[20px] font-extrabold text-slate-900 font-mono mt-0.5">
                {stats.blocked + stats.deleted}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300 min-w-0">
              <div className="text-[14px] font-bold text-sky-800 flex items-center gap-1">
                <ImageIcon className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Фото в галерее</span>
              </div>
              <div className="text-[20px] font-extrabold text-slate-900 font-mono mt-0.5">
                {stats.fullGalleryPhotos ?? 0}
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/85 via-pink-100/85 to-orange-100/85 border border-rose-300 text-rose-800 text-[14px] font-bold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="break-words">{errorMsg}</span>
            </div>
          )}

          {/* Live Batch Log */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 border border-pink-300 space-y-2 min-w-0">
            <div className="text-[14px] font-extrabold text-slate-900">
              Журнал хода пакетного обновления:
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {logs.length === 0 ? (
                <div className="text-[14px] text-slate-700 font-medium py-2">
                  Запрашиваем первый пакет пользователей...
                </div>
              ) : (
                logs.map((entry, idx) => (
                  <div
                    key={`${entry.userId}-${idx}`}
                    className="px-3 py-1.5 rounded-xl bg-white/80 border border-pink-200/90 flex items-center justify-between gap-2 flex-wrap text-[14px]"
                  >
                    <div className="font-bold text-slate-900 break-words min-w-0">
                      {entry.label}
                      {entry.telegramId ? (
                        <span className="text-slate-600 font-mono ml-1.5">
                          ({entry.telegramId})
                        </span>
                      ) : null}
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-[14px] font-bold border shrink-0 ${
                        entry.status === 'Активный'
                          ? 'bg-sky-100/90 text-sky-900 border-sky-300'
                          : entry.status === 'Блок'
                          ? 'bg-orange-100/90 text-orange-900 border-orange-300'
                          : 'bg-pink-100/90 text-pink-900 border-pink-300'
                      }`}
                    >
                      {entry.note || entry.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-2.5 flex-wrap pt-1">
            {isRunning ? (
              <button
                type="button"
                onClick={() => {
                  abortRef.current = true;
                  setIsRunning(false);
                }}
                className="px-4 py-2.5 rounded-2xl bg-white/90 hover:bg-white border border-pink-300 text-rose-700 text-[14px] font-extrabold flex items-center gap-2 cursor-pointer"
              >
                <Square className="w-4 h-4" />
                <span>Остановить пакетный обход</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={runCascadingSync}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-extrabold flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Запустить проверку заново</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                abortRef.current = true;
                onClose();
              }}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-extrabold cursor-pointer shadow-xs"
            >
              Готово
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
