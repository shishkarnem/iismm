import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Type,
  Palette,
  BookOpen,
  Eye,
  Edit3,
  Check,
  X,
  FileText
} from 'lucide-react';
import {
  POST_STYLES,
  PostStyleItem,
  CHAR_LIMIT_OPTIONS_V2,
  CHAR_LIMIT_OPTIONS_V2_MEDIA,
  CHAR_LIMIT_OPTIONS_RICH
} from '../../post-editor/core/postStylesData';
import { ChannelStyleAnalyzerModal } from '../../post-generator/ChannelStyleAnalyzerModal';
import {
  GradientSelect,
  VariableInsertDropdown,
  DEFAULT_SCENARIO_VARIABLES
} from '../../ui-kit/GradientDropdown';
import { CollapsibleSection } from '../../ui-kit/CollapsibleSection';
import { ResponsiveActionBtn } from '../../ui-kit/ResponsiveActionBtn';
import { AutoGrowVoiceTextarea } from '../../ui-kit/AutoGrowVoiceTextarea';
import { OnboardingFormattedTextField } from '../../onboarding-preview/OnboardingFormattedTextField';
import {
  HEADING_DECOR_OPTIONS,
  V2_LAYOUT_PRESETS,
  RICH_LAYOUT_PRESETS,
  V2_FONT_GUIDE,
  RICH_FONT_GUIDE,
  buildBeautyPostLivePreview
} from './beautyPostPresets';
import { usePricingConfig } from '../../../hooks/usePricingConfig';
import { formatIirkyCount } from '../../../shared/pricingConfig';

const CUSTOM_STYLES_STORAGE_KEY = 'iismm_custom_styles';

interface BeautyPostConfigProps {
  config: Record<string, any>;
  scenarioFormat: 'v2' | 'rich';
  hasMediaAttachment?: boolean;
  scenarioCategory?: string;
  activeUserId?: string;
  embeddedInTextGenerator?: boolean;
  onUpdateConfig: (patch: Record<string, any>, immediateSave?: boolean) => void;
}

export const BeautyPostConfig: React.FC<BeautyPostConfigProps> = ({
  config,
  scenarioFormat,
  hasMediaAttachment = false,
  scenarioCategory,
  activeUserId,
  embeddedInTextGenerator = false,
  onUpdateConfig
}) => {
  const { pricing } = usePricingConfig(activeUserId);
  const beautyAiCostLabel = formatIirkyCount(pricing.textAi.beautyPostAi);
  const [customStyles, setCustomStyles] = useState<PostStyleItem[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_STYLES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [isEditingStylePrompt, setIsEditingStylePrompt] = useState(false);
  const [draftStylePrompt, setDraftStylePrompt] = useState('');
  const [isAnalyzerOpen, setIsAnalyzerOpen] = useState(false);
  const [previewFormatTab, setPreviewFormatTab] = useState<'v2' | 'rich'>(scenarioFormat);

  useEffect(() => {
    setPreviewFormatTab(scenarioFormat);
  }, [scenarioFormat]);

  useEffect(() => {
    const uid = String(activeUserId || '').trim();
    const qs = uid ? `?userId=${encodeURIComponent(uid)}` : '';
    fetch(`/api/post-styles${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.styles)) return;
        setCustomStyles((prev) => {
          const map = new Map<string, PostStyleItem>();
          prev.forEach((s) => map.set(s.id, s));
          data.styles.forEach((s: PostStyleItem) => map.set(s.id, s));
          const merged = Array.from(map.values());
          try {
            localStorage.setItem(CUSTOM_STYLES_STORAGE_KEY, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      })
      .catch(() => {});
  }, [activeUserId]);

  const allStyles = useMemo(() => [...POST_STYLES, ...customStyles], [customStyles]);
  const selectedStyle = useMemo(() => {
    const targetId = String(config?.postStyleId || config?.postStyle || 'expert');
    return (
      allStyles.find((s) => s.id === targetId || s.title === targetId) ||
      allStyles[0]
    );
  }, [allStyles, config?.postStyleId, config?.postStyle]);

  const activeEngine = config?.formattingEngine === 'smart_rules' ? 'smart_rules' : 'ai_stylist';
  const includeHeading =
    config?.includeTopicHeading !== undefined
      ? Boolean(config.includeTopicHeading)
      : config?.richIncludeHeadings !== false;
  const headingDecor = String(config?.headingDecor || 'sparkle');
  const headingTemplate = String(config?.topicHeadingTemplate ?? '{{topic}}');

  const activePresets = previewFormatTab === 'rich' ? RICH_LAYOUT_PRESETS : V2_LAYOUT_PRESETS;
  const currentPresetId =
    previewFormatTab === 'rich'
      ? String(config?.richLayoutPreset || 'editorial_longread')
      : String(config?.v2LayoutPreset || 'magazine_v2');
  const activePreset =
    activePresets.find((p) => p.id === currentPresetId) || activePresets[0];

  const v2LimitOptions = hasMediaAttachment
    ? CHAR_LIMIT_OPTIONS_V2_MEDIA
    : CHAR_LIMIT_OPTIONS_V2;
  const currentCharLimit = useMemo(() => {
    if (previewFormatTab === 'rich') {
      const raw = Number(config?.maxCharsRich ?? config?.maxChars ?? 10000);
      const exact = CHAR_LIMIT_OPTIONS_RICH.find((o) => Number(o.value) === raw);
      if (exact) return exact.value;
      const closest = CHAR_LIMIT_OPTIONS_RICH.reduce((prev, curr) =>
        Math.abs(Number(curr.value) - raw) < Math.abs(Number(prev.value) - raw) ? curr : prev
      );
      return closest.value;
    }
    const maxV2Cap = hasMediaAttachment ? 1024 : 4096;
    const defaultV2 = hasMediaAttachment ? 800 : 2500;
    const raw = Math.min(maxV2Cap, Math.max(500, Number(config?.maxCharsV2 ?? config?.maxChars ?? defaultV2)));
    const exact = v2LimitOptions.find((o) => Number(o.value) === raw);
    if (exact) return exact.value;
    const closest = v2LimitOptions.reduce((prev, curr) =>
      Math.abs(Number(curr.value) - raw) < Math.abs(Number(prev.value) - raw) ? curr : prev
    );
    return closest.value;
  }, [previewFormatTab, hasMediaAttachment, config?.maxCharsRich, config?.maxCharsV2, config?.maxChars, v2LimitOptions]);

  const livePreview = useMemo(
    () =>
      buildBeautyPostLivePreview(
        config,
        previewFormatTab,
        scenarioCategory
          ? `${scenarioCategory}: 5 практических приемов для роста канала`
          : 'Как выстроить автопостинг с живым авторским стилем',
        selectedStyle?.title || 'Экспертный'
      ),
    [config, previewFormatTab, scenarioCategory, selectedStyle]
  );

  const handleSaveCustomStyle = () => {
    const cleanPrompt = draftStylePrompt.trim();
    if (!cleanPrompt) return;

    const existingCustom = customStyles.find((s) => s.id === selectedStyle.id);
    const targetId = existingCustom
      ? selectedStyle.id
      : `custom_${selectedStyle.id}_${Date.now()}`;
    const savedItem: PostStyleItem = existingCustom
      ? { ...existingCustom, prompt: cleanPrompt, isCustom: true }
      : {
          id: targetId,
          title: `✨ ${selectedStyle.title} (свой)`,
          desc: 'Авторский стиль оформления для сценариев и постов',
          prompt: cleanPrompt,
          isCustom: true
        };

    const nextList = existingCustom
      ? customStyles.map((s) => (s.id === targetId ? savedItem : s))
      : [...customStyles, savedItem];

    setCustomStyles(nextList);
    try {
      localStorage.setItem(CUSTOM_STYLES_STORAGE_KEY, JSON.stringify(nextList));
    } catch {}

    fetch('/api/post-styles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: savedItem.id,
        userId: String(activeUserId || 'global'),
        title: savedItem.title,
        desc: savedItem.desc,
        prompt: savedItem.prompt
      })
    }).catch(() => {});

    onUpdateConfig(
      {
        postStyleId: savedItem.id,
        postStyle: savedItem.title,
        stylePromptOverride: cleanPrompt
      },
      true
    );
    setIsEditingStylePrompt(false);
  };

  const fontGuide = previewFormatTab === 'rich' ? RICH_FONT_GUIDE : V2_FONT_GUIDE;

  return (
    <div className="space-y-4 min-w-0 text-[14px]">
      {/* Engine & Mode */}
      {!embeddedInTextGenerator && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300 space-y-3 min-w-0">
          <GradientSelect
            label="Режим художественного оформления поста"
            value={activeEngine}
            onChange={(val) => onUpdateConfig({ formattingEngine: val }, true)}
            options={[
              {
                value: 'ai_stylist',
                label: `✨ Нейро-верстка по фирменному стилю и шрифтам (${beautyAiCostLabel})`,
                hint: 'Применяет выбранный стиль конструктора или канала, расставляет акценты, шрифты и заголовок темы'
              },
              {
                value: 'smart_rules',
                label: '⚡ Быстрая структурная верстка по правилам (Бесплатно)',
                hint: 'Мгновенно добавляет красивый заголовок со сгенерированной темой, абзацы и разметку без списания'
              }
            ]}
          />
        </div>
      )}

      {/* Topic Heading Block */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300 space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Type size={17} className="text-pink-600 shrink-0" />
            <span className="font-bold text-slate-900">
              Заголовок поста со сгенерированной темой
            </span>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
            <span className="text-[14px] font-semibold text-slate-800">Включен</span>
            <input
              type="checkbox"
              checked={includeHeading}
              onChange={(e) =>
                onUpdateConfig(
                  {
                    includeTopicHeading: e.target.checked,
                    richIncludeHeadings: e.target.checked
                  },
                  true
                )
              }
              className="w-5 h-5 accent-pink-600 cursor-pointer"
            />
          </label>
        </div>

        {includeHeading && (
          <div className="space-y-3 pt-1 min-w-0">
            <GradientSelect
              label="Подача заголовка сверху поста"
              value={headingDecor}
              onChange={(val) => onUpdateConfig({ headingDecor: val }, true)}
              options={HEADING_DECOR_OPTIONS}
            />

            <AutoGrowVoiceTextarea
              label="Шаблон заголовка (подставляет тему из генератора тем)"
              value={headingTemplate}
              onChange={(val) => onUpdateConfig({ topicHeadingTemplate: val }, false)}
              onBlur={() =>
                onUpdateConfig(
                  { topicHeadingTemplate: headingTemplate.trim() || '{{topic}}' },
                  true
                )
              }
              minRows={2}
              showClearButton
              placeholder="{{topic}}"
              headerExtra={
                <VariableInsertDropdown
                  variables={DEFAULT_SCENARIO_VARIABLES}
                  onInsert={(token) => {
                    const next = headingTemplate ? `${headingTemplate} ${token}` : token;
                    onUpdateConfig({ topicHeadingTemplate: next }, true);
                  }}
                />
              }
            />
          </div>
        )}
      </div>

      {/* Style from Post Constructor & Channel Analyzer */}
      {!embeddedInTextGenerator && (
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300 space-y-3 min-w-0">
        <div className="flex items-center gap-2">
          <Palette size={17} className="text-pink-600 shrink-0" />
          <span className="font-bold text-slate-900">
            Стиль из конструктора постов или вашего канала
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-2 min-w-0">
          <div className="flex-1 min-w-0">
            <GradientSelect
              label="Выбранный стиль оформления и тональности"
              value={selectedStyle.id}
              searchable
              onChange={(id) => {
                const chosen = allStyles.find((s) => s.id === id);
                if (chosen) {
                  onUpdateConfig(
                    {
                      postStyleId: chosen.id,
                      postStyle: chosen.title,
                      stylePromptOverride: chosen.prompt
                    },
                    true
                  );
                }
              }}
              options={allStyles.map((s) => ({
                value: s.id,
                label: s.title,
                hint: s.desc
              }))}
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <ResponsiveActionBtn
              icon={<Edit3 className="w-4 h-4" />}
              label="Промпт"
              title="Настроить или сохранить свой вариант стиля"
              variant="secondary"
              onClick={() => {
                setDraftStylePrompt(
                  String(config?.stylePromptOverride || selectedStyle?.prompt || '')
                );
                setIsEditingStylePrompt((prev) => !prev);
              }}
            />
            <ResponsiveActionBtn
              icon={<Sparkles className="w-4 h-4" />}
              label="Из канала"
              title="Сформировать фирменный стиль по примерам постов вашего канала"
              variant="vivid"
              onClick={() => setIsAnalyzerOpen(true)}
            />
          </div>
        </div>

        {isEditingStylePrompt && (
          <div className="p-3 rounded-2xl bg-white/75 border border-pink-300 space-y-2 min-w-0">
            <AutoGrowVoiceTextarea
              label="Правила выбранного стиля"
              value={draftStylePrompt}
              onChange={(val) => setDraftStylePrompt(val)}
              minRows={2}
              showClearButton
              placeholder="Опишите подачу, длину предложений, ритм, допустимые эмодзи и акценты..."
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ResponsiveActionBtn
                icon={<X className="w-4 h-4" />}
                label="Скрыть"
                variant="ghost"
                onClick={() => setIsEditingStylePrompt(false)}
              />
              <ResponsiveActionBtn
                icon={<Check className="w-4 h-4" />}
                label="Сохранить в мои стили"
                variant="primary"
                onClick={handleSaveCustomStyle}
              />
            </div>
          </div>
        )}
      </div>
      )}

      {/* Format-Specific Layout Rules: Distinct v2 vs Rich */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300 space-y-3 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={17} className="text-pink-600 shrink-0" />
            <span className="font-bold text-slate-900">
              Правила верстки и шрифты ({previewFormatTab === 'rich' ? 'Rich' : 'v2'})
            </span>
          </div>

          {!embeddedInTextGenerator && (
            <div className="grid grid-cols-2 gap-1.5 sm:w-auto w-full shrink-0">
              <button
                type="button"
                onClick={() => setPreviewFormatTab('v2')}
                className={`px-3 py-1.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer border ${
                  previewFormatTab === 'v2'
                    ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-transparent shadow-xs'
                    : 'bg-white/80 text-slate-800 border-pink-300 hover:bg-white'
                }`}
              >
                Правила v2{scenarioFormat === 'v2' ? ' (активен)' : ''}
              </button>
              <button
                type="button"
                onClick={() => setPreviewFormatTab('rich')}
                className={`px-3 py-1.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer border ${
                  previewFormatTab === 'rich'
                    ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-transparent shadow-xs'
                    : 'bg-white/80 text-slate-800 border-pink-300 hover:bg-white'
                }`}
              >
                Правила Rich{scenarioFormat === 'rich' ? ' (активен)' : ''}
              </button>
            </div>
          )}
        </div>

        <GradientSelect
          label={
            previewFormatTab === 'rich'
              ? 'Макет оформления статьи Rich'
              : 'Макет оформления поста v2'
          }
          value={activePreset.id}
          onChange={(val) =>
            onUpdateConfig(
              previewFormatTab === 'rich'
                ? { richLayoutPreset: val }
                : { v2LayoutPreset: val },
              true
            )
          }
          options={activePresets.map((p) => ({
            value: p.id,
            label: p.title,
            hint: p.shortHint
          }))}
        />

        {!embeddedInTextGenerator && (
          <div className="space-y-2 pt-1">
            <GradientSelect
              label={
                previewFormatTab === 'rich'
                  ? 'Лимит и объём текста после оформления (Rich, до 32 000 симв.)'
                  : hasMediaAttachment
                  ? 'Лимит и объём подписи к медиа после оформления (Telegram v2, до 1 024 симв.)'
                  : 'Лимит и объём текста после оформления (Telegram v2, до 4 096 симв.)'
              }
              value={currentCharLimit}
              onChange={(val) => {
                const numVal = Number(val);
                const patch: Record<string, any> =
                  previewFormatTab === 'rich'
                    ? { maxCharsRich: numVal }
                    : { maxCharsV2: numVal };
                if (previewFormatTab === scenarioFormat) {
                  patch.maxChars = numVal;
                }
                onUpdateConfig(patch, true);
              }}
              options={previewFormatTab === 'rich' ? CHAR_LIMIT_OPTIONS_RICH : v2LimitOptions}
            />
            {previewFormatTab === 'v2' && hasMediaAttachment && (
              <div className="px-3 py-2 rounded-xl bg-amber-100/80 border border-amber-300 text-amber-950 text-[13px] leading-snug">
                В цепочке сценария есть медиа-вложение или генерация картинки — Telegram ограничивает подпись под медиа формата v2 до <b>1 024 символов</b> (с запасом под подпись канала).
              </div>
            )}
          </div>
        )}

        {/* Preset rules list */}
        <div className="p-3 rounded-xl bg-white/70 border border-pink-200 space-y-1.5">
          <div className="font-bold text-slate-900">
            Что делает макет «{activePreset.title}»:
          </div>
          <ul className="space-y-1 text-slate-800">
            {activePreset.rules.map((r, i) => (
              <li key={i} className="flex items-start gap-2 leading-snug">
                <span className="text-pink-600 font-bold shrink-0">•</span>
                <span className="break-words">{r}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {activePreset.fontsUsed.map((tag, idx) => (
              <span
                key={idx}
                className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-sky-100/90 via-pink-100/90 to-orange-100/90 border border-pink-300 font-mono text-[14px] text-slate-900"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Distinct Checkboxes for v2 vs Rich */}
        {previewFormatTab === 'v2' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { key: 'v2UseBoldAccents', label: 'Жирные смысловые акценты <b>', defVal: true },
              { key: 'v2UseItalicLead', label: 'Курсивная подводка <i>', defVal: true },
              { key: 'v2UseMonospace', label: 'Моноширинные цифры и коды <code>', defVal: true },
              { key: 'v2UseBlockquote', label: 'Выделенная блок-цитата <blockquote>', defVal: true },
              { key: 'v2UseSpoiler', label: 'Интригующий спойлер <tg-spoiler>', defVal: false },
              { key: 'v2UseEmojiBullets', label: 'Аккуратные эмодзи-буллиты списков', defVal: true }
            ].map((item) => {
              const checked =
                config?.[item.key] === undefined ? item.defVal : Boolean(config[item.key]);
              return (
                <label
                  key={item.key}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/75 border border-pink-300 cursor-pointer"
                >
                  <span className="text-[14px] font-medium text-slate-900 break-words">
                    {item.label}
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onUpdateConfig({ [item.key]: e.target.checked }, true)}
                    className="w-5 h-5 accent-pink-600 cursor-pointer shrink-0"
                  />
                </label>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { key: 'richUseSubheadings', label: 'Подзаголовки глав ## по смыслу', defVal: true },
              { key: 'richUseBoldItalic', label: 'Контраст жирного и курсива', defVal: true },
              { key: 'richUseBlockquote', label: 'Глубокая врезка-цитата >', defVal: true },
              { key: 'richUseChecklist', label: 'Интерактивный чек-лист [x] / [ ]', defVal: true },
              { key: 'richUseTable', label: 'Сравнительная таблица показателей', defVal: false },
              { key: 'richUseDividers', label: 'Горизонтальные разделители глав ---', defVal: true }
            ].map((item) => {
              const checked =
                config?.[item.key] === undefined ? item.defVal : Boolean(config[item.key]);
              return (
                <label
                  key={item.key}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/75 border border-pink-300 cursor-pointer"
                >
                  <span className="text-[14px] font-medium text-slate-900 break-words">
                    {item.label}
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onUpdateConfig({ [item.key]: e.target.checked }, true)}
                    className="w-5 h-5 accent-pink-600 cursor-pointer shrink-0"
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Reference Format Example with Selection Markup Constructor (V2 / Rich) */}
      {(() => {
        const exampleKey = previewFormatTab === 'rich' ? 'formatExampleRich' : 'formatExampleV2';
        const exampleVal = String(
          config?.[exampleKey] ?? config?.formatExample ?? ''
        );
        return (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300 space-y-2.5 min-w-0">
            <OnboardingFormattedTextField
              label={`Эталонный пример формата поста (${previewFormatTab === 'rich' ? 'Rich' : 'v2'}) для нейросети`}
              value={exampleVal}
              onChange={(val) => onUpdateConfig({ [exampleKey]: val }, false)}
              onBlur={() => onUpdateConfig({ [exampleKey]: exampleVal }, true)}
              format={previewFormatTab}
              userId={activeUserId}
              minRows={5}
              placeholder={
                previewFormatTab === 'rich'
                  ? 'Вставьте пример поста и выделите нужные слова для добавления заголовков #, таблиц, цитат, кнопок <tg-button>, коллажей и списков Rich...'
                  : 'Вставьте пример поста и выделите слова мышкой или пальцем — откроется панель разметки Telegram V2 (жирный, курсив, моноширинный, спойлер, цитата, ссылки)...'
              }
              hintText={
                previewFormatTab === 'rich'
                  ? 'Выделите фрагмент текста, чтобы оформить пример в Rich-разметке (заголовки #, таблицы, чек-листы, цитаты, медиа, инлайн-кнопки). Нейросеть повторит эту структуру.'
                  : 'Выделите фрагмент текста, чтобы оформить пример тегами V2 (<b>, <i>, <code>, <blockquote>, <tg-spoiler>, ссылки). Нейросеть повторит структуру без решеток # и с соблюдением лимитов V2.'
              }
              extraHeaderActions={
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() =>
                      onUpdateConfig({ [exampleKey]: livePreview.rawSample }, true)
                    }
                    className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs hover:brightness-105"
                    title="Подставить шаблон на основе выбранного макета и галочек"
                  >
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>Взять из макета</span>
                  </button>
                  {exampleVal.trim().length > 0 && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onUpdateConfig({ [exampleKey]: '' }, true)}
                      className="px-2.5 py-1.5 rounded-xl bg-white/85 hover:bg-white border border-pink-300 text-slate-800 text-[14px] font-bold flex items-center gap-1 cursor-pointer"
                      title="Очистить пример формата"
                    >
                      <X className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>Очистить</span>
                    </button>
                  )}
                </div>
              }
            />
          </div>
        );
      })()}

      {/* Live Visual Example Preview */}
      <CollapsibleSection
        title={`Живой пример оформления (${previewFormatTab === 'rich' ? 'Rich' : 'v2'})`}
        summary={`${livePreview.presetTitle} · Стиль: ${selectedStyle.title} · до ${Number(currentCharLimit).toLocaleString('ru-RU')} симв.`}
        icon={<Eye size={16} />}
        defaultOpen={true}
      >
        <div className="p-3.5 rounded-2xl bg-white/85 border border-pink-300 space-y-2.5 text-slate-900 min-w-0">
          {livePreview.headingLine && (
            <div className="space-y-1">
              <div
                className={
                  previewFormatTab === 'rich'
                    ? 'text-[18px] font-extrabold text-slate-900 leading-snug break-words'
                    : 'text-[16px] font-bold text-slate-900 leading-snug break-words'
                }
              >
                {livePreview.headingLine}
              </div>
              {livePreview.showEditorialRule && (
                <div className="h-[2px] w-28 rounded-full bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500" />
              )}
            </div>
          )}

          {livePreview.leadLine && (
            <div className="italic text-slate-700 leading-relaxed break-words">
              {livePreview.leadLine}
            </div>
          )}

          <div className="space-y-1.5">
            {livePreview.bodyBullets.map((b, idx) => (
              <div key={idx} className="leading-snug break-words">
                <span className="font-bold text-pink-700 mr-1.5">{b.prefix}</span>
                <span className="font-bold text-slate-900 mr-1">{b.boldPart}</span>
                <span className="text-slate-800">{b.restPart}</span>
                {b.codeChip && (
                  <code className="ml-1.5 px-2 py-0.5 rounded-md bg-pink-100/80 border border-pink-300 font-mono text-[14px] text-pink-800">
                    {b.codeChip}
                  </code>
                )}
              </div>
            ))}
          </div>

          {livePreview.checklistItems && (
            <div className="space-y-1 pt-1">
              {livePreview.checklistItems.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-800">
                  <span className="w-5 h-5 rounded-md border border-pink-400 bg-pink-100/70 flex items-center justify-center text-pink-700 font-bold shrink-0">
                    {c.checked ? '✓' : ''}
                  </span>
                  <span className="break-words">{c.text}</span>
                </div>
              ))}
            </div>
          )}

          {livePreview.tableRows && (
            <div className="overflow-x-auto rounded-xl border border-pink-300">
              <table className="w-full text-left border-collapse text-[14px]">
                <tbody>
                  {livePreview.tableRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={
                        rIdx === 0
                          ? 'bg-gradient-to-r from-sky-100/90 via-pink-100/90 to-orange-100/90 font-bold'
                          : 'bg-white/80 border-t border-pink-200'
                      }
                    >
                      <td className="px-3 py-1.5">{row[0]}</td>
                      <td className="px-3 py-1.5">{row[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {livePreview.quoteText && (
            <blockquote className="pl-3 py-1.5 border-l-4 border-pink-500 bg-gradient-to-r from-sky-50/90 via-pink-50/90 to-orange-50/90 rounded-r-xl italic text-slate-800 break-words">
              {livePreview.quoteText}
            </blockquote>
          )}

          {livePreview.spoilerText && (
            <div className="text-slate-800">
              Секретный прием:{' '}
              <span className="px-2 py-0.5 rounded-lg bg-pink-200/75 border border-pink-300 text-slate-800">
                {livePreview.spoilerText}
              </span>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Reference Guide of Fonts & Rules */}
      <CollapsibleSection
        title={`Шпаргалка шрифтов и разметки (${previewFormatTab === 'rich' ? 'Rich' : 'v2'})`}
        summary="Доступные шрифты, выделения и их назначение"
        icon={<BookOpen size={16} />}
        defaultOpen={false}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {fontGuide.map((fg, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-white/80 border border-pink-300 space-y-1 min-w-0"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-slate-900">{fg.label}</span>
                <code className="px-2 py-0.5 rounded-md bg-sky-100/80 border border-sky-300 font-mono text-[14px] text-slate-900">
                  {fg.syntax}
                </code>
              </div>
              <div className="text-slate-700 leading-snug break-words">{fg.purpose}</div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Extra Custom Notes with Voice Input */}
      <AutoGrowVoiceTextarea
        label="Дополнительные пожелания к верстке (необязательно)"
        value={String(config?.customFormatNotes || '')}
        onChange={(val) => onUpdateConfig({ customFormatNotes: val }, false)}
        onBlur={() =>
          onUpdateConfig({ customFormatNotes: String(config?.customFormatNotes || '') }, true)
        }
        minRows={2}
        showClearButton
        placeholder="Например: выделяй цифры моноширинным шрифтом, не ставь больше 3 эмодзи на пост..."
      />

      {!embeddedInTextGenerator && (
        <ChannelStyleAnalyzerModal
          isOpen={isAnalyzerOpen}
          onClose={() => setIsAnalyzerOpen(false)}
          userId={activeUserId}
          hasRazgonTariff={true}
          onStyleCreated={(created) => {
            const deduped = [...customStyles.filter((s) => s.id !== created.id), created];
            setCustomStyles(deduped);
            try {
              localStorage.setItem(CUSTOM_STYLES_STORAGE_KEY, JSON.stringify(deduped));
            } catch {}
            onUpdateConfig(
              {
                postStyleId: created.id,
                postStyle: created.title,
                stylePromptOverride: created.prompt
              },
              true
            );
          }}
        />
      )}
    </div>
  );
};
