import { useCallback, useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __iismmDeferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function detectIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function detectIsIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isAppleTouch =
    ua.includes('macintosh') && typeof document !== 'undefined' && 'ontouchend' in document;
  return /iphone|ipad|ipod/.test(ua) || isAppleTouch;
}

export function detectIsAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return /android/i.test(window.navigator.userAgent);
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    typeof window !== 'undefined' ? window.__iismmDeferredPrompt || null : null
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => detectIsStandalone());
  const [isIOS] = useState<boolean>(() => detectIsIOS());
  const [isAndroid] = useState<boolean>(() => detectIsAndroid());

  useEffect(() => {
    setIsInstalled(detectIsStandalone());

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__iismmDeferredPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      window.__iismmDeferredPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = (ev: MediaQueryListEvent) => {
      if (ev.matches) setIsInstalled(true);
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayChange);
      }
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'manual_required'> => {
    const promptObj = deferredPrompt || window.__iismmDeferredPrompt;
    if (!promptObj) {
      return 'manual_required';
    }
    try {
      await promptObj.prompt();
      const { outcome } = await promptObj.userChoice;
      if (outcome === 'accepted') {
        window.__iismmDeferredPrompt = null;
        setDeferredPrompt(null);
        setIsInstalled(true);
        return 'accepted';
      }
      return 'dismissed';
    } catch {
      return 'manual_required';
    }
  }, [deferredPrompt]);

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    isAndroid,
    install,
  };
}
