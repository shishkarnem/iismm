import { DayRequest } from '../types';

const EDITOR_INTERNAL_SUBTABS = ['channels', 'crosspost', 'redactor', 'neuroplan', 'autogenerator', 'rewright'];

export function cleanRoutePath(rawPath?: string): string {
  const base = (rawPath || '/').split('?')[0].split('#')[0];
  if (!base || base === '/') return '/';
  return base.replace(/\/+$/, '') || '/';
}

/**
 * Checks whether path is a cabinet feed URL like /posts16926299042 or /postsuser_abc
 * (single segment starting with /posts, excluding /posts itself).
 */
export function isCabinetFeedPath(rawPath?: string): boolean {
  const path = cleanRoutePath(rawPath);
  if (path === '/posts') return false;
  return /^\/posts[^/]+$/.test(path);
}

/**
 * Checks whether path is a drafts list / redactor URL like:
 * /posts/redactor, /posts16926299042/redactor, /postsuser_abc/redactor
 */
export function isDraftsListPath(rawPath?: string): boolean {
  const path = cleanRoutePath(rawPath);
  if (path === '/posts/redactor' || path === '/drafts') return true;
  if (/^\/posts[^/]*\/redactor$/.test(path)) return true;
  return path.endsWith('/redactor');
}

export function isNeuroplanPath(rawPath?: string): boolean {
  const path = cleanRoutePath(rawPath);
  if (path === '/neuroplan' || path.startsWith('/neuroplan/')) return true;
  if (path === '/posts/neuroplan' || path === '/blog/neuroplan') return true;
  if (/^\/posts[^/]*\/neuroplan$/.test(path)) return true;
  return path.endsWith('/neuroplan');
}

export function isPublicGuestRoute(rawPath: string): boolean {
  const path = cleanRoutePath(rawPath);
  if (path === '/' || path === '/main') return true;
  if (path === '/academy' || path.startsWith('/academy/')) return true;

  if (path === '/posts' || path === '/blog') return true;
  if (path.startsWith('/posts/') || path.startsWith('/blog/')) {
    const sub = decodeURIComponent(
      (path.startsWith('/posts/') ? path.slice('/posts/'.length) : path.slice('/blog/'.length)).replace(/\/$/, '')
    );
    if (sub.endsWith('/edit') || sub.startsWith('req_')) return false;
    return !EDITOR_INTERNAL_SUBTABS.includes(sub);
  }

  const legalPrefixes = [
    '/oferta',
    '/payment/oferta',
    '/privacy',
    '/policy',
    '/agreement',
    '/consent',
    '/personal-data'
  ];
  if (legalPrefixes.some((p) => path === p || path.startsWith(p + '/'))) return true;

  if (
    path.startsWith('/payment/success') ||
    path.startsWith('/payment/robokassa/success') ||
    path.startsWith('/payment/fail') ||
    path.startsWith('/payment/fall') ||
    path.startsWith('/payment/robokassa/fail')
  ) {
    return true;
  }

  if (path.startsWith('/reset-password')) return true;

  return false;
}

const PROFILE_TAB_QUERY_MAP: Record<string, string> = {
  profile: '/profile',
  channels: '/channels',
  tariffs: '/tarif',
  tarif: '/tarif',
  referrals: '/partner',
  partner: '/partner',
  multiplayer: '/teams',
  teams: '/teams',
  branding: '/brand',
  brand: '/brand',
  api_keys: '/api-keys',
  'api-keys': '/api-keys',
  api: '/api-keys',
  roundtable: '/roundtable',
  enterprise: '/enterprise',
  admin: '/admin'
};

export function normalizeCabinetTargetPath(rawPath: string): string {
  const [rawBase, rawQuery] = (rawPath || '/profile').split('?');
  const path = cleanRoutePath(rawBase || '/profile');

  if (path === '/profile' && rawQuery) {
    try {
      const params = new URLSearchParams(rawQuery.split('#')[0]);
      const tabParam = (params.get('tab') || '').trim().toLowerCase();
      if (tabParam && PROFILE_TAB_QUERY_MAP[tabParam]) {
        return PROFILE_TAB_QUERY_MAP[tabParam];
      }
    } catch {
      // Ignore malformed query string
    }
  }
  if (
    path === '/tarif/pay' ||
    path.startsWith('/tarif/pay') ||
    path === '/prices' ||
    path.startsWith('/prices/') ||
    path === '/billing' ||
    path.startsWith('/billing/')
  ) {
    return '/tarif';
  }
  if (
    path === '/ai' ||
    path.startsWith('/ai/') ||
    path === '/market-exchange' ||
    path.startsWith('/market-exchange/') ||
    path === '/projects' ||
    path.startsWith('/projects/')
  ) {
    return '/profile';
  }

  // Preserve all /posts... routes including /posts16926299042, /posts<uid>/redactor, /posts<uid>/neuroplan, /posts/<id>
  if (path.startsWith('/posts') || path === '/blog' || path.startsWith('/blog/')) {
    return path;
  }

  const cabinetPrefixes = [
    '/dashboard',
    '/channels',
    '/calendar',
    '/gallery',
    '/folders',
    '/history',
    '/templates',
    '/neuroplan',
    '/scenarios',
    '/crosspost',
    '/settings',
    '/social',
    '/market',
    '/bundles',
    '/profile',
    '/tarif',
    '/partner',
    '/teams',
    '/brand',
    '/api-keys',
    '/roundtable',
    '/enterprise',
    '/admin',
    '/system-admin'
  ];

  if (cabinetPrefixes.some((p) => path === p || path.startsWith(p + '/'))) {
    if (path === '/folders' && rawQuery) {
      const cleanQ = rawQuery.split('#')[0].trim();
      if (cleanQ) return `${path}?${cleanQ}`;
    }
    return path;
  }
  return '/profile';
}

export function buildAuthReasonForPath(rawPath: string): string {
  const lower = (rawPath || '').toLowerCase();
  if (lower.includes('tarif') || lower.includes('price') || lower.includes('pay')) {
    return 'Для выбора тарифа и оплаты пройдите быструю регистрацию или войдите в аккаунт';
  }
  if (lower.includes('redactor') || lower.includes('posts')) {
    return 'Для работы с черновиками и редактором постов пройдите быструю регистрацию или войдите в аккаунт';
  }
  return 'Для доступа к разделу пройдите быструю регистрацию или войдите в аккаунт';
}

export interface ResolvedPostsRoute {
  mode: 'blog_feed' | 'single_blog_post' | 'posts_workspace' | 'other';
  isCabinetFeed: boolean;
  blogSlug: string;
  routePostId: string | null;
  forceDraftsList: boolean;
}

export function resolvePostsRouteMode(currentPath: string, dayRequests: DayRequest[]): ResolvedPostsRoute {
  const path = cleanRoutePath(currentPath);

  if (isDraftsListPath(path) || isNeuroplanPath(path)) {
    return {
      mode: 'posts_workspace',
      isCabinetFeed: false,
      blogSlug: '',
      routePostId: null,
      forceDraftsList: true
    };
  }

  if (path === '/posts' || path === '/blog' || isCabinetFeedPath(path)) {
    return {
      mode: 'blog_feed',
      isCabinetFeed: isCabinetFeedPath(path) || path === '/posts',
      blogSlug: '',
      routePostId: null,
      forceDraftsList: false
    };
  }

  if (path.startsWith('/scenarios') || path.startsWith('/crosspost')) {
    return {
      mode: 'posts_workspace',
      isCabinetFeed: false,
      blogSlug: '',
      routePostId: null,
      forceDraftsList: true
    };
  }

  if (path === '/' || path === '/main' || path === '/dashboard' || path.startsWith('/dashboard/')) {
    return {
      mode: 'posts_workspace',
      isCabinetFeed: false,
      blogSlug: '',
      routePostId: null,
      forceDraftsList: true
    };
  }

  if (path.startsWith('/posts/') || path.startsWith('/blog/')) {
    const rawSub = path.startsWith('/posts/') ? path.slice('/posts/'.length) : path.slice('/blog/'.length);
    const sub = decodeURIComponent(rawSub.replace(/\/+$/, ''));

    if (path.startsWith('/posts/') && sub.endsWith('/edit')) {
      const editId = sub.slice(0, -'/edit'.length).replace(/\/+$/, '');
      if (editId) {
        const mappedReq = editId.startsWith('blog_') ? `req_${editId.slice(5)}` : editId;
        const resolvedId = dayRequests.some((d) => d.id === mappedReq) ? mappedReq : editId;
        return {
          mode: 'posts_workspace',
          isCabinetFeed: false,
          blogSlug: '',
          routePostId: resolvedId,
          forceDraftsList: false
        };
      }
    }

    if (EDITOR_INTERNAL_SUBTABS.includes(sub)) {
      return {
        mode: 'posts_workspace',
        isCabinetFeed: false,
        blogSlug: '',
        routePostId: null,
        forceDraftsList: true
      };
    }

    const blogReqCandidate = sub.startsWith('blog_') ? `req_${sub.slice(5)}` : '';
    if (
      path.startsWith('/posts/') &&
      (sub.startsWith('req_') ||
        dayRequests.some((d) => d.id === sub) ||
        (blogReqCandidate && dayRequests.some((d) => d.id === blogReqCandidate)))
    ) {
      return {
        mode: 'posts_workspace',
        isCabinetFeed: false,
        blogSlug: '',
        routePostId: blogReqCandidate && dayRequests.some((d) => d.id === blogReqCandidate) ? blogReqCandidate : sub,
        forceDraftsList: false
      };
    }

    if (sub) {
      return {
        mode: 'single_blog_post',
        isCabinetFeed: false,
        blogSlug: sub,
        routePostId: null,
        forceDraftsList: false
      };
    }
  }

  return {
    mode: 'other',
    isCabinetFeed: false,
    blogSlug: '',
    routePostId: null,
    forceDraftsList: false
  };
}
