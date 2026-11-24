import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BRAND_ASSETS, GALLERY_AVATAR_POOL } from '../constants/proTalkStorage';
import { NeurosphereLoader } from './loaders/NeurosphereLoader';

interface SitePreloaderProps {
  onComplete?: () => void;
  minDurationMs?: number;
}

// Critical images from Landing Page to cache into browser memory
const CRITICAL_LANDING_IMAGES = [
  '/pwa/heart-loader.png',
  ...GALLERY_AVATAR_POOL.slice(0, 4),
  BRAND_ASSETS.socialLight,
  BRAND_ASSETS.heroScreenshot,
  BRAND_ASSETS.logo
];

export const SitePreloader: React.FC<SitePreloaderProps> = ({ onComplete, minDurationMs = 1200 }) => {
  const [progress, setProgress] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('загрузка сервиса...');

  useEffect(() => {
    // SEO Bot detection (Yandex, Google, Mail.ru, GPTBot, ClaudeBot, etc.):
    // If a search engine crawler or AI indexing bot visits the site, bypass preloader immediately so full content is indexed without delays!
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isSearchBot = /bot|googlebot|crawler|spider|robot|crawling|yandex|mail\.ru|rambler|bingbot|duckduckbot|baiduspider|gptbot|claude|chatgpt|perplexity|applebot/i.test(userAgent);
    
    if (isSearchBot) {
      setIsLoaded(true);
      if (onComplete) onComplete();
      return;
    }

    // Check if user already saw the preloader in this tab session
    const hasLoadedThisSession = sessionStorage.getItem('iismm_preloader_seen');
    if (hasLoadedThisSession === 'true') {
      setIsLoaded(true);
      if (onComplete) onComplete();
      return;
    }

    const startTime = Date.now();
    let loadedCount = 0;
    const totalImages = CRITICAL_LANDING_IMAGES.length;

    const updateImageProgress = () => {
      loadedCount++;
      const currentPct = Math.min(95, Math.round((loadedCount / totalImages) * 90));
      setProgress(prev => Math.max(prev, currentPct));

      if (currentPct < 30) {
        setStatusMessage('загрузка сервиса...');
      } else if (currentPct < 65) {
        setStatusMessage('подготовка рабочего пространства...');
      } else if (currentPct < 90) {
        setStatusMessage('настройка интерфейса...');
      } else {
        setStatusMessage('почти готово...');
      }
    };

    // Preload all critical images asynchronously into browser memory cache
    CRITICAL_LANDING_IMAGES.forEach(url => {
      const img = new Image();
      img.onload = updateImageProgress;
      img.onerror = updateImageProgress;
      img.src = url;
    });

    // Smooth progress increment ticker to ensure visually pleasing ramp-up
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev < 90) {
          const nextVal = prev + Math.floor(Math.random() * 8) + 4;
          return Math.min(92, nextVal);
        }
        return prev;
      });
    }, 90);

    // Completion safety timer: finish loading after all images are cached (or safety timeout)
    const safetyTimeout = setTimeout(() => {
      clearInterval(interval);
      setProgress(100);
      setStatusMessage('добро пожаловать!');

      const elapsed = Date.now() - startTime;
      const remainingDelay = Math.max(200, minDurationMs - elapsed);

      setTimeout(() => {
        setIsLoaded(true);
        try {
          sessionStorage.setItem('iismm_preloader_seen', 'true');
        } catch (e) {}
        if (onComplete) onComplete();
      }, remainingDelay);
    }, 2200);

    return () => {
      clearInterval(interval);
      clearTimeout(safetyTimeout);
    };
  }, [minDurationMs, onComplete]);

  if (isLoaded) return null;

  return (
    <AnimatePresence>
      {!isLoaded && (
        <motion.div
          id="site-preloader-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.45, ease: 'easeInOut' } }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden select-none"
          style={{
            // Brand gradient background matching Landing Page
            background: 'linear-gradient(135deg, #e0f2fe 0%, #fce7f3 25%, #ffedd5 50%, #fce7f3 75%, #e0f2fe 100%)'
          }}
          aria-live="polite"
          aria-busy={!isLoaded}
        >
          {/* Subtle glowing ambient blobs (sky, pink, orange) */}
          <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-sky-300/30 blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-pink-300/30 blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 right-1/3 w-64 h-64 rounded-full bg-orange-300/25 blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1.5s' }} />

          {/* Central Liquid Glass Container */}
          <div className="relative z-10 max-w-md w-[92%] sm:w-full mx-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 backdrop-blur-xl border border-pink-200/80 shadow-2xl flex flex-col items-center text-center">
            
            {/* SVG Animated Neurosphere with compressed heart center */}
            <div className="relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center mb-5">
              <NeurosphereLoader variant="embed" />
            </div>

            {/* App Brand Title with pure gradient (no white-out) */}
            <h1
              className="text-2xl sm:text-3xl font-black tracking-tight mb-1"
              style={{
                background: 'linear-gradient(90deg, #38bdf8 0%, #ec4899 25%, #f97316 50%, #ec4899 75%, #38bdf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              ИИSMM
            </h1>

            {/* Subtitle - no caps, font size >= 14px */}
            <p className="text-[14px] text-slate-700 font-medium mb-5 leading-normal">
              интеллектуальный автопостинг и управление соцсетями
            </p>

            {/* Progress Percentage Display */}
            <div className="flex items-baseline justify-center space-x-1.5 mb-2.5">
              <span 
                className="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono"
                style={{
                  background: 'linear-gradient(90deg, #38bdf8 0%, #ec4899 50%, #f97316 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                {progress}%
              </span>
            </div>

            {/* Progress Bar Container with liquid glass border */}
            <div className="w-full max-w-xs h-3.5 bg-white/80 rounded-full p-0.5 border border-pink-300/80 shadow-inner mb-3.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-200 ease-out"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #38bdf8 0%, #ec4899 25%, #f97316 50%, #ec4899 75%, #38bdf8 100%)'
                }}
              />
            </div>

            {/* Dynamic Status Text - no caps, size 14px, high readability */}
            <p className="text-[14px] text-slate-700 font-medium transition-all duration-200 flex items-center justify-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
              <span>{statusMessage}</span>
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
