import type express from "express";
import { BRAND_ASSETS } from "../../constants/proTalkStorage";

export const LEGACY_STATIC_CDN_FALLBACKS: Record<string, { url: string; contentType: string }> = {
  "/pwa/icon-144x144.png": { url: BRAND_ASSETS.pwaIcon144, contentType: "image/png" },
  "/pwa/icon-192x192.png": { url: BRAND_ASSETS.pwaIcon192, contentType: "image/png" },
  "/pwa/icon-512x512.png": { url: BRAND_ASSETS.pwaIcon512, contentType: "image/png" },
  "/icons/favicon-16x16.png": { url: BRAND_ASSETS.favicon16, contentType: "image/png" },
  "/icons/favicon-32x32.png": { url: BRAND_ASSETS.favicon32, contentType: "image/png" },
  "/icons/favicon-48x48.png": { url: BRAND_ASSETS.favicon48, contentType: "image/png" },
  "/icons/favicon-96x96.png": { url: BRAND_ASSETS.favicon96, contentType: "image/png" },
  "/icons/favicon-120x120.png": { url: BRAND_ASSETS.favicon120, contentType: "image/png" },
  "/icons/heart-loader.png": { url: BRAND_ASSETS.heartLoader, contentType: "image/png" },
  "/tiles/maskable-192x192.png": { url: BRAND_ASSETS.pwaMaskable192, contentType: "image/png" },
  "/tiles/maskable-512x512.png": { url: BRAND_ASSETS.pwaMaskable512, contentType: "image/png" },
  "/tiles/push-badge-72x72.png": { url: BRAND_ASSETS.pwaMaskable192, contentType: "image/png" },
  "/tiles/mstile-150x150.png": { url: BRAND_ASSETS.pwaIcon144, contentType: "image/png" },
  "/tiles/mstile-310x150.png": { url: BRAND_ASSETS.socialLight, contentType: "image/jpeg" },
  "/tiles/tableau-logo.png": { url: BRAND_ASSETS.pwaIcon192, contentType: "image/png" },
  "/apple-touch-icon.png": { url: BRAND_ASSETS.appleTouchIcon, contentType: "image/png" },
  "/favicon.ico": { url: BRAND_ASSETS.favicon32, contentType: "image/png" },
  "/social/banner-mobile.jpg": { url: BRAND_ASSETS.bannerMobile, contentType: "image/jpeg" },
  "/social/og-cover-light.jpg": { url: BRAND_ASSETS.socialLight, contentType: "image/jpeg" },
  "/social/og-light.jpg": { url: BRAND_ASSETS.socialLight, contentType: "image/jpeg" }
};

const staticCdnBufferCache = new Map<string, { buffer: Buffer; contentType: string }>();

export async function sendCdnStaticFallback(reqPath: string, res: express.Response): Promise<boolean> {
  const entry = LEGACY_STATIC_CDN_FALLBACKS[reqPath];
  if (!entry) return false;
  try {
    let cached = staticCdnBufferCache.get(reqPath);
    if (!cached) {
      const upstream = await fetch(entry.url);
      if (!upstream.ok) return false;
      const buf = Buffer.from(await upstream.arrayBuffer());
      const contentType = upstream.headers.get("content-type") || entry.contentType;
      cached = { buffer: buf, contentType };
      staticCdnBufferCache.set(reqPath, cached);
    }
    res.setHeader("Content-Type", cached.contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.status(200).send(cached.buffer);
    return true;
  } catch (err) {
    console.warn(`[Static CDN Fallback] Failed serving ${reqPath}:`, err);
    return false;
  }
}

export function registerStaticCdnFallbackRoutes(app: express.Express): void {
  app.get(Object.keys(LEGACY_STATIC_CDN_FALLBACKS), async (req, res, next) => {
    const served = await sendCdnStaticFallback(req.path, res);
    if (!served) next();
  });
}
