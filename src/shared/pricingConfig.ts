export interface PricingConfig {
  textAi: {
    postGeneration: number;
    styleAnalysis: number;
    neuroplan: number;
    inlineButtons: number;
    channelDescription: number;
    scheduleAiFill: number;
    beautyPostAi: number;
  };
  imageModels: {
    func_787: number;
    func_621: number;
    func_784: number;
    func_791: number;
    legacyGenerateImage: number;
  };
  scenarioAi: {
    assistantBuildOrEdit: number;
    topicArchive: number;
    topicFast: number;
    textGeneration: number;
    imagePromptPerItem: number;
    richSplitAi: number;
  };
  promoAndFolders: {
    folderJoin: number;
    selectionJoin: number;
    selectionModeration: number;
    selectionEdit: number;
    promoAiText: number;
    promoAiImage: number;
  };
  topup: {
    iirkyPerRub: number;
    topupPresetsRub: number[];
  };
  updatedAt?: string;
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  textAi: {
    postGeneration: 5,
    styleAnalysis: 10,
    neuroplan: 10,
    inlineButtons: 1,
    channelDescription: 1,
    scheduleAiFill: 1,
    beautyPostAi: 1
  },
  imageModels: {
    func_787: 0,
    func_621: 5,
    func_784: 10,
    func_791: 15,
    legacyGenerateImage: 10
  },
  scenarioAi: {
    assistantBuildOrEdit: 5,
    topicArchive: 10,
    topicFast: 1,
    textGeneration: 1,
    imagePromptPerItem: 1,
    richSplitAi: 1
  },
  promoAndFolders: {
    folderJoin: 1,
    selectionJoin: 1,
    selectionModeration: 1,
    selectionEdit: 1,
    promoAiText: 1,
    promoAiImage: 10
  },
  topup: {
    iirkyPerRub: 1,
    topupPresetsRub: [500, 990, 2500, 4900, 10000, 25000]
  }
};

function toNonNegNumber(val: unknown, fallback: number, allowDecimal = false): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return allowDecimal ? Math.round(num * 100) / 100 : Math.round(num);
}

export function sanitizePricingConfig(raw: any): PricingConfig {
  const src = raw && typeof raw === 'object' ? raw : {};
  const t = src.textAi || {};
  const img = src.imageModels || {};
  const sc = src.scenarioAi || {};
  const pr = src.promoAndFolders || {};
  const top = src.topup || {};

  const presetsRaw = Array.isArray(top.topupPresetsRub)
    ? top.topupPresetsRub
        .map((n: any) => Math.round(Number(n)))
        .filter((n: number) => Number.isFinite(n) && n >= 10)
    : DEFAULT_PRICING_CONFIG.topup.topupPresetsRub;

  return {
    textAi: {
      postGeneration: toNonNegNumber(t.postGeneration, DEFAULT_PRICING_CONFIG.textAi.postGeneration),
      styleAnalysis: toNonNegNumber(t.styleAnalysis, DEFAULT_PRICING_CONFIG.textAi.styleAnalysis),
      neuroplan: toNonNegNumber(t.neuroplan, DEFAULT_PRICING_CONFIG.textAi.neuroplan),
      inlineButtons: toNonNegNumber(t.inlineButtons, DEFAULT_PRICING_CONFIG.textAi.inlineButtons),
      channelDescription: toNonNegNumber(t.channelDescription, DEFAULT_PRICING_CONFIG.textAi.channelDescription),
      scheduleAiFill: toNonNegNumber(t.scheduleAiFill, DEFAULT_PRICING_CONFIG.textAi.scheduleAiFill),
      beautyPostAi: toNonNegNumber(t.beautyPostAi, DEFAULT_PRICING_CONFIG.textAi.beautyPostAi)
    },
    imageModels: {
      func_787: toNonNegNumber(img.func_787, DEFAULT_PRICING_CONFIG.imageModels.func_787),
      func_621: toNonNegNumber(img.func_621, DEFAULT_PRICING_CONFIG.imageModels.func_621),
      func_784: toNonNegNumber(img.func_784, DEFAULT_PRICING_CONFIG.imageModels.func_784),
      func_791: toNonNegNumber(img.func_791, DEFAULT_PRICING_CONFIG.imageModels.func_791),
      legacyGenerateImage: toNonNegNumber(img.legacyGenerateImage, DEFAULT_PRICING_CONFIG.imageModels.legacyGenerateImage)
    },
    scenarioAi: {
      assistantBuildOrEdit: toNonNegNumber(sc.assistantBuildOrEdit, DEFAULT_PRICING_CONFIG.scenarioAi.assistantBuildOrEdit),
      topicArchive: toNonNegNumber(sc.topicArchive, DEFAULT_PRICING_CONFIG.scenarioAi.topicArchive),
      topicFast: toNonNegNumber(sc.topicFast, DEFAULT_PRICING_CONFIG.scenarioAi.topicFast),
      textGeneration: toNonNegNumber(sc.textGeneration, DEFAULT_PRICING_CONFIG.scenarioAi.textGeneration),
      imagePromptPerItem: toNonNegNumber(sc.imagePromptPerItem, DEFAULT_PRICING_CONFIG.scenarioAi.imagePromptPerItem),
      richSplitAi: toNonNegNumber(sc.richSplitAi, DEFAULT_PRICING_CONFIG.scenarioAi.richSplitAi)
    },
    promoAndFolders: {
      folderJoin: toNonNegNumber(pr.folderJoin, DEFAULT_PRICING_CONFIG.promoAndFolders.folderJoin),
      selectionJoin: toNonNegNumber(pr.selectionJoin, DEFAULT_PRICING_CONFIG.promoAndFolders.selectionJoin),
      selectionModeration: toNonNegNumber(pr.selectionModeration, DEFAULT_PRICING_CONFIG.promoAndFolders.selectionModeration),
      selectionEdit: toNonNegNumber(pr.selectionEdit, DEFAULT_PRICING_CONFIG.promoAndFolders.selectionEdit),
      promoAiText: toNonNegNumber(pr.promoAiText, DEFAULT_PRICING_CONFIG.promoAndFolders.promoAiText),
      promoAiImage: toNonNegNumber(pr.promoAiImage, DEFAULT_PRICING_CONFIG.promoAndFolders.promoAiImage)
    },
    topup: {
      iirkyPerRub: Math.max(0.01, toNonNegNumber(top.iirkyPerRub, DEFAULT_PRICING_CONFIG.topup.iirkyPerRub, true)),
      topupPresetsRub:
        presetsRaw.length > 0 ? presetsRaw.slice(0, 12) : DEFAULT_PRICING_CONFIG.topup.topupPresetsRub
    },
    updatedAt: typeof src.updatedAt === 'string' ? src.updatedAt : undefined
  };
}

export function formatIirkyWord(n: number, caseForm: 'nom' | 'acc' = 'nom'): string {
  const abs = Math.abs(Math.round(n));
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'ИИрок';
  if (mod10 === 1) return caseForm === 'acc' ? 'ИИрку' : 'ИИрка';
  if (mod10 >= 2 && mod10 <= 4) return 'ИИрки';
  return 'ИИрок';
}

export function formatIirkyCount(n: number, caseForm: 'nom' | 'acc' = 'nom'): string {
  const num = Number(n) || 0;
  return `${num.toLocaleString('ru-RU')} ${formatIirkyWord(num, caseForm)}`;
}

export function getImageModelCostFromPricing(cfg: PricingConfig, fnMode: string): number {
  const clean = String(fnMode || 'func_621').trim();
  if (clean === 'func_791' || clean === '791') return cfg.imageModels.func_791;
  if (clean === 'func_784' || clean === '784' || clean === 'with_text') return cfg.imageModels.func_784;
  if (clean === 'func_621' || clean === '621' || clean === 'no_text') return cfg.imageModels.func_621;
  if (clean === 'func_787' || clean === '787' || clean === 'free') return cfg.imageModels.func_787;
  return cfg.imageModels.func_621;
}

export function computeTopupIirkyAmount(amountRub: number, cfg: PricingConfig): number {
  const rub = Math.max(0, Number(amountRub) || 0);
  const rate = Math.max(0.01, Number(cfg?.topup?.iirkyPerRub || 1));
  return Math.max(1, Math.round(rub * rate));
}
