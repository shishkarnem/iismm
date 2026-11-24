import React from 'react';
import { ShieldCheck, ArrowLeft, CreditCard } from 'lucide-react';
import OfertaModalContent, { LegalDocSectionType } from '../components/OfertaModalContent';
import { useAppVersion } from '../components/footer/useAppVersion';

interface OfertaPageProps {
  onNavigate?: (path: string) => void;
}

export default function OfertaPage({ onNavigate }: OfertaPageProps) {
  const appVersion = useAppVersion();
  const initialSection: LegalDocSectionType = (() => {
    if (typeof window === 'undefined') return 'oferta';
    const params = new URLSearchParams(window.location.search);
    const docParam = (params.get('doc') || '').toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    if (docParam === 'privacy' || pathname.includes('privacy') || pathname.includes('policy')) {
      return 'privacy';
    }
    if (docParam === 'agreement' || pathname.includes('agreement')) {
      return 'agreement';
    }
    if (docParam === 'consent' || pathname.includes('consent') || pathname.includes('personal-data')) {
      return 'consent';
    }
    return 'oferta';
  })();

  const handleNavigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new Event('popstate'));
    }
  };

  return (
    <div className="min-h-screen py-6 sm:py-8 px-[2%] sm:px-6 lg:px-8 text-slate-900 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto space-y-6 min-w-0">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => handleNavigate('/')}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white rounded-2xl text-[14px] font-bold transition-all shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-white shrink-0" />
            <span>Вернуться на главную</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('/tarif')}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white rounded-2xl text-[14px] font-bold transition-all shadow-sm cursor-pointer"
          >
            <CreditCard className="w-4 h-4 text-white shrink-0" />
            <span>Перейти к тарифам и оплате</span>
          </button>
        </div>

        {/* Hero Legal Banner */}
        <div className="rounded-3xl p-5 sm:p-8 border-2 border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md shadow-md space-y-3 text-left">
          <div className="flex items-center gap-2 text-[14px] font-bold text-pink-700">
            <ShieldCheck className="w-5 h-5 text-pink-600 shrink-0" />
            <span>Правовая документация платформы ИИSMM · ООО «РентРоп» (налог 5%)</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent tracking-tight leading-snug break-words">
            Публичная оферта, Политика конфиденциальности, Пользовательское соглашение и Согласие на обработку данных
          </h1>
          <p className="text-[14px] sm:text-base text-slate-800 leading-relaxed font-medium break-words">
            Настоящие документы определяют правовые условия предоставления доступа к тарифным планам, пополнения виртуальных единиц «ИИрки», оформления рекуррентных ежемесячных подписок, защиты персональных данных и фискализации платежей по 54-фз через сервис Робокасса на официальных доменах <strong>https://iismm.online</strong> и <strong>https://iismm.ru</strong>.
          </p>
        </div>

        {/* Unified Legal Body with Document Switcher */}
        <div className="rounded-3xl p-4 sm:p-8 border-2 border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md shadow-md text-left">
          <OfertaModalContent initialSection={initialSection} />
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 text-[14px] font-semibold text-slate-800 text-center sm:text-left">
          <span>© 2026 ИИSMM {appVersion}. · Общество с ограниченной ответственностью «РентРоп» (ИНН 7726477438)</span>
          <a
            href="mailto:info@arenda-ropa.com"
            className="text-pink-700 hover:text-pink-800 font-bold underline"
          >
            info@arenda-ropa.com
          </a>
        </div>
      </div>
    </div>
  );
}
