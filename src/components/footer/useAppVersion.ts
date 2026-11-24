import { useState, useEffect } from 'react';

export const FALLBACK_APP_VERSION = 'v.1.56';
const APP_VERSION_UPDATED_EVENT = 'iismm-app-version-updated';

let cachedVersion: string = FALLBACK_APP_VERSION;
let cachedUpdatedAt: string | null = null;
let hasLoadedFromServer = false;
let inflightRequest: Promise<{ version: string; updatedAt: string | null }> | null = null;

function broadcastAppVersion(version: string, updatedAt: string | null) {
  cachedVersion = version;
  cachedUpdatedAt = updatedAt;
  hasLoadedFromServer = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(APP_VERSION_UPDATED_EVENT, {
        detail: { version, updatedAt }
      })
    );
  }
}

export async function fetchCurrentAppVersion(force = false): Promise<{ version: string; updatedAt: string | null }> {
  if (hasLoadedFromServer && !force) {
    return { version: cachedVersion, updatedAt: cachedUpdatedAt };
  }
  if (inflightRequest && !force) {
    return inflightRequest;
  }

  inflightRequest = fetch('/api/app-version', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  })
    .then(async (res) => {
      if (!res.ok) {
        return { version: cachedVersion, updatedAt: cachedUpdatedAt };
      }
      const data = await res.json();
      const resolved = typeof data?.version === 'string' && data.version.trim()
        ? data.version.trim()
        : cachedVersion;
      const updatedAt = typeof data?.updatedAt === 'string' ? data.updatedAt : null;
      broadcastAppVersion(resolved, updatedAt);
      return { version: resolved, updatedAt };
    })
    .catch(() => ({ version: cachedVersion, updatedAt: cachedUpdatedAt }))
    .finally(() => {
      inflightRequest = null;
    });

  return inflightRequest;
}

export async function updateAppVersionOnServer(nextVersion: string): Promise<{ version: string; updatedAt: string | null }> {
  const res = await fetch('/api/admin/app-version', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: nextVersion })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Не удалось обновить версию сборки');
  }

  const savedVersion = String(data.version || nextVersion).trim();
  const updatedAt = typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString();
  broadcastAppVersion(savedVersion, updatedAt);
  return { version: savedVersion, updatedAt };
}

export function useAppVersion(): string {
  const [version, setVersion] = useState<string>(cachedVersion);

  useEffect(() => {
    let mounted = true;

    fetchCurrentAppVersion().then((res) => {
      if (mounted && res.version) {
        setVersion(res.version);
      }
    });

    const handleVersionChange = (event: Event) => {
      const custom = event as CustomEvent<{ version?: string }>;
      if (custom.detail?.version) {
        setVersion(custom.detail.version);
      }
    };

    const handleFocusRefresh = () => {
      fetchCurrentAppVersion(true).then((res) => {
        if (mounted && res.version) {
          setVersion(res.version);
        }
      });
    };

    const timer = window.setInterval(handleFocusRefresh, 20000);
    window.addEventListener(APP_VERSION_UPDATED_EVENT, handleVersionChange);
    window.addEventListener('focus', handleFocusRefresh);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener(APP_VERSION_UPDATED_EVENT, handleVersionChange);
      window.removeEventListener('focus', handleFocusRefresh);
    };
  }, []);

  return version;
}
