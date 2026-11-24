import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { BRAND_ASSETS } from './constants/proTalkStorage';
import { UserAccount } from './types';
import Sidebar from './components/Sidebar';
import BottomNavbar from './components/BottomNavbar';
import { SitePreloader } from './components/SitePreloader';
import { CabinetLoginPreloader } from './components/CabinetLoginPreloader';
import AuthModal from './components/AuthModal';
import LiquidGlassBackground from './components/LiquidGlassBackground';
import { useAppVersion } from './components/footer/useAppVersion';
import { Globe, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { NeurosphereLoader } from './components/loaders/NeurosphereLoader';
import {
  buildAuthReasonForPath,
  cleanRoutePath,
  isDraftsListPath,
  isNeuroplanPath,
  isPublicGuestRoute,
  normalizeCabinetTargetPath,
  resolvePostsRouteMode
} from './hooks/useAppRouting';
import { useAppWorkspaceData } from './hooks/useAppWorkspaceData';
import { useDocumentTitle } from './hooks/useDocumentTitle';

const SocialPage = lazy(() => import('./pages/SocialPage'));
const MarketPage = lazy(() => import('./pages/MarketPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const OfertaPage = lazy(() => import('./pages/OfertaPage'));
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'));
const PaymentFailPage = lazy(() => import('./pages/PaymentFailPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const PublicBlogPostsPage = lazy(() => import('./pages/PublicBlogPostsPage'));
const SingleBlogPostPage = lazy(() => import('./pages/SingleBlogPostPage'));
const Posts = lazy(() => import('./pages/Posts'));
const Channels = lazy(() => import('./pages/Channels'));
const AppleCalendarView = lazy(() => import('./pages/AppleCalendarView'));
const GalleryView = lazy(() => import('./components/GalleryView'));
const FoldersPage = lazy(() => import('./pages/FoldersPage'));
import { OfflineStatusBanner } from './components/pwa/OfflineStatusBanner';
const AiConsultantWidget = lazy(() => import('./components/consultant/AiConsultantWidget').then((m) => ({ default: m.AiConsultantWidget })));
const OnboardingTourBanner = lazy(() => import('./components/onboarding/OnboardingTourModal').then((m) => ({ default: m.OnboardingTourBanner })));
const OnboardingTourModal = lazy(() => import('./components/onboarding/OnboardingTourModal').then((m) => ({ default: m.OnboardingTourModal })));

const RouteLoadingFallback = () => <NeurosphereLoader variant="viewport" />;

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: {
          start_param?: string;
          user?: {
            id: number;
            username?: string;
            first_name: string;
            last_name?: string;
            photo_url?: string;
          };
        };
        paymentStars?: number;
        ready: () => void;
        close: () => void;
        expand: () => void;
      };
    };
  }
}

export default function App() {
  const appVersion = useAppVersion();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      const initialPath = typeof window !== 'undefined' ? window.location.pathname : '';
      if (initialPath === '/' || initialPath === '' || initialPath === '/main' || initialPath === '/chat') {
        sessionStorage.removeItem('iismm_session_auth');
        localStorage.removeItem('iismm_session_auth');
        return false;
      }
      return sessionStorage.getItem('iismm_session_auth') === 'true';
    } catch {
      return false;
    }
  });

  const [isCabinetPreloading, setIsCabinetPreloading] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isOnboardingTourOpen, setIsOnboardingTourOpen] = useState(false);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean>(false);
  const [authModalReason, setAuthModalReason] = useState<string | undefined>(undefined);
  const pendingAuthRedirectRef = useRef<string>('/profile');
  const isLoggedInRef = useRef<boolean>(isLoggedIn);
  isLoggedInRef.current = isLoggedIn;

  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const mainContentRef = useRef<HTMLDivElement>(null);

  const {
    user,
    setUser,
    dayRequests,
    publications,
    templates,
    selectedPostId,
    setSelectedPostId,
    channels,
    posts,
    adListings,
    bulletinAds,
    advertiserOrders,
    totalViews,
    totalClicks,
    loadAllData,
    handleAvatarFileUpload,
    handleTelegramOneClickRegister,
    handleAddDayRequest,
    handleUpdateDayRequest,
    handleDeleteDayRequest,
    handleSaveDayRequest,
    handlePublishToTelegram,
    handleSaveTemplate,
    handleAddChannelNew,
    handleUpdateChannelNew,
    handleDeleteChannelNew,
    handleDeletePublication,
    handleExportCSV,
    handleAddAdListing,
    handleEarnMoney,
    handleReplenishTokens,
    handleReplenishBalance,
    handleBuyAdSlot,
    handleUpgradeTariff,
    handlePostBulletinAd,
    handleAdClick
  } = useAppWorkspaceData(currentPath, setIsLoggedIn);

  useDocumentTitle(currentPath, dayRequests, selectedPostId);

  useEffect(() => {
    const activeUid = user?.id || '16926299042';
    if (!isLoggedIn || !activeUid) return;
    fetch(`/api/onboarding/state?userId=${encodeURIComponent(activeUid)}`, {
      headers: { 'x-user-id': activeUid }
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.state) {
          const s1 = Boolean(d.state.step1Done || d.account?.hasEmail || d.account?.hasTelegram);
          const s2 = Boolean(d.state.step2Done || (d.account?.channelsCount ?? 0) > 0 || channels.length > 0);
          const s3 = Boolean(d.state.step3Done || d.state.createdPostId || (d.account?.postsCount ?? 0) > 0);
          const s4 = Boolean(d.state.step4Done || d.state.createdScenarioId || (d.account?.scenariosCount ?? 0) > 0);
          setIsOnboardingCompleted(Boolean(d.state.tourCompleted || (s1 && s2 && s3 && s4)));
        }
      })
      .catch(() => null);
  }, [isLoggedIn, user?.id, channels.length, dayRequests.length, publications.length]);

  useEffect(() => {
    const captureReferralParam = () => {
      try {
        const params = new URLSearchParams(window.location.search || '');
        const tgStartParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
        const foundRef =
          params.get('ref') ||
          params.get('startapp') ||
          params.get('startParam') ||
          params.get('tgWebAppStartParam') ||
          tgStartParam;
        if (foundRef && String(foundRef).trim()) {
          localStorage.setItem('iismm_ref', String(foundRef).trim());
        }
      } catch {}
    };

    const handleLocationChange = () => {
      captureReferralParam();
      const path = window.location.pathname;

      if (path === '/' || path === '' || path === '/main' || path === '/chat') {
        try {
          sessionStorage.removeItem('iismm_session_auth');
          localStorage.removeItem('iismm_session_auth');
        } catch {}
        setIsLoggedIn(false);
        isLoggedInRef.current = false;
        if (path === '/chat') {
          window.history.replaceState(null, '', '/');
        }
        setCurrentPath(path === '/main' ? '/main' : '/');
        return;
      }

      const search = window.location.search || '';
      const fullPath = `${path}${search}`;

      if (!isLoggedInRef.current) {
        if (isPublicGuestRoute(path)) {
          setCurrentPath(path);
        } else {
          pendingAuthRedirectRef.current = normalizeCabinetTargetPath(fullPath);
          setAuthModalReason(buildAuthReasonForPath(fullPath));
          window.history.replaceState(null, '', '/');
          setCurrentPath('/');
          setIsAuthModalOpen(true);
        }
        return;
      }

      if (isPublicGuestRoute(path)) {
        setCurrentPath(path);
        return;
      }

      const normalized = normalizeCabinetTargetPath(fullPath);
      if (
        isDraftsListPath(normalized) ||
        isNeuroplanPath(normalized) ||
        normalized.startsWith('/scenarios') ||
        normalized.startsWith('/crosspost') ||
        normalized === '/posts' ||
        normalized === '/blog' ||
        /^\/posts[^/]+$/.test(normalized)
      ) {
        setSelectedPostId(null);
      } else if (normalized.startsWith('/posts/')) {
        const sub = decodeURIComponent(normalized.slice('/posts/'.length).replace(/\/+$/, ''));
        if (sub.endsWith('/edit')) {
          setSelectedPostId(sub.slice(0, -'/edit'.length).replace(/\/+$/, '') || null);
        } else if (sub.startsWith('req_')) {
          setSelectedPostId(sub);
        } else {
          setSelectedPostId(null);
        }
      }

      const cleanOriginal = cleanRoutePath(path);
      const hasLegacyProfileTabQuery = cleanOriginal === '/profile' && search.includes('tab=');
      const fullOriginal = `${cleanOriginal}${search}`;
      if (normalized !== fullOriginal && (normalized !== cleanOriginal || hasLegacyProfileTabQuery)) {
        window.history.replaceState(null, '', normalized);
        setCurrentPath(normalized);
      } else {
        setCurrentPath(normalized === fullOriginal ? normalized : cleanOriginal);
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    handleLocationChange();

    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const changeRoute = (path: string) => {
    if (path === '/' || path === '' || path === '/main' || path === '/chat') {
      try {
        sessionStorage.removeItem('iismm_session_auth');
        localStorage.removeItem('iismm_session_auth');
      } catch {}
      setIsLoggedIn(false);
      isLoggedInRef.current = false;
      const cleanLanding = path === '/main' ? '/main' : '/';
      window.history.pushState(null, '', cleanLanding);
      setCurrentPath(cleanLanding);
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return;
    }

    if (!isLoggedInRef.current && !isPublicGuestRoute(path)) {
      pendingAuthRedirectRef.current = normalizeCabinetTargetPath(path);
      setAuthModalReason(buildAuthReasonForPath(path));
      setIsAuthModalOpen(true);
      return;
    }

    const resolvedPath = isLoggedInRef.current
      ? isPublicGuestRoute(path)
        ? cleanRoutePath(path)
        : normalizeCabinetTargetPath(path)
      : cleanRoutePath(path);

    if (
      isDraftsListPath(resolvedPath) ||
      isNeuroplanPath(resolvedPath) ||
      resolvedPath.startsWith('/scenarios') ||
      resolvedPath.startsWith('/crosspost') ||
      resolvedPath === '/posts' ||
      resolvedPath === '/blog' ||
      /^\/posts[^/]+$/.test(resolvedPath)
    ) {
      setSelectedPostId(null);
    } else if (resolvedPath.startsWith('/posts/')) {
      const sub = decodeURIComponent(resolvedPath.slice('/posts/'.length).replace(/\/+$/, ''));
      if (sub.endsWith('/edit')) {
        setSelectedPostId(sub.slice(0, -'/edit'.length).replace(/\/+$/, '') || null);
      } else if (sub.startsWith('req_')) {
        setSelectedPostId(sub);
      } else {
        setSelectedPostId(null);
      }
    }

    window.history.pushState(null, '', resolvedPath);
    setCurrentPath(resolvedPath);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('iismm_session_auth');
      sessionStorage.removeItem('iismm_session_auth');
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error('[Logout] Error clearing cache:', e);
    }
    setIsLoggedIn(false);
    changeRoute('/');
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    if (mainContentRef.current) mainContentRef.current.scrollTop = 0;
  }, [currentPath]);

  const handleGlobalAuthSuccess = (authedUser: Partial<UserAccount>) => {
    setUser((prev) => ({
      ...prev,
      ...authedUser
    }));
    try {
      sessionStorage.setItem('iismm_session_auth', 'true');
      localStorage.setItem('iismm_session_auth', 'true');
    } catch {}
    setIsLoggedIn(true);
    isLoggedInRef.current = true;
    setIsAuthModalOpen(false);
    loadAllData();
    const targetAfterAuth = pendingAuthRedirectRef.current || '/profile';
    pendingAuthRedirectRef.current = '/profile';
    if (isDraftsListPath(targetAfterAuth)) {
      setSelectedPostId(null);
    }
    window.history.pushState(null, '', targetAfterAuth);
    setCurrentPath(targetAfterAuth);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const globalAuthModal = (
    <AuthModal
      isOpen={isAuthModalOpen}
      onClose={() => setIsAuthModalOpen(false)}
      actionReason={authModalReason}
      initialTab="email_register"
      onSuccess={handleGlobalAuthSuccess}
    />
  );

  const isLegalRoute =
    currentPath.startsWith('/oferta') ||
    currentPath.startsWith('/payment/oferta') ||
    currentPath.startsWith('/privacy') ||
    currentPath.startsWith('/policy') ||
    currentPath.startsWith('/agreement') ||
    currentPath.startsWith('/consent') ||
    currentPath.startsWith('/personal-data');

  if (isLegalRoute) {
    return (
      <>
        <Suspense fallback={<RouteLoadingFallback />}>
          <OfertaPage onNavigate={changeRoute} />
        </Suspense>
        {globalAuthModal}
        <Suspense fallback={null}>
          <AiConsultantWidget
            currentPath={currentPath}
            currentUser={user}
            isLoggedIn={isLoggedIn}
            hasBottomNavbar={false}
          />
        </Suspense>
      </>
    );
  }

  if (currentPath.startsWith('/payment/success') || currentPath.startsWith('/payment/robokassa/success')) {
    return (
      <>
        <Suspense fallback={<RouteLoadingFallback />}>
          <PaymentSuccessPage onNavigate={changeRoute} />
        </Suspense>
        {globalAuthModal}
        <Suspense fallback={null}>
          <AiConsultantWidget
            currentPath={currentPath}
            currentUser={user}
            isLoggedIn={isLoggedIn}
            hasBottomNavbar={false}
          />
        </Suspense>
      </>
    );
  }

  if (
    currentPath.startsWith('/payment/fail') ||
    currentPath.startsWith('/payment/fall') ||
    currentPath.startsWith('/payment/robokassa/fail')
  ) {
    return (
      <>
        <Suspense fallback={<RouteLoadingFallback />}>
          <PaymentFailPage onNavigate={changeRoute} />
        </Suspense>
        {globalAuthModal}
        <Suspense fallback={null}>
          <AiConsultantWidget
            currentPath={currentPath}
            currentUser={user}
            isLoggedIn={isLoggedIn}
            hasBottomNavbar={false}
          />
        </Suspense>
      </>
    );
  }

  if (currentPath.startsWith('/reset-password')) {
    return (
      <>
        <Suspense fallback={<RouteLoadingFallback />}>
          <ResetPasswordPage
            onSuccessLogin={(loggedUser) => handleGlobalAuthSuccess(loggedUser)}
            onNavigate={changeRoute}
          />
        </Suspense>
        {globalAuthModal}
        <Suspense fallback={null}>
          <AiConsultantWidget
            currentPath={currentPath}
            currentUser={user}
            isLoggedIn={isLoggedIn}
            hasBottomNavbar={false}
          />
        </Suspense>
      </>
    );
  }

  if (isCabinetPreloading) {
    return (
      <CabinetLoginPreloader
        currentUser={user}
        onUpdateUser={setUser}
        onComplete={() => {
          try {
            sessionStorage.setItem('iismm_session_auth', 'true');
          } catch {}
          setIsCabinetPreloading(false);
          setIsLoggedIn(true);
          isLoggedInRef.current = true;
          const targetAfterAuth = pendingAuthRedirectRef.current || '/profile';
          pendingAuthRedirectRef.current = '/profile';
          changeRoute(targetAfterAuth);
        }}
      />
    );
  }

  const landingPaths = ['/', '/main', '/academy'];
  const isPostOrBlogRoute =
    currentPath === '/posts' ||
    currentPath === '/blog' ||
    currentPath.startsWith('/posts/') ||
    currentPath.startsWith('/blog/');
  const rawPostSubSlug = currentPath.startsWith('/posts/')
    ? currentPath.slice('/posts/'.length)
    : currentPath.startsWith('/blog/')
    ? currentPath.slice('/blog/'.length)
    : '';
  const postSubSlug = rawPostSubSlug
    ? decodeURIComponent(rawPostSubSlug.split('?')[0].split('#')[0].replace(/\/$/, ''))
    : '';
  const isEditorInternalSubRoute = [
    'channels',
    'crosspost',
    'redactor',
    'neuroplan',
    'autogenerator',
    'rewright'
  ].includes(postSubSlug);

  if (!isLoggedIn && isPostOrBlogRoute && !isEditorInternalSubRoute) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-sky-50 via-pink-50 via-orange-50 via-pink-50 to-sky-50 font-sans text-slate-800">
        <header className="sticky top-0 z-30 bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md border-b border-pink-300 px-4 py-3 shadow-2xs">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => changeRoute('/')}>
              <img src={BRAND_ASSETS.logo} alt="ИИSMM" className="h-7 w-auto object-contain" />
              <span className="text-[15px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 to-orange-600 bg-clip-text text-transparent hidden sm:inline">
                Публикации и блог
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => changeRoute('/academy')}
                title="Академия и обучение"
                className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold shadow-xs hover:opacity-90 transition-all cursor-pointer inline-flex items-center justify-center"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => changeRoute('/posts')}
                className="px-3.5 py-1.5 rounded-xl text-[14px] font-bold text-slate-800 hover:text-pink-600 transition-colors cursor-pointer"
              >
                Все публикации
              </button>
              <button
                type="button"
                onClick={() => {
                  pendingAuthRedirectRef.current = '/profile';
                  setAuthModalReason(
                    'Для перехода в личный кабинет пройдите быструю регистрацию или войдите в аккаунт'
                  );
                  setIsAuthModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold shadow-xs hover:opacity-90 transition-all cursor-pointer"
              >
                Войти в кабинет
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6 max-w-5xl mx-auto">
          <Suspense fallback={<RouteLoadingFallback />}>
            {postSubSlug ? (
              <SingleBlogPostPage
                slugOrId={postSubSlug}
                currentUser={null}
                onNavigate={changeRoute}
                onRequireAuth={(reason?: string) => {
                  pendingAuthRedirectRef.current = currentPath;
                  setAuthModalReason(
                    reason ||
                      'Для взаимодействия с публикацией пройдите быструю регистрацию или войдите в аккаунт'
                  );
                  setIsAuthModalOpen(true);
                }}
              />
            ) : (
              <PublicBlogPostsPage
                currentUser={null}
                currentPath={currentPath}
                onNavigate={changeRoute}
                onRequireAuth={(reason?: string) => {
                  pendingAuthRedirectRef.current = currentPath;
                  setAuthModalReason(
                    reason ||
                      'Для взаимодействия с публикацией пройдите быструю регистрацию или войдите в аккаунт'
                  );
                  setIsAuthModalOpen(true);
                }}
              />
            )}
          </Suspense>
        </main>

        <footer className="max-w-5xl mx-auto px-4 py-6 text-center text-[14px] font-medium text-slate-700">
          © 2026 ИИSMM {appVersion} · ООО «РентРоп» (ИНН 7726477438)
        </footer>

        {globalAuthModal}
        <Suspense fallback={null}>
          <AiConsultantWidget
            currentPath={currentPath}
            currentUser={user}
            isLoggedIn={isLoggedIn}
            hasBottomNavbar={false}
          />
        </Suspense>
      </div>
    );
  }

  const isLandingRoute =
    landingPaths.includes(currentPath) || currentPath.startsWith('/academy/') || !isLoggedIn;

  if (isLandingRoute) {
    return (
      <>
        <SitePreloader />
        <Suspense fallback={<RouteLoadingFallback />}>
          <LandingPage
            onLogin={() => {
              setIsCabinetPreloading(true);
              loadAllData();
            }}
            user={user}
            onUpdateUser={setUser}
            currentPath={
              landingPaths.includes(currentPath) || currentPath.startsWith('/academy/')
                ? currentPath
                : '/'
            }
            onNavigate={changeRoute}
            isLoggedIn={isLoggedIn}
          />
        </Suspense>
        {globalAuthModal}
        <Suspense fallback={null}>
          <AiConsultantWidget
            currentPath={currentPath}
            currentUser={user}
            isLoggedIn={isLoggedIn}
            hasBottomNavbar={false}
          />
        </Suspense>
      </>
    );
  }

  const postsRoute = resolvePostsRouteMode(currentPath, dayRequests);

  return (
    <div className="min-h-screen flex flex-col md:flex-row pb-16 md:pb-0 font-sans relative overflow-hidden">
      <LiquidGlassBackground />

      <Sidebar
        currentPath={cleanRoutePath(currentPath)}
        onNavigate={changeRoute}
        tariff={user.tariff}
        tokens={user.tokens}
        balanceRub={user.balanceRub}
        userName={user.name}
        telegramUsername={user.telegramUsername}
        iirky={user.iirky}
        userId={user.id || '16926299042'}
        onOpenOnboardingTour={() => setIsOnboardingTourOpen(true)}
        isOnboardingCompleted={isOnboardingCompleted}
      />

      <div
        ref={mainContentRef}
        className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto no-scrollbar pt-4 px-1 md:p-6 lg:p-8 space-y-5 relative z-10"
      >
        {currentPath === '/social' || currentPath.startsWith('/social/') ? (
          <div className="relative z-10 flex items-center justify-between p-2.5 px-3 rounded-2xl bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md border border-pink-300/70 shadow-xs md:hidden shrink-0">
            <button
              onClick={() => changeRoute('/profile')}
              className="focus:outline-none focus:ring-2 focus:ring-pink-300 rounded-full transition-transform active:scale-95 cursor-pointer z-10"
              title="Профиль"
            >
              <img
                src={user.userAvatar || user.photoUrl || user.avatarUrl || BRAND_ASSETS.heartAvatar}
                alt="Профиль"
                className="w-10 h-10 rounded-full object-cover border-2 border-pink-400 p-0.5 shadow-xs bg-white/80"
                referrerPolicy="no-referrer"
              />
            </button>
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer z-0"
              onClick={() => changeRoute('/dashboard')}
              title="ИИSMM"
            >
              <img
                src={BRAND_ASSETS.logo}
                alt="ИИSMM"
                className="h-7 w-auto object-contain max-w-[120px]"
              />
            </div>
            <button
              onClick={() => changeRoute('/')}
              className="bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white py-1.5 px-3 rounded-full text-[14px] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all z-10"
              title="Перейти на главный сайт"
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span className="font-sans font-bold text-[14px]">Сайт</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-2.5 px-3 rounded-2xl bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md border border-pink-300/70 shadow-xs md:hidden shrink-0 relative">
            <div className="flex items-center gap-1.5 z-10">
              {(() => {
                const raw = (user.tariff || '').toLowerCase();
                const label =
                  raw.includes('космос') || raw.includes('kosmos') || raw.includes('индивидуальн')
                    ? '👑 Космос'
                    : raw.includes('отрыв') || raw.includes('otryv') || raw.includes('vip') || raw.includes('взлет')
                    ? '🔥 Отрыв'
                    : raw.includes('разгон') || raw.includes('razgon') || raw.includes('pro')
                    ? '⚡ Разгон'
                    : '✨ Старт';
                return (
                  <button
                    onClick={() => changeRoute('/tarif')}
                    className="px-2.5 py-1 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold rounded-xl shadow-xs flex items-center gap-1 cursor-pointer hover:opacity-95"
                  >
                    <span>{label}</span>
                  </button>
                );
              })()}
            </div>

            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer z-0"
              onClick={() => changeRoute('/dashboard')}
              title="ИИSMM"
            >
              <img
                src={BRAND_ASSETS.logo}
                alt="ИИSMM"
                className="h-7 w-auto object-contain max-w-[120px]"
              />
            </div>

            <button
              onClick={() => changeRoute('/')}
              className="bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white py-1.5 px-3 rounded-full text-[14px] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all z-10"
              title="Перейти на главный сайт"
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span className="font-sans font-bold text-[14px]">Сайт</span>
            </button>
          </div>
        )}

        {isLoggedIn && !isPublicGuestRoute(currentPath) && !isOnboardingCompleted && (
          <Suspense fallback={null}>
            <OnboardingTourBanner
              userId={user.id || '16926299042'}
              channelsCount={channels.length}
              postsCount={dayRequests.length || publications.length || posts.length || 0}
              onOpenTour={() => setIsOnboardingTourOpen(true)}
              onCompletionChange={setIsOnboardingCompleted}
            />
          </Suspense>
        )}

        <div className="flex-1 min-w-0">
          <motion.div
            key={postsRoute.mode === 'posts_workspace' ? 'posts_workspace' : currentPath}
            initial={{ opacity: 0, scale: 0.992 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            <Suspense fallback={<RouteLoadingFallback />}>
              {postsRoute.mode === 'blog_feed' && (
                <PublicBlogPostsPage
                  currentUser={user}
                  currentPath={currentPath}
                  isCabinetView={postsRoute.isCabinetFeed}
                  onNavigate={changeRoute}
                  onRequireAuth={() => {
                    setAuthModalReason(
                      'Для взаимодействия с публикацией пройдите быструю регистрацию или войдите в аккаунт'
                    );
                    setIsAuthModalOpen(true);
                  }}
                />
              )}

              {postsRoute.mode === 'single_blog_post' && (
                <SingleBlogPostPage
                  slugOrId={postsRoute.blogSlug}
                  currentUser={user}
                  onNavigate={changeRoute}
                  onRequireAuth={() => {
                    setAuthModalReason(
                      'Для взаимодействия с публикацией пройдите быструю регистрацию или войдите в аккаунт'
                    );
                    setIsAuthModalOpen(true);
                  }}
                />
              )}

              {postsRoute.mode === 'posts_workspace' && (
                <Posts
                  dayRequests={dayRequests}
                  channels={channels}
                  templates={templates}
                  currentUser={user}
                  onAddDayRequest={handleAddDayRequest}
                  onUpdateDayRequest={handleUpdateDayRequest}
                  onDeleteDayRequest={handleDeleteDayRequest}
                  onSaveDayRequest={handleSaveDayRequest}
                  onPublishToTelegram={handlePublishToTelegram}
                  onSaveTemplate={handleSaveTemplate}
                  selectedPostId={
                    postsRoute.forceDraftsList ? null : postsRoute.routePostId || selectedPostId
                  }
                  onSelectPostId={setSelectedPostId}
                  telegramId={user.telegramId}
                  currentPath={currentPath}
                  onNavigate={changeRoute}
                  onRefresh={loadAllData}
                />
              )}

              {currentPath.startsWith('/channels') && (
                <Channels
                  channels={channels}
                  currentUser={user}
                  onAddChannel={handleAddChannelNew}
                  onUpdateChannel={handleUpdateChannelNew}
                  onDeleteChannel={handleDeleteChannelNew}
                  onRefresh={loadAllData}
                  onLogout={() => setIsLoggedIn(false)}
                />
              )}

              {(currentPath.startsWith('/calendar') || currentPath.startsWith('/history')) && (
                <AppleCalendarView
                  dayRequests={dayRequests}
                  publications={publications}
                  channels={channels}
                  currentUser={user}
                  handleExportCSV={handleExportCSV}
                  setActiveTab={(tab) => changeRoute('/' + tab)}
                  onSelectPostForEdit={(postId) => {
                    setSelectedPostId(postId);
                    changeRoute(`/posts/${postId}`);
                  }}
                  onDeletePublication={handleDeletePublication}
                  onRefresh={loadAllData}
                  initialViewMode={currentPath.startsWith('/history') ? 'history' : 'calendar'}
                />
              )}

              {currentPath.startsWith('/gallery') && (
                <GalleryView
                  currentUser={user}
                  channels={channels}
                  setActiveTab={(tab) => changeRoute('/' + tab)}
                  onSelectPostForEdit={(postId) => {
                    setSelectedPostId(postId);
                    changeRoute(`/posts/${postId}`);
                  }}
                />
              )}

              {currentPath.startsWith('/folders') && (
                <FoldersPage
                  currentUser={user}
                  channels={channels}
                  currentPath={currentPath}
                  onNavigate={changeRoute}
                  onRefreshUser={loadAllData}
                />
              )}

              {currentPath.startsWith('/social') && (
                <SocialPage
                  user={user}
                  onUpdateUser={setUser}
                  currentPath={currentPath}
                  onLogout={() => setIsLoggedIn(false)}
                  onAvatarFileUpload={handleAvatarFileUpload}
                />
              )}

              {currentPath.startsWith('/market') && (
                <MarketPage
                  adListings={adListings}
                  bulletinAds={bulletinAds}
                  userTariff={user.tariff}
                  userBalance={user.balanceRub}
                  onPostBulletinAd={handlePostBulletinAd}
                  onBuyAdSlot={handleBuyAdSlot}
                  onAddFunds={handleReplenishBalance}
                  onAdClick={handleAdClick}
                  connectedChannels={channels}
                  onAddAdListing={handleAddAdListing}
                  onEarnMoney={handleEarnMoney}
                  advertiserOrders={advertiserOrders}
                />
              )}

              {(currentPath.startsWith('/profile') ||
                currentPath.startsWith('/tarif') ||
                currentPath.startsWith('/partner') ||
                currentPath.startsWith('/teams') ||
                currentPath.startsWith('/brand') ||
                currentPath.startsWith('/api-keys') ||
                currentPath.startsWith('/roundtable') ||
                currentPath.startsWith('/enterprise')) && (
                <ProfilePage
                  user={user}
                  onUpgradeTariff={handleUpgradeTariff}
                  onReplenishTokens={handleReplenishTokens}
                  onReplenishBalance={handleReplenishBalance}
                  onUpdateUser={setUser}
                  onTelegramRegister={handleTelegramOneClickRegister}
                  onLogout={handleLogout}
                  channels={channels}
                  channelsCount={channels.length}
                  postsCount={posts.length}
                  createdPostsCount={dayRequests.length || posts.length || 0}
                  scheduledPostsCount={
                    dayRequests.filter((r) => r.status === 'scheduled' || r.status === 'pending').length
                  }
                  publishedPostsCount={
                    publications.length > 0
                      ? publications.length
                      : dayRequests.filter(
                          (r) => r.status === 'posted' || r.status === 'published' || r.status === 'done'
                        ).length
                  }
                  totalViews={totalViews}
                  totalClicks={totalClicks}
                  earningsRub={user.earningsRub}
                  currentPath={currentPath}
                  onOpenOnboardingTour={() => setIsOnboardingTourOpen(true)}
                />
              )}

              {(currentPath.startsWith('/admin') || currentPath.startsWith('/system-admin')) && (
                <AdminPage
                  currentUser={user}
                  onUpdateCurrentUser={setUser}
                  allChannelsCount={channels.length}
                  currentPath={currentPath}
                />
              )}

              {currentPath.startsWith('/oferta') && <OfertaPage onNavigate={changeRoute} />}

              {currentPath.startsWith('/reset-password') && (
                <ResetPasswordPage
                  onSuccessLogin={(loggedUser) => {
                    setUser(loggedUser);
                    setIsLoggedIn(true);
                  }}
                  onNavigate={changeRoute}
                />
              )}
              </Suspense>
          </motion.div>
        </div>

        <div className="md:hidden pt-2 pb-4 text-center text-[14px] font-medium text-slate-700 shrink-0">
          ИИSMM {appVersion}
        </div>
      </div>

      <BottomNavbar
        currentPath={currentPath}
        onNavigate={changeRoute}
        tariff={user.tariff}
        userId={user.id || '16926299042'}
      />

      {isOnboardingTourOpen && (
        <Suspense fallback={null}>
          <OnboardingTourModal
            isOpen={isOnboardingTourOpen}
            onClose={() => setIsOnboardingTourOpen(false)}
            user={user}
            channels={channels}
            onAddDayRequest={handleAddDayRequest}
            onNavigate={changeRoute}
            onSelectPostId={setSelectedPostId}
            onRefreshAll={loadAllData}
            onCompletionChange={setIsOnboardingCompleted}
          />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <AiConsultantWidget
          currentPath={currentPath}
          currentUser={user}
          isLoggedIn={isLoggedIn}
          hasBottomNavbar={true}
        />
      </Suspense>
      <OfflineStatusBanner onNavigate={changeRoute} />
    </div>
  );
}
