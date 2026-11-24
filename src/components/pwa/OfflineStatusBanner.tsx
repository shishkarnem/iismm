import React, { useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/pwa/useOnlineStatus';

interface OfflineStatusBannerProps {
  onNavigate?: (path: string) => void;
}

export const OfflineStatusBanner: React.FC<OfflineStatusBannerProps> = ({ onNavigate }) => {
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (!onNavigate || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_NAVIGATE' && typeof event.data.url === 'string') {
        onNavigate(event.data.url);
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, [onNavigate]);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 sm:right-auto z-50 flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 backdrop-blur-md border border-orange-300 px-4 py-2.5 text-[14px] font-bold text-slate-900 shadow-lg">
      <WifiOff className="w-4 h-4 text-orange-600 shrink-0" />
      <span>Нет подключения к сети — используется кэш приложения</span>
    </div>
  );
};
