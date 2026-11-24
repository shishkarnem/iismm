import React, { useState } from 'react';
import { ChevronDown, FolderOpen, Layers, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { GradientSelect } from '../../../ui-kit/GradientDropdown';
import { ResponsiveActionBtn } from '../../../ui-kit/ResponsiveActionBtn';
import { FileUpload } from '../../../FileUpload';
import { formatAbsoluteUrl } from '../../../../utils/urlUtils';
import { usePricingConfig } from '../../../../hooks/usePricingConfig';

export interface CascadingGeneratedSlide {
  index: number;
  url: string;
  caption: string;
  prompt: string;
}

interface CascadingCarouselPanelProps {
  userId?: string;
  initialIdea?: string;
  onPickRefFromGallery: (cb: (url: string) => void) => void;
  onSlidesGenerated: (slides: { url: string; caption: string }[]) => void;
}

export const CascadingCarouselPanel: React.FC<CascadingCarouselPanelProps> = ({
  userId,
  initialIdea = '',
  onPickRefFromGallery,
  onSlidesGenerated
}) => {
  const [expanded, setExpanded] = useState(true);
  const [slideCount, setSlideCount] = useState<string>('4');
  // Strictly ONLY models supporting reference images: func_791 (16 refs) and func_784 (4 refs)
  const [functionMode, setFunctionMode] = useState<'func_791' | 'func_784'>('func_791');
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [referenceMode, setReferenceMode] = useState<'first_slide_anchor' | 'custom_ref'>('first_slide_anchor');
  const [referenceUrl, setReferenceUrl] = useState<string>('');
  const [storyPrompt, setStoryPrompt] = useState<string>(initialIdea);
  const [slidePrompts, setSlidePrompts] = useState<string[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string>('');
  const [previewSlides, setPreviewSlides] = useState<CascadingGeneratedSlide[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const { pricing } = usePricingConfig(userId);
  const cost791 = pricing.imageModels.func_791;
  const cost784 = pricing.imageModels.func_784;
  const numericCount = Math.max(2, Math.min(10, Number(slideCount) || 4));
  const costPerSlide = functionMode === 'func_791' ? cost791 : cost784;
  const totalCostEstimate = costPerSlide * numericCount;

  const slideCountOptions = Array.from({ length: 9 }, (_, i) => {
    const n = i + 2;
    const word = n <= 4 ? 'слайда' : 'слайдов';
    return { value: String(n), label: `${n} ${word}` };
  });

  const modelOptions = [
    {
      value: 'func_791',
      label: `Pro: gpt-image-2.5-sunburst · ${cost791} Иирок/кадр`,
      sublabel: 'До 16 референсов — максимальная цельность стиля и деталей'
    },
    {
      value: 'func_784',
      label: `С текстом: flux-3-image-klein · ${cost784} Иирок/кадр`,
      sublabel: 'До 4 референсов — точный русский текст на карточках карусели'
    }
  ];

  const aspectOptions = [
    ...(functionMode === 'func_791' ? [{ value: 'auto', label: 'Автоматический (auto)' }] : []),
    { value: '1:1', label: 'Квадрат (1:1)' },
    { value: '16:9', label: 'Горизонтальный (16:9)' },
    { value: '9:16', label: 'Вертикальный (9:16)' },
    { value: '4:5', label: 'Портретный (4:5)' },
    { value: '3:2', label: 'Альбомный (3:2)' },
    { value: '2:3', label: 'Книжный (2:3)' }
  ];

  const referenceModeOptions = [
    {
      value: 'first_slide_anchor',
      label: 'Первый кадр как референс для следующих',
      sublabel: 'Кадр 1 задаёт общий визуальный стиль, кадры 2–N наследуют его каскадно'
    },
    {
      value: 'custom_ref',
      label: 'Своя картинка-референс (ссылка / файл / галерея)',
      sublabel: 'Единый стиль с вашим исходным образом для всей серии'
    }
  ];

  const handlePlanScenes = async () => {
    setErrorMsg('');
    setIsPlanning(true);
    try {
      const res = await fetch('/api/ai/image-builder/carousel-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyPrompt: storyPrompt.trim() || 'История продукта и его ключевые преимущества',
          slideCount: numericCount,
          userId
        })
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.prompts)) {
        throw new Error(data.error || 'Не удалось расписать кадры истории');
      }
      setSlidePrompts(data.prompts.slice(0, numericCount));
    } catch (e: any) {
      setErrorMsg(e?.message || 'Ошибка составления сценария карусели');
    } finally {
      setIsPlanning(false);
    }
  };

  const handleGenerateCascade = async () => {
    setErrorMsg('');
    if (referenceMode === 'custom_ref' && !referenceUrl.trim()) {
      setErrorMsg('Добавьте ссылку на картинку-референс, загрузите файл или выберите из галереи.');
      return;
    }
    if (!storyPrompt.trim() && slidePrompts.filter((p) => p.trim()).length === 0) {
      setErrorMsg('Опишите общую идею истории или распишите кадры перед запуском.');
      return;
    }

    setIsGenerating(true);
    setPreviewSlides([]);
    setProgressLabel(`Подготовка каскадной генерации (${numericCount} кадров)...`);

    try {
      const response = await fetch('/api/ai/image-builder/carousel-cascade?stream=1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream'
        },
        body: JSON.stringify({
          storyPrompt: storyPrompt.trim(),
          slideCount: numericCount,
          functionMode,
          aspectRatio: functionMode === 'func_784' && aspectRatio === 'auto' ? '1:1' : aspectRatio,
          referenceMode,
          referenceUrl: referenceUrl.trim(),
          slidePrompts: slidePrompts.length > 0 ? slidePrompts : undefined,
          userId,
          stream: true
        })
      });

      if (!response.body) {
        throw new Error('Поток генерации недоступен');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalSlides: CascadingGeneratedSlide[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          const dataLine = chunk
            .split('\n')
            .find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const jsonStr = dataLine.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const ev = JSON.parse(jsonStr);
            if (ev.type === 'plan_ready' && Array.isArray(ev.prompts)) {
              setSlidePrompts(ev.prompts);
              setProgressLabel(`Сценарий готов · старт кадра 1 из ${ev.prompts.length}`);
            } else if (ev.type === 'slide_start') {
              setProgressLabel(`Генерация кадра ${ev.index} из ${ev.total}...`);
            } else if (ev.type === 'slide_done' && ev.slide) {
              setPreviewSlides((prev) => {
                const updated = [...prev.filter((s) => s.index !== ev.slide.index), ev.slide];
                finalSlides = updated;
                return updated;
              });
              setProgressLabel(`Готово кадров: ${ev.index} из ${ev.total}`);
            } else if (ev.type === 'done' && Array.isArray(ev.slides)) {
              finalSlides = ev.slides;
              setPreviewSlides(ev.slides);
              setProgressLabel(`Серия готова (${ev.slides.length} кадров · ${ev.totalCost} Иирок)`);
            } else if (ev.type === 'error') {
              setErrorMsg(ev.error || 'Ошибка при генерации кадра');
            }
          } catch {
            // ignore partial JSON chunk
          }
        }
      }

      if (finalSlides.length > 0) {
        onSlidesGenerated(
          finalSlides.map((s) => ({
            url: s.url,
            caption: s.caption || `Кадр ${s.index}`
          }))
        );
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Сбой каскадной генерации карусели');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-pink-300/85 bg-gradient-to-br from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 overflow-hidden shadow-2xs">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full px-3.5 py-3 flex items-center justify-between gap-2 text-left cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white flex items-center justify-center shrink-0">
            <Layers size={16} />
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-bold text-slate-900 break-words">
              Сюжетная каскадная генерация (2–10 слайдов в едином стиле)
            </div>
            <div className="text-[14px] text-slate-700 break-words">
              Модели с референсами: Pro 791 и С текстом 784 · Оценка: {totalCostEstimate} Иирок
            </div>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-pink-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 pt-2 border-t border-pink-300/70 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GradientSelect
              compact
              label="Количество слайдов"
              value={slideCount}
              onChange={(val) => setSlideCount(val)}
              options={slideCountOptions}
            />
            <GradientSelect
              compact
              label="Соотношение сторон"
              value={aspectRatio}
              onChange={(val) => setAspectRatio(val)}
              options={aspectOptions}
            />
          </div>

          <GradientSelect
            compact
            label="Нейросеть с поддержкой референсов"
            value={functionMode}
            onChange={(val) => {
              const next = val as 'func_791' | 'func_784';
              setFunctionMode(next);
              if (next === 'func_784' && aspectRatio === 'auto') {
                setAspectRatio('1:1');
              }
            }}
            options={modelOptions}
          />

          <GradientSelect
            compact
            label="Источник единого стиля (референс)"
            value={referenceMode}
            onChange={(val) => setReferenceMode(val as 'first_slide_anchor' | 'custom_ref')}
            options={referenceModeOptions}
          />

          {referenceMode === 'custom_ref' && (
            <div className="p-3 rounded-2xl bg-white/75 border border-pink-300/80 space-y-2.5">
              <label className="block text-[14px] font-bold text-slate-900">
                Референс-изображение для всей серии
              </label>
              <div className="flex items-center gap-2.5 flex-wrap">
                {referenceUrl.trim() && (
                  <img
                    src={referenceUrl}
                    alt="Референс"
                    className="w-12 h-12 rounded-xl object-cover border border-pink-300 shrink-0"
                  />
                )}
                <input
                  type="text"
                  value={referenceUrl}
                  onChange={(e) => setReferenceUrl(e.target.value)}
                  placeholder="https://... ссылка на референс"
                  className="flex-1 min-w-[180px] px-3 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <FileUpload
                  variant="compact"
                  accept="image/*"
                  buttonLabel="Загрузить файл"
                  onUploaded={(_k, url) => {
                    const finalUrl = formatAbsoluteUrl(url);
                    if (finalUrl) setReferenceUrl(finalUrl);
                  }}
                />
                <ResponsiveActionBtn
                  icon={<FolderOpen size={15} />}
                  label="Из галереи"
                  variant="outline"
                  onClick={() => onPickRefFromGallery((url) => setReferenceUrl(url))}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[14px] font-bold mb-1 text-slate-900">
              Общая идея связанной истории и визуальный стиль
            </label>
            <textarea
              rows={2}
              value={storyPrompt}
              onChange={(e) => setStoryPrompt(e.target.value)}
              placeholder="Например: путь от идеи к запуску кофейни, тёплый редакционный фотореализм в пастельных тонах"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ResponsiveActionBtn
              icon={isPlanning ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
              label={isPlanning ? 'Планирование...' : `Расписать кадры (${numericCount} сцен)`}
              alwaysShowLabel
              disabled={isPlanning || isGenerating}
              variant="outline"
              onClick={handlePlanScenes}
            />
            <ResponsiveActionBtn
              icon={isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              label={
                isGenerating
                  ? progressLabel || 'Генерация серии...'
                  : `Сгенерировать сюжетную карусель (${totalCostEstimate} Иирок)`
              }
              alwaysShowLabel
              disabled={isGenerating}
              variant="vivid"
              onClick={handleGenerateCascade}
            />
          </div>

          {slidePrompts.length > 0 && (
            <div className="space-y-2 p-3 rounded-2xl bg-white/75 border border-pink-300/75">
              <div className="text-[14px] font-bold text-slate-900">
                Сценарий кадров (можно отредактировать перед запуском)
              </div>
              {Array.from({ length: numericCount }, (_, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-2 text-[14px] font-bold text-pink-700 shrink-0 w-7">
                    {i + 1}.
                  </span>
                  <textarea
                    rows={2}
                    value={slidePrompts[i] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSlidePrompts((prev) => {
                        const copy = Array.from({ length: numericCount }, (__, idx) => prev[idx] || '');
                        copy[i] = val;
                        return copy;
                      });
                    }}
                    placeholder={`Описание кадра ${i + 1}`}
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-white/90 border border-pink-200 text-[14px] text-slate-900 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}

          {progressLabel && (
            <div className="text-[14px] font-semibold text-pink-700 break-words">
              {progressLabel}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50/90 border border-rose-300 text-[14px] font-semibold text-rose-800 break-words">
              {errorMsg}
            </div>
          )}

          {previewSlides.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {previewSlides.map((s) => (
                <div
                  key={s.index}
                  className="rounded-xl overflow-hidden border border-pink-300/80 bg-white/85"
                >
                  <img
                    src={s.url}
                    alt={`Кадр ${s.index}`}
                    className="w-full h-24 object-cover"
                  />
                  <div className="px-2 py-1 text-[14px] font-semibold text-slate-800 truncate">
                    Кадр {s.index}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
