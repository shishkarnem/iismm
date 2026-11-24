import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, RefreshCw, Send, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { toMskInputString, fromMskInputString } from '../../utils/timezones';

export interface ReanimateTarget {
  id: string;
  type: 'folder' | 'selection';
  title: string;
  headerTitle?: string;
  postText?: string;
  scheduledAt?: string;
  repeatPostEnabled?: boolean | number;
  repeatScheduledAt?: string;
  imageUrl?: string;
  participantsCount?: number;
}

interface ReanimateModalProps {
  isOpen: boolean;
  target: ReanimateTarget | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
  userId?: string;
}

export default function ReanimateModal({
  isOpen,
  target,
  onClose,
  onSuccess,
  userId
}: ReanimateModalProps) {
  if (!isOpen || !target) return null;

  // Helper to generate future date/time strings in Moscow timezone (forward from current moment)
  const getFutureMskDate = (hoursAhead: number = 24) => {
    const d = new Date(Date.now() + hoursAhead * 3600 * 1000);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return toMskInputString(d);
  };

  const [title, setTitle] = useState(target.title || '');
  const [scheduledAt, setScheduledAt] = useState(() => getFutureMskDate(24));
  const [postText, setPostText] = useState(target.postText || '');
  const [repeatEnabled, setRepeatEnabled] = useState(target.type === 'folder' ? (target.repeatPostEnabled !== undefined ? Boolean(target.repeatPostEnabled) : true) : false);
  const [repeatScheduledAt, setRepeatScheduledAt] = useState(() => getFutureMskDate(48));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Whenever modal opens or target changes, automatically set dates forward from current time
  useEffect(() => {
    if (target && isOpen) {
      setTitle(target.title || '');
      setPostText(target.postText || '');
      setErrorMessage('');

      // Always set fresh future publication dates forward from the current moment
      const freshMainDate = getFutureMskDate(24);
      setScheduledAt(freshMainDate);

      // For folders: always reanimate second (repeat) post and set its date forward from now (+48h)
      if (target.type === 'folder') {
        const freshRepeatDate = getFutureMskDate(48);
        setRepeatScheduledAt(freshRepeatDate);
        setRepeatEnabled(true);
      } else {
        setRepeatEnabled(false);
        setRepeatScheduledAt('');
      }
    }
  }, [target, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage('Укажите название');
      return;
    }

    if (!scheduledAt) {
      setErrorMessage('Укажите новую дату и время публикации');
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = target.type === 'folder'
        ? `/api/promo-folders/${target.id}/reanimate`
        : `/api/promo-selections/${target.id}/reanimate`;

      const payload: any = {
        userId,
        title: title.trim(),
        scheduledAt: fromMskInputString(scheduledAt),
        postText: postText.trim()
      };

      if (target.type === 'folder') {
        payload.repeatPostEnabled = repeatEnabled;
        if (repeatEnabled && repeatScheduledAt) {
          payload.repeatScheduledAt = fromMskInputString(repeatScheduledAt);
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId || ''
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка при реанимации');
      }

      onSuccess(data.message || 'Успешно реанимировано. Приглашения разосланы участникам.');
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Не удалось выполнить реанимацию');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFolder = target.type === 'folder';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/30 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl my-8 rounded-3xl bg-gradient-to-r from-sky-200/40 via-pink-200/40 via-orange-200/40 via-pink-200/40 to-sky-200/40 backdrop-blur-md border border-pink-300/80 shadow-2xl p-5 sm:p-7 space-y-5 text-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-pink-200/80">
          <div className="space-y-0.5">
            <span className="px-2.5 py-0.5 rounded-lg text-[14px] font-bold bg-pink-100/90 border border-pink-300 text-slate-800">
              {isFolder ? '📁 Реанимация папки' : '📚 Реанимация подборки'}
            </span>
            <h3 className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 to-sky-600">
              Реанимировать и выслать приглашения
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-white/80 border border-pink-200 text-slate-600 hover:text-slate-900 hover:bg-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Explainer */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/70 border border-pink-200/80 text-sm text-slate-700 space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <RefreshCw className="w-4 h-4 text-sky-600" />
            <span>Как работает реанимация:</span>
          </div>
          <ul className="text-[14px] text-slate-700 space-y-1 list-disc list-inside">
            <li>Папка или подборка возвращается в статус «Идет сбор» с новой датой.</li>
            <li>Прежние участники получают статус «приглашен» и персональное приглашение в личку Telegram.</li>
            <li>После подтверждения участником его канал автоматически возвращается в активный состав и отображается в календаре.</li>
          </ul>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50/90 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-800">
              Название:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white/80 border border-pink-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-pink-400"
              placeholder="Название папки или подборки"
              required
            />
          </div>

          {/* New Scheduled Publication Date */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-sky-600" />
              <span>Новая дата и время публикации:</span>
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white/80 border border-pink-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-pink-400"
              required
            />
          </div>

          {/* Repeat post for Folder */}
          {isFolder && (
            <div className="p-3.5 rounded-2xl bg-white/60 border border-pink-200/80 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={repeatEnabled}
                  onChange={(e) => setRepeatEnabled(e.target.checked)}
                  className="w-4 h-4 rounded-md text-pink-500 focus:ring-pink-400"
                />
                <span>Включить повторный пост (дожим)</span>
              </label>

              {repeatEnabled && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-[14px] font-semibold text-slate-700 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-orange-600" />
                    <span>Дата и время повторного поста:</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={repeatScheduledAt}
                    onChange={(e) => setRepeatScheduledAt(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white/80 border border-pink-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-pink-400"
                  />
                </div>
              )}
            </div>
          )}

          {/* Post Text */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-orange-600" />
              <span>Текст поста:</span>
            </label>
            <textarea
              rows={4}
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white/80 border border-pink-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-pink-400"
              placeholder="Рекламный текст публикации"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-pink-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-2xl text-sm font-bold bg-white/80 border border-pink-200 text-slate-700 hover:bg-white transition-all cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-2xl text-sm font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 text-white shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Реанимация...' : 'Реанимировать и разослать инвайты'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
