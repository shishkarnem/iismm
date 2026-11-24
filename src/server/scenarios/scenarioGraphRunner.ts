import {
  generateProkhorPrompt,
  generateTopicFromHistory,
  removeMarkdownEscaping
} from '../protalk';
import { enforceParagraphsAndRichBlocks } from '../formatting/textParagraphFormatter';
import { handleUnifiedImageGeneration } from '../imageBuilderService';
import { ScenarioRichPart } from '../../types';
import {
  generateFastTopic1Iirka,
  generateImagePrompt1Iirka,
  splitRichTextIntoParts,
  generateInlineButtonsFromPost1Iirka,
  resolveStepHandoffContext,
  applyScenarioTemplateVariables,
  buildScenarioMacroContext,
  normalizeRichGeneratedMarkdown
} from './scenarioAiHelpers';
import {
  resolveImageNodeFnMode,
  isVisualGeneratorNodeType,
  computeSingleNodeExecutionCost,
  collectRecentAuthorHistory,
  computeDynamicPublishSchedule,
  assembleRichPartsIntoMessage,
  evaluateLogicFilterNode,
  executeRichPartVisualNode,
  executePublishPostNode,
  hasV2MediaInScenarioChain,
  clampV2MediaCaptionText
} from './scenarioGraphHelpers';
import { runFullScenarioGraphExecution } from './runners/scenarioFullRunner';
import {
  buildV2TextStylingContext,
  executeBeautyPostNode
} from './styling/beautyPostRunner';
import { getPricingConfigFromDb } from '../pricing/pricingService';
import { formatIirkyCount } from '../../shared/pricingConfig';
import {
  combineSystemAndUserPrompt,
  getRequiredScenarioPrompt,
  renderPromptTemplate
} from './prompts/scenarioPromptsRepo';

export {
  resolveImageNodeFnMode,
  isVisualGeneratorNodeType,
  computeSingleNodeExecutionCost,
  collectRecentAuthorHistory,
  computeDynamicPublishSchedule,
  assembleRichPartsIntoMessage,
  evaluateLogicFilterNode,
  runFullScenarioGraphExecution
};

function resolveDownstreamVisualTargets(
  startNodeId: string,
  allNodes?: any[],
  edges?: any[]
): {
  targetFunctionMode: 'func_621' | 'func_784' | 'func_787' | 'func_791';
  aspectRatio: string;
  mediaType: string;
  hasDownstreamImageConsumer: boolean;
  firstVisualNode?: any;
} {
  const nodesList = Array.isArray(allNodes) ? allNodes : [];
  const edgesList = Array.isArray(edges) ? edges : [];
  const nodeMap = new Map<string, any>();
  nodesList.forEach((n) => {
    if (n?.id) nodeMap.set(n.id, n);
  });

  const downstreamOrdered: any[] = [];
  const hasOutgoing = edgesList.some((e) => e.sourceNodeId === startNodeId);

  if (hasOutgoing) {
    const visited = new Set<string>([startNodeId]);
    const queue: string[] = [startNodeId];
    while (queue.length > 0) {
      const curId = queue.shift()!;
      const outEdges = edgesList.filter((e) => e.sourceNodeId === curId);
      for (const edge of outEdges) {
        const nextId = edge?.targetNodeId;
        if (!nextId || visited.has(nextId)) continue;
        visited.add(nextId);
        const nextNode = nodeMap.get(nextId);
        if (nextNode && nextNode.enabled !== false) {
          downstreamOrdered.push(nextNode);
        }
        queue.push(nextId);
      }
    }
  } else {
    const startIdx = nodesList.findIndex((n) => n?.id === startNodeId);
    if (startIdx >= 0) {
      for (let i = startIdx + 1; i < nodesList.length; i++) {
        const n = nodesList[i];
        if (n && n.enabled !== false) downstreamOrdered.push(n);
      }
    }
  }

  const firstVisualNode = downstreamOrdered.find((n) => isVisualGeneratorNodeType(n.type));
  const firstPromptNode = downstreamOrdered.find((n) => n.type === 'ai_generate_image_prompt');
  const targetFunctionMode = firstVisualNode
    ? resolveImageNodeFnMode(firstVisualNode.type, firstVisualNode.config)
    : 'func_621';
  const defaultAspect =
    targetFunctionMode === 'func_791'
      ? 'auto'
      : targetFunctionMode === 'func_784'
      ? '9:16'
      : '16:9';
  const aspectRatio = String(firstVisualNode?.config?.aspectRatio || defaultAspect);
  const mediaType = firstVisualNode
    ? firstVisualNode.type === 'rich_part_slideshow'
      ? 'slideshow'
      : firstVisualNode.type === 'rich_part_collage'
      ? 'collage'
      : String(firstVisualNode.config?.mediaType || 'photo')
    : 'photo';

  return {
    targetFunctionMode,
    aspectRatio,
    mediaType,
    hasDownstreamImageConsumer: Boolean(firstVisualNode || firstPromptNode),
    firstVisualNode
  };
}

/**
 * Выполнение одного узла сценария (используется и в тестировании, и в боевом/крон запуске)
 */
export async function executeSingleScenarioNode(params: {
  node: {
    id: string;
    type: string;
    title: string;
    config?: Record<string, any>;
    isUnderDevelopment?: boolean;
  };
  runningContext: Record<string, any>;
  nodeOutputsMap: Record<string, Record<string, any>>;
  edges: any[];
  allNodes?: any[];
  cleanUserId: string;
  settings: any;
  isTestRun: boolean;
  allowLivePublishInTest?: boolean;
  runStartedAt: Date;
  scenarioMeta?: {
    id?: string;
    name?: string;
    category?: string;
    targetChannels?: string[];
    messageFormat?: 'v2' | 'rich';
  };
  onSubProgress?: (fraction: number, detail: string) => void;
}): Promise<{
  output: Record<string, any>;
  message: string;
  actualCost: number;
  branchTaken?: 'yes' | 'no';
}> {
  const {
    node,
    runningContext,
    nodeOutputsMap,
    edges,
    allNodes,
    cleanUserId,
    settings,
    isTestRun,
    allowLivePublishInTest,
    runStartedAt,
    scenarioMeta,
    onSubProgress
  } = params;
  const nodeType = node.type;
  const config = node.config || {};
  onSubProgress?.(0.15, `Подготовка входного контекста блока «${node.title}»...`);

  const incomingIds = (edges || [])
    .filter((e) => e.targetNodeId === node.id)
    .map((e) => e.sourceNodeId);
  const directUpstreamOutputs = incomingIds.map((id) => nodeOutputsMap[id]).filter(Boolean);
  const selectedIds: string[] = Array.isArray(config.sourceNodeIds) ? config.sourceNodeIds : [];
  const selectedNodeOutputs = selectedIds.map((id) => nodeOutputsMap[id]).filter(Boolean);

  if (!runningContext.runStartedAt) {
    runningContext.runStartedAt = runStartedAt;
  }
  if (
    (!Array.isArray(runningContext.targetChannels) || runningContext.targetChannels.length === 0) &&
    Array.isArray(scenarioMeta?.targetChannels) &&
    scenarioMeta!.targetChannels!.length > 0
  ) {
    runningContext.targetChannels = scenarioMeta!.targetChannels;
  }

  const handoff = resolveStepHandoffContext({
    nodeConfig: config,
    directUpstreamOutputs,
    selectedNodeOutputs,
    accumulatedContext: runningContext
  });
  const baseMacroVars = buildScenarioMacroContext(runningContext, handoff);

  if (node.isUnderDevelopment || nodeType === 'ai_rewrite' || nodeType === 'publish_crosspost') {
    const infoMsg =
      nodeType === 'ai_rewrite'
        ? 'Блок «Рерайт и уникализация» находится в разработке (чтение внешних ссылок скоро появится) — шаг пропущен без списания'
        : `Блок «${node.title}» находится в разработке — шаг пропущен`;
    return {
      output: { skippedUnderDevelopment: true, info: infoMsg },
      message: infoMsg,
      actualCost: 0
    };
  }

  if (nodeType === 'trigger_schedule') {
    const interval = config.cronInterval || 'daily';
    const time = config.cronTime || '10:00';
    return {
      output: {
        triggerReady: true,
        runStartedAt: runStartedAt.toISOString(),
        scheduleInfo: `Периодичность: ${interval}, старт: ${time}`
      },
      message: `Триггер расписания активен (${interval}, ${time})`,
      actualCost: 0
    };
  }

  if (nodeType === 'trigger_manual') {
    return {
      output: {
        triggerReady: true,
        runStartedAt: runStartedAt.toISOString(),
        scheduleInfo: 'Ручной старт цепочки активен'
      },
      message: 'Блок ручного запуска готов к работе',
      actualCost: 0
    };
  }

  if (nodeType === 'ai_generate_topic') {
    const pricing = getPricingConfigFromDb();
    const topicArchiveCost = pricing.scenarioAi.topicArchive;
    const historyDaysLimit = Math.min(365, Math.max(1, Number(config.historyDaysLimit || 30)));
    const excludeHistory = config.excludeHistory !== false;
    const uniqueHistory = excludeHistory
      ? collectRecentAuthorHistory(cleanUserId, historyDaysLimit)
      : [];
    const rawCategory = String(
      config.topicCategory || runningContext.category || 'Технологии и нейросети'
    );
    const category =
      applyScenarioTemplateVariables(rawCategory, baseMacroVars).trim() ||
      'Технологии и нейросети';
    onSubProgress?.(0.45, `Анализ истории постов (${historyDaysLimit} дн.) и подбор уникальной темы...`);
    const newTopic = await generateTopicFromHistory(category, uniqueHistory, {
      excludeHistory,
      historyDaysLimit,
      upstreamContext: handoff.formattedPayloadText,
      userId: cleanUserId
    });
    runningContext.topic = newTopic;
    runningContext.title = newTopic;
    runningContext.category = category;
    return {
      output: {
        topic: newTopic,
        title: newTopic,
        category,
        historyDaysLimit,
        excludeHistory,
        historyCheckedCount: uniqueHistory.length
      },
      message: `Тема с анализом истории сгенерирована: «${newTopic}»`,
      actualCost: topicArchiveCost
    };
  }

  if (nodeType === 'ai_generate_topic_fast') {
    const pricing = getPricingConfigFromDb();
    const fastCost = pricing.scenarioAi.topicFast;
    const rawCategory = String(
      config.topicCategory || runningContext.category || 'Технологии и нейросети'
    );
    const category =
      applyScenarioTemplateVariables(rawCategory, baseMacroVars).trim() ||
      'Технологии и нейросети';
    const expandedAngle = applyScenarioTemplateVariables(
      String(config.topicAngle || 'guide'),
      baseMacroVars
    ).trim();
    const expandedAudience = applyScenarioTemplateVariables(
      String(config.targetAudience || ''),
      baseMacroVars
    ).trim();
    const expandedKeywords = applyScenarioTemplateVariables(
      String(config.topicSeed || config.topicKeywords || ''),
      baseMacroVars
    ).trim();
    onSubProgress?.(0.45, `Генерация быстрой темы по рубрике «${category}»...`);
    const fastTopic = await generateFastTopic1Iirka({
      topicCategory: category,
      topicAngle: expandedAngle || 'guide',
      targetAudience: expandedAudience,
      topicKeywords: expandedKeywords,
      upstreamContext: handoff.formattedPayloadText,
      userId: cleanUserId
    });
    runningContext.topic = fastTopic;
    runningContext.title = fastTopic;
    runningContext.category = category;
    return {
      output: { topic: fastTopic, title: fastTopic, category },
      message: `Быстрая тема сгенерирована (${formatIirkyCount(fastCost)}): «${fastTopic}»`,
      actualCost: fastCost
    };
  }

  if (nodeType === 'ai_generate_text') {
    const format: 'v2' | 'rich' =
      (config.messageFormat ||
        scenarioMeta?.messageFormat ||
        runningContext.messageFormat ||
        'v2') === 'rich'
        ? 'rich'
        : 'v2';
    const v2MediaInfo =
      format === 'v2'
        ? hasV2MediaInScenarioChain(allNodes, runningContext)
        : { hasMedia: false, signatureReserve: 0 };
    const maxLimit =
      format === 'rich'
        ? 32000
        : v2MediaInfo.hasMedia
        ? Math.max(300, 1024 - v2MediaInfo.signatureReserve - 16)
        : 4096;
    const rawConfiguredMax = Number(
      config.maxChars || (format === 'rich' ? 6000 : v2MediaInfo.hasMedia ? 900 : 2500)
    );
    const maxChars = Math.min(
      maxLimit,
      Math.max(
        200,
        v2MediaInfo.hasMedia && rawConfiguredMax > maxLimit
          ? Math.min(900, maxLimit)
          : rawConfiguredMax
      )
    );
    const expandedTopicCat = applyScenarioTemplateVariables(
      String(config.topicCategory || ''),
      baseMacroVars
    ).trim();
    const topic =
      handoff.effectiveTopic ||
      expandedTopicCat ||
      scenarioMeta?.category ||
      'Экспертный пост';
    const textMacroVars = buildScenarioMacroContext(runningContext, handoff, {
      topic,
      title: topic
    });

    const downstreamTargets = resolveDownstreamVisualTargets(node.id, allNodes, edges);
    const needImagePrompt = downstreamTargets.hasDownstreamImageConsumer;
    const imagePromptMaxChars =
      downstreamTargets.targetFunctionMode === 'func_791' ? 5000 : 450;

    const rawInstruction = String(config.userPrompt || '').trim();
    const filledPrompt = rawInstruction
      ? applyScenarioTemplateVariables(rawInstruction, textMacroVars).trim()
      : '';
    const expandedPostStyle = applyScenarioTemplateVariables(
      String(config.postStyle || 'Стандартный экспертный'),
      textMacroVars
    ).trim();
    const expandedStyleDesc = applyScenarioTemplateVariables(
      String(config.styleDesc || 'Экспертный стиль'),
      textMacroVars
    ).trim();

    const v2Styling =
      format === 'v2'
        ? await buildV2TextStylingContext({
            config,
            macroVars: textMacroVars,
            topic,
            cleanUserId
          })
        : null;

    const memLimit =
      config.uniquenessMemoryCount !== undefined
        ? Math.min(30, Math.max(0, Number(config.uniquenessMemoryCount)))
        : 15;
    const uniqueHistory =
      memLimit > 0 ? collectRecentAuthorHistory(cleanUserId).slice(0, memLimit) : [];
    onSubProgress?.(
      0.45,
      format === 'v2'
        ? `Генерация и красивое оформление поста v2 (${v2Styling?.presetTitle || 'стандарт'})...`
        : 'Написание текста поста (Rich)...'
    );
    const resText = await generateProkhorPrompt(
      'Сегодня',
      topic,
      filledPrompt,
      undefined,
      uniqueHistory,
      {
        title: topic,
        currentText: handoff.effectiveText || '',
        handoffPayload: handoff.formattedPayloadText,
        minChars: config.minChars ? Number(config.minChars) : undefined,
        maxChars,
        messageFormat: format,
        postStyle: v2Styling?.resolvedStyleTitle || expandedPostStyle || 'Стандартный экспертный',
        styleDesc: v2Styling?.resolvedStylePrompt || expandedStyleDesc || 'Экспертный стиль',
        needImagePrompt,
        imagePromptMaxChars,
        beautyVars: v2Styling
          ? {
              presetTitle: v2Styling.presetTitle,
              presetRules: v2Styling.presetRules,
              headingRule: v2Styling.headingRule,
              formatFlagsRules: v2Styling.formatFlagsRules,
              exampleSection: v2Styling.exampleSection,
              extraWishes: v2Styling.extraWishes
            }
          : undefined,
        structureFlags: {
          includeHeading:
            format === 'v2' && v2Styling
              ? v2Styling.includeTopicHeading
              : config.richIncludeHeadings !== false,
          includeLists: config.richIncludeLists !== false,
          includeChecklist: Boolean(config.richIncludeChecklist),
          includeQuotes: Boolean(config.richIncludeQuotes),
          includeSpoilers: Boolean(config.richIncludeSpoilers),
          includeTable: Boolean(config.richIncludeTables),
          includeCallout: Boolean(config.richIncludeCallout),
          includeRichButtons: Boolean(config.richIncludeButtons)
        },
        userId: cleanUserId
      }
    );

    const rawUnescaped = enforceParagraphsAndRichBlocks(
      format === 'rich'
        ? normalizeRichGeneratedMarkdown(resText.content)
        : removeMarkdownEscaping(resText.content),
      format
    );
    const effectiveV2Limit = v2MediaInfo.hasMedia
      ? Math.min(maxChars, maxLimit)
      : Math.min(maxLimit, Math.max(250, maxChars + 450));
    const cleanedText =
      format === 'v2'
        ? clampV2MediaCaptionText(rawUnescaped, effectiveV2Limit)
        : rawUnescaped.slice(0, maxLimit);
    const finalTitle = resText.title || topic;
    runningContext.title = finalTitle;
    runningContext.topic = runningContext.topic || finalTitle;
    runningContext.text = cleanedText;
    runningContext.messageFormat = format;
    if (config.linkPreviewEnabled !== undefined) {
      runningContext.linkPreviewEnabled = config.linkPreviewEnabled;
    }
    if (resText.imagePrompt) runningContext.imagePrompt = resText.imagePrompt;

    const pricing = getPricingConfigFromDb();
    return {
      output: {
        title: finalTitle,
        topic: runningContext.topic,
        text: cleanedText,
        messageFormat: format,
        linkPreviewEnabled: runningContext.linkPreviewEnabled !== false,
        imagePrompt: resText.imagePrompt
      },
      message: `Текст поста (${format === 'rich' ? 'Rich' : 'v2'}) сгенерирован: ${cleanedText.length} симв.`,
      actualCost: pricing.scenarioAi.textGeneration
    };
  }

  if (nodeType === 'rich_split_parts') {
    const pricing = getPricingConfigFromDb();
    const sourceText = handoff.effectiveText || runningContext.text || '';
    const partsCount = Math.min(10, Math.max(1, Number(config.partsCount || 3)));
    const splitMode: 'ai_semantic' | 'headings_paragraphs' =
      config.splitMode === 'headings_paragraphs' ? 'headings_paragraphs' : 'ai_semantic';
    const keepHeadings =
      config.keepPartHeadings !== false && config.preservePartHeadings !== false;
    onSubProgress?.(0.45, `Разделение Rich-текста на ${partsCount} смысловых частей...`);
    const parts = await splitRichTextIntoParts({
      text: sourceText,
      title: handoff.effectiveTopic || runningContext.title,
      partsCount,
      splitMode,
      preserveHeadings: keepHeadings,
      userId: cleanUserId
    });
    runningContext.parts = parts;
    runningContext.keepPartHeadings = keepHeadings;
    runningContext.messageFormat = 'rich';
    const cost = splitMode === 'headings_paragraphs' ? 0 : pricing.scenarioAi.richSplitAi;
    return {
      output: {
        partsCount: parts.length,
        splitMode,
        keepPartHeadings: keepHeadings,
        parts
      },
      message: `Rich-текст разделен по смыслу на ${parts.length} ч.`,
      actualCost: cost
    };
  }

  if (nodeType === 'ai_generate_image_prompt') {
    const partsInCtx: ScenarioRichPart[] =
      Array.isArray(handoff.effectiveParts) && handoff.effectiveParts.length > 0
        ? handoff.effectiveParts
        : Array.isArray(runningContext.parts)
        ? runningContext.parts
        : [];

    const shouldProcessParts =
      partsInCtx.length > 0 &&
      config.promptSourceMode !== 'whole_post' &&
      (config.promptSourceMode === 'per_part' ||
        config.promptSourceMode === 'each_rich_part' ||
        config.handoffMode === 'parts_stream' ||
        partsInCtx.length > 1);

    const rawVisualStyle = String(
      config.promptVisualStyle || config.visualStylePreset || config.styleHint || ''
    );
    const rawNegativeHint = String(config.negativeHint || '');
    const rawExtra = String(config.promptExtraNotes || config.userPrompt || '');
    const downstreamTargets = resolveDownstreamVisualTargets(node.id, allNodes, edges);

    if (shouldProcessParts) {
      const updatedParts: ScenarioRichPart[] = [];
      for (let pIdx = 0; pIdx < partsInCtx.length; pIdx++) {
        const part = partsInCtx[pIdx];
        onSubProgress?.(
          Math.min(0.92, 0.2 + (pIdx / partsInCtx.length) * 0.72),
          `Генерация промпта картинки (${downstreamTargets.targetFunctionMode}) для части ${pIdx + 1} из ${partsInCtx.length}...`
        );
        const partMacroVars = buildScenarioMacroContext(runningContext, handoff, {
          text: part.text,
          partHeading: part.heading,
          partText: part.text,
          partIndex: part.index
        });
        const customInstr = applyScenarioTemplateVariables(rawExtra, partMacroVars).trim();
        const expandedVisualStyle = applyScenarioTemplateVariables(rawVisualStyle, partMacroVars).trim();
        const expandedNegative = applyScenarioTemplateVariables(rawNegativeHint, partMacroVars).trim();
        const partPrompt = await generateImagePrompt1Iirka({
          sourceTitle: part.heading || `${handoff.effectiveTopic} (часть ${part.index})`,
          sourceText: part.text,
          visualStylePreset: expandedVisualStyle,
          negativeHint: expandedNegative,
          customInstruction: customInstr,
          targetFunctionMode: downstreamTargets.targetFunctionMode,
          aspectRatio: downstreamTargets.aspectRatio,
          mediaType: downstreamTargets.mediaType,
          partIndex: part.index,
          isPerPart: true,
          userId: cleanUserId
        });
        updatedParts.push({ ...part, imagePrompt: partPrompt });
      }
      const pricing = getPricingConfigFromDb();
      const totalPromptCost = updatedParts.length * pricing.scenarioAi.imagePromptPerItem;
      runningContext.parts = updatedParts;
      runningContext.imagePrompt = updatedParts[0]?.imagePrompt || '';
      return {
        output: {
          prompt: updatedParts[0]?.imagePrompt || '',
          imagePrompt: updatedParts[0]?.imagePrompt || '',
          targetFunctionMode: downstreamTargets.targetFunctionMode,
          partPrompts: updatedParts.map((p) => ({
            index: p.index,
            heading: p.heading,
            prompt: p.imagePrompt
          })),
          parts: updatedParts
        },
        message: `Сгенерированы промпты картинок (${downstreamTargets.targetFunctionMode}) для ${updatedParts.length} частей Rich (${formatIirkyCount(totalPromptCost)})`,
        actualCost: totalPromptCost
      };
    }

    const wholePostMacroVars = buildScenarioMacroContext(runningContext, handoff, {
      text: handoff.formattedPayloadText || handoff.effectiveText
    });
    const customInstr = applyScenarioTemplateVariables(rawExtra, wholePostMacroVars).trim();
    const expandedVisualStyle = applyScenarioTemplateVariables(rawVisualStyle, wholePostMacroVars).trim();
    const expandedNegative = applyScenarioTemplateVariables(rawNegativeHint, wholePostMacroVars).trim();
    onSubProgress?.(
      0.45,
      `Создание промпта для генерации изображения (${downstreamTargets.targetFunctionMode})...`
    );
    const generatedPrompt = await generateImagePrompt1Iirka({
      sourceTitle: handoff.effectiveTopic || runningContext.title,
      sourceText: handoff.formattedPayloadText || runningContext.text,
      visualStylePreset: expandedVisualStyle,
      negativeHint: expandedNegative,
      customInstruction: customInstr,
      targetFunctionMode: downstreamTargets.targetFunctionMode,
      aspectRatio: downstreamTargets.aspectRatio,
      mediaType: downstreamTargets.mediaType,
      isPerPart: false,
      userId: cleanUserId
    });
    const pricing = getPricingConfigFromDb();
    const promptCost = pricing.scenarioAi.imagePromptPerItem;
    runningContext.imagePrompt = generatedPrompt;
    return {
      output: {
        prompt: generatedPrompt,
        imagePrompt: generatedPrompt,
        targetFunctionMode: downstreamTargets.targetFunctionMode
      },
      message: `Промпт для генерации картинки (${downstreamTargets.targetFunctionMode}) создан (${formatIirkyCount(promptCost)})`,
      actualCost: promptCost
    };
  }

  // Rich per-part visual blocks: rich_part_image, rich_part_slideshow, rich_part_collage
  if (
    nodeType === 'rich_part_image' ||
    nodeType === 'rich_part_slideshow' ||
    nodeType === 'rich_part_collage'
  ) {
    return executeRichPartVisualNode({
      nodeType,
      config,
      runningContext,
      handoff,
      cleanUserId,
      settings,
      onSubProgress
    });
  }

  if (nodeType === 'rich_assemble_post') {
    const rawAssembleSig = String(config.signature || runningContext.signature || '');
    const effectiveSignature = applyScenarioTemplateVariables(rawAssembleSig, baseMacroVars).trim();
    const shouldAttachSignature =
      config.appendSignatureInAssemble !== false &&
      config.assembleAttachSignature !== false &&
      Boolean(
        config.appendSignatureInAssemble === true ||
          config.assembleAttachSignature === true ||
          runningContext.signature
      );

    const assembled = assembleRichPartsIntoMessage({
      title: runningContext.title || runningContext.topic,
      parts: Array.isArray(runningContext.parts) ? runningContext.parts : [],
      fallbackText: runningContext.text || '',
      includeTitle:
        config.includeMainTitle !== false && config.assembleIncludeTitle !== false,
      includePartHeadings: runningContext.keepPartHeadings !== false,
      headingLevel: config.assembleHeadingLevel || 'h2',
      separator: config.partSeparator || config.assembleSeparator || 'blank_line',
      signature: effectiveSignature,
      attachSignature: shouldAttachSignature,
      coverUrl:
        (!Array.isArray(runningContext.parts) ||
          runningContext.parts.length === 0 ||
          !runningContext.parts.some(
            (p: any) => Array.isArray(p?.imageUrls) && p.imageUrls.length > 0
          )) &&
        runningContext.imageUrl
          ? runningContext.imageUrl
          : undefined
    });

    runningContext.text = assembled;
    runningContext.messageFormat = 'rich';
    runningContext.richAssembled = true;
    if (effectiveSignature) {
      runningContext.signature = effectiveSignature;
    }

    return {
      output: {
        title: runningContext.title || runningContext.topic,
        text: assembled,
        messageFormat: 'rich',
        richAssembled: true,
        partsMerged: Array.isArray(runningContext.parts) ? runningContext.parts.length : 1,
        imageUrls: runningContext.imageUrls || [],
        signature: effectiveSignature,
        inlineButtons: runningContext.inlineButtons || []
      },
      message: `Единое Rich-сообщение собрано (${assembled.length} симв.)`,
      actualCost: 0
    };
  }

  // Standard Image Generation Node
  if (
    nodeType === 'ai_generate_image' ||
    nodeType === 'ai_generate_image_with_text' ||
    nodeType === 'ai_generate_image_free' ||
    nodeType === 'ai_generate_image_no_text'
  ) {
    const genMode = resolveImageNodeFnMode(nodeType, config);
    const batchCount = Math.min(10, Math.max(1, Number(config.imageCount || 1)));
    const topicStr = String(
      handoff.effectiveTopic || runningContext.category || 'Экспертный контент'
    ).trim();
    const textSnippet = handoff.effectiveSummary.slice(0, genMode === 'func_791' ? 1200 : 240);
    const effectiveAspectRatio =
      config.aspectRatio ||
      (genMode === 'func_791' ? 'auto' : genMode === 'func_784' ? '9:16' : '16:9');
    const refUrls791 =
      config.images_urls ||
      config.imagesUrls791 ||
      config.images ||
      config.referenceUrl ||
      config.filesUrl ||
      undefined;

    let basePrompt = '';
    const imgMacroVars = buildScenarioMacroContext(runningContext, handoff, {
      topic: topicStr,
      summary: textSnippet
    });
    const expandedStyleHint = applyScenarioTemplateVariables(
      String(config.styleHint || ''),
      imgMacroVars
    ).trim();

    if (config.promptMode === 'auto_context' || !String(config.imagePrompt || '').trim()) {
      if (handoff.effectiveImagePrompt) {
        basePrompt = handoff.effectiveImagePrompt;
      } else {
        const dbImgPromptRec = await getRequiredScenarioPrompt('ai_generate_image', genMode);
        const renderedImgUser = renderPromptTemplate(dbImgPromptRec.user_prompt_template, {
          topic: topicStr,
          text_snippet: textSnippet,
          style_hint: expandedStyleHint,
          aspect_ratio: effectiveAspectRatio,
          media_type: config.mediaType || 'photo',
          has_references: Boolean(refUrls791)
        });
        basePrompt = combineSystemAndUserPrompt(dbImgPromptRec.system_prompt, renderedImgUser);
      }
    } else {
      basePrompt = applyScenarioTemplateVariables(String(config.imagePrompt), imgMacroVars);
    }

    const maxPromptLen = genMode === 'func_791' ? 5000 : 520;
    basePrompt = basePrompt
      .replace(/[\u2028\u2029]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxPromptLen);

    const batchSeriesRecord =
      batchCount > 1 ? await getRequiredScenarioPrompt('ai_generate_image', 'batch_series') : null;

    const generatedList: string[] = [];
    for (let i = 0; i < batchCount; i++) {
      onSubProgress?.(
        Math.min(0.92, 0.2 + (i / batchCount) * 0.72),
        batchCount > 1
          ? `Генерация изображения ${i + 1} из ${batchCount} (${genMode})...`
          : `Генерация изображения (${genMode})...`
      );
      const framePrompt = batchSeriesRecord
        ? combineSystemAndUserPrompt(
            batchSeriesRecord.system_prompt,
            renderPromptTemplate(batchSeriesRecord.user_prompt_template, {
              base_prompt: basePrompt,
              frame_index: i + 1,
              frames_total: batchCount,
              media_type: config.mediaType || 'album',
              aspect_ratio: effectiveAspectRatio
            })
          )
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, maxPromptLen)
        : basePrompt;
      const fnRes = await handleUnifiedImageGeneration({
        mode: genMode,
        prompt: framePrompt,
        userId: cleanUserId,
        aspectRatio: effectiveAspectRatio,
        referenceUrl: config.referenceUrl || config.filesUrl || undefined,
        resolution: '1K',
        ai_model:
          genMode === 'func_791'
            ? 'gpt-image-2.5-sunburst'
            : config.ai_model || 'am/flux.2-klein-4b',
        size: genMode === 'func_791' ? '' : config.size,
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
        throw new Error(fnRes.error || 'Ошибка генерации изображения');
      }
      generatedList.push(fnRes.imageUrl);
      onSubProgress?.(
        Math.min(0.97, 0.2 + ((i + 1) / batchCount) * 0.75),
        `Готово кадров: ${i + 1} из ${batchCount}`
      );
    }

    const targetMediaType = batchCount <= 1 ? 'photo' : config.mediaType || 'album';
    runningContext.imageUrl = generatedList[0];
    runningContext.imageUrls = generatedList;
    runningContext.mediaType = targetMediaType;
    runningContext.attachmentType =
      batchCount > 1 && runningContext.messageFormat !== 'rich' ? 'album' : 'photo';
    runningContext.imagePrompt = basePrompt;

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

    return {
      output: {
        imageUrl: generatedList[0],
        imageUrls: generatedList,
        mediaType: targetMediaType,
        functionMode: genMode,
        prompt: basePrompt
      },
      message:
        generatedList.length > 1
          ? `Сгенерировано картинок: ${generatedList.length} шт. (${targetMediaType})`
          : 'Изображение успешно сгенерировано',
      actualCost: unit * generatedList.length
    };
  }

  // Dedicated v2 Media Attachments (7 types) + legacy format_media
  if (nodeType === 'v2_media_attachment' || nodeType === 'format_media') {
    const kind =
      nodeType === 'v2_media_attachment'
        ? config.v2AttachmentKind || 'photo'
        : config.mediaType || runningContext.mediaType || 'photo';

    const attachFromCfg: string[] = Array.isArray(config.attachmentUrls)
      ? config.attachmentUrls.map((u: any) => String(u || '').trim()).filter(Boolean)
      : [];
    const filesFromCfg: string[] = Array.isArray(config.v2Files)
      ? config.v2Files.map((f: any) => String(f?.url || '').trim()).filter(Boolean)
      : [];
    const urlsFromCfg: string[] = Array.isArray(config.imageUrls)
      ? config.imageUrls.map((u: any) => String(u || '').trim()).filter(Boolean)
      : [];
    const singleCfg = config.imageUrl ? [String(config.imageUrl).trim()] : [];

    const resolvedUrls =
      attachFromCfg.length > 0
        ? attachFromCfg
        : filesFromCfg.length > 0
        ? filesFromCfg
        : urlsFromCfg.length > 0
        ? urlsFromCfg
        : singleCfg.length > 0
        ? singleCfg
        : Array.isArray(runningContext.imageUrls) && runningContext.imageUrls.length > 0
        ? runningContext.imageUrls
        : runningContext.imageUrl
        ? [runningContext.imageUrl]
        : [];

    if (kind === 'voice') {
      runningContext.attachmentType = 'voice';
      runningContext.audioFormat = 'voice';
    } else if (
      kind === 'video' ||
      kind === 'video_note' ||
      kind === 'audio' ||
      kind === 'document' ||
      kind === 'album' ||
      kind === 'photo'
    ) {
      runningContext.attachmentType = kind;
      if (kind === 'audio') runningContext.audioFormat = 'audio';
    } else {
      runningContext.attachmentType = resolvedUrls.length > 1 ? 'album' : 'photo';
    }

    runningContext.mediaType = kind;
    runningContext.imageUrls = resolvedUrls;
    if (resolvedUrls[0]) runningContext.imageUrl = resolvedUrls[0];
    if (config.audioTitle !== undefined) {
      runningContext.audioTitle = applyScenarioTemplateVariables(
        String(config.audioTitle || ''),
        baseMacroVars
      ).trim();
    }
    if (config.audioPerformer !== undefined) {
      runningContext.audioPerformer = applyScenarioTemplateVariables(
        String(config.audioPerformer || ''),
        baseMacroVars
      ).trim();
    }
    if (config.protectContent !== undefined) {
      runningContext.protectContent = Boolean(config.protectContent);
    }
    const expandedCaption = String(config.captionText || '').trim()
      ? applyScenarioTemplateVariables(String(config.captionText).trim(), baseMacroVars).trim()
      : '';
    if (!String(runningContext.text || '').trim() && expandedCaption) {
      runningContext.text = expandedCaption;
    }

    const kindNames: Record<string, string> = {
      photo: 'Фото',
      album: 'Медиа-альбом',
      video: 'Видео',
      video_note: 'Видео-кружок',
      audio: 'Аудио',
      voice: 'Голосовое сообщение',
      document: 'Файлы / документы',
      slideshow: 'Слайдер Rich',
      collage: 'Коллаж Rich'
    };

    return {
      output: {
        mediaType: kind,
        attachmentKind: kind,
        attachmentUrls: resolvedUrls,
        attachmentType: runningContext.attachmentType,
        audioFormat: runningContext.audioFormat,
        audioTitle: runningContext.audioTitle || '',
        audioPerformer: runningContext.audioPerformer || '',
        protectContent: Boolean(runningContext.protectContent),
        captionText: expandedCaption,
        imageUrl: resolvedUrls[0] || '',
        imageUrls: resolvedUrls
      },
      message: `Вложение «${kindNames[kind] || kind}» подготовлено (${resolvedUrls.length} файл.)`,
      actualCost: 0
    };
  }

  if (nodeType === 'format_inline_buttons') {
    const expandButtonsRows = (rows: any): any[] =>
      Array.isArray(rows)
        ? rows.map((row) =>
            Array.isArray(row)
              ? row.map((btn: any) => ({
                  ...btn,
                  text: applyScenarioTemplateVariables(String(btn?.text || ''), baseMacroVars).trim(),
                  url: applyScenarioTemplateVariables(String(btn?.url || ''), baseMacroVars).trim()
                }))
              : row
          )
        : [];

    if (config.buttonsMode === 'ai_from_post') {
      const perRowNum = Number(config.aiButtonsPerRow || 1);
      const rawCustomInstr = String(
        config.aiButtonsCustomInstruction || config.aiButtonsTone || ''
      ).trim();
      const rawTone = String(config.aiButtonsTone || '').trim();
      const rawDefaultUrl = String(
        config.defaultButtonUrl || config.aiButtonsDefaultUrl || 'https://t.me/IIrkiBot'
      ).trim();
      const expandedTargetUrls = Array.isArray(config.aiButtonUrls)
        ? config.aiButtonUrls.map((u: any) =>
            applyScenarioTemplateVariables(String(u || ''), baseMacroVars).trim()
          )
        : undefined;
      const generatedRows = await generateInlineButtonsFromPost1Iirka({
        postTitle: handoff.effectiveTopic || runningContext.title,
        postText: handoff.effectiveText || runningContext.text,
        buttonsCount: config.aiButtonsCount || 2,
        buttonsPerRow: perRowNum === 3 ? 3 : perRowNum === 2 ? 2 : 1,
        layoutRule: config.aiButtonsLayoutRule || undefined,
        customInstruction: rawCustomInstr
          ? applyScenarioTemplateVariables(rawCustomInstr, baseMacroVars).trim()
          : undefined,
        defaultUrl: applyScenarioTemplateVariables(rawDefaultUrl, baseMacroVars).trim() || 'https://t.me/IIrkiBot',
        targetUrls: expandedTargetUrls,
        existingRows: expandButtonsRows(config.inlineButtons),
        tone: rawTone ? applyScenarioTemplateVariables(rawTone, baseMacroVars).trim() : undefined,
        userId: cleanUserId
      });
      const pricing = getPricingConfigFromDb();
      const btnCost = pricing.textAi.inlineButtons;
      runningContext.inlineButtons = generatedRows;
      return {
        output: { inlineButtons: generatedRows, generatedByAi: true },
        message: `Инлайн-кнопки сгенерированы по тексту поста (${generatedRows.flat().length} шт., ${formatIirkyCount(btnCost)})`,
        actualCost: btnCost
      };
    }

    const buttons = expandButtonsRows(config.inlineButtons || []);
    runningContext.inlineButtons = buttons;
    return {
      output: { inlineButtons: buttons },
      message: `Инлайн-кнопки прикреплены (${buttons.length} рядов)`,
      actualCost: 0
    };
  }

  if (nodeType === 'format_beauty_post') {
    const activeFmt: 'v2' | 'rich' =
      (config.messageFormat || scenarioMeta?.messageFormat || runningContext.messageFormat) === 'rich'
        ? 'rich'
        : 'v2';
    return executeBeautyPostNode({
      config,
      runningContext,
      handoff,
      allNodes,
      cleanUserId,
      scenarioFormat: activeFmt,
      onSubProgress
    });
  }

  if (nodeType === 'format_signature') {
    const rawSig = String(config.signature || '');
    const sig = applyScenarioTemplateVariables(rawSig, baseMacroVars).trim();
    runningContext.signature = sig;
    return {
      output: { signature: sig },
      message: 'Подпись и ссылки применены',
      actualCost: 0
    };
  }

  if (nodeType === 'logic_filter') {
    const evalRes = evaluateLogicFilterNode(config, runningContext);
    return {
      output: {
        passed: evalRes.passed,
        branch: evalRes.branch,
        summary: evalRes.details.join('; '),
        conditionDetails: evalRes.details
      },
      message: evalRes.passed
        ? `Условие выполнено -> переход по ветке «Да» (${evalRes.details.join('; ')})`
        : `Условие не выполнено -> переход по ветке «Нет» (${evalRes.details.join('; ')})`,
      actualCost: 0,
      branchTaken: evalRes.branch
    };
  }

  if (nodeType === 'logic_delay') {
    const mins = Math.max(1, Number(config.delayMinutes || 15));
    runningContext.extraDelayMinutes = (Number(runningContext.extraDelayMinutes) || 0) + mins;
    return {
      output: { delayMinutes: mins },
      message: `Добавлена пауза ${mins} мин.`,
      actualCost: 0
    };
  }

  // Unified Publish Node + Legacy save_draft & publish_telegram
  if (
    nodeType === 'publish_post' ||
    nodeType === 'publish_telegram' ||
    nodeType === 'save_draft'
  ) {
    return executePublishPostNode({
      nodeType,
      config,
      runningContext,
      cleanUserId,
      isTestRun,
      allowLivePublishInTest,
      runStartedAt: runStartedAt || (runningContext.runStartedAt ? new Date(runningContext.runStartedAt) : new Date()),
      scenarioMeta
    });
  }

  if (nodeType === 'notify_author') {
    return {
      output: { notified: true },
      message: 'Уведомление автору подготовлено',
      actualCost: 0
    };
  }

  return {
    output: { ok: true },
    message: `Шаг «${node.title}» выполнен`,
    actualCost: 0
  };
}
