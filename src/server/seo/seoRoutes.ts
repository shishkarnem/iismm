import type { Express } from "express";
import type { ViteDevServer } from "vite";
import path from "path";
import fs from "fs";
import {
  fetchAllBlogPostsFromPg,
  fetchBlogPostBySlugOrIdFromPg,
} from "../db/postgres";
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from "../../constants/proTalkStorage";

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function resolveRequestBaseUrl(req: any): { host: string; protocol: string; baseUrl: string } {
  const rawHost = (req.headers["x-forwarded-host"] as string) || req.headers.host || "iismm.ru";
  const host = rawHost.split(",")[0].trim();
  const rawProto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const protocol = rawProto.split(",")[0].trim();
  return { host, protocol, baseUrl: `${protocol}://${host}` };
}

export function registerSeoCrawlRoutes(app: Express): void {
  // Dynamic XML Sitemap for Yandex, Google & AI Crawlers
  app.get("/sitemap.xml", (req, res) => {
    try {
      const posts = fetchAllBlogPostsFromPg();
      const { baseUrl } = resolveRequestBaseUrl(req);
      const todayIso = new Date().toISOString().split("T")[0];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

      const staticRoutes = [
        { path: "/", priority: "1.0", changefreq: "daily" },
        { path: "/blog", priority: "0.9", changefreq: "daily" },
        { path: "/posts", priority: "0.9", changefreq: "daily" },
        { path: "/academy", priority: "0.9", changefreq: "weekly" },
        { path: "/channels", priority: "0.9", changefreq: "daily" },
        { path: "/folders", priority: "0.8", changefreq: "daily" },
        { path: "/templates", priority: "0.8", changefreq: "weekly" },
        { path: "/calendar", priority: "0.8", changefreq: "daily" },
        { path: "/history", priority: "0.8", changefreq: "daily" },
        { path: "/gallery", priority: "0.8", changefreq: "daily" },
        { path: "/scenarios", priority: "0.8", changefreq: "weekly" },
        { path: "/market", priority: "0.8", changefreq: "daily" },
        { path: "/bundles", priority: "0.8", changefreq: "daily" },
        { path: "/social", priority: "0.8", changefreq: "daily" },
        { path: "/ai", priority: "0.9", changefreq: "weekly" },
        { path: "/tarif", priority: "0.8", changefreq: "weekly" },
        { path: "/partner", priority: "0.8", changefreq: "weekly" },
        { path: "/oferta", priority: "0.7", changefreq: "monthly" },
        { path: "/payment/oferta", priority: "0.7", changefreq: "monthly" },
        { path: "/privacy", priority: "0.7", changefreq: "monthly" },
        { path: "/agreement", priority: "0.7", changefreq: "monthly" },
        { path: "/consent", priority: "0.7", changefreq: "monthly" },
      ];

      staticRoutes.forEach((r) => {
        xml += `  <url>\n    <loc>${escapeXml(`${baseUrl}${r.path}`)}</loc>\n    <lastmod>${todayIso}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>\n`;
      });

      posts.forEach((p: any) => {
        const postSlugOrId = encodeURIComponent(String(p.slug || p.id || ""));
        const modDate = p.updated_at || p.created_at;
        const lastMod = modDate ? new Date(modDate).toISOString().split("T")[0] : todayIso;
        xml += `  <url>\n    <loc>${escapeXml(`${baseUrl}/posts/${postSlugOrId}`)}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n`;
        if (p.image) {
          const imgLoc = p.image.startsWith("http") ? p.image : `${baseUrl}${p.image}`;
          xml += `    <image:image>\n      <image:loc>${escapeXml(imgLoc)}</image:loc>\n      <image:title>${escapeXml(p.title || "ИИSMM")}</image:title>\n    </image:image>\n`;
        }
        xml += `  </url>\n`;
        xml += `  <url>\n    <loc>${escapeXml(`${baseUrl}/blog/${encodeURIComponent(String(p.id || ""))}`)}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.85</priority>\n  </url>\n`;
      });

      xml += `</urlset>\n`;

      res.header("Content-Type", "application/xml; charset=utf-8");
      res.send(xml);
    } catch {
      res.status(500).send("Error generating sitemap");
    }
  });

  // Dynamic Yandex Browser Tableau Widget JSON
  app.get("/yandex-tableau.json", (req, res) => {
    const { baseUrl } = resolveRequestBaseUrl(req);
    res.header("Content-Type", "application/json; charset=utf-8");
    res.header("Cache-Control", "public, max-age=86400");
    res.json({
      version: "1.0",
      api_version: 3,
      layout: {
        logo: `${baseUrl}/tiles/tableau-logo.png`,
        color: "#fce7f3",
        show_title: true,
      },
    });
  });

  // Microsoft Edge / Windows Tiles Config XML
  app.get("/browserconfig.xml", (_req, res) => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square70x70logo src="/icons/favicon-96x96.png"/>
      <square150x150logo src="/tiles/mstile-150x150.png"/>
      <wide310x150logo src="/tiles/mstile-310x150.png"/>
      <square310x310logo src="/pwa/icon-512x512.png"/>
      <TileColor>#fce7f3</TileColor>
    </tile>
  </msapplication>
</browserconfig>\n`;
    res.header("Content-Type", "application/xml; charset=utf-8");
    res.header("Cache-Control", "public, max-age=86400");
    res.send(xml);
  });

  // Dynamic Robots.txt for Search Engines & AI Crawlers
  app.get("/robots.txt", (req, res) => {
    const { host, baseUrl } = resolveRequestBaseUrl(req);

    const robots = `User-agent: *
Allow: /
Allow: /blog
Allow: /blog/*
Allow: /posts
Allow: /academy
Allow: /academy/*
Allow: /channels
Allow: /folders
Allow: /templates
Allow: /calendar
Allow: /history
Allow: /gallery
Allow: /scenarios
Allow: /market
Allow: /bundles
Allow: /social
Allow: /ai
Allow: /oferta
Allow: /payment/oferta
Allow: /privacy
Allow: /agreement
Allow: /consent
Allow: /payment/success
Allow: /payment/fail
Allow: /payment/fall
Allow: /tarif
Allow: /file/*
Disallow: /api/
Disallow: /admin
Disallow: /admin/*
Disallow: /settings
Disallow: /reset-password
Disallow: /api-keys

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Googlebot
Allow: /

User-agent: Yandex
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
Host: ${host}
`;

    res.header("Content-Type", "text/plain; charset=utf-8");
    res.send(robots);
  });

  // Dynamic RSS Feed for News Aggregators & AI Web Crawlers
  app.get("/rss.xml", (req, res) => {
    try {
      const posts = fetchAllBlogPostsFromPg();
      const { baseUrl } = resolveRequestBaseUrl(req);
      const nowUtc = new Date().toUTCString();

      let rss = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      rss += `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n`;
      rss += `<channel>\n`;
      rss += `  <title>Блог и Новости ИИSMM — Автопостинг и Нейросети</title>\n`;
      rss += `  <link>${escapeXml(`${baseUrl}/blog`)}</link>\n`;
      rss += `  <atom:link href="${escapeXml(`${baseUrl}/rss.xml`)}" rel="self" type="application/rss+xml"/>\n`;
      rss += `  <description>Официальный блог платформы ИИSMM. Новости нейросетей, SMM-связки, Telegram API и советы по автопостингу.</description>\n`;
      rss += `  <language>ru-ru</language>\n`;
      rss += `  <lastBuildDate>${nowUtc}</lastBuildDate>\n`;
      rss += `  <image>\n    <url>${escapeXml(`${baseUrl}/pwa/icon-192x192.png`)}</url>\n    <title>ИИSMM</title>\n    <link>${escapeXml(`${baseUrl}/`)}</link>\n  </image>\n`;

      if (posts.length === 0) {
        rss += `  <item>\n`;
        rss += `    <title>ИИSMM — Умный автопостинг и генерация контента нейросетями</title>\n`;
        rss += `    <link>${escapeXml(`${baseUrl}/posts`)}</link>\n`;
        rss += `    <guid isPermaLink="true">${escapeXml(`${baseUrl}/posts`)}</guid>\n`;
        rss += `    <description>Создавайте посты в Telegram, ВКонтакте, Одноклассники и Дзен с помощью нейрогенератора, настраивайте календарь и папки взаимного пиара.</description>\n`;
        rss += `    <pubDate>${nowUtc}</pubDate>\n`;
        rss += `  </item>\n`;
      } else {
        posts.slice(0, 50).forEach((p: any) => {
          const postSlugOrId = encodeURIComponent(String(p.slug || p.id || ""));
          const itemUrl = `${baseUrl}/posts/${postSlugOrId}`;
          const parsedDate = new Date(p.created_at || Date.now());
          const pubDate = Number.isNaN(parsedDate.getTime()) ? nowUtc : parsedDate.toUTCString();
          rss += `  <item>\n`;
          rss += `    <title>${escapeXml(p.title || "Публикация ИИSMM")}</title>\n`;
          rss += `    <link>${escapeXml(itemUrl)}</link>\n`;
          rss += `    <guid isPermaLink="true">${escapeXml(itemUrl)}</guid>\n`;
          rss += `    <description>${escapeXml(p.desc || p.title || "Публикация на платформе ИИSMM")}</description>\n`;
          rss += `    <pubDate>${pubDate}</pubDate>\n`;
          rss += `  </item>\n`;
        });
      }

      rss += `</channel>\n</rss>\n`;

      res.header("Content-Type", "application/rss+xml; charset=utf-8");
      res.send(rss);
    } catch {
      res.status(500).send("Error generating RSS");
    }
  });
}

const PUBLIC_SSR_META_ROUTES = [
  "/",
  "/main",
  "/academy",
  "/academy/:slug",
  "/tarif",
  "/partner",
  "/market",
  "/channels",
  "/folders",
  "/social",
  "/templates",
  "/calendar",
  "/history",
  "/gallery",
  "/scenarios",
  "/bundles",
  "/ai",
  "/oferta",
  "/privacy",
  "/agreement",
  "/consent",
  "/blog/:id",
  "/blog",
  "/posts",
  "/posts/:slug",
];

function stripStaticSeoHeadTags(html: string): string {
  return html
    .replace(/<title>.*?<\/title>\s*/is, "")
    .replace(/<meta\s+name="(?:description|keywords|robots|author|twitter:[^"]+)"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="(?:og:[^"]+|vk:image)"[^>]*>\s*/gi, "")
    .replace(/<meta\s+itemprop="image"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="(?:geo\.[^"]+|ICBM)"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="(?:canonical|image_src)"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="alternate"[^>]*media="\(prefers-color-scheme:\s*dark\)"[^>]*>\s*/gi, "");
}

function escapeHtmlAttr(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function registerSeoSsrHtmlRoutes(
  app: Express,
  options: {
    isProduction: boolean;
    getViteServer: () => ViteDevServer | null;
  }
): void {
  // Dynamic SSR HTML SEO & GEO Meta-Tags Injector for Landing, Referral Links, Blog & Public Routes
  app.get(PUBLIC_SSR_META_ROUTES, async (req, res, next) => {
    const isBlogOrPosts = req.path === "/blog" || req.path.startsWith("/blog/") || req.path === "/posts" || req.path.startsWith("/posts/");
    let slugOrId = "";
    if (req.path.startsWith("/blog/") && req.path.length > 6) {
      slugOrId = req.path.substring(6);
    } else if (req.path.startsWith("/posts/") && req.path.length > 7) {
      slugOrId = req.path.substring(7);
    }
    const isInternalDraftSlug = slugOrId.startsWith("req_");
    const post = slugOrId && !isInternalDraftSlug ? fetchBlogPostBySlugOrIdFromPg(slugOrId) : null;

    const htmlFilePath = options.isProduction
      ? path.join(process.cwd(), "dist", "index.html")
      : path.join(process.cwd(), "index.html");

    if (!fs.existsSync(htmlFilePath)) {
      return next();
    }

    try {
      let html = fs.readFileSync(htmlFilePath, "utf-8");

      // In dev deployment mode, run Vite's HTML transform so @vitejs/plugin-react preamble is present
      const vite = options.getViteServer();
      if (!options.isProduction && vite) {
        html = await vite.transformIndexHtml(req.originalUrl, html);
      }

      const rawHost = (req.headers["x-forwarded-host"] as string) || req.headers.host || "iismm.ru";
      const host = rawHost.split(",")[0].trim();
      const rawProto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
      const protocol = rawProto.split(",")[0].trim();
      const baseUrl = `${protocol}://${host}`;
      const currentUrl = `${baseUrl}${req.originalUrl || req.path}`;
      const canonicalUrl = `${baseUrl}${req.path === "/main" ? "/" : req.path}`;

      let title = "ИИSMM — Сервис ИИ Автопостинга, Нейросетей и Управления Соцсетями";
      let description =
        "ИИSMM — инновационный умный SMM комбайн и сервис автопостинга на базе искусственного интеллекта. Генерация постов, обложек и кросспостинг в Telegram, VK, OK, Дзен, Max, Сетку.";

      if (isInternalDraftSlug) {
        title = "Редактор поста — ИИSMM";
        description =
          "Рабочий редактор публикаций ИИSMM для настройки текста, медиавложений, кнопок и расписания автопостинга.";
      } else if (post) {
        title = `${post.title} — Публикации ИИSMM`;
        description = post.desc || post.title;
      } else if (isBlogOrPosts) {
        title = "Публикации и Блог ИИSMM — Автопостинг, Нейросети и Telegram 2026";
        description =
          "Свежие статьи, кейсы и публикации по продвижению в Telegram, автопостингу и работе с нейросетями в 2026 году.";
      } else if (req.path.startsWith("/academy")) {
        title = "Академия ИИSMM — Пошаговое обучение автопостингу и настройкам";
        description =
          "Подробные гайды со скриншотами по настройке Telegram-каналов, редактора постов V2/Rich, сценариев автопилота, календаря и папок.";
      } else if (req.path.startsWith("/partner") || Boolean(req.query.ref)) {
        title = "ИИSMM — +300 ИИрок бонусом на старт за регистрацию по приглашению";
        description =
          "Присоединяйтесь к ИИSMM по приглашению: умный автопостинг, генерация постов и обложек нейросетью, кросспостинг в 10+ соцсетей и +300 ИИрок на баланс.";
      }

      const defaultSocialLightUrl = BRAND_ASSETS.socialLight;
      const defaultSocialDarkUrl = BRAND_ASSETS.socialDark;
      const postImage = normalizeProTalkMediaUrl(post?.image || post?.attachmentUrl);
      const image = postImage || defaultSocialLightUrl;
      const authorName = post?.author?.name || "Команда ИИSMM";

      const jsonLd = post
        ? {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": currentUrl,
            },
            headline: post.title,
            description: post.desc || post.title,
            articleBody: (post.content || post.desc || "").replace(/<[^>]*>?/gm, ""),
            image: [image],
            author: {
              "@type": "Person",
              name: authorName,
            },
            publisher: {
              "@type": "Organization",
              name: "ИИSMM — Платформа Автопостинга",
              logo: {
                "@type": "ImageObject",
                url: BRAND_ASSETS.pwaIcon192,
              },
            },
            datePublished: post.createdAt ? post.createdAt.split("T")[0] : post.date || "2026-06-01",
            dateModified: new Date().toISOString().split("T")[0],
            inLanguage: "ru-RU",
          }
        : null;

      const safeTitle = escapeHtmlAttr(title);
      const safeDesc = escapeHtmlAttr(description);
      const safeImage = escapeHtmlAttr(image);
      const safeDarkImage = escapeHtmlAttr(defaultSocialDarkUrl);
      const safeAuthor = escapeHtmlAttr(authorName);
      const safeCurrentUrl = escapeHtmlAttr(currentUrl);
      const safeCanonicalUrl = escapeHtmlAttr(canonicalUrl);
      const isJpegImage = /\.jpe?g(\?|$)/i.test(image);
      const ogWidth = postImage ? "1360" : "1200";
      const ogHeight = postImage ? "765" : "675";

      const seoTags = `
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />
    <meta name="keywords" content="${escapeHtmlAttr(post?.tag || "SMM, Telegram")}, автопостинг, нейросети 2026, ИИSMM, маркетинг, ИИ, контент" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="author" content="${safeAuthor}" />
    <link rel="canonical" href="${post ? escapeHtmlAttr(`${baseUrl}/posts/${post.slug || post.id}`) : safeCanonicalUrl}" />
    <link rel="image_src" href="${safeImage}" />
    <link rel="alternate" type="image/jpeg" media="(prefers-color-scheme: dark)" href="${safeDarkImage}" title="Превью ИИSMM для тёмной темы" />

    <!-- GEO Location Tags (Yandex & Google GEO Search) -->
    <meta name="geo.region" content="RU-MOW" />
    <meta name="geo.placename" content="Москва, Россия" />
    <meta name="geo.position" content="55.7558;37.6173" />
    <meta name="ICBM" content="55.7558, 37.6173" />

    <!-- OpenGraph Meta Tags for Social & Indexing -->
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:secure_url" content="${safeImage}" />
    <meta property="og:image:type" content="${isJpegImage ? "image/jpeg" : "image/png"}" />
    <meta property="og:image:width" content="${ogWidth}" />
    <meta property="og:image:height" content="${ogHeight}" />
    <meta property="og:image:alt" content="${safeTitle}" />
    <meta property="vk:image" content="${safeImage}" />
    <meta itemprop="image" content="${safeImage}" />
    <meta property="og:url" content="${safeCurrentUrl}" />
    <meta property="og:type" content="${post ? "article" : "website"}" />
    <meta property="og:locale" content="ru_RU" />
    <meta property="og:site_name" content="ИИSMM" />

    <!-- Twitter Meta Tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${safeImage}" />
    <meta name="twitter:image:src" content="${safeImage}" />

    ${jsonLd ? `<script type="application/ld+json" id="seo-jsonld-ssr">${JSON.stringify(jsonLd)}</script>` : ""}
`;

      html = stripStaticSeoHeadTags(html);
      html = html.replace(/<head([^>]*)>/i, `<head$1>\n${seoTags}`);

      if (post) {
        const articleSnapshot = `
        <div id="seo-prerender-content" style="display:none" aria-hidden="true">
          <article>
            <h1>${post.title}</h1>
            <p><strong>${post.desc}</strong></p>
            <p>Автор: ${authorName} | Дата: ${post.date} | Время чтения: ${post.readTime}</p>
            <div>${(post.content || "").replace(/\n/g, "<br/>")}</div>
          </article>
        </div>
      `;
        html = html.replace("</body>", `${articleSnapshot}\n</body>`);
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.send(html);
    } catch (err) {
      console.error("[SEO SSR Error]", err);
      next();
    }
  });
}
