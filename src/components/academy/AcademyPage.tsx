import React from 'react';
import { BookOpen, ArrowLeft, UserCheck } from 'lucide-react';
import { AcademyContentViewer } from './AcademyContentViewer';
import {
  ACADEMY_SECTIONS,
  ACADEMY_BLOCK_GRADIENT,
  ACADEMY_VIBRANT_GRADIENT,
  ACADEMY_TEXT_GRADIENT
} from './academyConstants';

export interface AcademyPageProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isLoggedIn?: boolean;
  onOpenLogin?: () => void;
}

export const AcademyPage: React.FC<AcademyPageProps> = ({
  currentPath,
  onNavigate,
  isLoggedIn = false,
  onOpenLogin
}) => {
  const rawSlug = currentPath.startsWith('/academy/')
    ? decodeURIComponent(currentPath.replace('/academy/', '').split('?')[0].replace(/\/$/, ''))
    : '';
  const initialSlug = ACADEMY_SECTIONS.some(s => s.slug === rawSlug)
    ? rawSlug
    : ACADEMY_SECTIONS[0].slug;

  return (
    <div className="w-full max-w-7xl mx-auto py-2 sm:py-4 space-y-5 text-left text-[14px] min-w-0">
      {/* Academy Hero Banner */}
      <div className={`p-[1.5px] rounded-3xl shadow-sm ${ACADEMY_VIBRANT_GRADIENT}`}>
        <div
          className={`rounded-[22.5px] p-5 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4 ${ACADEMY_BLOCK_GRADIENT}`}
        >
          <div className="space-y-2 min-w-0 max-w-3xl">
            <div className="flex items-center gap-2.5">
              <span className={`p-2.5 rounded-2xl text-white shadow-xs shrink-0 ${ACADEMY_VIBRANT_GRADIENT}`}>
                <BookOpen className="w-5 h-5" />
              </span>
              <h1 className={`text-[22px] sm:text-[28px] font-extrabold leading-tight break-words ${ACADEMY_TEXT_GRADIENT}`}>
                Академия платформы
              </h1>
            </div>
            <p className="text-[15px] text-slate-800 font-medium leading-relaxed break-words">
              Практические руководства и примеры по всем разделам: от настройки профиля, каналов и команд до работы с форматами постов v2 и Rich, сценариями автоматизации и подборками.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/main')}
              className={`px-4 py-2.5 rounded-2xl text-white font-bold text-[14px] shadow-xs hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2 ${ACADEMY_VIBRANT_GRADIENT}`}
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>На главную</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isLoggedIn) {
                  onNavigate('/profile');
                } else if (onOpenLogin) {
                  onOpenLogin();
                } else {
                  onNavigate('/profile');
                }
              }}
              className={`px-4 py-2.5 rounded-2xl text-white font-bold text-[14px] shadow-xs hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2 ${ACADEMY_VIBRANT_GRADIENT}`}
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>{isLoggedIn ? 'В личный кабинет' : 'Войти в кабинет'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive 7-Section Rich Markdown Viewer */}
      <AcademyContentViewer
        initialSectionSlug={initialSlug}
        onSectionChange={slug => {
          const nextUrl = `/academy/${slug}`;
          if (typeof window !== 'undefined' && window.location.pathname !== nextUrl) {
            window.history.replaceState(null, '', nextUrl);
          }
        }}
        onNavigate={onNavigate}
      />
    </div>
  );
};
