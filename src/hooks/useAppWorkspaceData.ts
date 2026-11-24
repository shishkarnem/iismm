import React, { useEffect, useState } from 'react';
import {
  AdListing,
  AdOrder,
  BulletinAd,
  CampaignPost,
  DayRequest,
  PostTemplate,
  PromoBundle,
  Publication,
  Settings,
  SocialChannel,
  Stats,
  UserAccount
} from '../types';
import { useFileUpload } from './useFileUpload';
import { isDraftsListPath, isNeuroplanPath } from './useAppRouting';
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from '../constants/proTalkStorage';

const INITIAL_AD_LISTINGS: AdListing[] = [
  {
    id: 'ad-lst-1',
    channelId: 'ch-ext-1',
    channelName: 'ИИ для бизнеса',
    platform: 'telegram',
    priceRub: 450,
    subscribersCount: 16500,
    avgViews: 4100,
    category: 'Бизнес и маркетинг',
    contactUsername: '@IIrkiBot',
    description: 'Авторский канал про нейросети и автоматизацию процессов. Платежеспособная аудитория.'
  },
  {
    id: 'ad-lst-2',
    channelId: 'ch-ext-2',
    channelName: 'Дизайнеры будущего',
    platform: 'vk',
    priceRub: 300,
    subscribersCount: 19800,
    avgViews: 1200,
    category: 'Дизайн и обучение',
    contactUsername: '@IIrkiBot',
    description: 'Сообщество с уроками, материалами и задачами для цифровых дизайнеров.'
  },
  {
    id: 'ad-lst-3',
    channelId: 'ch-ext-3',
    channelName: 'Цифровые тренды',
    platform: 'x',
    priceRub: 900,
    subscribersCount: 38200,
    avgViews: 9500,
    category: 'Технологии',
    contactUsername: '@IIrkiBot',
    description: 'Ежедневные обзоры технологических сервисов и аналитика рынка.'
  }
];

const INITIAL_BULLETIN_ADS: BulletinAd[] = [
  {
    id: 'bull-1',
    title: 'Защита комментариев в Telegram от спама',
    content:
      'Добавьте бота @IIrkiBot в комментарии вашего канала: автоматическая фильтрация спама со ссылками и удобные репосты.',
    linkUrl: 'https://t.me/IIrkiBot',
    postedBy: '@IIrkiBot',
    createdAt: '2026-05-23T10:15:00.000Z',
    clicks: 220
  },
  {
    id: 'bull-2',
    title: 'Набор организаторов тематических папок по маркетингу',
    content:
      'Создайте взаимный рекламный сбор для тематических каналов бесплатно и управляйте заявками участников в одном окне.',
    linkUrl: 'https://t.me/IIrkiBot',
    postedBy: '@IIrkiBot',
    createdAt: '2026-05-23T09:30:00.000Z',
    clicks: 145
  }
];

const INITIAL_ADVERTISER_ORDERS: AdOrder[] = [
  {
    id: 'ord-1',
    title: 'Академия нейромаркетинга',
    payoutRub: 350,
    platform: 'telegram',
    requirements: 'Держать в ленте 2 часа без удаления.',
    postContent:
      'Освойте подготовку контента с нейросетями за 2 недели и ускорьте ведение каналов в несколько раз.'
  },
  {
    id: 'ord-2',
    title: 'Продвижение экосистемы @IIrkiBot',
    payoutRub: 550,
    platform: 'telegram',
    requirements: 'Опубликовать на 24 часа.',
    postContent:
      'Подключите @IIrkiBot для защиты комментариев от спама и автоматизации ведения канала.'
  },
  {
    id: 'ord-3',
    title: 'Интенсив по продуктовому дизайну',
    payoutRub: 400,
    platform: 'vk',
    requirements: 'Размещение в основную ленту.',
    postContent: 'Практический интенсив по современным мобильным и веб-интерфейсам.'
  }
];

const INITIAL_BUNDLES: PromoBundle[] = [
  {
    id: 'bnd-1',
    title: 'Маркетинг и нейросети (майский сбор)',
    organizerUsername: '@shishkarnem',
    rules: 'Держать в топе 3 часа после размещения. Не удалять публикацию папки в течение 2 суток.',
    entryFeeRub: 250,
    channelsCount: 6,
    maxChannels: 12,
    status: 'collecting',
    joinedChannels: ['ch-1', 'ch-2'],
    isFreeForOrganizer: true
  },
  {
    id: 'bnd-2',
    title: 'Лайфстайл и блоги (быстрый рост)',
    organizerUsername: '@IIrkiBot',
    rules: 'Бот проверяет охваты и участие всех каналов подборки автоматически.',
    entryFeeRub: 150,
    channelsCount: 3,
    maxChannels: 10,
    status: 'collecting',
    joinedChannels: [],
    isFreeForOrganizer: false
  }
];

export function useAppWorkspaceData(currentPath: string, setIsLoggedIn: (val: boolean) => void) {
  const [user, setUser] = useState<UserAccount>({
    id: '16926299042',
    telegramId: 169262990,
    name: 'Тимошенко Денис',
    firstName: 'Денис',
    lastName: 'Тимошенко',
    telegramUsername: '@shishkarnem',
    email: 'shishkarnem@gmail.com',
    tariff: 'start',
    tokens: 1200,
    iirky: 1200,
    telegramStars: 9999,
    avatarUrl: BRAND_ASSETS.ownerAvatar,
    balanceRub: 100000,
    earningsRub: 500000,
    premiumUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('ru-RU')
  });

  const [dayRequests, setDayRequests] = useState<DayRequest[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [templates, setTemplates] = useState<PostTemplate[]>([]);
  const [settings, setSettings] = useState<Settings>({
    botToken: '',
    protalkApiKey: '',
    systemRole: 'Прохор',
    cronSchedule: '*/15 * * * *',
    theme: 'dark'
  });
  const [stats, setStats] = useState<Stats>({
    totalPrompts: 0,
    publishedThisMonth: 0,
    activeChannelsCount: 0,
    recentPublications: []
  });
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [channels, setChannels] = useState<SocialChannel[]>([]);
  const [posts, setPosts] = useState<CampaignPost[]>([]);
  const [adListings, setAdListings] = useState<AdListing[]>(INITIAL_AD_LISTINGS);
  const [bulletinAds, setBulletinAds] = useState<BulletinAd[]>(INITIAL_BULLETIN_ADS);
  const [advertiserOrders] = useState<AdOrder[]>(INITIAL_ADVERTISER_ORDERS);
  const [bundles, setBundles] = useState<PromoBundle[]>(INITIAL_BUNDLES);

  // Telegram WebApp auto-detection
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      try {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();

        const initData = tg.initData;
        const tgUser = tg.initDataUnsafe?.user;
        const searchParams = new URLSearchParams(window.location.search);
        const startParam =
          tg.initDataUnsafe?.start_param ||
          searchParams.get('tgWebAppStartParam') ||
          searchParams.get('startapp') ||
          searchParams.get('ref');

        if (startParam && String(startParam).trim()) {
          try {
            localStorage.setItem('iismm_ref', String(startParam).trim());
          } catch {}
        }

        if (initData) {
          fetch('/api/auth/telegram-twa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData, startParam })
          })
            .then((r) => r.json())
            .then((data) => {
              if (data.success && data.user) {
                const u = data.user;
                setUser({
                  id: String(u.id),
                  telegramId: u.telegramId,
                  name:
                    u.name ||
                    `${u.firstName || ''} ${u.lastName || ''}`.trim() ||
                    u.telegramUsername ||
                    `User_${u.id}`,
                  firstName: u.firstName || '',
                  lastName: u.lastName || '',
                  telegramUsername: u.telegramUsername
                    ? u.telegramUsername.startsWith('@')
                      ? u.telegramUsername
                      : `@${u.telegramUsername}`
                    : `@id${u.id}`,
                  role: u.role || 'user',
                  tariff: u.tariff || (u.role === 'admin' ? 'Космос' : 'Старт'),
                  tokens: u.balance ?? u.tokens ?? 300,
                  iirky: u.balance ?? u.iirky ?? 300,
                  telegramStars: 450,
                  avatarUrl:
                    normalizeProTalkMediaUrl(u.userAvatar || u.photoUrl || u.avatarUrl) ||
                    BRAND_ASSETS.heartAvatar,
                  balanceRub: u.balanceRub || 0,
                  earningsRub: u.earningsRub || 0,
                  referralRewardBalance: u.referralRewardBalance || 0,
                  tariff_expires_at: u.tariff_expires_at || undefined,
                  premiumUntil: u.tariff_expires_at
                    ? new Date(u.tariff_expires_at).toLocaleDateString('ru-RU')
                    : undefined
                });
                const isLanding =
                  window.location.pathname === '/' ||
                  window.location.pathname === '' ||
                  window.location.pathname === '/main';
                if (!isLanding) {
                  setIsLoggedIn(true);
                } else {
                  sessionStorage.removeItem('iismm_session_auth');
                  localStorage.removeItem('iismm_session_auth');
                  setIsLoggedIn(false);
                }
              }
            })
            .catch((e) => console.error('TWA backend auth error:', e));
        } else if (tgUser) {
          const namesStr =
            [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'Пользователь Telegram';
          setUser((prev) => ({
            ...prev,
            id: String(tgUser.id),
            telegramId: tgUser.id,
            name: namesStr,
            firstName: tgUser.first_name,
            lastName: tgUser.last_name || '',
            telegramUsername: tgUser.username ? `@${tgUser.username}` : `@id${tgUser.id}`,
            avatarUrl: tgUser.photo_url || prev.avatarUrl
          }));
          const isLanding =
            window.location.pathname === '/' ||
            window.location.pathname === '' ||
            window.location.pathname === '/main';
          if (!isLanding) {
            setIsLoggedIn(true);
          } else {
            sessionStorage.removeItem('iismm_session_auth');
            localStorage.removeItem('iismm_session_auth');
            setIsLoggedIn(false);
          }
        }
      } catch (err) {
        console.error('TWA detection error:', err);
      }
    }
  }, []);

  // Sync user profile and balance
  useEffect(() => {
    if (user.id || user.telegramId) {
      const query = new URLSearchParams();
      if (user.id) query.set('id', user.id);
      if (user.telegramId) query.set('telegramId', String(user.telegramId));

      fetch(`/api/users/me?${query.toString()}`, {
        headers: { 'x-user-id': user.id || '16926299042' }
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && data.user) {
            const u = data.user;
            setUser((prev) => ({
              ...prev,
              id: u.id || prev.id,
              telegramId: u.telegramId || prev.telegramId,
              avatarUrl: u.photoUrl || u.avatarUrl || prev.avatarUrl,
              name: u.name || prev.name,
              firstName: u.firstName || prev.firstName,
              lastName: u.lastName || prev.lastName,
              role: u.role || prev.role,
              tariff: u.tariff || prev.tariff,
              tariff_expires_at: u.tariff_expires_at !== undefined ? u.tariff_expires_at : prev.tariff_expires_at,
              auto_renew_tariff: u.auto_renew_tariff !== undefined ? u.auto_renew_tariff : prev.auto_renew_tariff,
              hasRainbowHeart: u.hasRainbowHeart !== undefined ? u.hasRainbowHeart : prev.hasRainbowHeart,
              balance_pay: u.balance_pay !== undefined ? u.balance_pay : prev.balance_pay,
              balance_tarif: u.balance_tarif !== undefined ? u.balance_tarif : prev.balance_tarif,
              iirky: u.balance !== undefined ? u.balance : u.iirky !== undefined ? u.iirky : prev.iirky,
              tokens: u.balance !== undefined ? u.balance : u.tokens !== undefined ? u.tokens : prev.tokens,
              telegramUsername: u.telegramUsername
                ? u.telegramUsername.startsWith('@')
                  ? u.telegramUsername
                  : `@${u.telegramUsername}`
                : prev.telegramUsername
            }));
          }
        })
        .catch(() => null);
    }
  }, [user.id, user.telegramId]);

  useEffect(() => {
    const handleLiveBalanceSync = (ev: Event) => {
      const customEv = ev as CustomEvent<{ balance?: number }>;
      const nextBal = customEv.detail?.balance;
      if (typeof nextBal === 'number' && !Number.isNaN(nextBal)) {
        setUser((prev) => ({
          ...prev,
          iirky: nextBal,
          tokens: nextBal
        }));
      }
    };
    window.addEventListener('iismm-balance-updated', handleLiveBalanceSync);
    return () => window.removeEventListener('iismm-balance-updated', handleLiveBalanceSync);
  }, []);

  // Keep selectedPostId strictly synced with currentPath: clear whenever opening drafts list / redactor
  useEffect(() => {
    if (isDraftsListPath(currentPath) || isNeuroplanPath(currentPath)) {
      setSelectedPostId(null);
      return;
    }
    if (currentPath.startsWith('/posts/')) {
      const sub = decodeURIComponent(currentPath.slice('/posts/'.length).replace(/\/+$/, ''));
      const subtabs = ['channels', 'crosspost', 'redactor', 'neuroplan', 'autogenerator', 'rewright'];
      if (sub && !subtabs.includes(sub) && (sub.startsWith('req_') || dayRequests.some((d) => d.id === sub))) {
        setSelectedPostId(sub);
      } else {
        setSelectedPostId(null);
      }
    } else {
      setSelectedPostId(null);
    }
  }, [currentPath, dayRequests]);

  const loadAllData = async () => {
    try {
      const activeUserId = user.id || '';
      const queryParam = activeUserId ? `?userId=${encodeURIComponent(activeUserId)}` : '';
      const reqHeaders: Record<string, string> = activeUserId ? { 'x-user-id': activeUserId } : {};

      const fetchWithRetry = async (url: string, opts?: RequestInit) => {
        const mergedOpts: RequestInit = { cache: 'no-store', ...opts };
        for (let i = 1; i <= 3; i++) {
          try {
            const r = await fetch(url, mergedOpts);
            if (r.ok || i === 3) return r;
          } catch (err) {
            if (i === 3) throw err;
            await new Promise((res) => setTimeout(res, 400));
          }
        }
        return fetch(url, mergedOpts);
      };

      const [drRes, pubRes, setRes, statRes, chRes, tplRes] = await Promise.all([
        fetchWithRetry(`/api/day-requests${queryParam}`, { headers: reqHeaders }),
        fetchWithRetry(`/api/publications${queryParam}`, { headers: reqHeaders }),
        fetchWithRetry('/api/settings'),
        fetchWithRetry('/api/stats'),
        fetchWithRetry(`/api/channels${queryParam}`, { headers: reqHeaders }),
        fetchWithRetry('/api/templates')
      ]);

      if (drRes.ok) setDayRequests(await drRes.json());
      if (pubRes.ok) setPublications(await pubRes.json());
      if (setRes.ok) setSettings(await setRes.json());
      if (statRes.ok) setStats(await statRes.json());
      if (chRes.ok) {
        const chData = await chRes.json();
        if (Array.isArray(chData)) setChannels(chData);
      }
      if (tplRes.ok) setTemplates(await tplRes.json());
    } catch (e) {
      console.error('Error loading data:', e);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [user.id]);

  const { upload } = useFileUpload();
  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await upload(file);
      if (url) {
        await fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAvatar: url, photoUrl: url, avatarUrl: url })
        }).catch(() => null);

        setUser((prev) => ({
          ...prev,
          userAvatar: url,
          photoUrl: url,
          avatarUrl: url
        }));
      }
    } catch (err) {
      console.error('Error uploading avatar:', err);
    }
  };

  const handleTelegramOneClickRegister = (customData?: Partial<UserAccount>) => {
    setUser({
      id: customData?.id || 'tg-' + Math.floor(Math.random() * 900000000 + 100000000),
      name: customData?.name || 'Михаил Регистратов',
      firstName: customData?.firstName || 'Михаил',
      lastName: customData?.lastName || 'Регистратов',
      telegramUsername: customData?.telegramUsername || '@IIrkiBot',
      tariff: 'Старт',
      tokens: 300,
      iirky: 300,
      telegramStars: customData?.telegramStars || 450,
      avatarUrl:
        normalizeProTalkMediaUrl(customData?.avatarUrl) ||
        BRAND_ASSETS.heartAvatar,
      balanceRub: 0,
      earningsRub: 0,
      premiumUntil: undefined
    });
    setIsLoggedIn(true);
  };

  const handleAddDayRequest = async (req: Partial<DayRequest>) => {
    let res: Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        res = await fetch('/api/day-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...req, status: req.status || 'создается', userId: user.id })
        });
        if (res && (res.ok || (res.status >= 400 && res.status < 500))) break;
      } catch (fetchErr) {
        if (attempt === 3) throw fetchErr;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (res && res.ok) {
      const created = await res.json();
      setDayRequests((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      if (created?.triggerSchedule?.enabled) {
        void loadAllData();
      }
      return created;
    }
    const errData = await res?.json().catch(() => ({}));
    throw new Error(errData?.error || 'Ошибка при сохранении поста в базу данных');
  };

  const handleUpdateDayRequest = async (id: string, updated: Partial<DayRequest>) => {
    let res: Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        res = await fetch(`/api/day-requests/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        });
        if (res && (res.ok || (res.status >= 400 && res.status < 500))) break;
      } catch (fetchErr) {
        if (attempt === 3) throw fetchErr;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (res && res.ok) {
      const saved = await res.json();
      setDayRequests((prev) => {
        const exists = prev.some((p) => p.id === saved.id || p.id === id);
        return exists
          ? prev.map((p) => (p.id === saved.id || p.id === id ? saved : p))
          : [saved, ...prev];
      });
      if (updated?.triggerSchedule !== undefined && user.id) {
        fetch(`/api/publications?userId=${encodeURIComponent(user.id)}`, {
          headers: { 'x-user-id': String(user.id) }
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((pubs) => {
            if (Array.isArray(pubs)) setPublications(pubs);
          })
          .catch(() => {});
      }
      return saved;
    }
    const errData = await res?.json().catch(() => ({}));
    throw new Error(errData?.error || 'Ошибка обновления поста в базе данных');
  };

  const handleDeleteDayRequest = async (id: string) => {
    try {
      const res = await fetch(`/api/day-requests/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) await loadAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveDayRequest = async (req: Partial<DayRequest>) => {
    const cleanId = req.id ? String(req.id).trim() : '';
    if (cleanId) return await handleUpdateDayRequest(cleanId, req);
    return await handleAddDayRequest(req);
  };

  const handlePublishToTelegram = async (
    title: string,
    content: string,
    dayRequestId: string,
    formattingOptions?: any
  ) => {
    const res = await fetch('/api/publications/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        content,
        dayRequestId,
        userId: user.id,
        ...formattingOptions
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка публикации');
    await loadAllData();
    return data;
  };

  const handleSaveTemplate = async (template: {
    type: 'header' | 'postText' | 'signature' | 'full';
    name: string;
    category?: string;
    content: string;
  }) => {
    try {
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template)
      });
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddChannelNew = async (ch: any) => {
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id || '169262990'
        },
        body: JSON.stringify({
          name: ch.name,
          username: ch.username,
          isActive: ch.isActive !== false,
          subscribersCount: ch.subscribersCount || 0,
          inviteLink: ch.inviteLink || '',
          description: ch.description || '',
          userId: user.id || '169262990'
        })
      });
      if (res.ok) await loadAllData();
    } catch (e) {
      console.error('Error adding channel to DB:', e);
    }
  };

  const handleUpdateChannelNew = async (id: string, updated: Partial<SocialChannel>) => {
    try {
      const res = await fetch(`/api/channels/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) await loadAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteChannelNew = async (id: string) => {
    try {
      const res = await fetch(`/api/channels/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setChannels((prev) => prev.filter((c) => c.id !== id));
        await loadAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePublication = async (id: string) => {
    try {
      await fetch(`/api/publications/${id}`, { method: 'DELETE' });
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await fetch('/api/export/csv', { method: 'GET', cache: 'no-store' });
      if (!res.ok) throw new Error('Не удалось выгрузить публикации');
      const ct = String(res.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('text/html')) throw new Error('Некорректный ответ сервера при экспорте csv');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'publications.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) {
      console.error('Export CSV error:', e);
    }
  };

  const handleAddAdListing = (listing: Omit<AdListing, 'id'>) => {
    setAdListings((prev) => [{ ...listing, id: `ad-lst-${Date.now()}` }, ...prev]);
  };

  const handleEarnMoney = (amount: number, orderTitle: string, channelName: string) => {
    setUser((prev) => ({
      ...prev,
      balanceRub: prev.balanceRub + amount,
      earningsRub: (prev.earningsRub || 0) + amount
    }));
    const newPost: CampaignPost = {
      id: `post-ord-${Date.now()}`,
      title: `Реклама: ${orderTitle}`,
      content: `Интеграция выполнена на канале ${channelName}. Начислено ${amount} ₽.`,
      platforms: ['telegram'],
      status: 'published',
      clicks: Math.floor(Math.random() * 45) + 10,
      views: Math.floor(Math.random() * 500) + 150,
      isAiGenerated: false
    };
    setPosts((prev) => [newPost, ...prev]);
  };

  const handleReplenishTokens = (amount: number, costRub: number) => {
    setUser((prev) => ({
      ...prev,
      tokens: prev.tokens + amount,
      balanceRub: Math.max(0, prev.balanceRub - costRub)
    }));
  };

  const handleReplenishBalance = (amount: number) => {
    setUser((prev) => ({
      ...prev,
      balanceRub: prev.balanceRub + amount
    }));
  };

  const handleBuyAdSlot = (costRub: number) => {
    setUser((prev) => ({
      ...prev,
      balanceRub: Math.max(0, prev.balanceRub - costRub)
    }));
  };

  const handleUpgradeTariff = (plan: 'free' | 'pro' | 'vip' = 'pro', useIirky: boolean = false) => {
    if (plan === 'free') {
      setUser((prev) => ({ ...prev, tariff: 'free' }));
      return;
    }
    const costRur = plan === 'pro' ? 490 : 990;
    const costIirky = plan === 'pro' ? 250 : 500;

    if (useIirky) {
      if ((user.iirky || 0) < costIirky) return;
      setUser((prev) => ({
        ...prev,
        iirky: (prev.iirky || 0) - costIirky,
        tariff: plan,
        premiumUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('ru-RU')
      }));
      return;
    }

    setUser((prev) => ({
      ...prev,
      balanceRub: prev.balanceRub >= costRur ? prev.balanceRub - costRur : prev.balanceRub,
      tariff: plan,
      premiumUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('ru-RU')
    }));
  };

  const handlePostBulletinAd = (newAd: Omit<BulletinAd, 'id' | 'createdAt' | 'clicks'>) => {
    setBulletinAds((prev) => [
      { ...newAd, id: `bull-${Date.now()}`, createdAt: new Date().toISOString(), clicks: 0 },
      ...prev
    ]);
  };

  const handleAdClick = (adId: string) => {
    setBulletinAds((prev) =>
      prev.map((ad) => (ad.id === adId ? { ...ad, clicks: ad.clicks + 1 } : ad))
    );
  };

  const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 12500);
  const totalClicks = posts.reduce((sum, p) => sum + (p.clicks || 0), 980);

  return {
    user,
    setUser,
    dayRequests,
    publications,
    templates,
    settings,
    stats,
    selectedPostId,
    setSelectedPostId,
    channels,
    posts,
    adListings,
    bulletinAds,
    advertiserOrders,
    bundles,
    setBundles,
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
  };
}
