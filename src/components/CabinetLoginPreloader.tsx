import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Database, Image as ImageIcon, CheckCircle, ShieldCheck, Layers } from 'lucide-react';
import { UserAccount } from '../types';
import { NeurosphereLoader } from './loaders/NeurosphereLoader';
import { BRAND_ASSETS, GALLERY_AVATAR_POOL } from '../constants/proTalkStorage';

interface CabinetLoginPreloaderProps {
  currentUser?: UserAccount;
  onComplete: () => void;
  onUpdateUser?: (updated: UserAccount) => void;
}

// Critical cabinet assets to pre-cache in browser memory
const CABINET_CRITICAL_IMAGES = [
  BRAND_ASSETS.socialLight,
  BRAND_ASSETS.heroScreenshot,
  BRAND_ASSETS.logo,
  BRAND_ASSETS.heartAvatar,
  ...GALLERY_AVATAR_POOL.slice(0, 5)
];

export const CabinetLoginPreloader: React.FC<CabinetLoginPreloaderProps> = ({
  currentUser,
  onComplete,
  onUpdateUser
}) => {
  const [progress, setProgress] = useState<number>(10);
  const [statusText, setStatusText] = useState<string>('вход в личный кабинет...');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  const onCompleteRef = React.useRef(onComplete);
  const onUpdateUserRef = React.useRef(onUpdateUser);
  const currentUserRef = React.useRef(currentUser);

  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  React.useEffect(() => {
    onUpdateUserRef.current = onUpdateUser;
  }, [onUpdateUser]);

  React.useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    let isCancelled = false;

    // Helper to preload an image into memory
    const preloadImg = (src: string): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!src) {
          resolve(true);
          return;
        }
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(true); // Don't block if single image fails
        img.src = src;
      });
    };

    const loadCabinetDataAndAssets = async () => {
      // Step 1: Authorization verification
      setProgress(15);
      setStatusText('проверка учётных данных и авторизация...');
      setCurrentStep(1);

      await new Promise(r => setTimeout(r, 260));
      if (isCancelled) return;

      // Step 2: Database sync
      setProgress(42);
      setStatusText('загрузка ваших данных и каналов из базы...');
      setCurrentStep(2);

      const activeUser = currentUserRef.current;
      const activeUserId = activeUser?.id ? String(activeUser.id).trim() : '';
      const activeTelegramId = activeUser?.telegramId ? String(activeUser.telegramId).trim() : '';

      try {
        const requests: Array<Promise<Response>> = [];
        const headers: Record<string, string> = { 'Cache-Control': 'no-cache' };
        if (activeUserId) {
          headers['x-user-id'] = activeUserId;
        }

        const userQuery = new URLSearchParams();
        if (activeUserId) userQuery.set('id', activeUserId);
        if (activeTelegramId) userQuery.set('telegramId', activeTelegramId);

        const userPromise =
          activeUserId || activeTelegramId
            ? fetch(`/api/users/me?${userQuery.toString()}`, { headers })
            : Promise.resolve(null);

        const scopedQs = activeUserId ? `?userId=${encodeURIComponent(activeUserId)}` : '';
        requests.push(
          fetch(`/api/channels${scopedQs}`, { headers }),
          fetch(`/api/day-requests${scopedQs}`, { headers }),
          fetch('/api/system/stats', { headers })
        );

        const [userResult] = await Promise.allSettled([userPromise, ...requests]);

        if (
          !isCancelled &&
          userResult.status === 'fulfilled' &&
          userResult.value &&
          userResult.value.ok
        ) {
          const freshData = await userResult.value.json();
          const latestActive = currentUserRef.current;
          if (
            freshData?.user &&
            onUpdateUserRef.current &&
            latestActive &&
            (!activeUserId || String(freshData.user.id) === activeUserId)
          ) {
            onUpdateUserRef.current({
              ...latestActive,
              ...freshData.user
            });
          }
        }
      } catch {
        // Continue gracefully
      }

      // Preload critical assets in parallel
      if (activeUser?.avatarUrl) {
        preloadImg(activeUser.avatarUrl).catch(() => null);
      }

      await new Promise(r => setTimeout(r, 320));
      if (isCancelled) return;

      // Step 3: Workspace preparation
      setProgress(78);
      setStatusText('настройка рабочего пространства и профиля...');
      setCurrentStep(3);

      await new Promise(r => setTimeout(r, 340));
      if (isCancelled) return;

      // Step 4: Finalization
      setProgress(100);
      setStatusText('добро пожаловать! переход в кабинет...');
      setCurrentStep(4);

      await new Promise(r => setTimeout(r, 380));
      if (!isCancelled) {
        setIsFinished(true);
        onCompleteRef.current();
      }
    };

    loadCabinetDataAndAssets();

    return () => {
      isCancelled = true;
    };
  }, [currentUser?.id, currentUser?.telegramId]);

  return (
    <AnimatePresence>
      {!isFinished && (
        <motion.div
          key="cabinet-preloader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 select-none backdrop-blur-xl"
          style={{
            background:
              'linear-gradient(135deg, rgba(240, 249, 255, 0.96) 0%, rgba(253, 242, 248, 0.96) 25%, rgba(255, 247, 237, 0.96) 50%, rgba(253, 242, 248, 0.96) 75%, rgba(240, 249, 255, 0.96) 100%)'
          }}
        >
          {/* Main Preloader Card */}
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl border-2 border-pink-400 shadow-2xl space-y-6 text-center backdrop-blur-md relative overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, rgba(240, 249, 255, 0.94) 0%, rgba(253, 242, 248, 0.94) 25%, rgba(255, 247, 237, 0.94) 50%, rgba(253, 242, 248, 0.94) 75%, rgba(240, 249, 255, 0.94) 100%)'
            }}
          >
            {/* Neural Sphere AI Badge */}
            <div className="flex flex-col items-center space-y-2">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <NeurosphereLoader variant="embed" />
              </div>

              <div className="space-y-1">
                <h2 className="text-[18px] sm:text-[20px] font-extrabold bg-gradient-to-r from-sky-500 via-pink-600 via-orange-500 via-pink-600 to-sky-500 bg-clip-text text-transparent">
                  добро пожаловать{currentUser?.firstName ? `, ${currentUser.firstName}` : ''}!
                </h2>
                <p className="text-[14px] text-slate-700 font-medium">
                  подготовка вашего личного кабинета
                </p>
              </div>
            </div>

            {/* Step Progress Indicators - Friendly User Steps */}
            <div className="grid grid-cols-4 gap-2 text-center text-[14px]">
              <div className={`p-2 rounded-xl border transition-all ${
                currentStep >= 1
                  ? 'bg-white/90 border-pink-400 text-pink-700 shadow-2xs font-semibold'
                  : 'bg-white/40 border-pink-200 text-slate-400'
              }`}>
                <ShieldCheck size={16} className="mx-auto mb-1 text-pink-600" />
                <span className="text-[14px] block leading-tight">вход</span>
              </div>
              <div className={`p-2 rounded-xl border transition-all ${
                currentStep >= 2
                  ? 'bg-white/90 border-pink-400 text-pink-700 shadow-2xs font-semibold'
                  : 'bg-white/40 border-pink-200 text-slate-400'
              }`}>
                <Layers size={16} className="mx-auto mb-1 text-pink-600" />
                <span className="text-[14px] block leading-tight">данные</span>
              </div>
              <div className={`p-2 rounded-xl border transition-all ${
                currentStep >= 3
                  ? 'bg-white/90 border-pink-400 text-pink-700 shadow-2xs font-semibold'
                  : 'bg-white/40 border-pink-200 text-slate-400'
              }`}>
                <Sparkles size={16} className="mx-auto mb-1 text-pink-600" />
                <span className="text-[14px] block leading-tight">профиль</span>
              </div>
              <div className={`p-2 rounded-xl border transition-all ${
                currentStep >= 4
                  ? 'bg-white/90 border-pink-400 text-pink-700 shadow-2xs font-semibold'
                  : 'bg-white/40 border-pink-200 text-slate-400'
              }`}>
                <CheckCircle size={16} className="mx-auto mb-1 text-pink-600" />
                <span className="text-[14px] block leading-tight">готово</span>
              </div>
            </div>

            {/* Dynamic Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[14px] text-slate-700 font-semibold px-1">
                <span>загрузка</span>
                <span className="font-mono text-pink-700 font-bold">{progress}%</span>
              </div>
              <div className="w-full h-3 bg-white/80 rounded-full border border-pink-300 p-0.5 overflow-hidden shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 transition-all duration-300 shadow-sm"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Status Message */}
            <div className="p-3 bg-white/90 rounded-2xl border border-pink-300 shadow-2xs">
              <p className="text-[14px] font-medium text-slate-800 leading-snug">
                {statusText}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

