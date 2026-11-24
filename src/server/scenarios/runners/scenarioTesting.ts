import { DB } from '../../db';
import { getPgDB, savePgDB } from '../../db/postgres';
import {
  getScenarioByIdFromDb,
  saveScenarioTestResultsInDb,
  ScenarioNodeTestRecord
} from '../../db/sceneriesTable';
import { sendPrivateTelegramNotification } from '../../telegram';
import {
  resolveImageNodeFnMode,
  computeSingleNodeExecutionCost,
  executeSingleScenarioNode
} from '../scenarioGraphRunner';
import { startSmoothStepTicker } from '../live/liveScenarioRoutes';

export { resolveImageNodeFnMode, computeSingleNodeExecutionCost };

/**
 * Вычисляет упорядоченную цепочку узлов до целевого блока (targetNodeId) для тестирования цепочки.
 */
export function resolveOrderedChainToTarget(
  nodes: any[],
  edges: any[],
  targetNodeId: string
): any[] {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];
  const targetIdx = nodes.findIndex((n) => n.id === targetNodeId);
  if (targetIdx === -1) return [];
  const targetNode = nodes[targetIdx];

  const validEdges = Array.isArray(edges) ? edges : [];
  const hasIncomingToTarget = validEdges.some((e) => e.targetNodeId === targetNodeId);

  if (!hasIncomingToTarget) {
    return nodes
      .slice(0, targetIdx + 1)
      .filter((n) => n.id === targetNodeId || (n.enabled !== false && !n.isUnderDevelopment));
  }

  const visitedIds = new Set<string>([targetNodeId]);
  const queue: string[] = [targetNodeId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    validEdges
      .filter((e) => e.targetNodeId === cur)
      .forEach((e) => {
        if (e.sourceNodeId && !visitedIds.has(e.sourceNodeId)) {
          const srcNode = nodes.find((n) => n.id === e.sourceNodeId);
          if (srcNode && srcNode.enabled !== false && !srcNode.isUnderDevelopment) {
            visitedIds.add(e.sourceNodeId);
            queue.push(e.sourceNodeId);
          }
        }
      });
  }

  const subNodes = nodes.filter((n) => visitedIds.has(n.id));
  const subEdges = validEdges.filter(
    (e) => visitedIds.has(e.sourceNodeId) && visitedIds.has(e.targetNodeId)
  );
  const inDegree = new Map<string, number>();
  subNodes.forEach((n) => inDegree.set(n.id, 0));
  subEdges.forEach((e) => {
    inDegree.set(e.targetNodeId, (inDegree.get(e.targetNodeId) || 0) + 1);
  });

  const ordered: any[] = [];
  const ready = subNodes
    .filter((n) => (inDegree.get(n.id) || 0) === 0)
    .sort((a, b) => (a.y ?? 0) - (b.y ?? 0));

  while (ready.length > 0) {
    const current = ready.shift()!;
    if (current.id !== targetNodeId) {
      ordered.push(current);
    }
    subEdges
      .filter((e) => e.sourceNodeId === current.id)
      .forEach((e) => {
        const nextDeg = (inDegree.get(e.targetNodeId) || 1) - 1;
        inDegree.set(e.targetNodeId, nextDeg);
        if (nextDeg === 0) {
          const nextNode = subNodes.find((n) => n.id === e.targetNodeId);
          if (nextNode) {
            ready.push(nextNode);
            ready.sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
          }
        }
      });
  }

  subNodes.forEach((n) => {
    if (n.id !== targetNodeId && !ordered.some((o) => o.id === n.id)) {
      ordered.push(n);
    }
  });
  ordered.push(targetNode);
  return ordered;
}

export async function executeScenarioTestAndPersist(params: {
  scenarioId?: string;
  scenarioSnapshot?: any;
  targetNodeId?: string;
  testMode?: 'single' | 'chain';
  allowLivePublish?: boolean;
  nodeType?: string;
  config?: Record<string, any>;
  context?: Record<string, any>;
  userId?: string;
  telegramId?: number;
  onEvent?: (evt: Record<string, any>) => void;
}) {
  const onEvent = params.onEvent;
  const cleanUserId = params.userId ? String(params.userId) : '16926299042';
  const testMode: 'single' | 'chain' = params.testMode === 'chain' ? 'chain' : 'single';
  const sqlDb = await getPgDB();
  const settings = DB.getSettings();
  const runStartedAt = new Date();

  const scenarioId = params.scenarioId || params.scenarioSnapshot?.id || '';
  const dbScenario = scenarioId ? getScenarioByIdFromDb(sqlDb, scenarioId) : null;
  const activeScenario = params.scenarioSnapshot
    ? { ...(dbScenario || {}), ...params.scenarioSnapshot }
    : dbScenario;

  const nodes: any[] = Array.isArray(activeScenario?.nodes) ? activeScenario.nodes : [];
  const edges: any[] = Array.isArray(activeScenario?.edges) ? activeScenario.edges : [];

  let nodesToExecute: any[] = [];
  if (params.targetNodeId && nodes.length > 0) {
    if (testMode === 'chain') {
      nodesToExecute = resolveOrderedChainToTarget(nodes, edges, params.targetNodeId);
    } else {
      const target = nodes.find((n) => n.id === params.targetNodeId);
      if (target) nodesToExecute = [target];
    }
  }

  if (nodesToExecute.length === 0 && params.nodeType) {
    nodesToExecute = [
      {
        id: params.targetNodeId || 'temp_node',
        type: params.nodeType,
        title: 'Шаг сценария',
        config: params.config || {}
      }
    ];
  }

  if (nodesToExecute.length === 0) {
    throw new Error('Блок для тестирования не найден в сценарии');
  }

  const existingDbResults: Record<string, ScenarioNodeTestRecord> =
    dbScenario?.testResults && typeof dbScenario.testResults === 'object'
      ? dbScenario.testResults
      : {};

  // Estimate cost upfront (with known parts count from split node or saved DB results)
  const splitNode = nodes.find((n) => n.type === 'rich_split_parts');
  const savedSplitCount = splitNode
    ? Number(
        existingDbResults[splitNode.id]?.output?.partsCount || splitNode.config?.partsCount || 1
      )
    : 1;

  const estimatedTotalCost = nodesToExecute.reduce(
    (sum, n) => sum + computeSingleNodeExecutionCost(n.type, n.config, settings, savedSplitCount),
    0
  );

  const user =
    DB.getUsers().find((u) => u.id === cleanUserId) ||
    DB.getUsers().find((u) => u.role === 'admin');
  if (estimatedTotalCost > 0 && user && (user.balance || 0) < estimatedTotalCost) {
    const err = new Error(
      `Недостаточно Иирок для тестирования! Стоимость: ${estimatedTotalCost} Иирок, ваш баланс: ${
        user.balance || 0
      } Иирок.`
    ) as any;
    err.statusCode = 402;
    throw err;
  }

  const pubNodeForCtx = nodes.find(
    (n) =>
      n.enabled !== false &&
      (n.type === 'publish_post' || n.type === 'publish_telegram' || n.type === 'save_draft')
  );
  const trigNodeForCtx = nodes.find((n) => n.enabled !== false && n.type === 'trigger_schedule');
  const initialChannels: string[] =
    Array.isArray(pubNodeForCtx?.config?.channels) && pubNodeForCtx.config.channels.length > 0
      ? pubNodeForCtx.config.channels
      : pubNodeForCtx?.config?.channelId
      ? [String(pubNodeForCtx.config.channelId)]
      : Array.isArray(activeScenario?.targetChannels) && activeScenario.targetChannels.length > 0
      ? activeScenario.targetChannels
      : [];
  const initialTimezone = String(
    pubNodeForCtx?.config?.timezone ||
      trigNodeForCtx?.config?.timezone ||
      params.context?.timezone ||
      'Europe/Moscow'
  ).trim() || 'Europe/Moscow';

  const runningContext: Record<string, any> = {
    category:
      activeScenario?.category ||
      activeScenario?.topicCategory ||
      params.context?.category ||
      'Технологии и нейросети',
    messageFormat: activeScenario?.messageFormat || 'v2',
    telegramId: params.telegramId,
    targetChannels: initialChannels,
    timezone: initialTimezone,
    runStartedAt,
    ...(params.context || {})
  };
  const nodeOutputsMap: Record<string, Record<string, any>> = {};

  // Pre-seed nodeOutputsMap and runningContext from saved DB outputs of predecessor blocks
  Object.entries(existingDbResults).forEach(([nid, rec]) => {
    if (rec?.output) {
      nodeOutputsMap[nid] = rec.output;
    }
  });

  if (testMode === 'single' && params.targetNodeId && nodes.length > 0) {
    const upstreamChain = resolveOrderedChainToTarget(nodes, edges, params.targetNodeId).filter(
      (n) => n.id !== params.targetNodeId
    );
    upstreamChain.forEach((upNode) => {
      const saved = existingDbResults[upNode.id]?.output;
      if (!saved) return;
      if (saved.topic) runningContext.topic = saved.topic;
      if (saved.title) runningContext.title = saved.title;
      if (saved.text) runningContext.text = saved.text;
      if (saved.imagePrompt || saved.prompt) {
        runningContext.imagePrompt = saved.imagePrompt || saved.prompt;
      }
      if (saved.imageUrl) runningContext.imageUrl = saved.imageUrl;
      if (Array.isArray(saved.imageUrls) && saved.imageUrls.length > 0) {
        runningContext.imageUrls = saved.imageUrls;
      } else if (Array.isArray(saved.attachmentUrls) && saved.attachmentUrls.length > 0) {
        runningContext.imageUrls = saved.attachmentUrls;
        runningContext.attachmentUrls = saved.attachmentUrls;
      }
      if (Array.isArray(saved.parts) && saved.parts.length > 0) {
        runningContext.parts = saved.parts;
      }
      if (saved.mediaType) runningContext.mediaType = saved.mediaType;
      if (saved.attachmentType) runningContext.attachmentType = saved.attachmentType;
      else if (saved.attachmentKind) runningContext.attachmentType = saved.attachmentKind;
      if (saved.audioFormat) runningContext.audioFormat = saved.audioFormat;
      if (saved.audioTitle) runningContext.audioTitle = saved.audioTitle;
      if (saved.audioPerformer) runningContext.audioPerformer = saved.audioPerformer;
      if (saved.protectContent !== undefined) runningContext.protectContent = saved.protectContent;
      if (saved.keepPartHeadings !== undefined) {
        runningContext.keepPartHeadings = saved.keepPartHeadings;
      }
      if (saved.linkPreviewEnabled !== undefined) {
        runningContext.linkPreviewEnabled = saved.linkPreviewEnabled;
      }
      if (saved.signature) runningContext.signature = saved.signature;
      if (saved.inlineButtons) runningContext.inlineButtons = saved.inlineButtons;
      if (saved.messageFormat) runningContext.messageFormat = saved.messageFormat;
      if (saved.richAssembled) runningContext.richAssembled = true;
    });
  }

  // Reuse previous test draftId only if it was a test draft and not already published/scheduled
  if (!runningContext.draftId) {
    const publishStep = nodesToExecute.find(
      (n) => n.type === 'publish_post' || n.type === 'publish_telegram' || n.type === 'save_draft'
    );
    const prevRec = publishStep ? existingDbResults[publishStep.id] : undefined;
    const prevDraftId = prevRec && prevRec.mode !== 'full' ? prevRec.output?.draftId : undefined;
    if (prevDraftId) {
      const existingDraft = DB.getDayRequests().find((r) => String(r.id) === String(prevDraftId));
      if (existingDraft && existingDraft.status !== 'опубликован' && existingDraft.status !== 'запланирован') {
        runningContext.draftId = prevDraftId;
      }
    }
  }

  const patchResults: Record<string, ScenarioNodeTestRecord> = {};
  const stepMessages: string[] = [];
  const testedAt = runStartedAt.toISOString();
  let actualChargedTotal = 0;
  let deliveryError: string | undefined;

  const totalSteps = Math.max(1, nodesToExecute.length);
  let highestPct = 2;
  const monotonicPct = (candidate: number) => {
    highestPct = Math.max(highestPct, Math.min(99, Math.round(candidate)));
    return highestPct;
  };

  onEvent?.({
    type: 'init',
    mode: testMode,
    totalSteps,
    percent: highestPct,
    steps: nodesToExecute.map((n) => ({
      nodeId: n.id,
      nodeTitle: n.title || 'Шаг сценария',
      nodeType: n.type,
      status: 'pending',
      stepPercent: 0
    }))
  });

  for (let i = 0; i < nodesToExecute.length; i++) {
    const stepNode = nodesToExecute[i];
    const stepTitle = stepNode.title || 'Шаг сценария';
    let highestStepPct = 8;

    onEvent?.({
      type: 'step_start',
      stepIndex: i,
      totalSteps,
      nodeId: stepNode.id,
      nodeTitle: stepTitle,
      nodeType: stepNode.type,
      stepPercent: highestStepPct,
      percent: monotonicPct(((i + 0.08) / totalSteps) * 100),
      detail: `Выполняется шаг ${i + 1} из ${totalSteps}: «${stepTitle}»...`
    });

    const emitSubProgress = (frac: number, detail: string) => {
      const clampedFrac = Math.min(0.96, Math.max(0.1, frac));
      highestStepPct = Math.max(highestStepPct, Math.round(clampedFrac * 100));
      onEvent?.({
        type: 'step_progress',
        stepIndex: i,
        totalSteps,
        nodeId: stepNode.id,
        nodeTitle: stepTitle,
        stepPercent: highestStepPct,
        percent: monotonicPct(((i + clampedFrac) / totalSteps) * 100),
        detail
      });
    };

    const stopTicker = startSmoothStepTicker(emitSubProgress, stepTitle, stepNode.type);
    let stepRes;
    try {
      stepRes = await executeSingleScenarioNode({
        node: stepNode,
        runningContext,
        nodeOutputsMap,
        edges,
        allNodes: nodes,
        cleanUserId,
        settings,
        isTestRun: true,
        allowLivePublishInTest: Boolean(params.allowLivePublish),
        runStartedAt,
        scenarioMeta: activeScenario,
        onSubProgress: emitSubProgress
      });
    } finally {
      stopTicker();
    }

    nodeOutputsMap[stepNode.id] = stepRes.output;
    actualChargedTotal += stepRes.actualCost;
    stepMessages.push(stepRes.message);
    if (
      stepRes.output?.publishError ||
      (stepRes.output?.published === false &&
        !stepRes.output?.scheduled &&
        !stepRes.output?.savedDraft &&
        stepRes.output?.publishTimingMode !== 'draft_only')
    ) {
      deliveryError = String(
        stepRes.output?.publishError || 'Не удалось доставить публикацию в Telegram'
      );
    }
    patchResults[stepNode.id] = {
      nodeId: stepNode.id,
      nodeTitle: stepTitle,
      nodeType: stepNode.type,
      output: stepRes.output,
      cost: stepRes.actualCost,
      mode: testMode,
      testedAt
    };

    // Persist each completed step immediately to PostgreSQL so live result view works while chain is running
    if (scenarioId) {
      try {
        const partialSaved = saveScenarioTestResultsInDb(
          sqlDb,
          scenarioId,
          { [stepNode.id]: patchResults[stepNode.id] },
          activeScenario
        );
        savePgDB();
        DB.updateScenario(scenarioId, { testResults: partialSaved });
      } catch {}
    }

    onEvent?.({
      type: 'step_done',
      stepIndex: i,
      totalSteps,
      nodeId: stepNode.id,
      nodeTitle: stepTitle,
      stepPercent: 100,
      percent: monotonicPct(((i + 1) / totalSteps) * 100),
      cost: stepRes.actualCost,
      message: stepRes.message,
      record: patchResults[stepNode.id]
    });

    // If testing a chain through a logic_filter node and the edge to the next node is on the opposite branch, note it clearly
    if (testMode === 'chain' && stepNode.type === 'logic_filter' && i < nodesToExecute.length - 1) {
      const nextInChain = nodesToExecute[i + 1];
      const connectingEdge = edges.find(
        (e) => e.sourceNodeId === stepNode.id && e.targetNodeId === nextInChain.id
      );
      if (connectingEdge) {
        const edgeBranch =
          connectingEdge.branch === 'no' || connectingEdge.sourceHandle === 'no' ? 'no' : 'yes';
        if (stepRes.branchTaken && edgeBranch !== stepRes.branchTaken) {
          const skipMsg = `Блок условия направил выполнение по ветке «${
            stepRes.branchTaken === 'yes' ? 'Да' : 'Нет'
          }» — целевой блок находится на противоположной ветке.`;
          stepMessages.push(skipMsg);
          const skippedIds = nodesToExecute.slice(i + 1).map((sn) => sn.id);
          onEvent?.({
            type: 'step_skipped',
            skippedIds,
            detail: skipMsg
          });
          break;
        }
      }
    }
  }

  let updatedBalance = user?.balance;
  if (actualChargedTotal > 0 && user) {
    const updatedUser = DB.updateUser(user.id, {
      balance: Math.max(0, (user.balance || 0) - actualChargedTotal)
    });
    updatedBalance = updatedUser.balance;

    try {
      sqlDb.run(
        `INSERT INTO transactions (id, user_id, type, balance_type, amount, description, status, created_at)
         VALUES (?, ?, 'cost', 'iirky', ?, ?, 'completed', ?)`,
        [
          `tx_test_${Date.now()}`,
          user.id,
          -actualChargedTotal,
          `Тестирование сценария «${activeScenario?.name || 'Сценарий'}»`,
          testedAt
        ]
      );
    } catch {}
  }

  const publishStepRecord = Object.values(patchResults).find(
    (r) => r.nodeType === 'publish_post' || r.nodeType === 'publish_telegram' || r.nodeType === 'save_draft'
  );
  const notifyTgId = params.telegramId || user?.telegramId;
  if (notifyTgId && (actualChargedTotal > 0 || Boolean(params.allowLivePublish && publishStepRecord))) {
    const pubOut = publishStepRecord?.output || {};
    const statusLine = deliveryError
      ? `Статус публикации: ошибка доставки в канал (${deliveryError})`
      : pubOut.published
      ? `Статус публикации: отправлено в ${pubOut.channel || 'Telegram'}${pubOut.messageId ? ` (пост #${pubOut.messageId})` : ''}`
      : pubOut.scheduled
      ? `Статус публикации: отложено в черновики (${pubOut.timingSummary || 'по графику'}), в канал сейчас НЕ отправлено`
      : pubOut.savedDraft
      ? 'Статус публикации: сохранено в черновики'
      : publishStepRecord
      ? 'Статус публикации: проверка без отправки в канал'
      : '';
    await sendPrivateTelegramNotification(
      notifyTgId,
      `Тестирование сценария «${activeScenario?.name || 'Сценарий'}»\n\n` +
        `Режим: ${
          testMode === 'chain'
            ? `Цепочка (${Object.keys(patchResults).length} шагов)`
            : `Один блок (${nodesToExecute[0]?.title})`
        }\n` +
        (statusLine ? `${statusLine}\n` : '') +
        `Списано: ${actualChargedTotal} Иирок\n` +
        `Остаток баланса: ${updatedBalance !== undefined ? updatedBalance : 'без изменений'} Иирок.`
    ).catch(() => null);
  }

  let allSavedResults = patchResults;
  if (scenarioId) {
    allSavedResults = saveScenarioTestResultsInDb(sqlDb, scenarioId, patchResults, activeScenario);
    savePgDB();
    try {
      DB.updateScenario(scenarioId, { testResults: allSavedResults });
    } catch {
      if (activeScenario) {
        DB.addScenario({ ...activeScenario, id: scenarioId, testResults: allSavedResults });
      }
    }
  }

  const executedIds = Object.keys(patchResults);
  const finalNodeId = executedIds[executedIds.length - 1] || nodesToExecute[nodesToExecute.length - 1].id;
  const targetRecord = allSavedResults[finalNodeId] || patchResults[finalNodeId];

  const finalPayload = {
    success: !deliveryError,
    deliveryError,
    published: deliveryError ? false : targetRecord?.output?.published,
    testMode,
    executedCount: executedIds.length,
    cost: actualChargedTotal,
    output: targetRecord?.output || {},
    targetRecord,
    testResults: allSavedResults,
    message: deliveryError
      ? `Ошибка доставки в канал: ${deliveryError}`
      : testMode === 'chain'
      ? `Цепочка (${executedIds.length} ш.) протестирована и сохранена в базе данных`
      : stepMessages[stepMessages.length - 1] || 'Тест блока выполнен и сохранен в базе данных',
    balance: updatedBalance
  };

  onEvent?.({
    type: 'complete',
    percent: 100,
    result: finalPayload
  });

  return finalPayload;
}

export async function getScenarioTestResultsFromPg(scenarioId: string, nodeId?: string) {
  const sqlDb = await getPgDB();
  const row = getScenarioByIdFromDb(sqlDb, scenarioId);
  if (!row) {
    const fallback = DB.getScenarios().find((s) => s.id === scenarioId);
    const map = fallback?.testResults || {};
    return {
      scenarioId,
      scenarioName: fallback?.name || 'Сценарий',
      testResults: map,
      nodeResult: nodeId ? map[nodeId] || null : null
    };
  }
  const map: Record<string, ScenarioNodeTestRecord> = row.testResults || {};
  return {
    scenarioId: row.id,
    scenarioName: row.name,
    testResults: map,
    nodeResult: nodeId ? map[nodeId] || null : null
  };
}

