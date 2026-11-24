import React, { useState } from 'react';
import { CheckCircle2, Download, HelpCircle, Smartphone, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../../hooks/pwa/usePWAInstall';
import { PWAInstallGuideModal } from './PWAInstallGuideModal';

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'manual_required') {
        setShowGuide(true);
      }
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 px-4 py-2.5 text-[14px] font-bold text-white shadow-sm hover:opacity-95 transition-all cursor-pointer ${className}`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{isIOS ? 'Установить на iPhone' : 'Установить приложение'}</span>
      </button>

      <PWAInstallGuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        defaultPlatform={isIOS ? 'ios' : 'android'}
      />
    </>
  );
};

interface PWAInstallCardProps {
  onGuideRequested?: () => void;
}

export const PWAInstallCard: React.FC<PWAInstallCardProps> = ({ onGuideRequested }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const [guidePlatform, setGuidePlatform] = useState<'ios' | 'android'>(isIOS ? 'ios' : 'android');
  const [installNotice, setInstallNotice] = useState<string>('');

  const handleInstallClick = async () => {
    setInstallNotice('');
    if (isInstallable) {
      const result = await install();
      if (result === 'accepted') {
        setInstallNotice('Приложение добавлено на рабочий стол вашего устройства!');
        return;
      }
      if (result === 'dismissed') {
        setInstallNotice('Установка отменена. Вы можете установить приложение в любой момент.');
        return;
      }
    }
    setGuidePlatform(isIOS ? 'ios' : 'android');
    setGuideOpen(true);
    onGuideRequested?.();
  };

  return (
    <div
      id="pwa-install-card"
      className="bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-pink-300 shadow-md text-left space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pink-200/80 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 flex items-center justify-center text-white shadow-xs shrink-0">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[16px] sm:text-[18px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 to-orange-500 bg-clip-text text-transparent leading-snug">
              Мобильное приложение ИИSMM (PWA)
            </h2>
            <p className="text-[14px] text-slate-700 font-medium leading-snug">
              Выведите иконку на рабочий стол Android или iPhone для быстрого доступа и push-уведомлений
            </p>
          </div>
        </div>

        {isInstalled ? (
          <span className="px-3.5 py-1.5 rounded-2xl bg-white/85 border border-sky-300 text-sky-800 text-[14px] font-bold inline-flex items-center gap-1.5 shadow-2xs shrink-0">
            <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
            <span>Установлено как приложение</span>
          </span>
        ) : (
          <span className="px-3.5 py-1.5 rounded-2xl bg-white/85 border border-pink-300 text-pink-800 text-[14px] font-bold inline-flex items-center gap-1.5 shadow-2xs shrink-0">
            <Sparkles className="w-4 h-4 text-pink-500 shrink-0" />
            <span>Android и iOS</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[14px] text-slate-800">
        <div className="p-3.5 rounded-2xl bg-white/75 border border-pink-200 space-y-1">
          <div className="font-bold text-slate-900">Удобство как в нативном приложении</div>
          <p className="text-slate-700 leading-relaxed">
            Открывается на весь экран без адресной строки браузера, кэширует интерфейс и мгновенно переходит к нужным постам и календарям.
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-white/75 border border-sky-200 space-y-1">
          <div className="font-bold text-slate-900">Обязательно для Push на iPhone и стабильно на Android</div>
          <p className="text-slate-700 leading-relaxed">
            На iOS push-уведомления работают только после добавления сайта на «Экран Домой». На Android это также обеспечивает надежную доставку.
          </p>
        </div>
      </div>

      {installNotice && (
        <div className="p-3 rounded-2xl bg-white/85 border border-sky-300 text-[14px] font-medium text-slate-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
          <span>{installNotice}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        {!isInstalled && (
          <button
            type="button"
            onClick={handleInstallClick}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold shadow-sm hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>
              {isInstallable
                ? 'Установить приложение на устройство'
                : isIOS
                ? 'Установить на iPhone / iPad'
                : isAndroid
                ? 'Установить на Android'
                : 'Установить приложение (Android / iOS / ПК)'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setGuidePlatform('ios');
            setGuideOpen(true);
          }}
          className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-white/85 hover:bg-white text-slate-800 border border-pink-300 text-[14px] font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
        >
          <HelpCircle className="w-4 h-4 text-pink-500 shrink-0" />
          <span>Инструкция для iPhone</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setGuidePlatform('android');
            setGuideOpen(true);
          }}
          className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-white/85 hover:bg-white text-slate-800 border border-sky-300 text-[14px] font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
        >
          <Smartphone className="w-4 h-4 text-sky-600 shrink-0" />
          <span>Инструкция для Android</span>
        </button>
      </div>

      <PWAInstallGuideModal
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
        defaultPlatform={guidePlatform}
      />
    </div>
  );
};
