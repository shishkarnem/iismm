import { DB } from '../db';
import { getPgDB } from '../db/postgres';
import { handleUnifiedImageGeneration } from '../imageBuilderService';
import { callProTalkBotApi } from '../protalk';
import { resolvePublicMediaUrl } from '../telegram';
import { getPricingConfig } from '../pricing/pricingService';
import {
  combineSystemAndUserPrompt,
  getRequiredScenarioPrompt,
  renderPromptTemplate
} from '../scenarios/prompts/scenarioPromptsRepo';

export type CascadingCarouselMode = 'func_791' | 'func_784';
export type CascadingReferenceMode = 'first_slide_anchor' | 'custom_ref';

export interface CascadingSlideResult {
  index: number;
  url: string;
  originalUrl: string;
  prompt: string;
  caption: string;
  cost: number;
}

export interface CascadingProgressEvent {
  type: 'plan_ready' | 'slide_start' | 'slide_done' | 'done' | 'error';
  index?: number;
  total?: number;
  prompt?: string;
  slide?: CascadingSlideResult;
  prompts?: string[];
  slides?: CascadingSlideResult[];
  totalCost?: number;
  error?: string;
}

export function clampCarouselSlideCount(val: any): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return 4;
  return Math.max(2, Math.min(10, Math.round(n)));
}

export function isAllowedCascadingModel(mode: any): mode is CascadingCarouselMode {
  return mode === 'func_791' || mode === 'func_784';
}

function buildDeterministicScenePrompts(storyPrompt: string, slideCount: number): string[] {
  const topic = String(storyPrompt || '').trim() || 'Визуальная история бренда в единой художественной стилистике';
  const stageBeats = [
    'Кадр 1 (Экспозиция и ключевой стиль): знакомство с главным образом и атмосферой истории, крупный выразительный план',
    'Кадр 2 (Развитие идеи): расширенный ракурс в том же пространстве и цветовой палитре, появление первой детали действия',
    'Кадр 3 (Фокус на действии): главный герой или объект в процессе взаимодействия, динамичная композиция в едином свете',
    'Кадр 4 (Контраст и глубина): новая точка съемки, раскрывающая смысл сюжета и сохраняющая прежние цвета и материалы',
    'Кадр 5 (Ключевой поворот): эмоциональный акцент сцены, те же персонажи и стилистика, выразительное освещение',
    'Кадр 6 (Практическая деталь): крупный план важного элемента истории в гармонии с основным визуальным кодом',
    'Кадр 7 (Динамика процесса): развитие движения сюжета вперёд, преемственность образов и единая атмосфера',
    'Кадр 8 (Кульминация): самый яркий момент истории, согласованная композиция и фирменные оттенки первых кадров',
    'Кадр 9 (Результат): спокойное и гармоничное раскрытие итога истории в том же художественном стиле',
    'Кадр 10 (Финальный аккорд): завершающий выразительный кадр, объединяющий всю серию в цельное впечатление'
  ];

  const prompts: string[] = [];
  for (let i = 0; i < slideCount; i++) {
    const beat = i === slideCount - 1 && slideCount > 2 ? stageBeats[9] : stageBeats[i % stageBeats.length];
    prompts.push(`${topic}. ${beat}.`);
  }
  return prompts;
}

function parsePlannedPrompts(rawReply: string, slideCount: number): string[] {
  const text = String(rawReply || '').trim();
  if (!text) return [];

  // 1. Try JSON array extraction (handling markdown fences)
  const fenced = text.replace(/```(?:json)?\s*([\s\S]*?)```/gi, '$1').trim();
  const arrMatch = fenced.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      const parsed = JSON.parse(arrMatch[0]);
      if (Array.isArray(parsed)) {
        const items = parsed
          .map((it) => {
            if (typeof it === 'string') return it.trim();
            if (it && typeof it === 'object') {
              return String(it.prompt || it.description || it.scene || it.text || '').trim();
            }
            return '';
          })
          .filter((s) => s.length >= 12);
        if (items.length >= 2) {
          return items.slice(0, slideCount);
        }
      }
    } catch {}
  }

  // 2. Fallback: numbered list lines ("1. ...", "Слайд 1: ...", "1) ...")
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^(?:\d+[\.\):]|(?:Слайд|Кадр)\s+\d+[:.\-])/i.test(l))
    .map((l) => l.replace(/^(?:\d+[\.\):]\s*|(?:Слайд|Кадр)\s+\d+[:.\-\s]*)/i, '').replace(/^["«]|["»]$/g, '').trim())
    .filter((l) => l.length >= 12);

  if (lines.length >= 2) {
    return lines.slice(0, slideCount);
  }

  return [];
}

/**
 * Generates sequential, visually unified scene prompts for a 2–10 slide cascading story carousel.
 */
export async function planCascadingCarouselPrompts(params: {
  storyPrompt: string;
  slideCount: number;
  userId?: string;
}): Promise<{ prompts: string[]; source: 'ai' | 'template' }> {
  const slideCount = clampCarouselSlideCount(params.slideCount);
  const storyPrompt = String(params.storyPrompt || '').trim();
  if (!storyPrompt) {
    return { prompts: buildDeterministicScenePrompts('', slideCount), source: 'template' };
  }

  const dbPrompt = await getRequiredScenarioPrompt('ai_carousel', 'plan_slides');
  const renderedUser = renderPromptTemplate(dbPrompt.user_prompt_template, {
    slide_count: slideCount,
    story_prompt: storyPrompt
  });
  const plannerPrompt = combineSystemAndUserPrompt(dbPrompt.system_prompt, renderedUser);

  try {
    const raw = await callProTalkBotApi(plannerPrompt, undefined, undefined, params.userId || '16926299042');
    const parsed = parsePlannedPrompts(raw, slideCount);
    if (parsed.length >= slideCount) {
      return { prompts: parsed.slice(0, slideCount), source: 'ai' };
    }
    if (parsed.length >= 2) {
      const fallbackTail = buildDeterministicScenePrompts(storyPrompt, slideCount);
      return {
        prompts: [...parsed, ...fallbackTail.slice(parsed.length)].slice(0, slideCount),
        source: 'ai'
      };
    }
  } catch (err: any) {
    console.warn('[CascadingCarousel] Prompt planner fallback triggered:', err?.message || err);
  }

  return { prompts: buildDeterministicScenePrompts(storyPrompt, slideCount), source: 'template' };
}

async function getUserTotalIirkyBalance(userId: string): Promise<number> {
  try {
    const db = await getPgDB();
    const stmt = db.prepare(`
      SELECT balance, balance_free, balance_pay, balance_start, balance_ref, balance_tarif, balance_admin
      FROM users WHERE id = ? LIMIT 1
    `);
    stmt.bind([userId]);
    let total = 0;
    if (stmt.step()) {
      const u = stmt.getAsObject() as any;
      const sum =
        Number(u.balance_pay || 0) +
        Number(u.balance_free || 0) +
        Number(u.balance_start || 0) +
        Number(u.balance_ref || 0) +
        Number(u.balance_tarif || 0) +
        Number(u.balance_admin || 0);
      total = sum > 0 ? sum : Number(u.balance || 0);
    }
    stmt.free();
    return total;
  } catch {
    return 1000;
  }
}

function uniqueHttpsUrls(candidates: Array<string | undefined | null>, maxRefs: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of candidates) {
    const u = String(raw || '').trim();
    if (!u || !/^https?:\/\//i.test(u)) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= maxRefs) break;
  }
  return out;
}

/**
 * Executes sequential cascading carousel image generation where Slide 1 and/or a user reference
 * anchors visual style, palette, and character consistency across slides 2..N.
 * STRICT: Only func_791 (up to 16 refs) and func_784 (up to 4 refs) are permitted.
 */
export async function executeCascadingCarouselGeneration(params: {
  storyPrompt: string;
  slideCount: number;
  functionMode: string;
  aspectRatio?: string;
  referenceMode?: CascadingReferenceMode;
  referenceUrl?: string;
  slidePrompts?: string[];
  userId?: string;
  hostProtocol?: { host: string; protocol: string };
  onProgress?: (ev: CascadingProgressEvent) => void;
}): Promise<{
  ok: boolean;
  status?: number;
  error?: string;
  mode?: CascadingCarouselMode;
  slides: CascadingSlideResult[];
  totalCost: number;
  plannedPrompts: string[];
}> {
  const {
    storyPrompt,
    functionMode,
    aspectRatio = '1:1',
    referenceMode = 'first_slide_anchor',
    referenceUrl = '',
    slidePrompts,
    userId = '16926299042',
    hostProtocol,
    onProgress
  } = params;

  if (!isAllowedCascadingModel(functionMode)) {
    return {
      ok: false,
      status: 400,
      error:
        'Для каскадной генерации карусели в едином стиле разрешены только модели с поддержкой референсов: func_791 (до 16 референсов) и func_784 (до 4 референсов).',
      slides: [],
      totalCost: 0,
      plannedPrompts: []
    };
  }

  const targetCount = clampCarouselSlideCount(params.slideCount);

  // Resolve custom reference URL if provided
  let resolvedCustomRef = '';
  if (referenceUrl && referenceUrl.trim()) {
    resolvedCustomRef = await resolvePublicMediaUrl(referenceUrl.trim());
    if (!/^https?:\/\//i.test(resolvedCustomRef) && hostProtocol?.host) {
      if (resolvedCustomRef.startsWith('/')) {
        resolvedCustomRef = `${hostProtocol.protocol}://${hostProtocol.host}${resolvedCustomRef}`;
      }
    }
  }

  if (referenceMode === 'custom_ref' && !/^https?:\/\//i.test(resolvedCustomRef)) {
    return {
      ok: false,
      status: 400,
      error: 'Укажите корректную ссылку на картинку-референс (или выберите файл из галереи / загрузите фото).',
      slides: [],
      totalCost: 0,
      plannedPrompts: []
    };
  }

  // Check balance upfront before generating multiple images
  const settings = DB.getSettings();
  const pricing = await getPricingConfig();
  const costPerSlide =
    functionMode === 'func_791'
      ? Number(pricing?.imageModels?.func_791 ?? settings?.costImage791Iirky ?? 15)
      : Number(pricing?.imageModels?.func_784 ?? settings?.costImage784Iirky ?? settings?.costImageWithTextIirky ?? 10);
  const totalEstimatedCost = costPerSlide * targetCount;
  const userBalance = await getUserTotalIirkyBalance(userId);

  if (totalEstimatedCost > 0 && userBalance < totalEstimatedCost) {
    return {
      ok: false,
      status: 402,
      error: `Недостаточно Иирок для карусели из ${targetCount} слайдов! Требуется: ${totalEstimatedCost} Иирок (${costPerSlide} × ${targetCount}), доступно: ${userBalance} Иирок.`,
      slides: [],
      totalCost: 0,
      plannedPrompts: []
    };
  }

  // Prepare slide prompts (use edited UI prompts if provided, else plan cohesive story sequence)
  let plannedPrompts: string[] = [];
  const providedClean = Array.isArray(slidePrompts)
    ? slidePrompts.map((p) => String(p || '').trim()).filter(Boolean)
    : [];

  if (providedClean.length >= targetCount) {
    plannedPrompts = providedClean.slice(0, targetCount);
  } else if (providedClean.length > 0) {
    const generated = await planCascadingCarouselPrompts({ storyPrompt, slideCount: targetCount, userId });
    plannedPrompts = [...providedClean, ...generated.prompts.slice(providedClean.length)].slice(0, targetCount);
  } else {
    if (!String(storyPrompt || '').trim()) {
      return {
        ok: false,
        status: 400,
        error: 'Опишите идею истории или заполните сценарии кадров для генерации карусели.',
        slides: [],
        totalCost: 0,
        plannedPrompts: []
      };
    }
    const generated = await planCascadingCarouselPrompts({ storyPrompt, slideCount: targetCount, userId });
    plannedPrompts = generated.prompts;
  }

  onProgress?.({
    type: 'plan_ready',
    total: plannedPrompts.length,
    prompts: plannedPrompts
  });

  const maxRefsForModel = functionMode === 'func_791' ? 16 : 4;
  let anchorSlide1Url = '';
  let prevSlideUrl = '';
  const completedSlides: CascadingSlideResult[] = [];
  let totalCost = 0;

  for (let i = 0; i < plannedPrompts.length; i++) {
    const rawSlidePrompt = plannedPrompts[i];
    const slideNumber = i + 1;

    // Reference anchor chain: optional custom user ref + Slide 1 style anchor + immediately previous frame
    const activeRefs = uniqueHttpsUrls(
      [resolvedCustomRef, anchorSlide1Url, prevSlideUrl],
      maxRefsForModel
    );

    const styleDirective =
      i === 0
        ? resolvedCustomRef
          ? 'Строго сохраняй визуальный стиль, цветовую палитру, материалы и характер образа с приложенного изображения-референса.'
          : 'Задай выразительный, цельный и узнаваемый художественный стиль, единую цветовую палитру и освещение для всей серии.'
        : 'Строго сохраняй единый художественный стиль, персонажей, пропорции, освещение и цветовую палитру референсных кадров, развивая сюжет дальше.';

    const outboundPrompt = `${rawSlidePrompt} Кадр ${slideNumber} из ${plannedPrompts.length}. ${styleDirective}`;

    onProgress?.({
      type: 'slide_start',
      index: slideNumber,
      total: plannedPrompts.length,
      prompt: rawSlidePrompt
    });

    const genRes = await handleUnifiedImageGeneration({
      mode: functionMode,
      prompt: outboundPrompt,
      aspectRatio: functionMode === 'func_784' && aspectRatio === 'auto' ? '1:1' : aspectRatio,
      referenceUrl: activeRefs[0],
      images_urls: activeRefs.join(','),
      userId,
      hostProtocol
    });

    if (!genRes.ok || !genRes.imageUrl) {
      const errText = genRes.error || `Не удалось сгенерировать кадр ${slideNumber}`;
      onProgress?.({
        type: 'error',
        index: slideNumber,
        total: plannedPrompts.length,
        error: errText,
        slides: completedSlides,
        totalCost
      });
      return {
        ok: false,
        status: genRes.status || 502,
        error: `Остановка на кадре ${slideNumber} из ${plannedPrompts.length}: ${errText}`,
        mode: functionMode,
        slides: completedSlides,
        totalCost,
        plannedPrompts
      };
    }

    if (i === 0) {
      anchorSlide1Url = genRes.originalUrl || genRes.imageUrl;
    }
    prevSlideUrl = genRes.originalUrl || genRes.imageUrl;

    const slideCost = Number(genRes.cost ?? costPerSlide);
    totalCost += slideCost;

    const slideEntry: CascadingSlideResult = {
      index: slideNumber,
      url: genRes.imageUrl,
      originalUrl: genRes.originalUrl || genRes.imageUrl,
      prompt: rawSlidePrompt,
      caption: rawSlidePrompt.slice(0, 90),
      cost: slideCost
    };
    completedSlides.push(slideEntry);

    onProgress?.({
      type: 'slide_done',
      index: slideNumber,
      total: plannedPrompts.length,
      slide: slideEntry,
      slides: [...completedSlides],
      totalCost
    });
  }

  onProgress?.({
    type: 'done',
    total: completedSlides.length,
    slides: completedSlides,
    totalCost
  });

  return {
    ok: true,
    mode: functionMode,
    slides: completedSlides,
    totalCost,
    plannedPrompts
  };
}
