import React, { useState, useEffect } from 'react';
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from '../constants/proTalkStorage';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Scale, Lock, FileCheck2 } from 'lucide-react';
import { UserAccount } from '../types';
import OfertaModalContent, { LegalDocSectionType } from './OfertaModalContent';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: Partial<UserAccount>) => void;
  initialTab?: 'email_login' | 'email_register' | 'telegram' | 'forgot_password';
  actionReason?: string;
}

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  initialTab = 'email_register',
  actionReason
}: AuthModalProps) {
  const [authTab, setAuthTab] = useState<'email_login' | 'email_register' | 'telegram' | 'forgot_password'>(initialTab);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');
  const [refCode, setRefCode] = useState('');
  const [legalDocModal, setLegalDocModal] = useState<LegalDocSectionType | null>(null);

  // Waiting animation cycling tips for login modal
  const [authTipIndex, setAuthTipIndex] = useState(0);
  const authWaitingTips = [
    { title: '✨ Ожидание авторизации...', desc: 'Связываемся с сервером для безопасной проверки сессии' },
    { title: '🎁 Стартовый баланс 300 ИИрок', desc: 'Начисляется каждому пользователю при первом входе' },
    { title: '⚡ Моментальный вход в 1 клик', desc: 'Через Telegram Mini App вход происходит мгновенно' },
    { title: '🔐 Защищённое соединение', desc: 'Ваши данные и черновики синхронизируются в реальном времени' },
  ];

  useEffect(() => {
    if (isOpen) {
      setAuthTab(initialTab);
      setAuthError('');
      setAuthSuccessMsg('');
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tgStart = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;
      const refParam =
        urlParams.get('ref') ||
        urlParams.get('startapp') ||
        urlParams.get('startParam') ||
        urlParams.get('tgWebAppStartParam') ||
        tgStart;
      if (refParam && String(refParam).trim()) {
        const cleanRef = String(refParam).trim();
        try {
          localStorage.setItem('iismm_ref', cleanRef);
        } catch {}
        setRefCode(cleanRef);
      } else {
        try {
          const savedRef = localStorage.getItem('iismm_ref');
          if (savedRef) setRefCode(savedRef);
        } catch {}
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setAuthTipIndex((prev) => (prev + 1) % authWaitingTips.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [isOpen, authWaitingTips.length]);

  if (!isOpen) return null;

  const handleEmailLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');
    if (!emailInput.trim() || !passwordInput.trim()) {
      setAuthError('Пожалуйста, укажите e-mail и пароль');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim(), password: passwordInput })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAuthError(data.error || 'Неверный логин или пароль');
        setAuthLoading(false);
        return;
      }
      const u = data.user || {};
      const authedUser: Partial<UserAccount> = {
        id: String(u.id || '16926299042'),
        telegramId: u.telegramId ? Number(u.telegramId) : undefined,
        name: u.firstName || u.name || emailInput.split('@')[0],
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        username: u.username || `@${emailInput.split('@')[0]}`,
        telegramUsername: u.username ? (u.username.startsWith('@') ? u.username : `@${u.username}`) : `@${emailInput.split('@')[0]}`,
        email: u.email || emailInput,
        role: u.role || 'user',
        avatarUrl: normalizeProTalkMediaUrl(u.photoUrl || u.avatarUrl) || BRAND_ASSETS.logo,
        photoUrl: normalizeProTalkMediaUrl(u.photoUrl || u.avatarUrl) || BRAND_ASSETS.logo,
        iirky: u.balance || 300
      };
      onSuccess(authedUser);
      onClose();
    } catch {
      setAuthError('Ошибка сети при попытке входа');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailRegisterSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');
    if (!emailInput.trim() || !passwordInput.trim() || !confirmPasswordInput.trim()) {
      setAuthError('Пожалуйста, заполните все обязательные поля');
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      setAuthError('Пароли не совпадают');
      return;
    }
    if (passwordInput.length < 4) {
      setAuthError('Пароль должен содержать минимум 4 символа');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          password: passwordInput,
          firstName: nameInput.trim() || emailInput.split('@')[0],
          ref: refCode || undefined,
          referredBy: refCode || undefined
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAuthError(data.error || 'Ошибка регистрации. Возможно, такой e-mail уже зарегистрирован.');
        setAuthLoading(false);
        return;
      }
      try {
        localStorage.removeItem('iismm_ref');
      } catch {}
      const u = data.user || {};
      const authedUser: Partial<UserAccount> = {
        id: String(u.id || 'usr-' + Date.now()),
        telegramId: u.telegramId ? Number(u.telegramId) : undefined,
        name: u.firstName || nameInput.trim() || emailInput.split('@')[0],
        firstName: u.firstName || nameInput.trim() || '',
        lastName: u.lastName || '',
        username: u.username || `@${emailInput.split('@')[0]}`,
        telegramUsername: u.username ? (u.username.startsWith('@') ? u.username : `@${u.username}`) : `@${emailInput.split('@')[0]}`,
        email: u.email || emailInput,
        role: u.role || 'editor',
        tariff: u.tariff || 'Старт',
        avatarUrl: normalizeProTalkMediaUrl(u.photoUrl || u.avatarUrl) || BRAND_ASSETS.logo,
        photoUrl: normalizeProTalkMediaUrl(u.photoUrl || u.avatarUrl) || BRAND_ASSETS.logo,
        iirky: u.balance || 300
      };
      onSuccess(authedUser);
      onClose();
    } catch {
      setAuthError('Ошибка сети при попытке регистрации');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleTelegramMiniAppInstantAuth = async () => {
    const tgInitData = (window as any)?.Telegram?.WebApp?.initData;
    if (!tgInitData) return;
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/telegram-twa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: tgInitData,
          startParam: refCode || undefined,
          ref: refCode || undefined
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.user) {
        setAuthError(data.error || 'Не удалось выполнить вход через Telegram Mini App');
        return;
      }
      const u = data.user;
      onSuccess({
        id: String(u.id),
        telegramId: u.telegramId,
        name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.telegramUsername || `User_${u.id}`,
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        telegramUsername: u.telegramUsername
          ? (u.telegramUsername.startsWith('@') ? u.telegramUsername : `@${u.telegramUsername}`)
          : `@id${u.id}`,
        email: u.email || '',
        role: u.role || 'editor',
        tariff: u.tariff || 'Старт',
        avatarUrl: normalizeProTalkMediaUrl(u.userAvatar || u.photoUrl || u.avatarUrl) || BRAND_ASSETS.heartAvatar,
        photoUrl: normalizeProTalkMediaUrl(u.userAvatar || u.photoUrl || u.avatarUrl) || BRAND_ASSETS.heartAvatar,
        iirky: u.balance ?? 300
      });
      onClose();
    } catch {
      setAuthError('Ошибка подключения к Telegram авторизации');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');
    if (!emailInput.trim()) {
      setAuthError('Пожалуйста, укажите ваш e-mail');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim() })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAuthError(data.error || 'Не удалось отправить ссылку для восстановления');
      } else {
        setAuthSuccessMsg('Инструкция по восстановлению пароля отправлена на ваш e-mail');
      }
    } catch {
      setAuthError('Ошибка при обращении к серверу');
    } finally {
      setAuthLoading(false);
    }
  };

  const renderLegalConsentButtons = () => (
    <div className="px-[2vw] py-3 sm:p-4 rounded-2xl border border-pink-300 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-2.5 min-w-0">
      <p className="text-[14px] text-slate-800 font-medium leading-snug break-words">
        Продолжая регистрацию или вход в сервис ИИSMM, вы подтверждаете согласие с условиями публичной оферты, политики конфиденциальности, пользовательского соглашения и обработкой персональных данных (152-фз):
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setLegalDocModal('oferta')}
          className="py-2.5 px-[2vw] sm:px-3 rounded-xl text-white text-[14px] font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer text-center min-w-0"
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span className="truncate">Публичная оферта</span>
        </button>
        <button
          type="button"
          onClick={() => setLegalDocModal('privacy')}
          className="py-2.5 px-[2vw] sm:px-3 rounded-xl text-white text-[14px] font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer text-center min-w-0"
        >
          <Lock className="w-4 h-4 shrink-0" />
          <span className="truncate">Политика конфиденциальности</span>
        </button>
        <button
          type="button"
          onClick={() => setLegalDocModal('agreement')}
          className="py-2.5 px-[2vw] sm:px-3 rounded-xl text-white text-[14px] font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer text-center min-w-0"
        >
          <Scale className="w-4 h-4 shrink-0" />
          <span className="truncate">Пользовательское соглашение</span>
        </button>
        <button
          type="button"
          onClick={() => setLegalDocModal('consent')}
          className="py-2.5 px-[2vw] sm:px-3 rounded-xl text-white text-[14px] font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer text-center min-w-0"
        >
          <FileCheck2 className="w-4 h-4 shrink-0" />
          <span className="truncate">Согласие на обработку данных</span>
        </button>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-[2vw] py-2 sm:p-4 bg-gradient-to-br from-sky-200/45 via-pink-200/45 to-orange-200/45 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="w-full max-w-full sm:max-w-[672px] max-h-[94vh] overflow-y-auto rounded-[24px] sm:rounded-[28px] shadow-2xl border-2 border-pink-300 px-[2vw] py-2.5 sm:p-2.5 backdrop-blur-xl custom-scrollbar my-auto bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 min-w-0"
        >
          {/* Header: vibrant title with 300 points bonus & close */}
          <div className="px-[2vw] py-3.5 sm:p-5 rounded-[20px] sm:rounded-[24px] text-white flex items-center justify-between shadow-md border border-pink-300 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl shrink-0">🎁</span>
              <div className="min-w-0">
                <h4 className="font-extrabold text-[15px] sm:text-[16px] tracking-tight text-white leading-tight break-words">300 Иирок бесплатно</h4>
                <p className="text-[14px] text-white/95 font-semibold mt-0.5 break-words">
                  Бонус при регистрации начисляется сразу на баланс!
                </p>
              </div>
            </div>
            <button
              type="button"
              id="auth-modal-close-btn"
              onClick={onClose}
              className="text-white hover:text-orange-100 font-extrabold text-[14px] bg-white/20 hover:bg-white/30 py-1.5 px-3 rounded-full transition-all cursor-pointer shrink-0 ml-2"
            >
              ✕
            </button>
          </div>

          {/* Mobile-friendly Navigation Switcher (grid without horizontal scroll) */}
          <div className="px-0 sm:px-4 pt-2.5 sm:pt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
            <button
              type="button"
              id="auth-tab-register"
              onClick={() => { setAuthTab('email_register'); setAuthError(''); setAuthSuccessMsg(''); }}
              className={`px-[2vw] sm:px-4 py-2.5 text-[14px] font-bold rounded-xl transition-all cursor-pointer text-center ${
                authTab === 'email_register'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-xs font-extrabold'
                  : 'bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 text-slate-800 border border-pink-300 hover:opacity-95'
              }`}
            >
              📝 Регистрация
            </button>
            <button
              type="button"
              id="auth-tab-login"
              onClick={() => { setAuthTab('email_login'); setAuthError(''); setAuthSuccessMsg(''); }}
              className={`px-[2vw] sm:px-4 py-2.5 text-[14px] font-bold rounded-xl transition-all cursor-pointer text-center ${
                authTab === 'email_login'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-xs font-extrabold'
                  : 'bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 text-slate-800 border border-pink-300 hover:opacity-95'
              }`}
            >
              ✉️ Вход через e-mail
            </button>
          </div>

          {/* Action Reason Notice if passed */}
          {actionReason && (
            <div className="mx-0 sm:mx-4 mt-2.5 sm:mt-3 px-[2vw] py-2.5 sm:p-3 bg-gradient-to-r from-sky-100/80 via-pink-100/80 to-orange-100/80 rounded-2xl border border-pink-300 text-slate-900 text-[14px] font-bold text-center shadow-2xs break-words">
              💡 {actionReason}
            </div>
          )}

          {/* Modal Body */}
          <div className="px-0 py-3 sm:p-5 space-y-3.5 sm:space-y-4 min-w-0">
            {/* Dynamic Animated Waiting / Verification Visual Companion */}
            <div className="px-[2vw] py-3 sm:p-4 rounded-2xl border border-pink-300 shadow-2xs space-y-2 select-none relative overflow-hidden bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 min-w-0">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white/85 border border-pink-300 shadow-2xs shrink-0">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-50 animate-ping" />
                    <span className="text-lg animate-pulse">🤖</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-slate-900 leading-snug break-words">
                      {authLoading ? 'Проверка учётных данных...' : authWaitingTips[authTipIndex].title}
                    </div>
                    <div className="text-[14px] text-slate-700 font-medium leading-snug break-words">
                      {authLoading ? 'Пожалуйста, подождите несколько секунд...' : authWaitingTips[authTipIndex].desc}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-bounce" />
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-bounce" />
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-bounce" />
                </div>
              </div>

              {/* Animated gradient progress bar */}
              <div className="w-full h-1.5 bg-white/80 rounded-full overflow-hidden border border-pink-200">
                <div
                  className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-sky-400 via-pink-500 to-orange-500"
                  style={{
                    width: authLoading ? '92%' : `${((authTipIndex + 1) / authWaitingTips.length) * 100}%`
                  }}
                />
              </div>
            </div>

            {/* Alert Notifications */}
            {authError && (
              <div className="px-[2vw] py-3 sm:p-3.5 bg-gradient-to-r from-sky-100/85 via-pink-100/85 to-orange-100/85 border border-pink-300 text-rose-800 text-[14px] font-semibold rounded-xl space-y-1 break-words">
                <div>⚠️ {authError}</div>
                {authTab === 'email_login' && (
                  <button
                    type="button"
                    onClick={() => { setAuthTab('forgot_password'); setAuthError(''); }}
                    className="text-[14px] text-orange-600 font-bold hover:underline cursor-pointer block pt-0.5 text-left"
                  >
                    Забыли пароль? Восстановить доступ ➔
                  </button>
                )}
              </div>
            )}
            {authSuccessMsg && (
              <div className="px-[2vw] py-3 sm:p-3.5 bg-gradient-to-r from-sky-100/80 via-pink-100/80 to-orange-100/80 border border-pink-300 text-slate-900 text-[14px] font-semibold rounded-xl break-words">
                {authSuccessMsg}
              </div>
            )}

            {/* TAB: EMAIL LOGIN */}
            {authTab === 'email_login' && (
              <form onSubmit={handleEmailLoginSubmit} className="space-y-3.5 text-[14px] min-w-0">
                <div className="space-y-1 min-w-0">
                  <label className="text-[14px] text-slate-800 font-bold block">E-mail адрес</label>
                  <input
                    type="email"
                    id="login-email-input"
                    placeholder="user@example.com"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    required
                    className="w-full bg-white/85 border border-pink-300 px-[2vw] py-2.5 sm:p-3 rounded-xl text-[14px] text-slate-900 focus:ring-2 focus:ring-pink-400 focus:outline-none font-medium"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="text-[14px] text-slate-800 font-bold block">Пароль</label>
                    <button
                      type="button"
                      onClick={() => { setAuthTab('forgot_password'); setAuthError(''); }}
                      className="text-[14px] text-orange-600 font-bold hover:underline cursor-pointer"
                    >
                      Забыли пароль?
                    </button>
                  </div>
                  <input
                    type="password"
                    id="login-password-input"
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    required
                    className="w-full bg-white/85 border border-pink-300 px-[2vw] py-2.5 sm:p-3 rounded-xl text-[14px] text-slate-900 focus:ring-2 focus:ring-pink-400 focus:outline-none font-medium"
                  />
                </div>

                {renderLegalConsentButtons()}

                <button
                  type="submit"
                  id="login-submit-btn"
                  disabled={authLoading}
                  className="w-full py-3 px-[2vw] sm:px-4 text-white font-extrabold text-[14px] rounded-xl shadow-md cursor-pointer transition-all text-center disabled:opacity-50 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95"
                >
                  {authLoading ? 'Вход в аккаунт...' : 'Войти в аккаунт ➔'}
                </button>
              </form>
            )}

            {/* TAB: REGISTER */}
            {authTab === 'email_register' && (
              <div className="space-y-3.5 text-[14px] min-w-0">
                {typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData ? (
                  <button
                    type="button"
                    onClick={handleTelegramMiniAppInstantAuth}
                    disabled={authLoading}
                    className="w-full py-3 px-[2vw] sm:px-4 text-white font-extrabold text-[14px] rounded-xl shadow-md cursor-pointer transition-all text-center flex items-center justify-center gap-2 hover:opacity-95 active:scale-98 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 disabled:opacity-60"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-white fill-current shrink-0">
                      <path d="M19.897 5.115l-17.1 6.59c-1.17.47-1.16 1.12-.22 1.41l4.39 1.37 10.16-6.41c.48-.29.92-.13.56.19l-8.24 7.44-.32 4.79c.47 0 .68-.21.94-.47l2.25-2.19 4.68 3.46c.86.48 1.48.23 1.69-.8l3.07-14.47c.31-1.26-.48-1.83-1.32-1.37z" />
                    </svg>
                    <span className="break-words">Моментальный вход через Telegram 🚀</span>
                  </button>
                ) : (
                  <a
                    href={`https://t.me/IIrkiBot/app?startapp=${refCode || '169262990'}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-[2vw] sm:px-4 text-white font-extrabold text-[14px] rounded-xl shadow-md cursor-pointer transition-all text-center flex items-center justify-center gap-2 hover:opacity-95 active:scale-98 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-white fill-current shrink-0">
                      <path d="M19.897 5.115l-17.1 6.59c-1.17.47-1.16 1.12-.22 1.41l4.39 1.37 10.16-6.41c.48-.29.92-.13.56.19l-8.24 7.44-.32 4.79c.47 0 .68-.21.94-.47l2.25-2.19 4.68 3.46c.86.48 1.48.23 1.69-.8l3.07-14.47c.31-1.26-.48-1.83-1.32-1.37z" />
                    </svg>
                    <span className="break-words">Быстрая регистрация через Telegram 🚀</span>
                  </a>
                )}

                <div className="px-[2vw] py-2.5 sm:p-3 rounded-2xl bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 border border-pink-300 text-[14px] text-slate-800 font-medium leading-snug break-words">
                  💡 <strong>Если Telegram работает только с впн, а сайт открыт напрямую без впн:</strong> зарегистрируйтесь ниже по почте (+300 Иирок), а затем в личном кабинете привяжите свой аккаунт Telegram по числовому идентификатору и получите еще +300 Иирок!
                </div>

                <form onSubmit={handleEmailRegisterSubmit} className="space-y-3.5 text-[14px] min-w-0">
                  {refCode && (
                    <div className="px-[2vw] py-2.5 sm:p-3 bg-gradient-to-r from-sky-100/80 via-pink-100/80 to-orange-100/80 border border-pink-300 rounded-xl flex flex-wrap items-center justify-between gap-2 text-[14px] text-pink-900 font-bold">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span>🎁 Реферер:</span>
                        <span className="font-mono bg-white/85 px-2 py-0.5 rounded border border-pink-200 text-pink-700 font-black truncate">{refCode}</span>
                      </span>
                      <span className="text-[14px] text-orange-600 font-extrabold">+300 Иирок пригласившему</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 min-w-0">
                    <div className="space-y-1 min-w-0">
                      <label className="text-[14px] text-slate-800 font-bold block">Ваше имя</label>
                      <input
                        type="text"
                        id="register-name-input"
                        placeholder="Иван Петров"
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        className="w-full bg-white/85 border border-pink-300 px-[2vw] py-2.5 sm:p-3 rounded-xl text-[14px] text-slate-900 focus:ring-2 focus:ring-pink-400 focus:outline-none font-medium"
                      />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <label className="text-[14px] text-slate-800 font-bold block">E-mail адрес</label>
                      <input
                        type="email"
                        id="register-email-input"
                        placeholder="user@example.com"
                        value={emailInput}
                        onChange={e => setEmailInput(e.target.value)}
                        required
                        className="w-full bg-white/85 border border-pink-300 px-[2vw] py-2.5 sm:p-3 rounded-xl text-[14px] text-slate-900 focus:ring-2 focus:ring-pink-400 focus:outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 min-w-0">
                    <div className="space-y-1 min-w-0">
                      <label className="text-[14px] text-slate-800 font-bold block">Придумайте пароль</label>
                      <input
                        type="password"
                        id="register-password-input"
                        placeholder="••••••••"
                        value={passwordInput}
                        onChange={e => setPasswordInput(e.target.value)}
                        required
                        minLength={4}
                        className="w-full bg-white/85 border border-pink-300 px-[2vw] py-2.5 sm:p-3 rounded-xl text-[14px] text-slate-900 focus:ring-2 focus:ring-pink-400 focus:outline-none font-medium"
                      />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <label className="text-[14px] text-slate-800 font-bold block">Повторите пароль</label>
                      <input
                        type="password"
                        id="register-confirm-password-input"
                        placeholder="••••••••"
                        value={confirmPasswordInput}
                        onChange={e => setConfirmPasswordInput(e.target.value)}
                        required
                        minLength={4}
                        className="w-full bg-white/85 border border-pink-300 px-[2vw] py-2.5 sm:p-3 rounded-xl text-[14px] text-slate-900 focus:ring-2 focus:ring-pink-400 focus:outline-none font-medium"
                      />
                    </div>
                  </div>

                  {renderLegalConsentButtons()}

                  <button
                    type="submit"
                    id="register-submit-btn"
                    disabled={authLoading}
                    className="w-full py-3 px-[2vw] sm:px-4 text-white font-extrabold text-[14px] rounded-xl shadow-md cursor-pointer transition-all text-center disabled:opacity-50 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95"
                  >
                    {authLoading ? 'Регистрация...' : 'Зарегистрироваться 🚀'}
                  </button>
                </form>
              </div>
            )}

            {/* TAB: FORGOT PASSWORD */}
            {authTab === 'forgot_password' && (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-3.5 text-[14px] min-w-0">
                <div className="space-y-1 min-w-0">
                  <label className="text-[14px] text-slate-800 font-bold block">E-mail адрес аккаунта</label>
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    required
                    className="w-full bg-white/85 border border-pink-300 px-[2vw] py-2.5 sm:p-3 rounded-xl text-[14px] text-slate-900 focus:ring-2 focus:ring-pink-400 focus:outline-none font-medium"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 px-[2vw] sm:px-4 text-white font-extrabold text-[14px] rounded-xl shadow-md cursor-pointer transition-all text-center disabled:opacity-50 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95"
                >
                  {authLoading ? 'Отправка...' : 'Восстановить доступ ➔'}
                </button>
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => { setAuthTab('email_login'); setAuthError(''); }}
                    className="text-[14px] font-bold text-pink-600 hover:underline cursor-pointer"
                  >
                    Вернуться ко входу
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>

        {/* Translucent In-Modal Legal Viewer (Public Offer & User Agreement) */}
        {legalDocModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-[2vw] py-2 sm:p-4 bg-gradient-to-br from-sky-200/50 via-pink-200/50 to-orange-200/50 backdrop-blur-md">
            <div className="bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xl rounded-3xl px-[2vw] py-4 sm:p-6 max-w-full sm:max-w-3xl w-full border-2 border-pink-300 shadow-2xl space-y-4 text-left max-h-[92vh] overflow-y-auto min-w-0">
              <div className="flex justify-between items-center gap-3 border-b border-pink-300 pb-3 min-w-0">
                <h4 className="font-extrabold text-[16px] bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent break-words">
                  Правовые документы сервиса ИиСмм
                </h4>
                <button
                  type="button"
                  onClick={() => setLegalDocModal(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] cursor-pointer shrink-0"
                >
                  Закрыть
                </button>
              </div>
              <div className="max-h-[68vh] overflow-y-auto pr-1">
                <OfertaModalContent initialSection={legalDocModal} />
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
