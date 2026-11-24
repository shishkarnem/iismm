import React from 'react';
import {
  ImageTargetMode,
  ImageBuilderSyncedConfig
} from '../image-builder/types';
import { UnifiedImageGeneratorPanel } from '../image-builder/core/UnifiedImageGeneratorPanel';
import { DEFAULT_SCENARIO_VARIABLES as UI_KIT_SCENARIO_VARS } from '../ui-kit/GradientDropdown';
import type { PricingConfig } from '../../shared/pricingConfig';

export type ScenarioImageFunctionMode = 'func_787' | 'func_621' | 'func_784' | 'func_791';
export type ScenarioPromptMode = 'auto_context' | 'custom_template';

export interface ScenarioImageCosts {
  cost787: number;
  cost621: number;
  cost784: number;
  cost791?: number;
  pricingConfig?: PricingConfig;
}

export function isScenarioImageNodeType(type?: string): boolean {
  return (
    type === 'ai_generate_image' ||
    type === 'ai_generate_image_with_text' ||
    type === 'ai_generate_image_free' ||
    type === 'ai_generate_image_no_text'
  );
}

export function isScenarioRichVisualNodeType(type?: string): boolean {
  return (
    type === 'rich_part_image' ||
    type === 'rich_part_slideshow' ||
    type === 'rich_part_collage'
  );
}

export function isAnyScenarioVisualBuilderNode(type?: string): boolean {
  return (
    isScenarioImageNodeType(type) ||
    isScenarioRichVisualNodeType(type) ||
    type === 'v2_media_attachment' ||
    type === 'format_media'
  );
}

export function resolveScenarioImageFunction(node?: {
  type?: string;
  config?: Record<string, any>;
} | null): ScenarioImageFunctionMode {
  if (!node) return 'func_621';
  const cfgMode = node.config?.functionMode;
  if (
    cfgMode === 'func_787' ||
    cfgMode === 'func_621' ||
    cfgMode === 'func_784' ||
    cfgMode === 'func_791'
  ) {
    return cfgMode;
  }
  if (cfgMode === '791') return 'func_791';
  if (cfgMode === '787') return 'func_787';
  if (node.type === 'ai_generate_image_with_text') return 'func_784';
  if (node.type === 'ai_generate_image_free' || node.type === 'ai_generate_image_no_text') {
    return 'func_787';
  }
  return 'func_621';
}

export function computeScenarioImageCost(
  node: { type?: string; config?: Record<string, any> } | null | undefined,
  costs: ScenarioImageCosts
): number {
  if (!node) return 0;
  const fnMode = resolveScenarioImageFunction(node);
  const defaultCount =
    node.type === 'rich_part_slideshow' || node.type === 'rich_part_collage'
      ? Number(node.config?.slidesPerPart || node.config?.imageCount || 3)
      : Number(node.config?.imageCount || 1);
  const count = Math.min(10, Math.max(1, defaultCount));
  const unit =
    fnMode === 'func_791'
      ? costs.cost791 ?? 15
      : fnMode === 'func_784'
      ? costs.cost784
      : fnMode === 'func_621'
      ? costs.cost621
      : costs.cost787;
  return unit * count;
}

export function buildScenarioImageSubtitle(
  node: { type?: string; config?: Record<string, any> } | null | undefined,
  scenarioFormat: 'v2' | 'rich' = 'v2'
): string {
  if (!node) return 'Генерация картинки';
  const fnMode = resolveScenarioImageFunction(node);
  const fnLabel =
    fnMode === 'func_791'
      ? '791 · Инфографика и кириллица'
      : fnMode === 'func_784'
      ? '784 · Постер с текстом'
      : fnMode === 'func_621'
      ? '621 · Фотореализм'
      : '787 · Без текста';

  const rawRatio = String(
    node.config?.aspectRatio ||
      (fnMode === 'func_791' ? 'auto' : fnMode === 'func_784' ? '9:16' : '16:9')
  );
  const ratioLabel = rawRatio === 'auto' ? 'авто' : rawRatio;

  if (node.type === 'rich_part_image') {
    return `${fnLabel} · ${ratioLabel} · к частям`;
  }
  if (node.type === 'rich_part_slideshow') {
    const cnt = Math.min(10, Math.max(2, Number(node.config?.slidesPerPart || node.config?.imageCount || 3)));
    return `${fnLabel} · ${ratioLabel} · слайдер по ${cnt}`;
  }
  if (node.type === 'rich_part_collage') {
    const cnt = Math.min(10, Math.max(2, Number(node.config?.slidesPerPart || node.config?.imageCount || 3)));
    return `${fnLabel} · ${ratioLabel} · коллаж по ${cnt}`;
  }

  const count = Math.min(10, Math.max(1, Number(node.config?.imageCount || 1)));
  if (count <= 1) {
    return `${fnLabel} · ${ratioLabel} · 1 кадр`;
  }

  const fmt = (node.config?.messageFormat || scenarioFormat) === 'rich' ? 'rich' : 'v2';
  const target: ImageTargetMode =
    node.config?.mediaType || (fmt === 'rich' ? 'slideshow' : 'album');
  const targetLabel =
    target === 'slideshow' ? 'слайдер' : target === 'collage' ? 'коллаж' : 'альбом';

  return `${fnLabel} · ${count} шт. (${targetLabel})`;
}

interface ScenarioImageNodeConfigProps {
  config: Record<string, any>;
  nodeType: string;
  lastOutput?: Record<string, any>;
  scenarioFormat: 'v2' | 'rich';
  costs: ScenarioImageCosts;
  activeUserId?: string;
  userBalance?: number;
  onUpdateConfig: (patch: Record<string, any>, immediateSave?: boolean) => void;
  onOpenConstructor?: () => void;
  onOpenHelp?: (e: React.MouseEvent, key: string, title: string, text: string) => void;
}

export const ScenarioImageNodeConfig: React.FC<ScenarioImageNodeConfigProps> = ({
  config,
  nodeType,
  scenarioFormat,
  activeUserId,
  userBalance,
  onUpdateConfig
}) => {
  const activeFn = resolveScenarioImageFunction({ type: nodeType, config });
  const isCustomPrompt =
    config.promptMode === 'custom_template' ||
    (config.promptMode !== 'auto_context' && Boolean(config.imagePrompt));

  const effectiveFormat: 'v2' | 'rich' =
    config.messageFormat === 'rich' || (config.messageFormat !== 'v2' && scenarioFormat === 'rich')
      ? 'rich'
      : 'v2';

  const isRichPartSingle = nodeType === 'rich_part_image';
  const isRichPartMulti = nodeType === 'rich_part_slideshow' || nodeType === 'rich_part_collage';

  const defaultTargetMode: ImageTargetMode =
    nodeType === 'rich_part_slideshow'
      ? 'slideshow'
      : nodeType === 'rich_part_collage'
      ? 'collage'
      : isRichPartSingle
      ? 'photo'
      : (config.mediaType as ImageTargetMode) || (effectiveFormat === 'rich' ? 'photo' : 'photo');

  const initialCount = isRichPartMulti
    ? Math.min(10, Math.max(2, Number(config.slidesPerPart || config.imageCount || 3)))
    : Math.min(10, Math.max(1, Number(config.imageCount || 1)));

  const richVariables =
    effectiveFormat === 'rich'
      ? [
          ...UI_KIT_SCENARIO_VARS,
          { token: '{{part.heading}}', label: 'Заголовок части {{part.heading}}' },
          { token: '{{part.text}}', label: 'Текст части {{part.text}}' }
        ]
      : UI_KIT_SCENARIO_VARS;

  const handleSyncFromPanel = (synced: ImageBuilderSyncedConfig) => {
    const nextPromptMode: ScenarioPromptMode =
      synced.promptMode === 'custom' ? 'custom_template' : 'auto_context';
    const nextMediaType: ImageTargetMode =
      nodeType === 'rich_part_slideshow'
        ? 'slideshow'
        : nodeType === 'rich_part_collage'
        ? 'collage'
        : isRichPartSingle
        ? 'photo'
        : synced.targetMode;

    const prevPromptText = isCustomPrompt ? config.imagePrompt || '' : config.styleHint || '';
    const isPromptTypingChange =
      synced.prompt !== prevPromptText &&
      synced.mode === activeFn &&
      synced.imageCount === initialCount &&
      nextMediaType === defaultTargetMode;

    onUpdateConfig(
      {
        functionMode: synced.mode,
        aspectRatio: synced.aspectRatio,
        imageCount: synced.imageCount,
        ...(isRichPartMulti ? { slidesPerPart: Math.max(2, synced.imageCount) } : {}),
        mediaType: nextMediaType,
        promptMode: nextPromptMode,
        ...(nextPromptMode === 'custom_template'
          ? { imagePrompt: synced.prompt }
          : { styleHint: synced.prompt }),
        referenceUrl: synced.mode === 'func_787' ? '' : synced.referenceUrl,
        images_urls: synced.func791.images_urls,
        ai_model: synced.func787.ai_model,
        size: synced.func787.size,
        quality: 'auto',
        output_format: synced.func787.output_format,
        response_format: 'url',
        images: '',
        images_url: '',
        background: 'auto',
        mode: 'sync',
        debug: synced.mode === 'func_791' ? synced.func791.debug : false
      },
      !isPromptTypingChange
    );
  };

  return (
    <UnifiedImageGeneratorPanel
      isScenarioMode={true}
      promptMode={isCustomPrompt ? 'custom' : 'auto'}
      onPromptModeChange={(m) =>
        onUpdateConfig(
          { promptMode: m === 'custom' ? 'custom_template' : 'auto_context' },
          true
        )
      }
      scenarioVariables={richVariables}
      onScenarioChange={handleSyncFromPanel}
      editorFormat={effectiveFormat}
      defaultTargetMode={defaultTargetMode}
      allowMultiple={!isRichPartSingle}
      initialCount={initialCount}
      initialPrompt={isCustomPrompt ? config.imagePrompt || '' : config.styleHint || ''}
      initialMode={activeFn}
      initialAspectRatio={
        config.aspectRatio ||
        (activeFn === 'func_791' ? 'auto' : activeFn === 'func_784' ? '9:16' : '16:9')
      }
      initialReferenceUrl={config.referenceUrl || config.images_urls || ''}
      initialFunc787Config={{
        size: config.size || '1024x1024',
        quality: 'auto',
        output_format: config.output_format || 'png',
        response_format: 'url',
        images: '',
        images_url: '',
        background: 'auto',
        mode: 'sync',
        debug: false
      }}
      initialFunc791Config={{
        aspect_ratio: config.aspectRatio || 'auto',
        images_urls: config.images_urls || config.referenceUrl || '',
        debug: Boolean(config.debug)
      }}
      onApplyResult={(urls, targetMode, synced) => {
        handleSyncFromPanel(synced);
        if (urls && urls.length > 0) {
          onUpdateConfig(
            {
              imageUrls: urls,
              imageUrl: urls[0],
              mediaType: isRichPartSingle ? 'photo' : targetMode,
              imageCount: urls.length
            },
            true
          );
        }
      }}
      userId={activeUserId}
      userBalance={userBalance}
    />
  );
};
