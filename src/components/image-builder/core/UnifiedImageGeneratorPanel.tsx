import React, { useState, useEffect, useRef } from 'react';
import {
  Wand2,
  AlertCircle,
  Sliders,
  X,
  Check,
  RefreshCw
} from 'lucide-react';
import {
  NormalizedImageFunctionMode,
  ImageTargetMode,
  ImageBuilderSyncedConfig,
  Function787Config,
  Function791Config,
  ASPECT_RATIO_OPTIONS_791,
  ASPECT_RATIO_OPTIONS_BASIC,
  normalizeImageFunctionMode
} from '../types';
import { ReferenceImageSelector } from '../ReferenceImageSelector';
import {
  ImageBuilderResultBlock,
  ImageBuilderWaitingModal,
  ImageBuilderFullscreenModal
} from './ImageBuilderOverlays';
import {
  GradientSelect,
  VariableInsertDropdown,
  ScenarioVariableOption,
  DEFAULT_SCENARIO_VARIABLES
} from '../../ui-kit/GradientDropdown';
import { CollapsibleSection } from '../../ui-kit/CollapsibleSection';
import { ResponsiveActionBtn, UnboxedMetaLine } from '../../ui-kit/ResponsiveActionBtn';
import { AutoGrowVoiceTextarea } from '../../ui-kit/AutoGrowVoiceTextarea';
import { usePricingConfig } from '../../../hooks/usePricingConfig';

export interface UnifiedImageGeneratorPanelProps {
  /** Scenario mode shows promptMode ('auto' | 'custom') + variable insertion and syncs every change */
  isScenarioMode?: boolean;
  promptMode?: 'auto' | 'custom';
  onPromptModeChange?: (mode: 'auto' | 'custom') => void;
  scenarioVariables?: ScenarioVariableOption[];
  onScenarioChange?: (config: ImageBuilderSyncedConfig) => void;

  /** Editor / Modal mode props */
  editorFormat?: 'v2' | 'rich';
  defaultTargetMode?: ImageTargetMode;
  allowMultiple?: boolean;
  fixedCountLabel?: string;
  initialCount?: number;
  initialPrompt?: string;
  initialMode?: string;
  initialAspectRatio?: string;
  initialReferenceUrl?: string;
  initialFunc787Config?: Partial<Function787Config>;
  initialFunc791Config?: Partial<Function791Config>;

  onApplyResult?: (urls: string[], targetMode: ImageTargetMode, synced: ImageBuilderSyncedConfig) => void;
  onSaveConfigOnly?: (synced: ImageBuilderSyncedConfig) => void;
  saveConfigButtonLabel?: string;
  onClose?: () => void;

  userId?: string;
  userBalance?: number;
  onRefreshUser?: () => void;
}

const SIZE_787_OPTIONS = [
  { value: '1024x1024', label: '1024x1024 · Квадрат (1:1)' },
  { value: '1536x1024', label: '1536x1024 · Горизонтальный (3:2)' },
  { value: '1024x1536', label: '1024x1536 · Вертикальный (2:3)' },
  { value: 'auto', label: 'auto · Авторазмер' }
];

const FORMAT_787_OPTIONS = [
  { value: 'png', label: 'png · Четкие детали' },
  { value: 'jpeg', label: 'jpeg · Компактный вес' },
  { value: 'webp', label: 'webp · Современный формат' }
];

export const UnifiedImageGeneratorPanel: React.FC<UnifiedImageGeneratorPanelProps> = ({
  isScenarioMode = false,
  promptMode = 'auto',
  onPromptModeChange,
  scenarioVariables = DEFAULT_SCENARIO_VARIABLES,
  onScenarioChange,
  editorFormat,
  defaultTargetMode,
  allowMultiple = true,
  initialCount,
  initialPrompt = '',
  initialMode = 'func_621',
  initialAspectRatio = '16:9',
  initialReferenceUrl = '',
  initialFunc787Config,
  initialFunc791Config,
  onApplyResult,
  onSaveConfigOnly,
  saveConfigButtonLabel,
  onClose,
  userId,
  userBalance,
  onRefreshUser
}) => {
  const { pricing: dynamicPricing } = usePricingConfig(userId);
  const [cost787, setCost787] = useState(dynamicPricing.imageModels.func_787);
  const [cost621, setCost621] = useState(dynamicPricing.imageModels.func_621);
  const [cost784, setCost784] = useState(dynamicPricing.imageModels.func_784);
  const [cost791, setCost791] = useState(dynamicPricing.imageModels.func_791);

  const [mode, setMode] = useState<NormalizedImageFunctionMode>(() => normalizeImageFunctionMode(initialMode));
  const [aspectRatioBasic, setAspectRatioBasic] = useState<'16:9' | '9:16' | '1:1'>(() =>
    initialAspectRatio === '9:16' || initialAspectRatio === '1:1' ? initialAspectRatio : '16:9'
  );
  const [aspectRatio791, setAspectRatio791] = useState<string>(
    initialFunc791Config?.aspect_ratio ||
      (ASPECT_RATIO_OPTIONS_791.some(o => o.value === initialAspectRatio) ? initialAspectRatio : 'auto')
  );
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [imageCount, setImageCount] = useState<number>(() => {
    if (initialCount && initialCount >= 1) return allowMultiple ? Math.min(10, initialCount) : 1;
    return 1;
  });

  // Reference URLs per function (787 always uses empty references by default)
  const [referenceUrl784, setReferenceUrl784] = useState(initialReferenceUrl || '');
  const [imagesUrls791, setImagesUrls791] = useState(
    initialFunc791Config?.images_urls || initialReferenceUrl || ''
  );

  // Function 787 parameters (quality=auto, background=auto, response_format=url, mode=sync, debug=false fixed)
  const aiModel787 = 'am/flux.2-klein-4b';
  const [size787, setSize787] = useState(initialFunc787Config?.size || '1024x1024');
  const [outputFormat787, setOutputFormat787] = useState(initialFunc787Config?.output_format || 'png');
  const [debug791, setDebug791] = useState(Boolean(initialFunc791Config?.debug));
  const didMountSyncRef = useRef(false);

  // Live generation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number }>({
    current: 1,
    total: 1
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [generatedUrls, setGeneratedUrls] = useState<string[]>([]);
  const [activePreviewIdx, setActivePreviewIdx] = useState(0);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setCost787(dynamicPricing.imageModels.func_787);
    setCost621(dynamicPricing.imageModels.func_621);
    setCost784(dynamicPricing.imageModels.func_784);
    setCost791(dynamicPricing.imageModels.func_791);
  }, [dynamicPricing]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isGenerating) {
      setGenerationSeconds(0);
      timer = setInterval(() => setGenerationSeconds(prev => prev + 1), 1000);
    } else {
      setGenerationSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isGenerating]);

  const buildSyncedConfig = (
    overrideTargetMode?: ImageTargetMode,
    countOverride?: number
  ): ImageBuilderSyncedConfig => {
    const resolvedCount = countOverride ?? (allowMultiple ? imageCount : 1);
    const fallbackTarget: ImageTargetMode =
      resolvedCount <= 1
        ? 'photo'
        : defaultTargetMode && defaultTargetMode !== 'photo'
        ? defaultTargetMode
        : editorFormat === 'rich'
        ? 'slideshow'
        : 'album';

    const activeAspect = mode === 'func_791' ? aspectRatio791 : aspectRatioBasic;
    const activeRef =
      mode === 'func_791'
        ? imagesUrls791.trim()
        : mode === 'func_787'
        ? ''
        : referenceUrl784.trim();

    return {
      mode,
      prompt: prompt,
      promptMode: (promptMode === 'auto' ? 'auto' : 'custom') as 'auto' | 'custom',
      aspectRatio: activeAspect,
      imageCount: resolvedCount,
      targetMode: overrideTargetMode || fallbackTarget,
      referenceUrl: activeRef,
      func787: {
        ai_model: aiModel787,
        size: size787,
        quality: 'auto',
        output_format: outputFormat787,
        response_format: 'url',
        images: '',
        images_url: '',
        background: 'auto',
        mode: 'sync',
        debug: false
      },
      func791: {
        aspect_ratio: aspectRatio791,
        images_urls: imagesUrls791.trim(),
        debug: debug791
      }
    };
  };

  // Emit updates automatically in Scenario mode (skip initial mount to avoid redundant DB write)
  useEffect(() => {
    if (!didMountSyncRef.current) {
      didMountSyncRef.current = true;
      return;
    }
    if (isScenarioMode && onScenarioChange) {
      onScenarioChange(buildSyncedConfig());
    }
  }, [
    isScenarioMode,
    mode,
    prompt,
    promptMode,
    aspectRatioBasic,
    aspectRatio791,
    imageCount,
    referenceUrl784,
    imagesUrls791,
    size787,
    outputFormat787,
    debug791
  ]);

  const getUnitCost = () => {
    if (mode === 'func_787') return cost787;
    if (mode === 'func_621') return cost621;
    if (mode === 'func_784') return cost784;
    return cost791;
  };

  const getFunctionLabel = () => {
    if (mode === 'func_787') return '787 · Без текста';
    if (mode === 'func_621') return '621 · Иллюстрация';
    if (mode === 'func_784') return '784 · Заголовок на обложке';
    return '791 · Инфографика и кириллица';
  };

  const functionOptions = [
    {
      value: 'func_787',
      label: `787 · Быстрый визуал без текста · ${cost787 === 0 ? 'Бесплатно' : `${cost787} Иирок`}`,
      hint: 'Чистая атмосфера, фото и арт без надписей'
    },
    {
      value: 'func_621',
      label: `621 · Детальная иллюстрация · ${cost621} Иирок`,
      hint: 'Сочная композиция с выбором пропорций 16:9, 9:16 или 1:1'
    },
    {
      value: 'func_784',
      label: `784 · Обложка с коротким заголовком · ${cost784} Иирок`,
      hint: 'Крупная надпись на обложке и 1 картинка-референс'
    },
    {
      value: 'func_791',
      label: `791 · Инфографика и любой текст на кириллице · ${cost791} Иирок`,
      hint: 'Умеет всё: диалоги, карточки, инфографику на кириллице без ограничений и до 16 референсов'
    }
  ];

  const batchCountOptions = Array.from(
    { length: defaultTargetMode === 'slideshow' || defaultTargetMode === 'collage' ? 9 : 10 },
    (_, idx) => {
      const num =
        defaultTargetMode === 'slideshow' || defaultTargetMode === 'collage' ? idx + 2 : idx + 1;
      const suffix = num === 1 ? 'картинка' : num <= 4 ? 'картинки' : 'картинок';
      return {
        value: String(num),
        label: `${num} ${suffix}`
      };
    }
  );

  const maxPromptChars = mode === 'func_791' ? 5000 : 1500;

  const refCountActive =
    mode === 'func_791'
      ? imagesUrls791.split(/[\n,]+/).filter(s => s.trim()).length
      : mode === 'func_784'
      ? referenceUrl784.trim()
        ? 1
        : 0
      : 0;

  const paramsSummary =
    mode === 'func_791'
      ? `${aspectRatio791} · 1k${refCountActive ? ` · Референсов: ${refCountActive}` : ''}${
          debug791 ? ' · Отладка' : ''
        }`
      : mode === 'func_787'
      ? `${size787} · ${outputFormat787}`
      : mode === 'func_784'
      ? `${aspectRatioBasic} · 1k${refCountActive ? ' · Референс: 1' : ''}`
      : `${aspectRatioBasic}`;

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setErrorMessage('Генерация остановлена. Потраченный баланс Иирок не возвращается.');
  };

  const runBatchGeneration = async (countToRun: number, appendToExisting: boolean) => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      setErrorMessage(
        isScenarioMode && promptMode === 'auto'
          ? 'Для тестовой генерации введите пример промпта или переключитесь на свой шаблон'
          : 'Напишите описание изображения в поле промпта'
      );
      return;
    }

    const existingCount = appendToExisting ? generatedUrls.length : 0;
    const maxSlots = Math.max(1, 10 - existingCount);
    const effectiveCount = allowMultiple ? Math.min(Math.max(1, countToRun), maxSlots) : 1;

    if (!appendToExisting) {
      setGeneratedUrls([]);
      setActivePreviewIdx(0);
    }

    setIsGenerating(true);
    setErrorMessage('');
    setBatchProgress({ current: 1, total: effectiveCount });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      for (let i = 0; i < effectiveCount; i++) {
        if (controller.signal.aborted) break;
        setBatchProgress({ current: i + 1, total: effectiveCount });

        const variationHint =
          effectiveCount > 1 ? ` (вариант композиции ${i + 1} из ${effectiveCount})` : '';

        const payload: Record<string, any> = {
          mode,
          prompt: `${cleanPrompt}${variationHint}`.slice(0, maxPromptChars),
          userId
        };

        if (mode === 'func_791') {
          payload.aspectRatio = aspectRatio791;
          payload.resolution = '1K';
          payload.debug = debug791;
          if (imagesUrls791.trim()) payload.images_urls = imagesUrls791.trim();
        } else if (mode === 'func_621') {
          payload.aspectRatio = aspectRatioBasic;
        } else if (mode === 'func_784') {
          payload.aspectRatio = aspectRatioBasic;
          payload.resolution = '1K';
          if (referenceUrl784.trim()) payload.referenceUrl = referenceUrl784.trim();
        } else {
          payload.ai_model = aiModel787;
          payload.size = size787;
          payload.quality = 'auto';
          payload.output_format = outputFormat787;
          payload.response_format = 'url';
          payload.background = 'auto';
          payload.generation_mode = 'sync';
          payload.debug = false;
          payload.images = '';
          payload.images_url = '';
        }

        const res = await fetch('/api/ai/image-builder/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId || ''
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Ошибка генерации изображения');
        }

        if (data.imageUrl) {
          setGeneratedUrls(prev => {
            const next = [...prev, data.imageUrl].slice(0, 10);
            setActivePreviewIdx(next.length - 1);
            return next;
          });
          onRefreshUser?.();
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setErrorMessage('Генерация остановлена пользователем.');
      } else {
        setErrorMessage(err.message || 'Не удалось сгенерировать изображение');
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const unitCost = getUnitCost();
  const effectiveBatchCount = allowMultiple ? imageCount : 1;
  const totalCost = unitCost * effectiveBatchCount;

  const metaItems = [
    getFunctionLabel(),
    totalCost === 0 ? 'Бесплатно' : `${totalCost} Иирок`,
    userBalance !== undefined ? `Баланс: ${userBalance} Иирок` : '',
    'Все генерации сохраняются в галерею'
  ].filter(Boolean);

  return (
    <div className="space-y-3.5 min-w-0">
      <UnboxedMetaLine items={metaItems} />

      <div className="space-y-2 min-w-0">
        <div className="text-[14px] font-bold text-slate-900 px-0.5">
          Тип генерации изображения
        </div>
        <div className="grid grid-cols-2 gap-2.5 min-w-0">
          {[
            {
              id: 'func_787' as NormalizedImageFunctionMode,
              title: '787 · Без текста',
              costLabel: cost787 === 0 ? 'Бесплатно' : `${cost787} Иирок`,
              desc: 'Чистый атмосферный визуал и иллюстрация'
            },
            {
              id: 'func_621' as NormalizedImageFunctionMode,
              title: '621 · Иллюстрация',
              costLabel: `${cost621} Иирок`,
              desc: 'Художественный кадр с выбором пропорций'
            },
            {
              id: 'func_784' as NormalizedImageFunctionMode,
              title: '784 · С заголовком',
              costLabel: `${cost784} Иирок`,
              desc: 'Обложка с короткой крупной фразой, 1 референс'
            },
            {
              id: 'func_791' as NormalizedImageFunctionMode,
              title: '791 · Инфографика и кириллица',
              costLabel: `${cost791} Иирок`,
              desc: 'Любые тексты, комиксы, схемы и до 16 референсов'
            }
          ].map((tile) => {
            const isSelected = mode === tile.id;
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => setMode(tile.id)}
                className={`text-left p-[1.5px] rounded-2xl transition-all cursor-pointer min-w-0 ${
                  isSelected
                    ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-sm'
                    : 'bg-pink-300/80 hover:bg-gradient-to-r hover:from-sky-400 hover:via-pink-400 hover:to-orange-400'
                }`}
              >
                <div
                  className={`h-full rounded-[14.5px] p-2.5 sm:p-3 flex flex-col justify-between gap-1.5 min-w-0 ${
                    isSelected
                      ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white'
                      : 'bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 text-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5 flex-wrap">
                    <span className="text-[14px] font-extrabold leading-snug break-words">
                      {tile.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-xl text-[14px] font-bold shrink-0 ${
                        isSelected
                          ? 'bg-white/25 text-white border border-white/40'
                          : 'bg-white/80 text-pink-700 border border-pink-300'
                      }`}
                    >
                      {tile.costLabel}
                    </span>
                  </div>
                  <p
                    className={`text-[14px] leading-snug break-words ${
                      isSelected ? 'text-white/95 font-medium' : 'text-slate-700'
                    }`}
                  >
                    {tile.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {allowMultiple && (
        <div className="min-w-0">
          <GradientSelect
            label="Количество картинок"
            value={String(imageCount)}
            onChange={(val) => setImageCount(Math.max(1, Math.min(10, Number(val) || 1)))}
            options={batchCountOptions}
          />
        </div>
      )}

      {isScenarioMode && onPromptModeChange && (
        <GradientSelect
          label="Источник промпта в сценарии"
          value={promptMode}
          onChange={(val) => onPromptModeChange(val as 'auto' | 'custom')}
          options={[
            {
              value: 'auto',
              label: 'Автоматически по тексту и теме предыдущего шага',
              hint: 'Сценарий сам составит визуальный промпт из входных данных цепочки'
            },
            {
              value: 'custom',
              label: 'Свой шаблон промпта с переменными',
              hint: 'Использует ваш текст и подставляет переменные сценария'
            }
          ]}
        />
      )}

      <div className="space-y-1.5 min-w-0">
        <AutoGrowVoiceTextarea
          label={
            isScenarioMode && promptMode === 'auto'
              ? 'Пожелания к стилю изображения (необязательно)'
              : 'Описание изображения (промпт)'
          }
          minRows={2}
          maxLength={maxPromptChars}
          value={prompt}
          onChange={setPrompt}
          showClearButton={true}
          headerExtra={
            isScenarioMode ? (
              <VariableInsertDropdown
                variables={scenarioVariables}
                onInsert={(token) =>
                  setPrompt((prev) => (prev ? `${prev} ${token}` : token))
                }
              />
            ) : undefined
          }
          placeholder={
            isScenarioMode && promptMode === 'auto'
              ? 'Например: минимализм, пастельные тона, студийное мягкое освещение...'
              : mode === 'func_791'
              ? 'Опишите сцену, стиль, структуру инфографики или точный текст на кириллице (до 5000 символов, без ограничений)...'
              : mode === 'func_784'
              ? 'Опишите сцену и укажите короткую фразу в кавычках для обложки...'
              : 'Опишите композицию, освещение, стиль и детали без текста на картинке...'
          }
        />
        <div className="flex items-center justify-end text-[14px] text-slate-600">
          <span>
            {prompt.length} / {maxPromptChars}
          </span>
        </div>
      </div>

      <CollapsibleSection
        title="Пропорции, параметры и референсы"
        icon={<Sliders className="w-4 h-4" />}
        summary={paramsSummary}
        defaultOpen={false}
      >
        {mode === 'func_791' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <GradientSelect
                label="Соотношение сторон (aspect_ratio)"
                value={aspectRatio791}
                onChange={setAspectRatio791}
                options={ASPECT_RATIO_OPTIONS_791}
                searchable
              />
              <div className="p-2.5 rounded-2xl bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 border border-pink-300 flex items-center justify-between gap-2 min-h-[42px]">
                <span className="text-[14px] text-slate-800 font-medium">
                  Разрешение: 1K · Отладка (debug)
                </span>
                <input
                  type="checkbox"
                  checked={debug791}
                  onChange={(e) => setDebug791(e.target.checked)}
                  className="w-5 h-5 accent-pink-600 cursor-pointer shrink-0"
                />
              </div>
            </div>

            <ReferenceImageSelector
              referenceUrl={imagesUrls791}
              onReferenceUrlChange={setImagesUrls791}
              userId={userId}
              title="Референсы для редактирования (images_urls)"
              maxCount={16}
            />
          </div>
        )}

        {mode === 'func_784' && (
          <div className="space-y-3">
            <GradientSelect
              label="Соотношение сторон"
              value={aspectRatioBasic}
              onChange={(val) => setAspectRatioBasic(val as '16:9' | '9:16' | '1:1')}
              options={ASPECT_RATIO_OPTIONS_BASIC}
            />
            <ReferenceImageSelector
              referenceUrl={referenceUrl784}
              onReferenceUrlChange={setReferenceUrl784}
              userId={userId}
              title="Картинка-референс"
              maxCount={1}
            />
          </div>
        )}

        {mode === 'func_621' && (
          <GradientSelect
            label="Соотношение сторон"
            value={aspectRatioBasic}
            onChange={(val) => setAspectRatioBasic(val as '16:9' | '9:16' | '1:1')}
            options={ASPECT_RATIO_OPTIONS_BASIC}
          />
        )}

        {mode === 'func_787' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GradientSelect
              label="Размер кадра"
              value={size787}
              onChange={setSize787}
              options={SIZE_787_OPTIONS}
            />
            <GradientSelect
              label="Формат файла"
              value={outputFormat787}
              onChange={setOutputFormat787}
              options={FORMAT_787_OPTIONS}
            />
          </div>
        )}
      </CollapsibleSection>

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 border border-rose-300 text-rose-800 text-[14px] font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span className="break-words">{errorMessage}</span>
          </div>
          <button
            type="button"
            disabled={isGenerating || (!prompt.trim() && !(isScenarioMode && promptMode === 'auto'))}
            onClick={() => runBatchGeneration(effectiveBatchCount, false)}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold shadow-xs hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Повторить попытку</span>
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          {onClose && (
            <ResponsiveActionBtn
              icon={<X className="w-4 h-4" />}
              label="Закрыть"
              variant="ghost"
              disabled={isGenerating}
              onClick={onClose}
            />
          )}
          {onSaveConfigOnly && saveConfigButtonLabel && (
            <ResponsiveActionBtn
              icon={<Check className="w-4 h-4" />}
              label={saveConfigButtonLabel}
              variant="secondary"
              disabled={isGenerating}
              onClick={() => onSaveConfigOnly(buildSyncedConfig())}
            />
          )}
        </div>

        <ResponsiveActionBtn
          icon={<Wand2 className="w-4 h-4" />}
          label={
            isScenarioMode
              ? `Протестировать генерацию (${totalCost === 0 ? '0' : totalCost} Иирок)`
              : effectiveBatchCount > 1
              ? `Сгенерировать ${effectiveBatchCount} шт. (${totalCost === 0 ? 'бесплатно' : `${totalCost} Иирок`})`
              : `Сгенерировать (${totalCost === 0 ? 'бесплатно' : `${totalCost} Иирок`})`
          }
          alwaysShowLabel
          variant="primary"
          disabled={isGenerating || (!prompt.trim() && !(isScenarioMode && promptMode === 'auto'))}
          onClick={() => runBatchGeneration(effectiveBatchCount, false)}
        />
      </div>

      <ImageBuilderResultBlock
        generatedUrls={generatedUrls}
        activeIndex={activePreviewIdx}
        onSelectIndex={setActivePreviewIdx}
        onRemoveIndex={(idx) => {
          setGeneratedUrls(prev => {
            const next = prev.filter((_, i) => i !== idx);
            setActivePreviewIdx(cur => Math.min(cur, Math.max(0, next.length - 1)));
            return next;
          });
        }}
        onClearAll={() => {
          setGeneratedUrls([]);
          setActivePreviewIdx(0);
        }}
        onOpenFullscreen={() => setIsFullscreenPreview(true)}
        onGenerateMore={() => runBatchGeneration(1, true)}
        isGenerating={isGenerating}
        allowMultiple={allowMultiple}
        editorFormat={editorFormat}
        defaultTargetMode={defaultTargetMode}
        onApply={(targetMode, singleOnly = false) => {
          if (generatedUrls.length === 0) return;
          const safeIdx = Math.min(activePreviewIdx, generatedUrls.length - 1);
          const chosen = singleOnly ? [generatedUrls[safeIdx]] : generatedUrls;
          const synced = buildSyncedConfig(targetMode, chosen.length);
          if (onApplyResult) {
            onApplyResult(chosen, targetMode, synced);
          } else if (isScenarioMode && onScenarioChange) {
            onScenarioChange(synced);
          }
        }}
      />

      <ImageBuilderWaitingModal
        isOpen={isGenerating}
        functionName={getFunctionLabel()}
        generationSeconds={generationSeconds}
        batchCurrent={batchProgress.current}
        batchTotal={batchProgress.total}
        prompt={prompt || 'Тестовый запрос'}
        onStop={handleStopGeneration}
      />

      <ImageBuilderFullscreenModal
        isOpen={isFullscreenPreview}
        urls={generatedUrls}
        activeIndex={activePreviewIdx}
        onChangeIndex={setActivePreviewIdx}
        onClose={() => setIsFullscreenPreview(false)}
      />
    </div>
  );
};
