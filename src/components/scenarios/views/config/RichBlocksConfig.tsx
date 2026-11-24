import React from 'react';
import {
  Scissors,
  Combine,
  Wand2
} from 'lucide-react';
import { Scenario, WorkflowNode } from '../../../../types';
import {
  ScenarioImageCosts,
  ScenarioImageNodeConfig
} from '../../ScenarioImageNodeConfig';
import {
  GradientSelect,
  GradientMultiSelect,
  VariableInsertDropdown,
  DEFAULT_SCENARIO_VARIABLES
} from '../../../ui-kit/GradientDropdown';
import { UnboxedMetaLine } from '../../../ui-kit/ResponsiveActionBtn';
import { AutoGrowVoiceTextarea } from '../../../ui-kit/AutoGrowVoiceTextarea';
import { usePricingConfig } from '../../../../hooks/usePricingConfig';
import { formatIirkyCount } from '../../../../shared/pricingConfig';

interface RichBlocksConfigProps {
  selectedNode: WorkflowNode;
  currentScenario: Scenario;
  costs: ScenarioImageCosts;
  activeUserId?: string;
  userBalance?: number;
  onUpdateConfig: (patch: Record<string, any>, immediateSave?: boolean) => void;
  onOpenImageConstructor?: () => void;
}

export const RichBlocksConfig: React.FC<RichBlocksConfigProps> = ({
  selectedNode,
  currentScenario,
  costs,
  activeUserId,
  userBalance,
  onUpdateConfig
}) => {
  const { pricing } = usePricingConfig(activeUserId);
  const effectiveScenarioAi = costs.pricingConfig?.scenarioAi ?? pricing.scenarioAi;
  const imagePromptCostLabel = formatIirkyCount(effectiveScenarioAi.imagePromptPerItem);
  const richSplitAiCostLabel = formatIirkyCount(effectiveScenarioAi.richSplitAi);
  const cfg = selectedNode.config || {};

  /* 1. Fast Topic Generator (1 Iirka) */
  if (selectedNode.type === 'ai_generate_topic_fast') {
    return (
      <div className="space-y-3.5 pt-1 text-[14px] min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 min-w-0">
          <AutoGrowVoiceTextarea
            label="Рубрика или ниша канала"
            value={cfg.topicCategory || ''}
            onChange={(val) => onUpdateConfig({ topicCategory: val }, false)}
            onBlur={() => onUpdateConfig({ topicCategory: cfg.topicCategory || '' }, true)}
            minRows={2}
            showClearButton
            placeholder="Нейросети, маркетинг, психология, бизнес"
          />

          <AutoGrowVoiceTextarea
            label="Угол подачи или формат идеи"
            value={cfg.topicAngle || ''}
            onChange={(val) => onUpdateConfig({ topicAngle: val }, false)}
            onBlur={() => onUpdateConfig({ topicAngle: cfg.topicAngle || '' }, true)}
            minRows={2}
            showClearButton
            placeholder="Разбор ошибки, практический гайд, тренд дня"
          />
        </div>

        <AutoGrowVoiceTextarea
          label="Ключевые слова или ориентир (необязательно)"
          value={cfg.topicSeed || ''}
          onChange={(val) => onUpdateConfig({ topicSeed: val }, false)}
          onBlur={() => onUpdateConfig({ topicSeed: cfg.topicSeed || '' }, true)}
          minRows={2}
          showClearButton
          placeholder="Оставьте пустым для свободного подбора свежей идеи или надиктуйте ориентир голосом"
        />
      </div>
    );
  }

  /* 2. AI Image Prompt Generator (1 Iirka) */
  if (selectedNode.type === 'ai_generate_image_prompt') {
    const hasUpstreamSplit = (currentScenario.nodes || []).some(
      (n) => n.type === 'rich_split_parts' && n.enabled !== false
    );
    const isPerPartMode =
      cfg.promptSourceMode !== 'whole_post' &&
      (cfg.promptSourceMode === 'per_part' ||
        cfg.promptSourceMode === 'each_rich_part' ||
        cfg.handoffMode === 'parts_stream' ||
        hasUpstreamSplit);

    const richVars = [
      ...DEFAULT_SCENARIO_VARIABLES,
      { token: '{{part.heading}}', label: 'Заголовок части {{part.heading}}' },
      { token: '{{part.text}}', label: 'Текст части {{part.text}}' }
    ];

    return (
      <div className="space-y-3 pt-1 text-[14px]">
        <div className="flex items-center gap-2 text-slate-700">
          <Wand2 size={16} className="text-pink-600 shrink-0" />
          <span>
            {hasUpstreamSplit && isPerPartMode
              ? 'Составляет отдельный визуальный промпт для каждой смысловой части Rich.'
              : 'Изучает результат прошлого шага и создает готовый промпт для блока картинки.'}
          </span>
        </div>

        {hasUpstreamSplit && (
          <GradientSelect
            label="Режим подготовки промптов в Rich-сценарии"
            value={isPerPartMode ? 'per_part' : 'whole_post'}
            onChange={(val) =>
              onUpdateConfig(
                val === 'per_part'
                  ? { promptSourceMode: 'per_part', handoffMode: 'parts_stream' }
                  : { promptSourceMode: 'whole_post', handoffMode: 'full' },
                true
              )
            }
            options={[
              {
                value: 'per_part',
                label: 'Отдельный промпт к каждой части Rich',
                meta: `по ${imagePromptCostLabel} за часть`
              },
              {
                value: 'whole_post',
                label: 'Один общий промпт по всему посту',
                meta: imagePromptCostLabel
              }
            ]}
          />
        )}

        <AutoGrowVoiceTextarea
          label="Художественный стиль будущей картинки"
          value={cfg.promptVisualStyle || ''}
          onChange={(val) => onUpdateConfig({ promptVisualStyle: val }, false)}
          onBlur={() => onUpdateConfig({ promptVisualStyle: cfg.promptVisualStyle || '' }, true)}
          minRows={2}
          showClearButton
          placeholder="Фотореализм, редакционная иллюстрация, мягкий студийный свет"
        />

        <AutoGrowVoiceTextarea
          label="Дополнительные требования к сцене (необязательно)"
          value={cfg.promptExtraNotes || ''}
          onChange={(val) => onUpdateConfig({ promptExtraNotes: val }, false)}
          onBlur={() => onUpdateConfig({ promptExtraNotes: cfg.promptExtraNotes || '' }, true)}
          minRows={2}
          showClearButton
          placeholder="Светлая палитра, крупный план объекта, чистая композиция..."
          headerExtra={
            <VariableInsertDropdown
              variables={hasUpstreamSplit ? richVars : DEFAULT_SCENARIO_VARIABLES}
              onInsert={(token) => {
                const prev = String(cfg.promptExtraNotes || '');
                onUpdateConfig(
                  { promptExtraNotes: prev ? `${prev} ${token}` : token },
                  true
                );
              }}
            />
          }
        />
      </div>
    );
  }

  /* 3. Rich Split Parts (1..10 parts — single vertical dropdown without duplicate +/- and 1..10 grid) */
  if (selectedNode.type === 'rich_split_parts') {
    const partsCount = Math.min(10, Math.max(1, Number(cfg.partsCount || 3)));
    const splitMode =
      cfg.splitMode === 'headings_paragraphs' ? 'headings_paragraphs' : 'ai_semantic';

    const countOptions = Array.from({ length: 10 }, (_, idx) => {
      const n = idx + 1;
      const suffix = n === 1 ? 'часть' : n >= 2 && n <= 4 ? 'части' : 'частей';
      return { value: String(n), label: `${n} ${suffix}` };
    });

    return (
      <div className="space-y-3.5 pt-1 text-[14px]">
        <div className="flex items-center gap-2 text-slate-700">
          <Scissors size={16} className="text-pink-600 shrink-0" />
          <span>Делит Rich-статью на смысловые главы для каскадной генерации иллюстраций.</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <GradientSelect
            label="Количество смысловых частей"
            value={String(partsCount)}
            onChange={(val) => onUpdateConfig({ partsCount: Number(val) || 3 }, true)}
            options={countOptions}
          />

          <GradientSelect
            label="Способ разделения текста"
            value={splitMode}
            onChange={(val) => onUpdateConfig({ splitMode: val }, true)}
            options={[
              {
                value: 'ai_semantic',
                label: 'Умное деление по смыслу',
                meta: richSplitAiCostLabel,
                sublabel: 'Нейросеть выделяет завершенные главы и выжимку для визуала'
              },
              {
                value: 'headings_paragraphs',
                label: 'По заголовкам и абзацам',
                meta: 'Бесплатно',
                sublabel: 'Структурное разбиение текста по подзаголовкам'
              }
            ]}
          />
        </div>

        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-sky-100/70 via-pink-100/70 via-orange-100/70 via-pink-100/70 to-sky-100/70 border border-pink-300 cursor-pointer">
          <input
            type="checkbox"
            checked={cfg.keepPartHeadings !== false}
            onChange={(e) => onUpdateConfig({ keepPartHeadings: e.target.checked }, true)}
            className="w-4 h-4 rounded border-pink-300 text-pink-600 cursor-pointer shrink-0"
          />
          <span className="font-semibold text-slate-900">
            Сохранять подзаголовки каждой части при финальной сборке поста
          </span>
        </label>
      </div>
    );
  }

  /* 4. Rich Per-Part Visual Generators: Image / Slideshow / Collage — Unified 1-to-1 with ImageBuilder */
  if (
    selectedNode.type === 'rich_part_image' ||
    selectedNode.type === 'rich_part_slideshow' ||
    selectedNode.type === 'rich_part_collage'
  ) {
    const splitNode = (currentScenario.nodes || []).find((n) => n.type === 'rich_split_parts');
    const maxParts = Math.min(10, Math.max(1, Number(splitNode?.config?.partsCount || 3)));
    const applyMode = cfg.applyToParts === 'selected' ? 'selected' : 'all';
    const selectedNums: number[] = Array.isArray(cfg.selectedPartNumbers)
      ? cfg.selectedPartNumbers
      : [1];

    const partOptions = Array.from({ length: maxParts }, (_, idx) => ({
      value: String(idx + 1),
      label: `Часть #${idx + 1}`
    }));

    return (
      <div className="space-y-3.5 pt-1 text-[14px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <GradientSelect
            label={`К каким частям применять (всего: ${maxParts})`}
            value={applyMode}
            onChange={(val) => onUpdateConfig({ applyToParts: val }, true)}
            options={[
              { value: 'all', label: `Ко всем частям (1–${maxParts})` },
              { value: 'selected', label: 'Только к выбранным частям' }
            ]}
          />

          <GradientSelect
            label="Расположение внутри части"
            value={cfg.partVisualPosition || 'after_heading'}
            onChange={(val) => onUpdateConfig({ partVisualPosition: val }, true)}
            options={[
              { value: 'after_heading', label: 'Сразу после заголовка части' },
              { value: 'after_text', label: 'После абзацев текста части' },
              { value: 'before_heading', label: 'Перед заголовком части' }
            ]}
          />
        </div>

        {applyMode === 'selected' && (
          <GradientMultiSelect
            label="Номера частей для вставки визуала"
            values={selectedNums.map(String)}
            onChange={(vals) => {
              const nums = vals
                .map((v) => Number(v))
                .filter((n) => n >= 1 && n <= maxParts)
                .sort((a, b) => a - b);
              onUpdateConfig({ selectedPartNumbers: nums.length > 0 ? nums : [1] }, true);
            }}
            options={partOptions}
            selectAllLabel="Все части"
          />
        )}

        <ScenarioImageNodeConfig
          config={cfg}
          nodeType={selectedNode.type}
          scenarioFormat="rich"
          costs={costs}
          activeUserId={activeUserId}
          userBalance={userBalance}
          onUpdateConfig={onUpdateConfig}
        />
      </div>
    );
  }

  /* 5. Rich Assemble Post (Merge parts 1..N without duplicate signature textarea) */
  if (selectedNode.type === 'rich_assemble_post') {
    const hasUpstreamSignatureNode = (currentScenario.nodes || []).some(
      (n) => n.type === 'format_signature' && n.enabled !== false
    );
    const hasUpstreamButtonsNode = (currentScenario.nodes || []).some(
      (n) => n.type === 'format_inline_buttons' && n.enabled !== false
    );
    const attachSigChecked =
      cfg.appendSignatureInAssemble !== undefined
        ? Boolean(cfg.appendSignatureInAssemble)
        : hasUpstreamSignatureNode;

    return (
      <div className="space-y-3.5 pt-1 text-[14px]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Combine size={16} className="text-pink-600 shrink-0" />
            <span>Собирает заголовок, все части с визуалом, подпись и кнопки в единый Rich-пост.</span>
          </div>
          <UnboxedMetaLine
            items={[
              hasUpstreamSignatureNode ? 'Подпись из блока подписи подключена' : null,
              hasUpstreamButtonsNode ? 'Инлайн-кнопки подключены' : null
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <GradientSelect
            label="Разделитель между частями"
            value={cfg.partSeparator || 'line'}
            onChange={(val) => onUpdateConfig({ partSeparator: val }, true)}
            options={[
              { value: 'line', label: 'Горизонтальная линия (---)' },
              { value: 'blank', label: 'Чистый отступ (пустая строка)' },
              { value: 'none', label: 'Без разделителя' }
            ]}
          />

          <GradientSelect
            label="Уровень подзаголовков глав"
            value={cfg.assembleHeadingLevel === 'h3' ? 'h3' : 'h2'}
            onChange={(val) => onUpdateConfig({ assembleHeadingLevel: val }, true)}
            options={[
              { value: 'h2', label: 'Крупные подзаголовки (##)' },
              { value: 'h3', label: 'Компактные подзаголовки (###)' }
            ]}
          />
        </div>

        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-sky-100/70 via-pink-100/70 via-orange-100/70 via-pink-100/70 to-sky-100/70 border border-pink-300 cursor-pointer">
          <input
            type="checkbox"
            checked={cfg.includeMainTitle !== false}
            onChange={(e) => onUpdateConfig({ includeMainTitle: e.target.checked }, true)}
            className="w-4 h-4 rounded border-pink-300 text-pink-600 cursor-pointer shrink-0"
          />
          <span className="font-semibold text-slate-900">
            Добавлять главный заголовок статьи вверху сообщения
          </span>
        </label>

        <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-sky-100/70 via-pink-100/70 via-orange-100/70 via-pink-100/70 to-sky-100/70 border border-pink-300 cursor-pointer">
          <input
            type="checkbox"
            checked={attachSigChecked}
            onChange={(e) => onUpdateConfig({ appendSignatureInAssemble: e.target.checked }, true)}
            className="w-4 h-4 rounded border-pink-300 text-pink-600 cursor-pointer shrink-0"
          />
          <span className="font-semibold text-slate-900">
            Прикреплять подпись из блока «Шаблон и подпись» или настроек канала
          </span>
        </label>
      </div>
    );
  }

  return null;
};
