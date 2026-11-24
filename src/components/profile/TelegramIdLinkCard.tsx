import React, { useState } from 'react';
import {
  Smartphone,
  Bot,
  Lock,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X
} from 'lucide-react';

export interface TelegramLinkedResult {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  photoUrl?: string;
  balance?: number;
  bonusGranted?: boolean;
}

export interface TelegramIdLinkCardProps {
  userId: string;
  isModal?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  onLinked?: (result: TelegramLinkedResult) => void | Promise<void>;
}

export const TelegramIdLinkCard: React.FC<TelegramIdLinkCardProps> = ({
  userId,
  isModal = false,
  isOpen = true,
  onClose,
  onLinked
}) => {
  const [telegramIdInput, setTelegramIdInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (isModal && !isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanId = telegramIdInput.replace(/\D/g, '').trim();
    if (!cleanId || cleanId.length < 4) {
      setErrorMsg('Пожалуйста, укажите корректный числовой идентификатор Telegram (только цифры).');
      return;
    }
    if (!passwordInput.trim() || !confirmPasswordInput.trim()) {
      setErrorMsg('Введите ваш пароль от кабинета и повторите пароль для подтверждения привязки.');
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      setErrorMsg('Введенные пароли не совпадают. Проверьте оба поля пароля.');
      return;
    }
    if (passwordInput.length < 4) {
      setErrorMsg('Пароль должен содержать минимум 4 символа.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/account/link-telegram-by-id', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({
          userId,
          telegramId: cleanId,
          username: usernameInput.trim(),
          password: passwordInput,
          confirmPassword: confirmPasswordInput
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(
          data?.error ||
            'Не удалось привязать аккаунт Telegram. Убедитесь, что вы запустили нашего бота @IIrkiBot и ввели верный пароль.'
        );
      }

      setSuccessMsg(
        data.message ||
          'Аккаунт Telegram успешно проверен, фото загружено в галерею полной ссылкой и привязано к вашему кабинету!'
      );
      setPasswordInput('');
      setConfirmPasswordInput('');

      if (onLinked && data.linked) {
        await onLinked(data.linked);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Ошибка при проверке и привязке идентификатора Telegram');
    } finally {
      setSubmitting(false);
    }
  };

  const cardInner = (
    <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-md min-w-0">
      <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/88 via-pink-100/88 via-orange-100/88 via-pink-100/88 to-sky-100/88 backdrop-blur-xl p-4 sm:p-6 space-y-4 text-left min-w-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-pink-300/80 pb-3 min-w-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[17px] sm:text-[18px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent break-words">
                Привязка своего Telegram по идентификатору (+300 Иирок)
              </h3>
              <p className="text-[14px] text-slate-700 font-medium pt-0.5 break-words">
                Удобный способ без открытия мини-приложения (если сайт работает напрямую без впн, а мессенджер открыт отдельно)
              </p>
            </div>
          </div>

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-2xl bg-white/85 hover:bg-white border border-pink-300 text-slate-800 text-[14px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4 text-pink-600" />
              <span>Закрыть</span>
            </button>
          )}
        </div>

        {/* Step-by-step instructions with @my_id_bot and @IIrkiBot */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 to-orange-100/80 border border-pink-300 space-y-2 min-w-0">
            <div className="text-[14px] font-extrabold text-slate-900 flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white text-[14px] font-extrabold flex items-center justify-center shrink-0">
                1
              </span>
              <span>Узнайте свой числовой идентификатор</span>
            </div>
            <p className="text-[14px] text-slate-800 font-medium leading-snug break-words">
              Откройте стороннего справочного бота в мессенджере и нажмите «Запустить» — он сразу пришлет цифры вашего идентификатора:
            </p>
            <a
              href="https://t.me/my_id_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-extrabold shadow-xs cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              <span>Открыть @my_id_bot</span>
            </a>
          </div>

          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 to-orange-100/80 border border-pink-300 space-y-2 min-w-0">
            <div className="text-[14px] font-extrabold text-slate-900 flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white text-[14px] font-extrabold flex items-center justify-center shrink-0">
                2
              </span>
              <span>Обязательно запустите нашего бота</span>
            </div>
            <p className="text-[14px] text-slate-800 font-medium leading-snug break-words">
              Перейдите в нашего бота и нажмите «Запустить», чтобы система проверила аккаунт, считала имя и загрузила фото в галерею:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="https://t.me/IIrkiBot?start=connect"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-extrabold shadow-xs cursor-pointer"
              >
                <Bot className="w-4 h-4 shrink-0" />
                <span>Запустить @IIrkiBot</span>
              </a>
              <a
                href="https://t.me/IIrkiBot/app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/85 hover:bg-white border border-pink-300 text-slate-800 text-[14px] font-bold cursor-pointer"
                title="Альтернативный вход через мини-приложение"
              >
                <span>Или через мини-приложение</span>
              </a>
            </div>
          </div>
        </div>

        {/* Form: Telegram ID + Password + Confirm Password */}
        <form onSubmit={handleSubmit} className="space-y-3.5 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <div className="min-w-0">
              <label className="block text-[14px] font-extrabold text-slate-900 mb-1">
                Ваш числовой идентификатор Telegram
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={telegramIdInput}
                onChange={(e) => setTelegramIdInput(e.target.value)}
                placeholder="Например: 169262990"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 font-mono focus:outline-none focus:border-pink-500"
              />
            </div>

            <div className="min-w-0">
              <label className="block text-[14px] font-extrabold text-slate-900 mb-1">
                Ваш юзернейм в Telegram (подтянется автоматически)
              </label>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="@username (необязательно)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 font-mono focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <div className="min-w-0">
              <label className="block text-[14px] font-extrabold text-slate-900 mb-1 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-pink-600 shrink-0" />
                <span>Ваш пароль от личного кабинета</span>
              </label>
              <input
                type="password"
                required
                minLength={4}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Введите ваш пароль"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
              />
            </div>

            <div className="min-w-0">
              <label className="block text-[14px] font-extrabold text-slate-900 mb-1 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-pink-600 shrink-0" />
                <span>Повторите пароль от кабинета</span>
              </label>
              <input
                type="password"
                required
                minLength={4}
                value={confirmPasswordInput}
                onChange={(e) => setConfirmPasswordInput(e.target.value)}
                placeholder="Повторите ваш пароль"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/85 via-pink-100/85 to-orange-100/85 border border-rose-300 text-rose-800 text-[14px] font-bold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="break-words">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/90 via-pink-100/90 to-orange-100/90 border border-pink-300 text-slate-900 text-[14px] font-bold flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-pink-600 shrink-0 mt-0.5" />
              <span className="break-words">{successMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <span className="text-[14px] text-slate-700 font-medium break-words">
              Проверяем уникальность в базе, пароль и живую связь с ботом @IIrkiBot
            </span>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 disabled:opacity-55 text-white text-[14px] font-extrabold flex items-center gap-2 cursor-pointer shadow-sm"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 shrink-0" />
              )}
              <span>Проверить и привязать Telegram (+300 Иирок)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (!isModal) {
    return cardInner;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-gradient-to-br from-sky-200/50 via-pink-200/50 via-orange-200/50 via-pink-200/50 to-sky-200/50 backdrop-blur-sm overflow-y-auto">
      <div className="my-auto w-full max-w-2xl min-w-0">{cardInner}</div>
    </div>
  );
};
