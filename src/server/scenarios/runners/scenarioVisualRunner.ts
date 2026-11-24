import { handleUnifiedImageGeneration } from '../../imageBuilderService';
import { applyScenarioTemplateVariables, buildScenarioMacroContext } from '../scenarioAiHelpers';
import { ScenarioRichPart } from '../../../types';
import { getPricingConfigFromDb } from '../../pricing/pricingService';
import { getRequiredScenarioPrompt, renderPromptTemplate } from '../prompts/scenarioPromptsRepo';

export function resolveImageNodeFnMode(
  type: string,
  cfg: any
): 'func_787' | 'func_621' | 'func_784' | 'func_791' {
  if (
    cfg?.functionMode === 'func_787' ||
    cfg?.functionMode === 'func_621' ||
    cfg?.functionMode === 'func_784' ||
    cfg?.functionMode === 'func_791'
  ) {
    return cfg.functionMode;
  }
  if (type === 'ai_generate_image_with_text') return 'func_784';
  if (type === 'ai_generate_image_free' || type === 'ai_generate_image_no_text') return 'func_787';
  return 'func_621';
}

export async function executeRichPartVisualNode(params: {
  nodeType: string;
  config: Record<string, any>;
  runningContext: Record<string, any>;
  handoff: {
    effectiveTopic: string;
    effectiveText?: string;
    effectiveSummary?: string;
    effectiveImagePrompt?: string;
  };
  cleanUserId: string;
  settings: any;
  onSubProgress?: (fraction: number, detail: string) => void;
}): Promise<{ output: Record<string, any>; message: string; actualCost: number }> {
  const { nodeType, config, runningContext, handoff, cleanUserId, settings, onSubProgress } = params;
  const genMode = resolveImageNodeFnMode(nodeType, config);
  const visualKind: 'image' | 'slideshow' | 'collage' =
    nodeType === 'rich_part_slideshow'
      ? 'slideshow'
      : nodeType === 'rich_part_collage'
      ? 'collage'
      : 'image';
  const perPartCount =
    visualKind === 'image'
      ? 1
      : Math.min(10, Math.max(2, Number(config.slidesPerPart || config.imageCount || 3)));
  const position: 'before_heading' | 'before_text' | 'after_heading' | 'after_text' =
    config.partVisualPosition || config.visualPosition || 'after_heading';

  let partsList: ScenarioRichPart[] =
    Array.isArray(runningContext.parts) && runningContext.parts.length > 0
      ? [...runningContext.parts]
      : [
          {
            index: 1,
            heading: runningContext.title || runningContext.topic,
            text: runningContext.text || ''
          }
        ];

  const isSelectedMode =
    config.applyToParts === 'selected' || config.partTargetMode === 'selected';
  const selectedNums: number[] =
    isSelectedMode && Array.isArray(config.selectedPartNumbers)
      ? config.selectedPartNumbers.map(Number)
      : partsList.map((p) => p.index);

  const totalTargetParts = partsList.filter((p) => selectedNums.includes(p.index)).length;
  const totalExpectedImages = Math.max(1, totalTargetParts * perPartCount);
  const allGeneratedUrls: string[] = [];
  let generatedImagesCount = 0;

  const defaultRatio =
    genMode === 'func_791' ? 'auto' : genMode === 'func_784' ? '9:16' : '16:9';
  const effectiveAspect = String(config.aspectRatio || defaultRatio);
  const mappedSize787 =
    config.size ||
    (effectiveAspect === '9:16'
      ? '1024x1792'
      : effectiveAspect === '1:1'
      ? '1024x1024'
      : '1792x1024');

  const maxPromptChars = genMode === 'func_791' ? 5000 : 520;
  const refUrls791 =
    config.images_urls ||
    config.imagesUrls791 ||
    config.images ||
    config.referenceUrl ||
    config.filesUrl ||
    undefined;

  const visualDbNodeType =
    nodeType === 'rich_part_slideshow' || nodeType === 'rich_part_collage' || nodeType === 'rich_part_image'
      ? nodeType
      : 'rich_part_image';
  const dbPartVisualPrompt = await getRequiredScenarioPrompt(visualDbNodeType, 'default');

  onSubProgress?.(
    0.1,
    `Каскадная генерация визуалов для ${totalTargetParts} ч. (${totalExpectedImages} кадр., ${effectiveAspect})...`
  );

  const updatedParts: ScenarioRichPart[] = [];
  for (let pIdx = 0; pIdx < partsList.length; pIdx++) {
    const part = partsList[pIdx];
    if (!selectedNums.includes(part.index)) {
      updatedParts.push(part);
      continue;
    }

    const partMacroVars = buildScenarioMacroContext(runningContext, handoff, {
      text: part.text,
      partHeading: part.heading,
      partText: part.text,
      partIndex: part.index
    });
    const customConfigPrompt = applyScenarioTemplateVariables(
      String(config.imagePrompt || ''),
      partMacroVars
    ).trim();
    const expandedStyleHint = applyScenarioTemplateVariables(
      String(config.styleHint || ''),
      partMacroVars
    ).trim();
    const explicitPrompt =
      config.promptMode === 'custom_template' && customConfigPrompt
        ? customConfigPrompt
        : part.imagePrompt || customConfigPrompt;

    const urlsForPart: string[] = [];
    for (let f = 0; f < perPartCount; f++) {
      onSubProgress?.(
        Math.min(0.92, 0.12 + (generatedImagesCount / totalExpectedImages) * 0.8),
        `Каскад: генерация кадра ${generatedImagesCount + 1} из ${totalExpectedImages} (часть ${part.index}, ${effectiveAspect})...`
      );
      const renderedFramePrompt = explicitPrompt
        ? `${explicitPrompt}${perPartCount > 1 ? ` (кадр ${f + 1} из ${perPartCount})` : ''}`
        : renderPromptTemplate(dbPartVisualPrompt.user_prompt_template, {
            part_index: part.index,
            parts_total: partsList.length,
            part_heading: part.heading || '',
            part_text: String(part.text || '').slice(0, genMode === 'func_791' ? 1200 : 280),
            topic: handoff.effectiveTopic || `Часть ${part.index}`,
            style_hint: expandedStyleHint,
            aspect_ratio: effectiveAspect,
            function_mode: genMode,
            frame_index: f + 1,
            frames_total: perPartCount
          });
      const framePrompt = renderedFramePrompt
        .replace(/[\u2028\u2029]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxPromptChars);

      const fnRes = await handleUnifiedImageGeneration({
        mode: genMode,
        prompt: framePrompt,
        userId: cleanUserId,
        aspectRatio: effectiveAspect,
        referenceUrl: config.referenceUrl || config.filesUrl || undefined,
        resolution: '1K',
        ai_model:
          genMode === 'func_791'
            ? 'gpt-image-2.5-sunburst'
            : config.ai_model || 'am/flux.2-klein-4b',
        size: genMode === 'func_791' ? '' : mappedSize787,
        quality: config.quality,
        output_format: config.output_format,
        response_format: config.response_format,
        images: config.images,
        images_url: config.images_url,
        images_urls: refUrls791,
        background: config.background,
        generation_mode: config.mode || config.generation_mode,
        debug: Boolean(config.debug),
        skipBilling: true,
        skipHiddenRule: true
      });
      if (!fnRes.ok || !fnRes.imageUrl) {
        throw new Error(fnRes.error || `Ошибка каскадной генерации визуала для части ${part.index}`);
      }
      urlsForPart.push(fnRes.imageUrl);
      allGeneratedUrls.push(fnRes.imageUrl);
      generatedImagesCount += 1;
      onSubProgress?.(
        Math.min(0.96, 0.12 + (generatedImagesCount / totalExpectedImages) * 0.84),
        `Готово каскадно: ${generatedImagesCount} из ${totalExpectedImages} (часть ${part.index})`
      );
    }

    updatedParts.push({
      ...part,
      visualType: visualKind,
      imageUrls: urlsForPart,
      visualPosition: position
    });
  }
  partsList = updatedParts;

  runningContext.parts = partsList;
  runningContext.messageFormat = 'rich';
  if (allGeneratedUrls[0]) runningContext.imageUrl = allGeneratedUrls[0];
  if (allGeneratedUrls.length > 0) {
    runningContext.imageUrls = allGeneratedUrls;
  }

  const pricing = getPricingConfigFromDb();
  const cost621 = Number(pricing?.imageModels?.func_621 ?? settings?.costImage621Iirky ?? settings?.costImageNoTextIirky ?? 5);
  const cost784 = Number(pricing?.imageModels?.func_784 ?? settings?.costImage784Iirky ?? settings?.costImageWithTextIirky ?? 10);
  const cost787 = Number(pricing?.imageModels?.func_787 ?? settings?.costImage787Iirky ?? 0);
  const cost791 = Number(pricing?.imageModels?.func_791 ?? settings?.costImage791Iirky ?? 15);
  const unit =
    genMode === 'func_791'
      ? cost791
      : genMode === 'func_784'
      ? cost784
      : genMode === 'func_621'
      ? cost621
      : cost787;
  const totalStepCost = unit * generatedImagesCount;
  const kindLabel =
    visualKind === 'slideshow' ? 'слайдер' : visualKind === 'collage' ? 'коллаж' : 'картинка';

  return {
    output: {
      visualKind,
      functionMode: genMode,
      aspectRatio: effectiveAspect,
      cascadeExecution: true,
      imageUrl: allGeneratedUrls[0] || '',
      imageUrls: allGeneratedUrls,
      parts: partsList
    },
    message: `Rich-визуал (${kindLabel}, ${effectiveAspect}, каскадно) создан: ${allGeneratedUrls.length} изобр.`,
    actualCost: totalStepCost
  };
}
