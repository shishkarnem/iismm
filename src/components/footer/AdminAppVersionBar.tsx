import React, { useState, useEffect } from 'react';
import { Tag, Save, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAppVersion, updateAppVersionOnServer, fetchCurrentAppVersion } from './useAppVersion';

export default function AdminAppVersionBar() {
  const currentVersion = useAppVersion();
  const [draftVersion, setDraftVersion] = useState<string>(currentVersion);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setDraftVersion(currentVersion);
  }, [currentVersion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftVersion.trim();
    if (!cleaned) {
      setFeedback({ kind: 'error', message: 'Введите номер версии сборки, например v.1.56' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const result = await updateAppVersionOnServer(cleaned);
      setDraftVersion(result.version);
      setFeedback({
        kind: 'ok',
        message: `Версия ${result.version} сохранена в базе данных и обновлена на всех страницах сайта`
      });
    } catch (err: any) {
      setFeedback({
        kind: 'error',
        message: err?.message || 'Ошибка при сохранении версии сборки'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefresh = async () => {
    setFeedback(null);
    const latest = await fetchCurrentAppVersion(true);
    setDraftVersion(latest.version);
  };

  return (
    <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-xs w-full min-w-0">
      <div className="rounded-[14.5px] p-4 sm:p-5 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-3 min-w-0">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 min-w-0"
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0 shadow-2xs">
              <Tag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] sm:text-[17px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent leading-snug break-words">
                Единая версия сборки сайта: {currentVersion}
              </h3>
              <p className="text-[14px] text-slate-700 font-medium leading-snug break-words">
                Хранится в базе данных на сервере и автоматически подставляется в подвал всех страниц
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full lg:w-auto min-w-0">
            <div className="p-[1.5px] rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 w-full sm:w-44">
              <input
                type="text"
                value={draftVersion}
                onChange={(e) => setDraftVersion(e.target.value)}
                placeholder="v.1.56"
                maxLength={40}
                aria-label="Версия сборки"
                className="w-full px-3.5 py-2.5 rounded-[10.5px] bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 text-slate-900 font-bold text-[14px] focus:outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 sm:flex-initial px-4 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white font-bold text-[14px] shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-opacity"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Save className="w-4 h-4 shrink-0" />
                )}
                <span>{isSaving ? 'Сохранение...' : 'Сохранить версию'}</span>
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                title="Обновить текущее значение из базы"
                className="px-3 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white font-bold text-[14px] shadow-xs flex items-center justify-center cursor-pointer transition-opacity shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>

        {feedback && (
          <div className="p-[1.5px] rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
            <div className="rounded-[10.5px] px-3.5 py-2.5 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 flex items-center gap-2 text-[14px] font-semibold text-slate-800 break-words">
              {feedback.kind === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
