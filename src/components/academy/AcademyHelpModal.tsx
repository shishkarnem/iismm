import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X, BookOpen, ExternalLink } from 'lucide-react';
import { AcademyContentViewer } from './AcademyContentViewer';
import {
  ACADEMY_SECTIONS,
  ACADEMY_BLOCK_GRADIENT,
  ACADEMY_VIBRANT_GRADIENT,
  ACADEMY_TEXT_GRADIENT,
  AcademySectionSlug
} from './academyConstants';

export interface AcademyHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionSlug?: AcademySectionSlug | string;
  onNavigate?: (path: string) => void;
}

export const AcademyHelpModal: React.FC<AcademyHelpModalProps> = ({
  isOpen,
  onClose,
  sectionSlug = 'profile-channels-teams',
  onNavigate
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const sectionInfo =
    ACADEMY_SECTIONS.find(s => s.slug === sectionSlug) || ACADEMY_SECTIONS[0];

  const handleOpenFullAcademy = () => {
    onClose();
    const targetPath = `/academy/${sectionInfo.slug}`;
    if (onNavigate) {
      onNavigate(targetPath);
    } else {
      window.history.pushState(null, '', targetPath);
      window.dispatchEvent(new Event('popstate'));
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-gradient-to-br from-sky-100/45 via-pink-100/45 via-orange-100/45 via-pink-100/45 to-sky-100/45 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-5xl my-auto p-[2px] rounded-3xl shadow-xl ${ACADEMY_VIBRANT_GRADIENT}`}
        onClick={e => e.stopPropagation()}
      >
        <div
          className={`w-full max-h-[88vh] flex flex-col rounded-[22px] overflow-hidden ${ACADEMY_BLOCK_GRADIENT}`}
        >
          {/* Modal Header */}
          <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-pink-300/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`p-2 rounded-2xl text-white shadow-xs shrink-0 ${ACADEMY_VIBRANT_GRADIENT}`}>
                <BookOpen className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <h2 className={`text-[17px] sm:text-[20px] font-extrabold leading-tight break-words ${ACADEMY_TEXT_GRADIENT}`}>
                  Академия: {sectionInfo.title}
                </h2>
                <p className="text-[14px] text-slate-700 font-medium truncate hidden sm:block">
                  Подробные инструкции и примеры оформления прямо внутри вашего раздела
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <button
                type="button"
                onClick={handleOpenFullAcademy}
                className={`px-3.5 py-2 rounded-xl text-white font-bold text-[14px] shadow-xs hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5 ${ACADEMY_VIBRANT_GRADIENT}`}
                title="Открыть полную страницу Академии"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Страница Академии</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className={`px-3 py-2 rounded-xl text-white font-bold text-[14px] shadow-xs hover:opacity-95 transition-all cursor-pointer flex items-center gap-1 ${ACADEMY_VIBRANT_GRADIENT}`}
                title="Закрыть окно справки"
              >
                <X className="w-4 h-4" />
                <span>Закрыть</span>
              </button>
            </div>
          </div>

          {/* Scrollable Modal Body */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 min-w-0">
            <AcademyContentViewer
              initialSectionSlug={sectionInfo.slug}
              compactMode={true}
              onNavigate={path => {
                onClose();
                if (onNavigate) {
                  onNavigate(path);
                } else {
                  window.history.pushState(null, '', path);
                  window.dispatchEvent(new Event('popstate'));
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export interface AcademyHelpButtonProps {
  sectionSlug: AcademySectionSlug;
  label?: string;
  showLabelOnDesktop?: boolean;
  onNavigate?: (path: string) => void;
  className?: string;
}

export const AcademyHelpButton: React.FC<AcademyHelpButtonProps> = ({
  sectionSlug,
  label = 'Справка',
  showLabelOnDesktop = false,
  onNavigate,
  className = ''
}) => {
  const [open, setOpen] = useState(false);
  const sectionInfo = ACADEMY_SECTIONS.find(s => s.slug === sectionSlug);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Открыть справку Академии: ${sectionInfo?.title || 'Обучение'}`}
        aria-label={`Открыть справку Академии: ${sectionInfo?.title || 'Обучение'}`}
        className={`px-3 py-2 rounded-2xl text-white font-bold text-[14px] shadow-sm hover:opacity-95 active:scale-95 transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0 ${ACADEMY_VIBRANT_GRADIENT} ${className}`}
      >
        <HelpCircle className="w-4 h-4 shrink-0" />
        {showLabelOnDesktop ? (
          <span className="hidden sm:inline text-[14px]">{label}</span>
        ) : (
          <span className="text-[14px]">?</span>
        )}
      </button>

      <AcademyHelpModal
        isOpen={open}
        onClose={() => setOpen(false)}
        sectionSlug={sectionSlug}
        onNavigate={onNavigate}
      />
    </>
  );
};
