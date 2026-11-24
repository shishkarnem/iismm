import React from 'react';
import ShinyLogo from './ShinyLogo';
import { useAppVersion } from './footer/useAppVersion';
import { 
  FileText, Users, User,
  CalendarDays, FolderHeart, Compass
} from 'lucide-react';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  tariff?: 'free' | 'pro' | 'vip';
  tokens?: number;
  iirky?: number;
  balanceRub?: number;
  userName?: string;
  telegramUsername?: string;
  userId?: string;
  onOpenOnboardingTour?: () => void;
  isOnboardingCompleted?: boolean;
}

export default function Sidebar({ 
  currentPath, 
  onNavigate, 
  userName = '',
  telegramUsername = '',
  userId = '16926299042',
  onOpenOnboardingTour,
  isOnboardingCompleted = false
}: SidebarProps) {
  const appVersion = useAppVersion();
  const isAdmin = telegramUsername === '@shishkarnem' || userName.toLowerCase().includes('шишкар');
  const postsCabinetPath = `/posts${userId || '16926299042'}`;

  // Active Core Navigation
  const navItems = [
    { label: 'Профиль', path: '/profile', icon: <User className="w-5 h-5 text-orange-500" /> },
    { label: 'Соцсеть', path: '/social', icon: <Users className="w-5 h-5 text-pink-500" /> },
    { label: 'Посты', path: postsCabinetPath, icon: <FileText className="w-5 h-5 text-indigo-500" /> },
    { label: 'Календарь', path: '/calendar', icon: <CalendarDays className="w-5 h-5 text-sky-500" /> },
    { label: 'Папки', path: '/folders', icon: <FolderHeart className="w-5 h-5 text-rose-500" /> },
  ];

  return (
    <div className="hidden md:flex flex-col w-64 shrink-0 bg-white/40 backdrop-blur-xl border-r border-white/60 h-screen sticky top-0 justify-between p-4 z-20 gap-2 overflow-y-auto no-scrollbar shadow-xs">
      
      <div className="space-y-4">
        {/* Geometric Balance brand header */}
        <div className="flex items-center justify-center px-1 pt-1 cursor-pointer" onClick={() => onNavigate('/')}>
          <ShinyLogo height={38} />
        </div>

        {/* Core Navigation */}
        <div className="pt-2">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isPostsItem = item.label === 'Посты';
              const isPostsRelated =
                isPostsItem &&
                (currentPath.startsWith('/posts') ||
                  currentPath.startsWith('/neuroplan') ||
                  currentPath.startsWith('/scenarios') ||
                  currentPath.startsWith('/crosspost'));
              const isActive = isPostsRelated || (currentPath === item.path || currentPath.startsWith(item.path + '/'));
              return (
                <button
                  id={`btn-sidebar-nav-${item.path.substring(1)}`}
                  key={item.path}
                  onClick={() => onNavigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-bold transition-all text-left cursor-pointer ${
                    isActive 
                      ? 'iirky-card-block text-orange-600 font-extrabold shadow-xs bg-white/80 border border-orange-200/80' 
                      : 'text-slate-700 hover:bg-white/60 hover:text-slate-900 transition-colors'
                  }`}
                >
                  <span className={isActive ? 'text-orange-500' : 'text-slate-500'}>
                    {item.icon}
                  </span>
                  <span className="text-sm font-bold">{item.label}</span>
                </button>
              );
            })}

            {onOpenOnboardingTour && (
              <button
                type="button"
                id="btn-sidebar-onboarding-tour"
                onClick={onOpenOnboardingTour}
                className={
                  isOnboardingCompleted
                    ? 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-bold text-slate-700 hover:bg-white/60 hover:text-slate-900 transition-colors text-left cursor-pointer'
                    : 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-bold bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 hover:opacity-95 text-slate-900 border border-pink-300 shadow-2xs transition-all text-left cursor-pointer'
                }
              >
                <span className="text-sky-500 shrink-0">
                  <Compass className="w-5 h-5 text-sky-500" />
                </span>
                <span className="text-sm font-bold">Вводный тур</span>
              </button>
            )}
          </nav>
        </div>
      </div>

      <div className="pt-3 border-t border-pink-200/60 px-2 text-center text-[14px] font-medium text-slate-600">
        ИИSMM {appVersion}
      </div>

    </div>
  );
}

