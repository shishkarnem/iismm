import express from "express";
import fs from "fs";
import path from "path";
import type { ViteDevServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { apiRouter } from "./src/server/api";
import { DB } from "./src/server/db";
import { flushPendingPgWrites, getPgDB } from "./src/server/db/postgres";
import { startCentralizedCronWorker } from "./src/server/cronWorker";
import { registerSeoCrawlRoutes, registerSeoSsrHtmlRoutes } from "./src/server/seo/seoRoutes";
import { registerAppVersionRoutes } from "./src/server/seo/appVersionRoutes";
import { registerInlineButtonsRoutes } from "./src/server/seo/inlineButtonsRoutes";
import { registerScenarioLiveAndStylesRoutes } from "./src/server/scenarios/live/liveScenarioRoutes";
import { registerChannelBrandingRoutes } from "./src/server/channels/channelBrandingRoutes";
import { registerOnboardingRoutes } from "./src/server/onboarding/onboardingRoutes";
import { registerTelegramUsersBatchRoutes } from "./src/server/admin/telegramUsersBatchRoutes";
import { normalizeStoredGalleryAvatarUrlsInDb } from "./src/server/channelAvatarService";
import { enforceParagraphsAndRichBlocks } from "./src/server/formatting/textParagraphFormatter";
import {
  combineSystemAndUserPrompt,
  getRequiredScenarioPrompt,
  renderPromptTemplate
} from "./src/server/scenarios/prompts/scenarioPromptsRepo";
import { uploadBufferToProTalkTgf } from "./src/server/pg/client/tgfUploadClient";
import { registerFileInStorage } from "./src/server/db/filesTable";
import { registerStaticCdnFallbackRoutes } from "./src/server/seo/staticCdnFallback";
import { normalizeProTalkMediaUrl } from "./src/constants/proTalkStorage";

dotenv.config();

const IS_PRODUCTION =
  process.env.NODE_ENV === "production" ||
  (typeof __filename !== "undefined" && (__filename.endsWith(".cjs") || __filename.endsWith(".js")));

if (IS_PRODUCTION) {
  process.env.NODE_ENV = "production";
}

const app = express();
app.set("trust proxy", true);

function resolveCliArg(names: string[]): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    for (const name of names) {
      if (arg === name && argv[i + 1]) return argv[i + 1];
      if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
    }
  }
  return undefined;
}

const cliPortRaw = resolveCliArg(["--port", "-p"]);
const parsedCliPort = cliPortRaw ? Number(cliPortRaw) : NaN;
const PORT = (Number.isFinite(parsedCliPort) && parsedCliPort > 0 ? parsedCliPort : Number(process.env.PORT)) || 3000;
const HOST = resolveCliArg(["--host", "-H"]) || process.env.HOST || "0.0.0.0";
let viteInstance: ViteDevServer | null = null;
let isPgDbReady = false;

// Universal CORS & Preflight handling for iframe & cross-origin API calls
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-id, x-upload-token, x-convert-voice-ogg");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Dynamic SEO crawl routes (/sitemap.xml, /robots.txt, /rss.xml)
registerSeoCrawlRoutes(app);

// Centralized PostgreSQL ProTalk build version routes (/api/app-version, /api/admin/app-version)
registerAppVersionRoutes(app);

// PostgreSQL-backed AI Inline Buttons Prompt routes (/api/inline-buttons/prompt)
registerInlineButtonsRoutes(app);

// Real-time Scenario Execution Status & PostgreSQL Custom Post Styles routes
registerScenarioLiveAndStylesRoutes(app);

// Channel Avatar & 1-Iirka Description Generation + Telegram Branding Sync routes
registerChannelBrandingRoutes(app);

// 4-Step Interactive Onboarding Tour & +300 Iirki Contact Linking routes
registerOnboardingRoutes(app);

// Admin Cascading Batch Telegram User Verification & Full Gallery Photo Sync
registerTelegramUsersBatchRoutes(app);

// Ensure all /api data endpoints wait for Cloud PostgreSQL hydration if accessed during startup,
// while /api/status and /health respond immediately for deployment health checks.
app.use("/api", async (req, _res, next) => {
  if (req.path === "/status" || req.path === "/health") {
    return next();
  }
  if (!isPgDbReady) {
    try {
      await getPgDB();
      isPgDbReady = true;
    } catch (err) {
      console.warn("[API DB Readiness] Continuing after startup hydration warning:", err);
    }
  }
  next();
});

// Register tgsmm2 API Router
app.use("/api", apiRouter);

// Short URL Redirect endpoint: /f/:shortKey
app.get("/f/:shortKey", (req, res) => {
  const rawKey = req.params.shortKey || "";
  const cleanKey = rawKey.split(".")[0];
  const mapped = normalizeProTalkMediaUrl(`/file/${cleanKey}`);
  if (mapped.startsWith("https://file.pro-talk.ru/tgf/")) {
    return res.redirect(302, mapped);
  }
  const file = DB.getFileByShortKey(cleanKey);
  if (file && file.fullUrl) {
    return res.redirect(302, normalizeProTalkMediaUrl(file.fullUrl));
  }
  return res.redirect(302, `https://file.pro-talk.ru/tgf/${rawKey}`);
});

// Legacy /file/:id and /file/:id/:filename redirect to canonical https://file.pro-talk.ru/tgf/... URLs
app.get(["/file/:id", "/file/:id/:filename"], async (req, res) => {
  try {
    const paramId = req.params.id || "";
    const paramFilename = req.params.filename || "";

    const directTgf = normalizeProTalkMediaUrl(
      paramFilename ? `/file/${paramId}/${paramFilename}` : `/file/${paramId}`
    );
    if (directTgf.startsWith("https://file.pro-talk.ru/tgf/")) {
      return res.redirect(302, directTgf);
    }

    const db = await getPgDB();
    let file: any = null;

    if (db) {
      if (/^\d+$/.test(paramId)) {
        try {
          const numId = parseInt(paramId, 10);
          const stmt = db.prepare("SELECT * FROM file_storage WHERE id = ? OR legacy_id = ?");
          stmt.bind([numId, numId]);
          if (stmt.step()) file = stmt.getAsObject();
          stmt.free();
        } catch (e) {}
      }

      if (!file) {
        try {
          const stmt = db.prepare("SELECT * FROM file_storage WHERE file_key = ? OR slug_name = ?");
          stmt.bind([paramId, paramId]);
          if (stmt.step()) file = stmt.getAsObject();
          stmt.free();
        } catch (e) {}
      }
    }

    // Fallback to legacy files lookup
    if (!file) {
      const legacy = DB.getFileByShortKey(paramId);
      if (legacy) {
        file = {
          original_url: legacy.fullUrl,
          mime_type: legacy.mimeType || 'application/octet-stream'
        };
      }
    }

    const rawTargetUrl = file?.original_url || file?.url || file?.originalUrl || file?.fullUrl || "";
    const targetUrl = normalizeProTalkMediaUrl(rawTargetUrl);
    if (targetUrl.startsWith("https://file.pro-talk.ru/tgf/")) {
      return res.redirect(302, targetUrl);
    }

    if (!targetUrl || targetUrl.startsWith('/')) {
      return res.status(404).send("File not found");
    }

    const fileRes = await fetch(targetUrl);
    if (!fileRes.ok) {
      return res.redirect(302, targetUrl);
    }

    const upstreamCt = fileRes.headers.get("content-type") || "";
    const storedMime = (file.mime_type || file.mimeType || "").trim();
    const isGenericUpstream =
      !upstreamCt ||
      upstreamCt.includes("octet-stream") ||
      upstreamCt.includes("trolltech.linguist") ||
      upstreamCt.startsWith("text/plain");
    const contentType =
      (!isGenericUpstream ? upstreamCt : "") ||
      (storedMime && storedMime !== "application/octet-stream" ? storedMime : "") ||
      upstreamCt ||
      "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    const arrayBuffer = await fileRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("File proxy error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Direct ProTalk TGF storage is used for all media assets; local /uploads disk storage is disabled.

// Initialize Gemini Client safely
let ai: GoogleGenAI | null = null;
const API_KEY = process.env.GEMINI_API_KEY;

if (API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini API Client successfully initialized.");
  } catch (err) {
    console.error("Error setting up Gemini Client:", err);
  }
} else {
  console.warn("WARNING: GEMINI_API_KEY environment variable is not set. The app will run in demo fallback mode.");
}

// Global state / API metadata & fast health checks
app.get(["/api/status", "/api/health", "/health"], (_req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!API_KEY,
    dbReady: isPgDbReady,
    time: new Date().toISOString()
  });
});

app.get("/api/system/stats", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.json({
    success: true,
    status: "ok",
    hasApiKey: !!API_KEY,
    dbReady: isPgDbReady,
    time: new Date().toISOString()
  });
});

// Endpoint 1: ИИ Рерайт под авторский стиль (AI Rewrite style helper)
app.post("/api/ai/rewrite", async (req, res) => {
  const { 
    content, 
    styleUrlOrChannel, 
    originalStyleDesc,
    customTextPrompt,
    customImagePrompt,
    customVideoPrompt,
    narrativeStyle,
    textExampleRef,
    imageExampleRef,
    videoExampleRef,
    useRecentPostsChannel,
    referenceChannelSelected
  } = req.body;

  if (!content) {
    return res.status(400).json({ error: "Не передан текст для рерайта" });
  }

  if (!ai) {
    // Demonstration content if API key is not passed
    const currentDate = new Date().toLocaleDateString();
    return res.json({
      text: `[Режим ДЕМО | Отрерайчено по референсу] Исходный текст адаптирован под стиль ${styleUrlOrChannel || referenceChannelSelected || 'автора'}:\n\n🔥 SMM инсайт! ${content.slice(0, 100)}...\n\nМы полностью переложили ваши тезисы на новый лад. Теперь публикация читается на одном дыхании!\n\n🤖 Читайте также наш телеграм по SMM!`,
      imagePrompt: customImagePrompt || `Креативное промо-изображение, иллюстрирующее стиль канала ${styleUrlOrChannel || 'автора'}`,
      videoPrompt: customVideoPrompt || `Reels/Shorts сценарий: Видео-референс адаптации этого рерайта`,
      isDemo: true
    });
  }

  try {
    const rewriteFmt = req.body?.messageFormat === 'rich' ? 'rich' : 'v2';
    const [rewritePromptRec, formatPromptRec] = await Promise.all([
      getRequiredScenarioPrompt('post_editor', 'rewrite_post'),
      getRequiredScenarioPrompt('ai_generate_text', rewriteFmt)
    ]);

    const referenceChannelRules =
      useRecentPostsChannel && referenceChannelSelected
        ? `В качестве эталона стиля используй манеру публикаций канала: ${referenceChannelSelected}.\nОриентируйся на последние 10 постов этого канала: пиши в меру коротко, структурировано, лаконично, с умеренным использованием профессионального юмора.`
        : '';

    const narrativeRules =
      narrativeStyle || textExampleRef
        ? `Соблюдай следующий стиль повествования:\n${narrativeStyle || ''}${
            textExampleRef
              ? `\nВот пример/референс текста, на силу которого нужно ориентироваться:\n"""\n${textExampleRef}\n"""`
              : ''
          }`
        : '';

    const customTextInstruction = customTextPrompt
      ? `Также строго следуй этой инструкции для адаптации текста:\n"${customTextPrompt}"`
      : '';

    const imageInstruction = customImagePrompt
      ? `(Учитывай пожелание пользователя для картинки: "${customImagePrompt}")`
      : imageExampleRef
      ? `(Учитывай референс картинки от пользователя: "${imageExampleRef}")`
      : '';

    const videoInstruction = customVideoPrompt
      ? `(Учитывай пожелание пользователя для видео: "${customVideoPrompt}")`
      : videoExampleRef
      ? `(Учитывай референс видео от пользователя: "${videoExampleRef}")`
      : '';

    const userPrompt = renderPromptTemplate(rewritePromptRec.user_prompt_template, {
      style_source: styleUrlOrChannel || referenceChannelSelected || 'креативный, профессиональный, вовлекающий',
      reference_channel_rules: referenceChannelRules,
      narrative_rules: narrativeRules,
      custom_text_instruction: customTextInstruction,
      source_content: content,
      image_instruction: imageInstruction,
      video_instruction: videoInstruction,
      format_system_prompt: formatPromptRec.system_prompt
    });

    const combinedPrompt = combineSystemAndUserPrompt(rewritePromptRec.system_prompt, userPrompt);

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: combinedPrompt,
      config: {
        temperature: 0.85,
        systemInstruction: rewritePromptRec.system_prompt || formatPromptRec.system_prompt
      }
    });

    const aiText = response.text || "Не удалось получить ответ от ИИ.";
    const { text, imagePrompt, videoPrompt } = extractBlocks(aiText);

    res.json({
      text: enforceParagraphsAndRichBlocks(text, req.body?.messageFormat || 'v2'),
      imagePrompt,
      videoPrompt
    });
  } catch (err: any) {
    console.error("Rewrite error:", err);
    res.status(500).json({ error: err.message || "Ошибка генерации на сервере" });
  }
});

// Endpoint for improving text (ИИ Улучшение текстав ручном редакторе)
app.post("/api/ai/improve", async (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: "Введите текст для улучшения" });
  }

  if (!ai) {
    return res.json({
      text: `${content}\n\n[РЕЖИМ ДЕМО | УЛУЧШЕНО ИИSMM] ✨\n🚀 Текст был сделан более динамичным, ошибки исправлены, добавлены яркие призывы к действию и эмодзи! Подпишитесь на уведомления!`,
      isDemo: true
    });
  }

  try {
    const targetFmt = req.body?.messageFormat === 'rich' ? 'rich' : 'v2';
    const [improvePromptRec, beautyFormatRec] = await Promise.all([
      getRequiredScenarioPrompt('post_editor', 'improve_post'),
      getRequiredScenarioPrompt('format_beauty_post', targetFmt)
    ]);

    const userPrompt = renderPromptTemplate(improvePromptRec.user_prompt_template, {
      format_system_prompt: beautyFormatRec.system_prompt,
      source_content: content
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: combineSystemAndUserPrompt(improvePromptRec.system_prompt, userPrompt),
      config: {
        temperature: 0.7,
        systemInstruction: improvePromptRec.system_prompt || beautyFormatRec.system_prompt
      }
    });

    res.json({
      text: enforceParagraphsAndRichBlocks(response.text || content, targetFmt)
    });
  } catch (err: any) {
    console.error("Improvement error:", err);
    res.status(500).json({ error: err.message || "Ошибка улучшения текста на сервере" });
  }
});

function extractBlocks(aiText: string) {
  let text = aiText;
  let imagePrompt = "Минималистичное концептуальное SMM изображение";
  let videoPrompt = "Динамичное Reels видео с тезисами по теме публикации";

  const textMatch = aiText.match(/(?:### ТЕКСТ ПУБЛИКАЦИИ|### ТЕКСТ|### Основной текст)([\s\S]*?)(?:### ИИ-ИЛЛЮСТРАЦИЯ|### ИИ-ВИДЕОСЦЕНАРИЙ|$)/i);
  const imageMatch = aiText.match(/(?:### ИИ-ИЛЛЮСТРАЦИЯ|### Иллюстрация|### Изображение|### Промпт для картинки)([\s\S]*?)(?:### ИИ-ВИДЕОСЦЕНАРИЙ|$)/i);
  const videoMatch = aiText.match(/(?:### ИИ-ВИДЕОСЦЕНАРИЙ|### Видеосценарий|### Сценарий видео|### Видео)([\s\S]*?)$/i);

  if (textMatch) text = textMatch[1].trim();
  if (imageMatch) imagePrompt = imageMatch[1].trim();
  if (videoMatch) videoPrompt = videoMatch[1].trim();

  // If match failed to find sections, just return the whole text as text and clean placeholders
  if (!textMatch && !imageMatch && !videoMatch) {
    text = aiText;
  }

  return { text, imagePrompt, videoPrompt };
}

// Endpoint 2: Автопостинг/генерация постов и поиск идей в интернете (Google Grounding)
app.post("/api/ai/generate", async (req, res) => {
  const { 
    topic, 
    platform, 
    enableSearch, 
    styleDesc,
    customTextPrompt,
    customImagePrompt,
    customVideoPrompt,
    narrativeStyle,
    textExampleRef,
    imageExampleRef,
    videoExampleRef,
    useRecentPostsChannel,
    referenceChannelSelected
  } = req.body;

  if (!topic) {
    return res.status(400).json({ error: "Тема поста обязательна" });
  }

  if (!ai) {
    // Demonstration content if API key is not passed
    const currentDate = new Date().toLocaleDateString();
    return res.json({
      text: `[Режим ДЕМО | Добавьте API KEY] ИИ-Пост на тему "${topic}" для ${platform || "Telegram"}:\n\n🔥 Тренды на ${currentDate}!\n\nАвтоматизированные публикации и ИИ-ассистенты показывают высочайшую вовлекаемость во второй половине 2026года. С помощью ИИSMM мы настраиваем гибкое расписание для ваших публикаций в один клик.\n\nЧто думаете об этом тренде? Обсудим 👇`,
      imagePrompt: customImagePrompt || `Креативная футуристичная иллюстрация: ${topic}, стиль flat design, высокое разрешение`,
      videoPrompt: customVideoPrompt || `Reels сценарий на тему "${topic}": 1. Завлекающее вступление (3 сек), 2. Раскрытие сути проблемы (7 сек), 3. Призыв зарегистрироваться в ИИSMM (5 сек)`,
      sources: [
        { title: `Поиск в Google: ${topic}`, uri: `https://google.com/search?q=${encodeURIComponent(topic)}` }
      ],
      isDemo: true
    });
  }

  try {
    const genFmt = req.body?.messageFormat === 'rich' ? 'rich' : 'v2';
    const [genPromptRec, genFormatRec] = await Promise.all([
      getRequiredScenarioPrompt('post_editor', 'generate_post'),
      getRequiredScenarioPrompt('ai_generate_text', genFmt)
    ]);

    const referenceChannelRules =
      useRecentPostsChannel && referenceChannelSelected
        ? `В качестве эталона стиля используй манеры публикаций канала: ${referenceChannelSelected}.\nОриентируйся на последние 10 постов этого канала: пиши в меру коротко, структурировано, лаконично, с умеренным использованием профессионального юмора.`
        : '';

    const narrativeRules =
      narrativeStyle || textExampleRef
        ? `Соблюдай следующий стиль повествования:\n${narrativeStyle || ''}${
            textExampleRef
              ? `\nВот пример/референс текста, на силу которого нужно ориентироваться:\n"""\n${textExampleRef}\n"""`
              : ''
          }`
        : '';

    const customTextInstruction = customTextPrompt
      ? `Также строго следуй этой инструкции для генерации основного текста публикации:\n"${customTextPrompt}"`
      : '';

    const imageInstruction = customImagePrompt
      ? `(Учитывай пожелание пользователя для картинки: "${customImagePrompt}")`
      : imageExampleRef
      ? `(Учитывай референс картинки от пользователя: "${imageExampleRef}")`
      : '';

    const videoInstruction = customVideoPrompt
      ? `(Учитывай пожелание пользователя для видео: "${customVideoPrompt}")`
      : videoExampleRef
      ? `(Учитывай референс видео от пользователя: "${videoExampleRef}")`
      : '';

    const searchInstruction = enableSearch
      ? 'Обязательно найди актуальную информацию в интернете по этой теме перед написанием, чтобы подкрепить текст реальными фактами.'
      : '';

    const userPrompt = renderPromptTemplate(genPromptRec.user_prompt_template, {
      platform: platform || 'Telegram',
      topic,
      style_desc: styleDesc || 'профессиональный, захватывающий, легкий для чтения',
      reference_channel_rules: referenceChannelRules,
      narrative_rules: narrativeRules,
      custom_text_instruction: customTextInstruction,
      image_instruction: imageInstruction,
      video_instruction: videoInstruction,
      search_instruction: searchInstruction,
      format_system_prompt: genFormatRec.system_prompt
    });

    // Configure tools if search is requested
    const tools: any[] = [];
    if (enableSearch) {
      tools.push({ googleSearch: {} });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: combineSystemAndUserPrompt(genPromptRec.system_prompt, userPrompt),
      config: {
        tools: tools.length > 0 ? tools : undefined,
        temperature: 0.75,
        systemInstruction: genPromptRec.system_prompt || genFormatRec.system_prompt
      }
    });

    // Extract search grounding chunks
    const sources: Array<{ title: string; uri: string }> = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      for (const chunk of groundingChunks) {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title || "Справочный материал",
            uri: chunk.web.uri
          });
        }
      }
    }

    const aiText = response.text || "Пост успешно пуст.";
    const { text, imagePrompt, videoPrompt } = extractBlocks(aiText);

    res.json({
      text,
      imagePrompt,
      videoPrompt,
      sources
    });
  } catch (err: any) {
    console.error("Generator error:", err);
    res.status(500).json({ error: err.message || "Ошибка генерации на сервере" });
  }
});

// Endpoint 3: Чат с ассистентом (AI Assistant Chat with custom prompt via ProTalk API with SSE Streaming support)
app.post("/api/ai/chat", async (req, res) => {
  const { prompt, history, systemInstruction } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Не передан запрос" });
  }

  const effectiveSystemInstruction =
    String(systemInstruction || "").trim() ||
    DB.getSystemPromptByKey("chat_assistant")?.promptText ||
    "Ты — профессиональный ИИ-ассистент.";

  const botId = process.env.PROTALK_BOT_ID || "66275";
  const botToken = process.env.PROTALK_BOT_TOKEN || "GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE";
  const apiKey = `${botId}_${botToken}`;

  console.log(`Using ProTalk AI Assistant Chat with bot_id: ${botId}`);

  try {
    // Construct chat history messages for OpenAI style API
    const messages = [];
    messages.push({
      role: "system",
      content: effectiveSystemInstruction
    });

    // Additional reinforcement: Inject the assistant's specific instructions as user-assistant
    // conversation prefix to bypass ProTalk's automated "system" message filtering
    if (effectiveSystemInstruction && prompt !== "/restart") {
      messages.push({
        role: "user",
        content: `[СИСТЕМНАЯ ИНСТРУКЦИЯ ДЛЯ ИИ - УСТАНОВКА РОЛИ]:\nДействуй строго по этой роли: ${effectiveSystemInstruction}`
      });
      messages.push({
        role: "assistant",
        content: "Принято! Я полностью усвоил свою роль и буду отвечать в строгом соответствии с этой инструкцией."
      });
    }

    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.text
        });
      });
    }

    // Final prompt: for non-command requests, inline the role into the user prompt block
    let finalPrompt = prompt;
    if (prompt !== "/restart" && effectiveSystemInstruction) {
      finalPrompt = `[Установка твоей роли: В рамках этого диалога ты — ${effectiveSystemInstruction}]\n\nЗапрос пользователя: ${prompt}`;
    }

    messages.push({
      role: "user",
      content: finalPrompt
    });

    // Make the API call to ProTalk API with stream: true as requested
    const openAiResponse = await fetch("https://ai.pro-talk.ru/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "iismm_landing",
        messages: messages,
        temperature: 0.7,
        stream: true
      })
    });

    if (!openAiResponse.ok) {
      const errText = await openAiResponse.text();
      throw new Error(`ProTalk API Error (Status ${openAiResponse.status}): ${errText}`);
    }

    let accumulatedText = "";

    if (openAiResponse.body) {
      const reader = openAiResponse.body.getReader ? openAiResponse.body.getReader() : null;
      if (reader) {
        const decoder = new TextDecoder("utf-8");
        let done = false;
        let buffer = "";

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            buffer += decoder.decode(value, { stream: !done });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              if (trimmed.startsWith("data: ")) {
                const dataContent = trimmed.substring(6).trim();
                if (dataContent === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(dataContent);
                  const deltaContent = parsed.choices?.[0]?.delta?.content;
                  if (deltaContent) {
                    accumulatedText += deltaContent;
                  }
                } catch (e) {
                  // Ignore JSON fragment parsing errors
                }
              }
            }
          }
        }

        // Parse trailing text if any
        if (buffer) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith("data: ")) {
            const dataContent = trimmed.substring(6).trim();
            if (dataContent !== "[DONE]") {
              try {
                const parsed = JSON.parse(dataContent);
                const deltaContent = parsed.choices?.[0]?.delta?.content;
                if (deltaContent) {
                  accumulatedText += deltaContent;
                }
              } catch (e) {}
            }
          }
        }
      } else {
        // Fallback for environment constraints where reader is unsupported
        const rawText = await openAiResponse.text();
        try {
          const parsed = JSON.parse(rawText);
          accumulatedText = parsed.choices?.[0]?.message?.content || "";
        } catch {
          const lines = rawText.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const dataContent = trimmed.substring(6).trim();
              if (dataContent === "[DONE]") continue;
              try {
                const parsed = JSON.parse(dataContent);
                const deltaContent = parsed.choices?.[0]?.delta?.content;
                if (deltaContent) accumulatedText += deltaContent;
              } catch (e) {}
            }
          }
        }
      }
    }

    if (!accumulatedText.trim()) {
      // Direct backup request using stream: false in case stream chunk collection was altogether empty
      const directResponse = await fetch("https://ai.pro-talk.ru/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "iismm_landing",
          messages: messages,
          temperature: 0.7,
          stream: false
        })
      });
      if (directResponse.ok) {
        const directJson = await directResponse.json();
        accumulatedText = directJson.choices?.[0]?.message?.content || "";
      }
    }

    if (!accumulatedText.trim()) {
      throw new Error("Не удалось получить сгенерированный текст от ProTalk API.");
    }

    return res.json({
      text: accumulatedText
    });

  } catch (err: any) {
    console.error("ProTalk Chat error:", err);
    
    // Auto Graceful fallback to Gemini if ProTalk encounters error and Gemini is configured
    if (ai) {
      console.log("ProTalk failed, auto-falling back to Gemini model gracefully...");
      try {
        const contents: any[] = [];
        if (history && Array.isArray(history)) {
          history.forEach((msg: any) => {
            contents.push({
              role: msg.role === 'user' ? 'user' : 'model',
              parts: [{ text: msg.text }]
            });
          });
        }
        contents.push({
          role: 'user',
          parts: [{ text: prompt }]
        });

        const fallbackResponse = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: contents,
          config: {
            temperature: 0.7,
            systemInstruction: effectiveSystemInstruction,
          }
        });

        return res.json({
          text: fallbackResponse.text || "Извините, я не смог сформулировать ответ."
        });
      } catch (geminiErr: any) {
        console.error("Gemini fallback also failed:", geminiErr);
      }
    }

    res.status(500).json({ 
      error: `Ошибка при обращении к ИИ ProTalk: ${err.message || "Неизвестная ошибка"}` 
    });
  }
});

// Endpoint for saving voice records via ProTalk TGF Storage (storing only URL in PostgreSQL)
app.post("/api/ai/upload-voice", async (req, res) => {
  const { audioBase64, extension, userId } = req.body;
  if (!audioBase64) {
    return res.status(400).json({ error: "Передан пустой аудиофайл (audioBase64 is required)" });
  }

  try {
    const ext = String(extension || "webm").replace(/[^a-z0-9]/gi, "") || "webm";
    const filename = `voice_${Date.now()}.${ext}`;
    const mimeType = ext === "wav" ? "audio/wav" : ext === "ogg" ? "audio/ogg" : "audio/webm";
    const cleanB64 = String(audioBase64).replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(cleanB64, "base64");

    let fileUrl = "";
    let lastUploadErr: any = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const uploaded = await uploadBufferToProTalkTgf({
          buffer,
          filename,
          mimeType,
          preserveAlpha: true
        });
        fileUrl = normalizeProTalkMediaUrl(uploaded.url);
        if (fileUrl) break;
      } catch (tgfErr) {
        lastUploadErr = tgfErr;
        if (attempt === 1) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    }

    if (!fileUrl) {
      console.error("[Voice Upload] ProTalk TGF unavailable:", lastUploadErr);
      return res.status(502).json({ error: "Не удалось загрузить голосовое сообщение в ProTalk TGF. Повторите попытку." });
    }

    const db = await getPgDB();
    if (db) {
      registerFileInStorage(db, {
        userId: String(userId || "admin"),
        name: filename,
        originalUrl: fileUrl,
        fileType: "audio",
        mimeType,
        fileSize: buffer.length
      });
    }

    console.log(`[ИИSMM] Аудиофайл успешно сохранён по ссылке: ${fileUrl}`);
    res.json({ url: fileUrl });
  } catch (err: any) {
    console.error("Ошибка при сохранении аудиофайла:", err);
    res.status(500).json({ error: `Не удалось сохранить голосовое сообщение: ${err.message}` });
  }
});

// Dynamic SSR HTML SEO & GEO Meta-Tags Injector for Blog & Public Posts
registerSeoSsrHtmlRoutes(app, {
  isProduction: IS_PRODUCTION,
  getViteServer: () => viteInstance,
});

// Configure Vite or Static production serving immediately so health checks pass within milliseconds,
// while Cloud PostgreSQL (iismm2) hydrates cleanly in background and gates /api data endpoints.
async function bootstrap() {
  const appRootCandidates = Array.from(
    new Set([
      process.cwd(),
      ...(typeof __dirname !== "undefined" ? [path.resolve(__dirname, ".."), __dirname] : [])
    ])
  );

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import("vite");
    viteInstance = await createViteServer({
      server: {
        middlewareMode: true,
        host: HOST,
        allowedHosts: true,
        hmr: false,
        ws: false,
      },
      appType: "spa",
    });
    app.use(viteInstance.middlewares);
    registerStaticCdnFallbackRoutes(app);
    console.log("Vite middleware mounted for UI serving (allowedHosts enabled, WebSocket/HMR disabled).");
  } else {
    const distCandidates = appRootCandidates.map((root) => path.join(root, "dist"));
    const publicCandidates = appRootCandidates.map((root) => path.join(root, "public"));
    const resolvedDistPath =
      distCandidates.find((dir) => fs.existsSync(path.join(dir, "index.html"))) || distCandidates[0];
    const indexHtmlPath = path.join(resolvedDistPath, "index.html");
    if (!fs.existsSync(indexHtmlPath)) {
      console.warn(`[Production Warning] ${indexHtmlPath} not found! Run "npm run build" before starting.`);
    }
    const staticHeadersHandler = (res: express.Response, filePath: string) => {
      if (filePath.endsWith(".html") || filePath.endsWith("sw.js") || filePath.endsWith("sw-push.js")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else if (filePath.endsWith(".webmanifest")) {
        res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=86400");
      } else if (
        filePath.includes(`${path.sep}assets${path.sep}`) ||
        filePath.includes(`${path.sep}icons${path.sep}`) ||
        filePath.includes(`${path.sep}pwa${path.sep}`) ||
        filePath.includes(`${path.sep}tiles${path.sep}`) ||
        filePath.includes(`${path.sep}social${path.sep}`)
      ) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    };
    for (const dir of [...distCandidates, ...publicCandidates]) {
      if (fs.existsSync(dir)) {
        app.use(express.static(dir, { setHeaders: staticHeadersHandler }));
      }
    }
    registerStaticCdnFallbackRoutes(app);
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "API route not found" });
      }
      if (
        /\.(?:png|jpe?g|webp|gif|ico|svg|webmanifest|js|css|map|woff2?|ttf|eot|json|xml)$/i.test(req.path) ||
        /^\/(?:assets|pwa|icons|tiles|social)\//.test(req.path)
      ) {
        return res.status(404).end();
      }
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.sendFile(indexHtmlPath);
    });
    console.log("Production preview server serving optimized /dist + ProTalk PostgreSQL API.");
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(
      `ИИSMM server (${IS_PRODUCTION ? "production-preview" : "dev"}) is active & listening at http://${HOST}:${PORT}`
    );
  });

  // Hydrate Cloud PostgreSQL (iismm2) immediately in background right after opening the HTTP port
  void (async () => {
    try {
      await getPgDB();
      isPgDbReady = true;
      console.log("[PostgreSQL ProTalk iismm2] Initialized and verified on startup (v.1.56).");
      await normalizeStoredGalleryAvatarUrlsInDb();
      DB.deduplicateExistingPostTitles();
      startCentralizedCronWorker(30000);
    } catch (err) {
      console.error("[PostgreSQL ProTalk iismm2] Startup initialization error:", err);
    }
  })();

  const gracefulShutdown = async (signal: string) => {
    console.log(`[Server] Received ${signal}. Flushing pending PostgreSQL (iismm2) writes...`);
    try {
      await flushPendingPgWrites(10000);
    } catch (flushErr) {
      console.error("[Server] Error flushing pending PostgreSQL writes:", flushErr);
    }
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.once("SIGTERM", () => void gracefulShutdown("SIGTERM"));
  process.once("SIGINT", () => void gracefulShutdown("SIGINT"));
}

bootstrap();
