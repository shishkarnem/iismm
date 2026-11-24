import React, { useState, useEffect } from 'react';
import { Smartphone, Mail, Sparkles, CheckCircle2, ArrowRight, Loader2, AlertCircle, Bot } from 'lucide-react';
import { OnboardingAccountInfo } from './onboardingTypes';

export interface OnboardingStep1AccountProps {
  userId: string;
  account: OnboardingAccountInfo | null;
  onCompletedStep1: () => Promise<void> | void;
  onRefreshAccount: () => Promise<void> | void;
}

export const OnboardingStep1Account: React.FC<OnboardingStep1AccountProps> = ({
  userId,
  account,
  onCompletedStep1,
  onRefreshAccount
}) => {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [tgIdInput, setTgIdInput] = useState('');
  const [tgUsernameInput, setTgUsernameInput] = useState('');
  const [tgPasswordInput, setTgPasswordInput] = useState('');
  const [tgConfirmPasswordInput, setTgConfirmPasswordInput] = useState('');
  const [botUsername, setBotUsername] = useState('IIrkiBot');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const tmaUser =
    typeof window !== 'undefined' ? window.Telegram?.WebApp?.initDataUnsafe?.user : undefined;
  const isMiniApp = Boolean(tmaUser?.id);

  useEffect(() => {
    if (tmaUser?.id && !tgIdInput) {
      setTgIdInput(String(tmaUser.id));
      if (tmaUser.username) setTgUsernameInput(`@${tmaUser.username}`);
    }
  }, [tmaUser?.id]);

  useEffect(() => {
    fetch('/api/telegram/bot-info')
      .then((r) => r.json())
      .then((d) => {
        if (d?.bot_username) setBotUsername(String(d.bot_username).replace(/^@/, ''));
      })
      .catch(() => null);
  }, []);

  const hasEmail = Boolean(account?.hasEmail);
  const hasTelegram = Boolean(account?.hasTelegram);

  const handleLinkEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/onboarding/link-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          userId,
          mode: 'email',
          email: emailInput.trim(),
          password: passwordInput.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось привязать почту');
      }
      setSuccessMsg(data.message || 'Почта успешно привязана!');
      await onRefreshAccount();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка привязки электронной почты');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!isMiniApp) {
      if (!tgPasswordInput.trim() || !tgConfirmPasswordInput.trim()) {
        setErrorMsg('Введите ваш пароль от кабинета и повторите пароль для подтверждения.');
        return;
      }
      if (tgPasswordInput !== tgConfirmPasswordInput) {
        setErrorMsg('Пароли не совпадают. Пожалуйста, проверьте оба поля пароля.');
        return;
      }
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/onboarding/link-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          userId,
          mode: 'telegram',
          telegramId: tgIdInput.trim(),
          username: tgUsernameInput.trim(),
          password: tgPasswordInput,
          confirmPassword: tgConfirmPasswordInput
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось привязать аккаунт Telegram');
      }
      setSuccessMsg(data.message || 'Telegram успешно привязан!');
      setTgPasswordInput('');
      setTgConfirmPasswordInput('');
      await onRefreshAccount();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка привязки Telegram');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStayOnEmail = async () => {
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await fetch('/api/onboarding/link-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ userId, mode: 'stay_email' })
      });
      await onCompletedStep1();
    } catch {
      await onCompletedStep1();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      {/* Status Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
        <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 flex items-start gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[15px] font-extrabold text-slate-900">Ваш Telegram</span>
              <span
                className={`px-2.5 py-0.5 rounded-xl text-[14px] font-bold border ${
                  hasTelegram
                    ? 'bg-sky-100/90 text-sky-900 border-sky-300'
                    : 'bg-pink-100/90 text-pink-800 border-pink-300'
                }`}
              >
                {hasTelegram ? 'Подключен (+300 Иирок)' : 'Бонус +300 Иирок'}
              </span>
            </div>
            <p className="text-[14px] text-slate-700 font-medium pt-1 break-words">
              {hasTelegram
                ? `Идентификатор: ${account?.telegramId}${account?.username ? ` (${account.username})` : ''}`
                : isMiniApp
                ? 'Вы открыли приложение внутри Telegram Mini App — можно привязать в один клик'
                : 'Нужен для получения тестовых постов в личку и уведомлений от бота'}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 flex items-start gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[15px] font-extrabold text-slate-900">Электронная почта</span>
              <span
                className={`px-2.5 py-0.5 rounded-xl text-[14px] font-bold border ${
                  hasEmail
                    ? 'bg-sky-100/90 text-sky-900 border-sky-300'
                    : 'bg-pink-100/90 text-pink-800 border-pink-300'
                }`}
              >
                {hasEmail ? 'Подключена (+300 Иирок)' : 'Бонус +300 Иирок'}
              </span>
            </div>
            <p className="text-[14px] text-slate-700 font-medium pt-1 break-words">
              {hasEmail
                ? `Адрес: ${account?.email}`
                : 'Позволяет заходить с любого компьютера и браузера по паролю и дает +300 Иирок'}
            </p>
          </div>
        </div>
      </div>

      {/* Case 1: Logged in via Telegram / MiniApp, no Email yet -> Bind Email for +300 Iirki */}
      {hasTelegram && !hasEmail && (
        <form
          onSubmit={handleLinkEmail}
          className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 space-y-3.5 min-w-0"
        >
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-5 h-5 text-pink-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h4 className="text-[16px] font-extrabold text-slate-900 break-words">
                Вы вошли через Telegram — привяжите почту и получите еще +300 Иирок
              </h4>
              <p className="text-[14px] text-slate-700 font-medium break-words">
                Так вы сможете входить в кабинет с любого браузера и удвоите стартовый баланс до 600 Иирок.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
                Ваша электронная почта
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
                Придумайте пароль для входа
              </label>
              <input
                type="password"
                required
                minLength={4}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Минимум 4 символа"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2.5 flex-wrap pt-1">
            <button
              type="button"
              onClick={() => onCompletedStep1()}
              className="px-4 py-2.5 rounded-2xl bg-white/90 hover:bg-white border border-pink-300 text-slate-800 text-[14px] font-bold cursor-pointer"
            >
              Пропустить и перейти к шагу 2
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 disabled:opacity-55 text-white text-[14px] font-extrabold flex items-center gap-2 cursor-pointer shadow-sm"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Привязать почту и получить +300 Иирок</span>
            </button>
          </div>
        </form>
      )}

      {/* Case 2: Logged in via Email (without MiniApp), no Telegram yet -> Bind Telegram (+300) OR stay on Email */}
      {!hasTelegram && (
        <form
          onSubmit={handleLinkTelegram}
          className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 space-y-3.5 min-w-0"
        >
          <div className="flex items-start gap-2.5">
            <Bot className="w-5 h-5 text-pink-600 shrink-0 mt-0.5" />
            <div className="min-w-0 space-y-1">
              <h4 className="text-[16px] font-extrabold text-slate-900 break-words">
                Добавьте свой Telegram и получите +300 Иирок (или останьтесь на почте)
              </h4>
              <p className="text-[14px] text-slate-700 font-medium break-words">
                1. Узнайте свой числовой идентификатор через стороннего бота{' '}
                <a
                  href="https://t.me/my_id_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono font-extrabold text-sky-700 underline"
                >
                  @my_id_bot
                </a>
                . 2. Обязательно откройте нашего бота{' '}
                <a
                  href={`https://t.me/${botUsername}?start=connect`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono font-extrabold text-pink-700 underline"
                >
                  @{botUsername}
                </a>{' '}
                и нажмите «Запустить» — мы проверим аккаунт, загрузим фото профиля в галерею полной ссылкой и начислим +300 Иирок!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
                Числовой идентификатор вашего Telegram
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={tgIdInput}
                onChange={(e) => setTgIdInput(e.target.value)}
                placeholder="Например: 169262990"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 font-mono focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
                Ваш юзернейм в Telegram (подтянется автоматически)
              </label>
              <input
                type="text"
                value={tgUsernameInput}
                onChange={(e) => setTgUsernameInput(e.target.value)}
                placeholder="@username (необязательно)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 font-mono focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          {!isMiniApp && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
                  Ваш пароль от личного кабинета
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={tgPasswordInput}
                  onChange={(e) => setTgPasswordInput(e.target.value)}
                  placeholder="Введите ваш пароль"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
                />
              </div>
              <div>
                <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
                  Повторите пароль от кабинета
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={tgConfirmPasswordInput}
                  onChange={(e) => setTgConfirmPasswordInput(e.target.value)}
                  placeholder="Повторите ваш пароль"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2.5 flex-wrap pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleStayOnEmail}
              className="px-4 py-2.5 rounded-2xl bg-white/90 hover:bg-white border border-pink-300 text-slate-800 text-[14px] font-extrabold cursor-pointer"
            >
              Остаться на почте и перейти дальше
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 disabled:opacity-55 text-white text-[14px] font-extrabold flex items-center gap-2 cursor-pointer shadow-sm"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Привязать Telegram (+300 Иирок)</span>
            </button>
          </div>
        </form>
      )}

      {/* Case 3: Both Email and Telegram already connected */}
      {hasTelegram && hasEmail && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 border border-pink-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <CheckCircle2 className="w-6 h-6 text-pink-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-[16px] font-extrabold text-slate-900 break-words">
                Отлично! И почта, и Telegram уже привязаны к вашему аккаунту
              </div>
              <div className="text-[14px] text-slate-700 font-medium break-words">
                Текущий баланс: <strong>{account?.balance ?? 300} Иирок</strong>. Можно переходить к подключению и оформлению вашего канала!
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onCompletedStep1()}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-extrabold flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-sm"
          >
            <span>Далее: Канал</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-100/85 to-orange-100/85 border border-rose-300 text-rose-800 text-[14px] font-bold flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span className="break-words">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 to-orange-50/90 border border-pink-300 text-slate-900 text-[14px] font-bold flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-pink-600 shrink-0" />
            <span className="break-words">{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => onCompletedStep1()}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <span>К шагу 2</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
