import React from 'react';
import { createPortal } from 'react-dom';
import { Download, Share, PlusSquare, Smartphone, X, CheckCircle2 } from 'lucide-react';

interface PWAInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlatform?: 'ios' | 'android';
}

export function PWAInstallGuideModal({
  isOpen,
  onClose,
  defaultPlatform = 'ios',
}: PWAInstallGuideModalProps) {
  const [platform, setPlatform] = React.useState<'ios' | 'android'>(defaultPlatform);

  React.useEffect(() => {
    setPlatform(defaultPlatform);
  }, [defaultPlatform, isOpen]);

  React.useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Установка ИИSMM на телефон"
      className="fixed inset-0 z-[9999] overflow-y-auto bg-gradient-to-br from-sky-200/45 via-pink-200/45 via-orange-200/45 to-sky-200/45 backdrop-blur-md"
      onClick={onClose}
    >
      <div className="min-h-full flex items-center justify-center p-3 sm:p-5">
        <div
          className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl bg-gradient-to-br from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xl border border-pink-300 shadow-2xl p-4 sm:p-5 space-y-4 text-left"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-pink-200/80 pb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 flex items-center justify-center text-white shrink-0 shadow-xs">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[16px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 to-orange-500 bg-clip-text text-transparent leading-snug break-words">
                  Установка ИИSMM на телефон
                </h3>
                <p className="text-[14px] text-slate-700 font-medium leading-snug break-words">
                  Быстрый запуск с рабочего стола и push-уведомления
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/85 hover:bg-white text-slate-700 border border-pink-200 cursor-pointer shrink-0"
              aria-label="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPlatform('ios')}
              className={`w-full px-3 py-2.5 rounded-2xl text-[14px] font-bold transition-all cursor-pointer border text-center break-words ${
                platform === 'ios'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-pink-400 shadow-xs'
                  : 'bg-white/80 hover:bg-white text-slate-800 border-pink-200'
              }`}
            >
              iPhone / iPad (iOS)
            </button>
            <button
              type="button"
              onClick={() => setPlatform('android')}
              className={`w-full px-3 py-2.5 rounded-2xl text-[14px] font-bold transition-all cursor-pointer border text-center break-words ${
                platform === 'android'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-pink-400 shadow-xs'
                  : 'bg-white/80 hover:bg-white text-slate-800 border-pink-200'
              }`}
            >
              Android смартфон
            </button>
          </div>

          {platform === 'ios' ? (
            <div className="space-y-2.5 text-[14px] text-slate-800">
              <div className="p-3 rounded-2xl bg-white/80 border border-pink-200 flex items-start gap-3">
                <span className="w-7 h-7 rounded-xl bg-gradient-to-r from-sky-500 to-pink-500 text-white text-[14px] font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <p className="leading-relaxed min-w-0 break-words">
                  Откройте сайт в браузере <strong>Safari</strong> на вашем iPhone или iPad (не во встроенном окне мессенджера).
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-white/80 border border-pink-200 flex items-start gap-3">
                <span className="w-7 h-7 rounded-xl bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold flex items-center justify-center shrink-0">
                  <Share className="w-4 h-4" />
                </span>
                <p className="leading-relaxed min-w-0 break-words">
                  Нажмите на кнопку <strong>«Поделиться»</strong> (иконка квадрата со стрелкой вверх) на нижней панели Safari.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-white/80 border border-pink-200 flex items-start gap-3">
                <span className="w-7 h-7 rounded-xl bg-gradient-to-r from-orange-500 to-sky-500 text-white font-bold flex items-center justify-center shrink-0">
                  <PlusSquare className="w-4 h-4" />
                </span>
                <p className="leading-relaxed min-w-0 break-words">
                  Пролистайте список вниз и нажмите <strong>«На экран Домой»</strong>, затем подтвердите кнопкой <strong>«Добавить»</strong>.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-sky-50/90 border border-sky-200 flex items-start gap-2.5 text-slate-800">
                <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed min-w-0 break-words">
                  Затем запустите ИИSMM с новой иконки на рабочем столе и включите push-уведомления в разделе ниже.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 text-[14px] text-slate-800">
              <div className="p-3 rounded-2xl bg-white/80 border border-pink-200 flex items-start gap-3">
                <span className="w-7 h-7 rounded-xl bg-gradient-to-r from-sky-500 to-pink-500 text-white text-[14px] font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <p className="leading-relaxed min-w-0 break-words">
                  Откройте сервис в браузере <strong>Chrome</strong>, <strong>Яндекс Браузере</strong> или <strong>Edge</strong> на Android.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-white/80 border border-pink-200 flex items-start gap-3">
                <span className="w-7 h-7 rounded-xl bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4" />
                </span>
                <p className="leading-relaxed min-w-0 break-words">
                  Откройте меню браузера (три точки в правом углу) и выберите <strong>«Установить приложение»</strong> или <strong>«Добавить на главный экран»</strong>.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-sky-50/90 border border-sky-200 flex items-start gap-2.5 text-slate-800">
                <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed min-w-0 break-words">
                  На рабочем столе появится ярлык ИИSMM, а уведомления смогут приходить даже при свернутом браузере.
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold shadow-sm hover:opacity-95 transition-all cursor-pointer"
          >
            Понятно, закрыть
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

