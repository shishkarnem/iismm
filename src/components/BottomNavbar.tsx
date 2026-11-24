import React from 'react';
import { 
  User, FileText, FolderHeart, Users, MessageSquare, Cpu, CalendarDays, Image as ImageIcon
} from 'lucide-react';

interface BottomNavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  tariff?: 'free' | 'pro' | 'vip';
  userId?: string;
}

export default function BottomNavbar({ currentPath, onNavigate, userId = '16926299042' }: BottomNavbarProps) {
  const postsCabinetPath = `/posts${userId || '16926299042'}`;

  const navItems = [
    { label: 'Профиль', path: '/profile', icon: <User className="w-5 h-5 text-orange-500" /> },
    { label: 'Соцсеть', path: '/social', icon: <Users className="w-5 h-5 text-pink-500" /> },
    { label: 'Посты', path: postsCabinetPath, icon: <FileText className="w-5 h-5 text-indigo-500" /> },
    { label: 'Календарь', path: '/calendar', icon: <CalendarDays className="w-5 h-5 text-sky-500" /> },
    { label: 'Папки', path: '/folders', icon: <FolderHeart className="w-5 h-5 text-rose-500" /> }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 backdrop-blur-md border-t-2 border-x border-pink-300/80 rounded-t-3xl shadow-2xl pb-safe-bottom overflow-hidden">
      <nav id="bottom-navbar" className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const isPostsItem = item.label === 'Посты';
          const isPostsRelated =
            isPostsItem &&
            (currentPath.startsWith('/posts') ||
              currentPath.startsWith('/neuroplan') ||
              currentPath.startsWith('/scenarios') ||
              currentPath.startsWith('/crosspost'));
          const isSocialItem = item.label === 'Соцсеть';
          const isSocialRelated = isSocialItem && (currentPath === '/social' || currentPath.startsWith('/social/feed') || currentPath.startsWith('/social/messages'));
          const isFoldersItem = item.label === 'Папки';
          const isFoldersRelated = isFoldersItem && (currentPath.startsWith('/folders') || currentPath.startsWith('/social/saved'));
          
          const isActive = isPostsRelated || isSocialRelated || isFoldersRelated || currentPath === item.path || currentPath.startsWith(item.path + '/');
          
          return (
            <button
              id={`btn-bottom-nav-${item.path.substring(1).replace(/\//g, '-')}`}
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full min-h-[48px] text-center transition-all cursor-pointer ${
                isActive 
                  ? 'text-pink-600 font-extrabold' 
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-white/90 shadow-xs' : 'text-slate-500'}`}>
                {item.icon}
              </div>
              <span className="text-[14px] mt-0.5 font-bold font-sans tracking-tight truncate w-full text-center leading-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

