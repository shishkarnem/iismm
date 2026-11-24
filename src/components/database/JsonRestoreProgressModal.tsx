import React, { useEffect, useRef, useState } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileJson,
  Sparkles,
  X
} from 'lucide-react';
import { JsonRestoreProgressState } from './jsonRestoreRunner';

interface JsonRestoreProgressModalProps {
  state: JsonRestoreProgressState | null;
  onClose: () => void;
}

export default function JsonRestoreProgressModal({
  state,
  onClose
}: JsonRestoreProgressModalProps) {
  const [displayPercent, setDisplayPercent] = useState<number>(0);
  const activeItemRef = useRef<HTMLDivElement | null>(null);

  const isOpen = Boolean(state?.isOpen);
  const targetPercent = state?.targetPercent ?? 0;
  const status = state?.status ?? 'reading';
  const isFinished = status === 'completed' || status === 'error';

  // Smoothly animate displayed percentage toward targetPercent and gently creep while waiting on network
  useEffect(() => {
    if (!isOpen) {
      setDisplayPercent(0);
      return;
    }

    const timer = setInterval(() => {
      setDisplayPercent((prev) => {
        if (status === 'completed') {
          if (prev >= 100) return 100;
          const step = Math.max(1, (100 - prev) * 0.35);
          return Math.min(100, Number((prev + step).toFixed(1)));
        }
        if (status === 'error') {
          return prev;
        }
        if (prev < targetPercent) {
          const diff = targetPercent - prev;
          const step = Math.max(0.4, diff * 0.28);
          return Math.min(targetPercent, Number((prev + step).toFixed(1)));
        }
        // Subtle waiting creep while awaiting server chunk response (up to +2.4%, never exceeding 98.5%)
        const waitCap = Math.min(98.5, targetPercent + 2.4);
        if (prev < waitCap) {
          return Number((prev + 0.15).toFixed(1));
        }
        return prev;
      });
    }, 45);

    return () => clearInterval(timer);
  }, [isOpen, targetPercent, status]);

  // Auto-scroll active loading table into view inside the modal list
  const loadingTableKey = state?.items.find((i) => i.state === 'loading')?.table;
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [loadingTableKey]);

  if (!state || !state.isOpen) return null;

  const roundedPercent = status === 'completed' ? 100 : Math.min(99, Math.round(displayPercent));

  const statusSubtitle =
    status === 'reading'
      ? 'Ожидание чтения файла с устройства...'
      : status === 'parsing'
      ? 'Анализ таблиц и проверка совместимости колонок...'
      : status === 'uploading'
      ? 'Передача пакетов данных и запись строк в таблицы...'
      : status === 'finalizing'
      ? 'Ожидание сохранения базы данных на сервере...'
      : status === 'completed'
      ? 'Все таблицы записаны и зафиксированы на сервере'
      : 'Процесс остановлен из-за ошибки';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-[2vw] py-4 sm:p-6 backdrop-blur-md bg-gradient-to-r from-sky-200/35 via-pink-200/35 via-orange-200/35 via-pink-200/35 to-sky-200/35">
      <div className="w-full max-w-2xl min-w-0 rounded-3xl p-[2px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-2xl">
        <div className="w-full min-w-0 rounded-[22px] bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xl p-4 sm:p-6 space-y-5 text-left">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 flex items-center justify-center text-white shadow-md shrink-0">
                {!isFinished ? (
                  <>
                    <RefreshCw size={22} className="animate-spin" />
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 border-2 border-white animate-ping" />
                  </>
                ) : status === 'completed' ? (
                  <CheckCircle2 size={24} />
                ) : (
                  <AlertTriangle size={24} />
                )}
              </div>

              <div className="min-w-0">
                <h3 className="text-[18px] sm:text-[20px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent break-words leading-snug">
                  {state.stageTitle}
                </h3>
                <p className="text-[14px] font-medium text-slate-700 mt-0.5 break-words">
                  {statusSubtitle}
                </p>
              </div>
            </div>

            {isFinished && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-sm hover:opacity-95 transition-all cursor-pointer shrink-0"
                title="Закрыть окно"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Percentage & Animated Progress Bar Block */}
          <div className="rounded-2xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
            <div className="rounded-[15px] bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 p-4 space-y-3 min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileJson size={18} className="text-pink-600 shrink-0" />
                  <span className="text-[14px] font-bold text-slate-900 break-all">
                    {state.fileName}
                  </span>
                  <span className="text-[14px] text-slate-700 shrink-0">
                    · {state.fileSizeLabel}
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5 shrink-0">
                  <span className="text-[26px] sm:text-[30px] font-black bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent tabular-nums leading-none">
                    {roundedPercent}%
                  </span>
                </div>
              </div>

              {/* Progress Track */}
              <div className="w-full h-4 rounded-full p-[1px] bg-gradient-to-r from-sky-400 via-pink-400 via-orange-400 via-pink-400 to-sky-400 overflow-hidden">
                <div className="w-full h-full rounded-full bg-gradient-to-r from-sky-50/70 via-pink-50/70 via-orange-50/70 via-pink-50/70 to-sky-50/70 overflow-hidden relative">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 transition-all duration-150 ease-out relative overflow-hidden"
                    style={{ width: `${Math.max(3, displayPercent)}%` }}
                  >
                    {!isFinished && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/45 to-transparent animate-pulse" />
                    )}
                  </div>
                </div>
              </div>

              {/* Active loading item + animated waiting indicator */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2 min-w-0">
                  {!isFinished && (
                    <span className="inline-flex items-center gap-1 shrink-0" aria-hidden="true">
                      <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce [animation-delay:-0.25s]" />
                      <span className="w-2 h-2 rounded-full bg-pink-500 animate-bounce [animation-delay:-0.12s]" />
                      <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" />
                    </span>
                  )}
                  <span className="text-[14px] font-semibold text-slate-900 break-words min-w-0">
                    {state.errorMessage ? state.errorMessage : state.currentDetail}
                  </span>
                </div>

                {state.totalTables > 0 && (
                  <div className="text-[14px] font-bold text-slate-800 shrink-0 tabular-nums">
                    Таблиц: {state.processedTables} из {state.totalTables} · Записей:{' '}
                    {state.processedRows.toLocaleString('ru-RU')} из{' '}
                    {state.totalRows.toLocaleString('ru-RU')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Error Alert Block */}
          {status === 'error' && state.errorMessage && (
            <div className="rounded-2xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
              <div className="rounded-[15px] bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 p-3.5 flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-pink-600 shrink-0 mt-0.5" />
                <p className="text-[14px] font-semibold text-slate-900 break-words">
                  {state.errorMessage}
                </p>
              </div>
            </div>
          )}

          {/* Detailed Table-by-Table Live Queue */}
          {state.items.length > 0 && (
            <div className="rounded-2xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-400 via-orange-400 via-pink-400 to-sky-400">
              <div className="rounded-[15px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 p-3 sm:p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2 pb-1 border-b border-pink-300/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <Database size={16} className="text-pink-600 shrink-0" />
                    <span className="text-[14px] font-bold text-slate-900">
                      Детализация загрузки по таблицам
                    </span>
                  </div>
                  <span className="text-[14px] font-medium text-slate-700 shrink-0">
                    {state.processedTables} / {state.totalTables}
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto pr-1 space-y-2">
                  {state.items.map((item) => {
                    const itemPercent =
                      item.totalRows > 0
                        ? Math.round((item.loadedRows / item.totalRows) * 100)
                        : 100;
                    const isCurrent = item.state === 'loading';
                    const isDone = item.state === 'done';

                    return (
                      <div
                        key={item.table}
                        ref={isCurrent ? activeItemRef : null}
                        className={`rounded-xl p-2.5 transition-all border ${
                          isCurrent
                            ? 'bg-gradient-to-r from-sky-200/80 via-pink-200/80 via-orange-200/80 via-pink-200/80 to-sky-200/80 border-pink-400 shadow-xs'
                            : 'bg-gradient-to-r from-sky-50/75 via-pink-50/75 via-orange-50/75 via-pink-50/75 to-sky-50/75 border-pink-300/60'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {isDone ? (
                              <CheckCircle2 size={16} className="text-pink-600 shrink-0" />
                            ) : isCurrent ? (
                              <RefreshCw size={16} className="text-orange-600 animate-spin shrink-0" />
                            ) : (
                              <Sparkles size={16} className="text-sky-500 shrink-0 opacity-70" />
                            )}
                            <span className="text-[14px] font-bold text-slate-900 break-words">
                              {item.label}
                            </span>
                            <span className="text-[14px] font-mono text-slate-700 break-all">
                              ({item.table})
                            </span>
                          </div>

                          <div className="text-[14px] font-bold text-slate-800 tabular-nums shrink-0">
                            {isDone
                              ? `Готово · ${item.totalRows.toLocaleString('ru-RU')} зап.`
                              : isCurrent
                              ? `Загрузка ${itemPercent}% (${item.loadedRows}/${item.totalRows})`
                              : `Ожидание · ${item.totalRows.toLocaleString('ru-RU')} зап.`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Footer Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <span className="text-[14px] text-slate-700 font-medium break-words">
              {!isFinished
                ? 'Пожалуйста, не закрывайте страницу до завершения фиксации данных'
                : status === 'completed'
                ? 'Данные зафиксированы в облачной базе PostgreSql ProTalk (iismm2) и доступны в интерфейсе'
                : 'Вы можете проверить структуру файла и повторить загрузку'}
            </span>

            {isFinished && (
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 hover:opacity-95 text-white text-[14px] font-bold shadow-md transition-all cursor-pointer shrink-0 text-center"
              >
                {status === 'completed' ? 'Готово' : 'Закрыть'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
