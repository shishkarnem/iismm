import React, { useState, useMemo, useEffect } from 'react';
import {
  Wand2,
  Sliders,
  LayoutList,
  Edit3,
  Sparkles,
  X,
  Check,
  Loader2
} from 'lucide-react';
import {
  PostStyleItem,
  POST_STYLES,
  CHAR_LIMIT_OPTIONS_V2,
  CHAR_LIMIT_OPTIONS_V2_MEDIA,
  CHAR_LIMIT_OPTIONS_RICH,
  UNIQUENESS_MEMORY_OPTIONS
} from '../post-editor/core/postStylesData';
import {
  GradientSelect,
  VariableInsertDropdown,
  ScenarioVariableOption,
  DEFAULT_SCENARIO_VARIABLES
} from '../ui-kit/GradientDropdown';
import { CollapsibleSection } from '../ui-kit/CollapsibleSection';
import { ResponsiveActionBtn, UnboxedMetaLine } from '../ui-kit/ResponsiveActionBtn';
import { AutoGrowVoiceTextarea } from '../ui-kit/AutoGrowVoiceTextarea';
import { ChannelStyleAnalyzerModal } from './ChannelStyleAnalyzerModal';

export interface PostStructureFlags {
  includeHeading: boolean;
  includeLists: boolean;
  includeChecklist?: boolean;
  includeQuotes: boolean;
  includeSpoilers: boolean;
  includeTable: boolean;
  includeCallout: boolean;
  includeRichButtons?: boolean;
}

export interface UnifiedPostGeneratorPanelProps {
  /** Format context ('v2' | 'rich') */
  messageFormat: 'v2' | 'rich';
  hasMediaAttachment?: boolean;

  /** Style & prompt values */
  selectedStyleId: string;
  onSelectStyleId: (styleId: string) => void;
  stylePromptOverride?: string;
  onStylePromptOverrideChange?: (prompt: string) => void;

  promptValue: string;
  onPromptValueChange: (val: string) => void;

  /** Volume & uniqueness */
  maxChars: number;
  onMaxCharsChange: (chars: number) => void;
  uniquenessMemoryCount: number;
  onUniquenessMemoryCountChange: (count: number) => void;
  hasRazgonTariff?: boolean;
  onRequireRazgon?: (featureTitle: string, featureDesc: string) => void;

  /** Structure flags */
  structureFlags: PostStructureFlags;
  onStructureFlagsChange: (next: PostStructureFlags) => void;

  /** Scenario mode integration */
  isScenarioMode?: boolean;
  scenarioVariables?: ScenarioVariableOption[];

  /** Editor live generation button (optional — shown when onGenerateNow is passed) */
  onGenerateNow?: (resolvedStyleTitle: string, resolvedStylePrompt: string) => Promise<void> | void;
  isGenerating?: boolean;
  costIirky?: number;

  userId?: string;
  telegramId?: number | string;
}

const CUSTOM_STYLES_STORAGE_KEY = 'iismm_custom_styles';

export const UnifiedPostGeneratorPanel: React.FC<UnifiedPostGeneratorPanelProps> = ({
  messageFormat,
  hasMediaAttachment = false,
  selectedStyleId,
  onSelectStyleId,
  stylePromptOverride,
  onStylePromptOverrideChange,
  promptValue,
  onPromptValueChange,
  maxChars,
  onMaxCharsChange,
  uniquenessMemoryCount,
  onUniquenessMemoryCountChange,
  hasRazgonTariff = true,
  onRequireRazgon,
  structureFlags,
  onStructureFlagsChange,
  isScenarioMode = false,
  scenarioVariables = DEFAULT_SCENARIO_VARIABLES,
  onGenerateNow,
  isGenerating = false,
  costIirky = 5,
  userId,
  telegramId
}) => {
  const [customStyles, setCustomStyles] = useState<PostStyleItem[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_STYLES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const uid = String(userId || telegramId || '').trim();
    const qs = uid ? `?userId=${encodeURIComponent(uid)}` : '';
    fetch(`/api/post-styles${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.styles)) return;
        setCustomStyles((prev) => {
          const byId = new Map<string, PostStyleItem>();
          prev.forEach((s) => byId.set(s.id, s));
          data.styles.forEach((s: PostStyleItem) => byId.set(s.id, s));
          const merged = Array.from(byId.values());
          try {
            localStorage.setItem(CUSTOM_STYLES_STORAGE_KEY, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      })
      .catch(() => {});
  }, [userId, telegramId]);

  const allStyles = useMemo(() => [...POST_STYLES, ...customStyles], [customStyles]);
  const activeStyle =
    allStyles.find(s => s.id === selectedStyleId || s.title === selectedStyleId) || allStyles[0];

  const [isEditingStylePrompt, setIsEditingStylePrompt] = useState(false);
  const [draftStylePrompt, setDraftStylePrompt] = useState('');
  const [isAnalyzerOpen, setIsAnalyzerOpen] = useState(false);

  const handleOpenEditStylePrompt = () => {
    if (!hasRazgonTariff && onRequireRazgon) {
      onRequireRazgon(
        'Настраиваемые стили',
        'Редактирование и сохранение фирменных стилей доступно с тарифа Разгон.'
      );
      return;
    }
    setDraftStylePrompt(stylePromptOverride || activeStyle?.prompt || '');
    setIsEditingStylePrompt(prev => !prev);
  };

  const handleSaveCustomStyle = () => {
    const cleanPrompt = draftStylePrompt.trim();
    if (!cleanPrompt) return;

    const existingCustom = customStyles.find(s => s.id === activeStyle.id);
    let updated: PostStyleItem[];
    let targetId = activeStyle.id;
    let savedItem: PostStyleItem;

    if (existingCustom) {
      savedItem = { ...existingCustom, prompt: cleanPrompt, isCustom: true };
      updated = customStyles.map(s => (s.id === activeStyle.id ? savedItem : s));
    } else {
      targetId = `custom_${activeStyle.id}_${Date.now()}`;
      savedItem = {
        id: targetId,
        title: `✨ ${activeStyle.title} (свой)`,
        desc: 'Собственный настроенный промпт стиля',
        prompt: cleanPrompt,
        isCustom: true
      };
      updated = [...customStyles, savedItem];
    }

    setCustomStyles(updated);
    localStorage.setItem(CUSTOM_STYLES_STORAGE_KEY, JSON.stringify(updated));
    fetch('/api/post-styles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: savedItem.id,
        userId: String(userId || telegramId || 'global'),
        title: savedItem.title,
        desc: savedItem.desc,
        prompt: savedItem.prompt
      })
    }).catch(() => {});
    onSelectStyleId(targetId);
    onStylePromptOverrideChange?.(cleanPrompt);
    setIsEditingStylePrompt(false);
  };

  const handleOpenAnalyzer = () => {
    setIsAnalyzerOpen(true);
  };

  const charOptions =
    messageFormat === 'rich'
      ? CHAR_LIMIT_OPTIONS_RICH
      : hasMediaAttachment
      ? CHAR_LIMIT_OPTIONS_V2_MEDIA
      : CHAR_LIMIT_OPTIONS_V2;

  const nearestCharValue = useMemo(() => {
    const exact = charOptions.find(o => Number(o.value) === maxChars);
    if (exact) return exact.value;
    let best = charOptions[0].value;
    let minDiff = Infinity;
    for (const o of charOptions) {
      const d = Math.abs(Number(o.value) - maxChars);
      if (d < minDiff) {
        minDiff = d;
        best = o.value;
      }
    }
    return best;
  }, [charOptions, maxChars]);

  const activeStructureLabels = [
    structureFlags.includeHeading ? 'заголовок' : '',
    structureFlags.includeLists ? 'списки' : '',
    structureFlags.includeChecklist ? 'чек-лист' : '',
    structureFlags.includeQuotes ? 'цитата' : '',
    structureFlags.includeSpoilers ? 'спойлер' : '',
    messageFormat === 'rich' && structureFlags.includeTable ? 'таблица' : '',
    structureFlags.includeCallout ? (messageFormat === 'rich' ? 'выноска' : 'вывод') : '',
    messageFormat === 'rich' && structureFlags.includeRichButtons ? 'кнопки' : ''
  ].filter(Boolean);

  const volumeSummary = `До ${maxChars.toLocaleString('ru-RU')} симв.${
    uniquenessMemoryCount > 0 ? ` · Память: ${uniquenessMemoryCount} постов` : ''
  }`;

  const structureSummary =
    activeStructureLabels.length > 0 ? activeStructureLabels.join(' · ') : 'Без доп. блоков';

  const toggleItems: Array<{
    key: keyof PostStructureFlags;
    label: string;
    richOnly?: boolean;
  }> = [
    { key: 'includeHeading', label: 'Заголовок и подзаголовки' },
    { key: 'includeLists', label: 'Маркированные списки' },
    { key: 'includeChecklist', label: 'Чек-лист с галочками [ ] / [x]' },
    { key: 'includeQuotes', label: 'Цитата или раскрываемая врезка' },
    { key: 'includeSpoilers', label: 'Скрытый спойлер / <details>' },
    { key: 'includeTable', label: 'Таблица показателей', richOnly: true },
    { key: 'includeCallout', label: 'Выноска / финальный вывод' },
    { key: 'includeRichButtons', label: 'Инлайн-кнопки в тексте', richOnly: true }
  ];

  return (
    <div className="space-y-3.5 min-w-0">
      <UnboxedMetaLine
        items={[
          messageFormat === 'rich' ? 'Формат статьи' : 'Формат поста',
          `${costIirky} Иирок за генерацию`,
          activeStyle?.title || 'Экспертный'
        ]}
      />

      <div className="space-y-2">
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <GradientSelect
              label="Стиль подачи текста"
              value={activeStyle.id}
              onChange={(id) => {
                onSelectStyleId(id);
                const chosen = allStyles.find(s => s.id === id);
                if (chosen) {
                  onStylePromptOverrideChange?.(chosen.prompt);
                }
              }}
              searchable
              options={allStyles.map(s => ({
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
              title="Настроить инструкцию стиля"
              variant="secondary"
              onClick={handleOpenEditStylePrompt}
            />
            <ResponsiveActionBtn
              icon={<Sparkles className="w-4 h-4" />}
              label="Из канала"
              title="Создать стиль по примерам постов канала"
              variant="secondary"
              onClick={handleOpenAnalyzer}
            />
          </div>
        </div>

        {isEditingStylePrompt && (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300 space-y-2 min-w-0">
            <AutoGrowVoiceTextarea
              label="Системная инструкция выбранного стиля"
              value={draftStylePrompt}
              onChange={(val) => setDraftStylePrompt(val)}
              minRows={2}
              showClearButton
              placeholder="Опишите фирменный стиль, структуру и подачу текста..."
            />
            <div className="flex items-center justify-end gap-2">
              <ResponsiveActionBtn
                icon={<X className="w-4 h-4" />}
                label="Скрыть"
                variant="ghost"
                onClick={() => setIsEditingStylePrompt(false)}
              />
              <ResponsiveActionBtn
                icon={<Check className="w-4 h-4" />}
                label="Сохранить стиль"
                variant="primary"
                onClick={handleSaveCustomStyle}
              />
            </div>
          </div>
        )}
      </div>

      <AutoGrowVoiceTextarea
        label={
          isScenarioMode
            ? 'Задача и шаблон инструкции для нейросети'
            : 'О чем написать публикацию'
        }
        value={promptValue}
        onChange={(val) => onPromptValueChange(val)}
        minRows={2}
        maxLength={10000}
        showClearButton
        placeholder={
          isScenarioMode
            ? 'Опишите задачу для генерации поста. Можно вставлять переменные {{topic}}, {{summary}}, {{text}}...'
            : 'Укажите тему, ключевые тезисы, целевую аудиторию или черновые мысли для поста...'
        }
        headerExtra={
          isScenarioMode ? (
            <VariableInsertDropdown
              variables={scenarioVariables}
              onInsert={(token) =>
                onPromptValueChange(promptValue ? `${promptValue} ${token}` : token)
              }
            />
          ) : undefined
        }
      />

      <CollapsibleSection
        title="Объем и уникальность"
        icon={<Sliders className="w-4 h-4" />}
        summary={volumeSummary}
        defaultOpen={false}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <GradientSelect
            label="Целевой объем текста"
            value={nearestCharValue}
            onChange={(v) => onMaxCharsChange(Number(v) || 2500)}
            options={charOptions}
          />
          <GradientSelect
            label="Память уникальности (антиповтор тем)"
            value={String(uniquenessMemoryCount || 0)}
            onChange={(v) => {
              const nextNum = Number(v) || 0;
              if (nextNum > 0 && !hasRazgonTariff && onRequireRazgon) {
                onRequireRazgon(
                  'Память уникальности постов',
                  'Сверка с прошлыми публикациями канала для исключения самоповторов доступна с тарифа Разгон.'
                );
                return;
              }
              onUniquenessMemoryCountChange(nextNum);
            }}
            options={UNIQUENESS_MEMORY_OPTIONS}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Структура и разметка"
        icon={<LayoutList className="w-4 h-4" />}
        summary={structureSummary}
        defaultOpen={false}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {toggleItems
            .filter(item => !item.richOnly || messageFormat === 'rich')
            .map(item => {
              const checked = Boolean(structureFlags[item.key]);
              return (
                <label
                  key={item.key}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 cursor-pointer"
                >
                  <span className="text-[14px] font-medium text-slate-900">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      onStructureFlagsChange({
                        ...structureFlags,
                        [item.key]: e.target.checked
                      })
                    }
                    className="w-5 h-5 accent-pink-600 cursor-pointer shrink-0"
                  />
                </label>
              );
            })}
        </div>
      </CollapsibleSection>

      {onGenerateNow && (
        <div className="flex justify-end pt-1">
          <ResponsiveActionBtn
            icon={isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            label={
              isGenerating
                ? 'Генерируем текст поста...'
                : `Сгенерировать текст (${costIirky} Иирок)`
            }
            alwaysShowLabel
            variant="primary"
            disabled={isGenerating}
            onClick={() => {
              const basePrompt = stylePromptOverride || activeStyle?.prompt || '';
              const structureHints: string[] = [];
              if (structureFlags.includeHeading) structureHints.push('выразительный заголовок # и подзаголовки ##');
              if (structureFlags.includeLists) structureHints.push('структурированный список');
              if (structureFlags.includeChecklist) {
                structureHints.push(
                  messageFormat === 'rich'
                    ? 'интерактивный чек-лист (- [ ] / - [x])'
                    : 'пошаговый чек-лист'
                );
              }
              if (structureFlags.includeQuotes) {
                structureHints.push(
                  messageFormat === 'rich'
                    ? 'цитату (или раскрываемую цитату <blockquote expandable>...</blockquote>)'
                    : 'уместную цитату'
                );
              }
              if (structureFlags.includeSpoilers) {
                structureHints.push(
                  messageFormat === 'rich'
                    ? 'скрытый блок-спойлер <details><summary>...</summary>...</details>'
                    : 'интригующий спойлер ||...||'
                );
              }
              if (messageFormat === 'rich' && structureFlags.includeTable) {
                structureHints.push('наглядную markdown-таблицу');
              }
              if (structureFlags.includeCallout) {
                structureHints.push(
                  messageFormat === 'rich'
                    ? 'акцентную выноску <aside>...</aside> и практический вывод'
                    : 'сильный практический вывод'
                );
              }
              if (messageFormat === 'rich' && structureFlags.includeRichButtons) {
                structureHints.push('инлайн-кнопки в тексте (<tg-button-row align="center"><tg-button type="url" style="primary" url="https://t.me/IIrkiBot">...</tg-button></tg-button-row>)');
              }
              const combinedStylePrompt =
                structureHints.length > 0
                  ? `${basePrompt} Обязательные элементы структуры: ${structureHints.join(', ')}.`
                  : basePrompt;
              onGenerateNow(activeStyle?.title || 'Экспертный', combinedStylePrompt);
            }}
          />
        </div>
      )}

      <ChannelStyleAnalyzerModal
        isOpen={isAnalyzerOpen}
        onClose={() => setIsAnalyzerOpen(false)}
        userId={userId}
        telegramId={telegramId}
        hasRazgonTariff={hasRazgonTariff}
        onRequireRazgon={() => {
          setIsAnalyzerOpen(false);
          onRequireRazgon?.(
            'Стиль из канала',
            'Анализ примеров постов и создание стиля канала доступны с тарифа Разгон.'
          );
        }}
        onStyleCreated={(created) => {
          const deduped = [...customStyles.filter((s) => s.id !== created.id), created];
          setCustomStyles(deduped);
          localStorage.setItem(CUSTOM_STYLES_STORAGE_KEY, JSON.stringify(deduped));
          onSelectStyleId(created.id);
          onStylePromptOverrideChange?.(created.prompt);
        }}
      />
    </div>
  );
};
