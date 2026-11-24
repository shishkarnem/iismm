import { DB } from '../../db';
import { getPgDB, savePgDB } from '../../db/postgres';
import {
  getScenarioByIdFromDb,
  upsertScenarioInDb,
  saveScenarioTestResultsInDb,
  ScenarioNodeTestRecord
} from '../../db/sceneriesTable';
import { sendPrivateTelegramNotification } from '../../telegram';
import { computeSingleNodeExecutionCost } from '../scenarioGraphHelpers';
import { executeSingleScenarioNode } from '../scenarioGraphRunner';
import { startSmoothStepTicker } from '../live/liveScenarioRoutes';

/**
 * Полный графовый запуск сценария (учитывает ветвление logic_filter Да/Нет, части Rich 1..10,
 * динамическую публикацию, потоковый прогресс onEvent и честный статус доставки).
 */
export async function runFullScenarioGraphExecution(
  scenarioId: string,
  userId?: string,
  telegramId?: number,
  onEvent?: (evt: Record<string, any>) => void,
  cronMeta?: { scheduledSlotKey?: string; nextRunIsoAfter?: string | null }
) {
  const sqlDb = await getPgDB();
  const dbScen = getScenarioByIdFromDb(sqlDb, scenarioId);
  const memScen = DB.getScenarios().find((s) => s.id === scenarioId);
  const scenario = dbScen || memScen;
  if (!scenario) {
    throw new Error('Сценарий не найден в базе данных');
  }

  const runStartedAt = new Date();
  const cleanUserId = String(userId || scenario.userId || '16926299042');
  const settings = DB.getSettings();
  const nodes: any[] = Array.isArray(scenario.nodes) ? scenario.nodes : [];
  const edges: any[] = Array.isArray(scenario.edges) ? scenario.edges : [];

  const user =
    DB.getUsers().find((u) => u.id === cleanUserId) ||
    DB.getUsers().find((u) => u.role === 'admin');

  const estimatedParts = Math.max(
    1,
    Number(nodes.find((n) => n.type === 'rich_split_parts')?.config?.partsCount || 1)
  );
  const estimatedMaxCost = nodes
    .filter((n) => n.enabled !== false && !n.isUnderDevelopment)
    .reduce(
      (sum, n) => sum + computeSingleNodeExecutionCost(n.type, n.config, settings, estimatedParts),
      0
    );

  if (user && estimatedMaxCost > 0 && (user.balance || 0) < estimatedMaxCost) {
    const errorMsg = `Недостаточно Иирок для запуска сценария «${scenario.name}». Требуется до ${estimatedMaxCost} Иирок, ваш баланс: ${
      user.balance || 0
    } Иирок.`;
    DB.addScenarioLog({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      status: 'failed',
      details: errorMsg,
      cost: 0
    });
    upsertScenarioInDb(sqlDb, {
      ...scenario,
      lastStatus: 'failed',
      lastError: errorMsg,
      lastRunAt: runStartedAt.toISOString()
    });
    savePgDB();
    try {
      DB.updateScenario(scenario.id, {
        lastStatus: 'failed',
        lastError: errorMsg,
        lastRunAt: runStartedAt.toISOString()
      });
    } catch {}
    const notifyTgId = telegramId || user.telegramId;
    if (notifyTgId) {
      await sendPrivateTelegramNotification(
        notifyTgId,
        `Ошибка запуска сценария «${scenario.name}»\n\n${errorMsg}`
      ).catch(() => null);
    }
    const err = new Error(errorMsg) as any;
    err.statusCode = 402;
    throw err;
  }

  const activeNodes = [...nodes]
    .filter((n) => n.enabled !== false)
    .sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
  const activeIds = new Set(activeNodes.map((n) => n.id));
  const validEdges = edges.filter(
    (e) => activeIds.has(e.sourceNodeId) && activeIds.has(e.targetNodeId)
  );

  const pubNodeForCtx = activeNodes.find(
    (n) => n.type === 'publish_post' || n.type === 'publish_telegram' || n.type === 'save_draft'
  );
  const trigNodeForCtx = activeNodes.find((n) => n.type === 'trigger_schedule');
  const initialChannels: string[] =
    Array.isArray(pubNodeForCtx?.config?.channels) && pubNodeForCtx.config.channels.length > 0
      ? pubNodeForCtx.config.channels
      : pubNodeForCtx?.config?.channelId
      ? [String(pubNodeForCtx.config.channelId)]
      : Array.isArray(scenario.targetChannels) && scenario.targetChannels.length > 0
      ? scenario.targetChannels
      : [];
  const initialTimezone = String(
    pubNodeForCtx?.config?.timezone || trigNodeForCtx?.config?.timezone || 'Europe/Moscow'
  ).trim() || 'Europe/Moscow';

  const runningContext: Record<string, any> = {
    category: scenario.topicCategory || scenario.category || 'Технологии и нейросети',
    messageFormat: scenario.messageFormat || 'v2',
    telegramId: telegramId || user?.telegramId,
    targetChannels: initialChannels,
    timezone: initialTimezone,
    runStartedAt
  };
  const nodeOutputsMap: Record<string, Record<string, any>> = {};
  const patchResults: Record<string, ScenarioNodeTestRecord> = {};
  const logDetails: string[] = [];
  let totalChargedCost = 0;
  let deliveryError: string | null = null;

  const totalSteps = Math.max(1, activeNodes.length);
  let completedOrSkippedCount = 0;
  let highestPct = 2;
  const monotonicPct = (candidate: number) => {
    highestPct = Math.max(highestPct, Math.min(99, Math.round(candidate)));
    return highestPct;
  };

  onEvent?.({
    type: 'init',
    mode: 'full',
    totalSteps,
    percent: highestPct,
    steps: activeNodes.map((n) => ({
      nodeId: n.id,
      nodeTitle: n.title || 'Шаг сценария',
      nodeType: n.type,
      status: 'pending',
      stepPercent: 0
    }))
  });

  const runAndRecordNode = async (node: any, stepIdx: number, edgesForStep: any[]) => {
    const stepTitle = node.title || 'Шаг сценария';
    onEvent?.({
      type: 'step_start',
      stepIndex: stepIdx,
      totalSteps,
      nodeId: node.id,
      nodeTitle: stepTitle,
      nodeType: node.type,
      stepPercent: 8,
      percent: monotonicPct(((completedOrSkippedCount + 0.08) / totalSteps) * 100),
      detail: `Выполняется шаг ${stepIdx + 1} из ${totalSteps}: «${stepTitle}»...`
    });

    let currentStepPct = 8;
    const emitSubProgress = (frac: number, detail: string) => {
      const clampedFrac = Math.min(0.96, Math.max(0.1, frac));
      currentStepPct = Math.max(currentStepPct, Math.round(clampedFrac * 100));
      onEvent?.({
        type: 'step_progress',
        stepIndex: stepIdx,
        totalSteps,
        nodeId: node.id,
        nodeTitle: stepTitle,
        stepPercent: currentStepPct,
        percent: monotonicPct(((completedOrSkippedCount + clampedFrac) / totalSteps) * 100),
        detail
      });
    };

    const stopTicker = startSmoothStepTicker(emitSubProgress, stepTitle, node.type);
    let stepRes;
    try {
      stepRes = await executeSingleScenarioNode({
        node,
        runningContext,
        nodeOutputsMap,
        edges: edgesForStep,
        allNodes: activeNodes,
        cleanUserId,
        settings,
        isTestRun: false,
        runStartedAt,
        scenarioMeta: scenario,
        onSubProgress: emitSubProgress
      });
    } finally {
      stopTicker();
    }

    nodeOutputsMap[node.id] = stepRes.output;
    totalChargedCost += stepRes.actualCost;
    logDetails.push(`${stepTitle}: ${stepRes.message}`);
    if (stepRes.output?.published === false && stepRes.output?.publishError) {
      deliveryError = String(stepRes.output.publishError);
    }

    patchResults[node.id] = {
      nodeId: node.id,
      nodeTitle: stepTitle,
      nodeType: node.type,
      output: stepRes.output,
      cost: stepRes.actualCost,
      mode: 'full',
      testedAt: runStartedAt.toISOString()
    };

    // Persist this step immediately to PostgreSQL so live result view works in real time during execution
    try {
      const partialMerged = saveScenarioTestResultsInDb(
        sqlDb,
        scenario.id,
        { [node.id]: patchResults[node.id] },
        scenario
      );
      savePgDB();
      DB.updateScenario(scenario.id, { testResults: partialMerged });
    } catch {}

    completedOrSkippedCount += 1;
    onEvent?.({
      type: 'step_done',
      stepIndex: stepIdx,
      totalSteps,
      nodeId: node.id,
      nodeTitle: stepTitle,
      stepPercent: 100,
      percent: monotonicPct((completedOrSkippedCount / totalSteps) * 100),
      cost: stepRes.actualCost,
      message: stepRes.message,
      record: patchResults[node.id]
    });

    return stepRes;
  };

  if (validEdges.length === 0) {
    for (let idx = 0; idx < activeNodes.length; idx++) {
      const node = activeNodes[idx];
      const stepRes = await runAndRecordNode(node, idx, []);
      if (node.type === 'logic_filter' && stepRes.branchTaken === 'no') {
        const skipMsg = 'Цепочка остановлена блоком условия (ветка «Нет»).';
        logDetails.push(skipMsg);
        const skippedIds = activeNodes.slice(idx + 1).map((sn) => sn.id);
        if (skippedIds.length > 0) {
          onEvent?.({ type: 'step_skipped', skippedIds, detail: skipMsg });
        }
        break;
      }
    }
  } else {
    const incomingByNode = new Map<string, any[]>();
    const outgoingByNode = new Map<string, any[]>();
    activeNodes.forEach((n) => {
      incomingByNode.set(n.id, []);
      outgoingByNode.set(n.id, []);
    });
    validEdges.forEach((e) => {
      incomingByNode.get(e.targetNodeId)?.push(e);
      outgoingByNode.get(e.sourceNodeId)?.push(e);
    });

    const edgeStatus = new Map<string, 'pending' | 'active' | 'skipped'>();
    validEdges.forEach((e) => edgeStatus.set(e.id, 'pending'));
    const processedNodes = new Set<string>();

    const propagateSkippedFrom = (skippedEdgeId: string) => {
      const newlySkipped: string[] = [];
      const queue = [skippedEdgeId];
      while (queue.length > 0) {
        const eid = queue.shift()!;
        const edgeObj = validEdges.find((x) => x.id === eid);
        if (!edgeObj) continue;
        const targetId = edgeObj.targetNodeId;
        const inc = incomingByNode.get(targetId) || [];
        if (
          !processedNodes.has(targetId) &&
          inc.length > 0 &&
          inc.every((ie) => edgeStatus.get(ie.id) === 'skipped')
        ) {
          processedNodes.add(targetId);
          newlySkipped.push(targetId);
          completedOrSkippedCount += 1;
          (outgoingByNode.get(targetId) || []).forEach((oe) => {
            if (edgeStatus.get(oe.id) === 'pending') {
              edgeStatus.set(oe.id, 'skipped');
              queue.push(oe.id);
            }
          });
        }
      }
      if (newlySkipped.length > 0) {
        onEvent?.({
          type: 'step_skipped',
          skippedIds: newlySkipped,
          detail: 'Пропущено по неактивной ветке условия'
        });
      }
    };

    let stepCounter = 0;
    let progress = true;
    while (progress) {
      progress = false;
      const readyNodes = activeNodes.filter((n) => {
        if (processedNodes.has(n.id)) return false;
        const inc = incomingByNode.get(n.id) || [];
        if (inc.length === 0) return true;
        const allResolved = inc.every((ie) => edgeStatus.get(ie.id) !== 'pending');
        const atLeastOneActive = inc.some((ie) => edgeStatus.get(ie.id) === 'active');
        return allResolved && atLeastOneActive;
      });

      if (readyNodes.length === 0) break;
      const currentNode = readyNodes[0];
      processedNodes.add(currentNode.id);
      progress = true;

      const stepRes = await runAndRecordNode(currentNode, stepCounter, validEdges);
      stepCounter += 1;

      const outEdges = outgoingByNode.get(currentNode.id) || [];
      if (currentNode.type === 'logic_filter') {
        const chosenBranch = stepRes.branchTaken || 'yes';
        outEdges.forEach((oe) => {
          const edgeBranch = oe.branch === 'no' || oe.sourceHandle === 'no' ? 'no' : 'yes';
          if (edgeBranch === chosenBranch) {
            edgeStatus.set(oe.id, 'active');
          } else {
            edgeStatus.set(oe.id, 'skipped');
            propagateSkippedFrom(oe.id);
          }
        });
      } else {
        outEdges.forEach((oe) => edgeStatus.set(oe.id, 'active'));
      }
    }
  }

  let newBalance = user?.balance;
  if (user && totalChargedCost > 0) {
    const updatedUser = DB.updateUser(user.id, {
      balance: Math.max(0, (user.balance || 0) - totalChargedCost)
    });
    newBalance = updatedUser.balance;
    try {
      sqlDb.run(
        `INSERT INTO transactions (id, user_id, type, balance_type, amount, description, status, created_at)
         VALUES (?, ?, 'cost', 'iirky', ?, ?, 'completed', ?)`,
        [
          `tx_scen_${Date.now()}`,
          user.id,
          -totalChargedCost,
          `Запуск сценария «${scenario.name}»`,
          runStartedAt.toISOString()
        ]
      );
    } catch {}
  }

  const publishRecord = Object.values(patchResults).find(
    (r) =>
      r.nodeType === 'publish_post' ||
      r.nodeType === 'publish_telegram' ||
      r.nodeType === 'save_draft'
  );
  const pubOut = publishRecord?.output || {};
  const isActuallyPublished = Boolean(pubOut.published);
  const isActuallyScheduled = Boolean(pubOut.scheduled);
  const isSavedDraftOnly = Boolean(pubOut.savedDraft || pubOut.publishTimingMode === 'draft_only');
  const targetChanLabel =
    Array.isArray(pubOut.channels) && pubOut.channels.length > 0
      ? pubOut.channels.join(', ')
      : Array.isArray(runningContext.targetChannels) && runningContext.targetChannels.length > 0
      ? runningContext.targetChannels.join(', ')
      : (scenario.targetChannels || []).join(', ');

  const formatMskDateTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const deliveryStatusText = deliveryError
    ? `ошибка доставки (${deliveryError})`
    : isActuallyPublished
    ? `опубликовано в ${targetChanLabel || 'Telegram'}${pubOut.messageId ? ` (пост #${pubOut.messageId})` : ''}`
    : isActuallyScheduled
    ? `сохранено в черновики и отложено на ${formatMskDateTime(pubOut.scheduledFor) || pubOut.timingSummary || 'по графику'} (МСК) → ${targetChanLabel || 'Telegram'} (в канал выйдет автоматически по расписанию)`
    : isSavedDraftOnly
    ? 'сохранено в черновики (без автоотправки)'
    : 'выполнено (блок публикации не активен)';

  const finalStatus: 'success' | 'failed' = deliveryError ? 'failed' : 'success';
  const notifyRan = Object.values(patchResults).some((r) => r.nodeType === 'notify_author');
  const notifyNode = activeNodes.find((n) => n.type === 'notify_author');
  const targetTgId = notifyNode?.config?.telegramId || telegramId || user?.telegramId;
  if (targetTgId && (notifyRan || activeNodes.length > 0)) {
    await sendPrivateTelegramNotification(
      Number(targetTgId),
      `Отчет о выполнении сценария «${scenario.name}»\n\n` +
        `Статус: ${deliveryStatusText}\n` +
        `Тема: ${runningContext.title || runningContext.topic || scenario.name}\n` +
        `Формат: ${runningContext.messageFormat === 'rich' ? 'Rich' : 'Markdown v2'}\n` +
        `Списано: ${totalChargedCost} Иирок\n` +
        `Остаток баланса: ${newBalance !== undefined ? newBalance : 'без изменений'} Иирок`
    ).catch(() => null);
  }

  const finishedIso = new Date().toISOString();
  DB.addScenarioLog({
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    status: finalStatus,
    generatedText: runningContext.text || '',
    generatedImageUrl: runningContext.imageUrl || '',
    details: `${logDetails.join('\n')}\nИтог: ${deliveryStatusText}`.trim(),
    cost: totalChargedCost
  });

  const mergedTestResults = saveScenarioTestResultsInDb(
    sqlDb,
    scenario.id,
    patchResults,
    scenario
  );

  const trigNode = nodes.find((n) => n.type === 'trigger_schedule' && n.enabled !== false);
  const isOnceTrigger = String(trigNode?.config?.cronInterval || '') === 'once';
  const markCompletedOnce = !deliveryError && isOnceTrigger;
  const persistedStatus: 'success' | 'failed' | 'completed' = markCompletedOnce
    ? 'completed'
    : finalStatus;
  const nextRunsCount = (Number(scenario.runsCount) || 0) + 1;
  const effectiveNextRunAt = markCompletedOnce
    ? null
    : cronMeta?.nextRunIsoAfter !== undefined
    ? cronMeta.nextRunIsoAfter
    : scenario.nextRunAt;

  upsertScenarioInDb(sqlDb, {
    ...scenario,
    enabled: markCompletedOnce ? false : scenario.enabled,
    lastStatus: persistedStatus,
    lastRunAt: finishedIso,
    lastSentAt: isActuallyPublished ? finishedIso : scenario.lastSentAt,
    lastRunSlot: markCompletedOnce
      ? 'once'
      : cronMeta?.scheduledSlotKey || scenario.lastRunSlot,
    isSent: isActuallyPublished ? true : Boolean(scenario.isSent),
    runsCount: nextRunsCount,
    nextRunAt: effectiveNextRunAt,
    lastError: deliveryError,
    testResults: mergedTestResults
  });

  if (markCompletedOnce) {
    try {
      sqlDb.run(
        "UPDATE cron SET status = 'completed', next_run = NULL, last_run = ? WHERE id = ?",
        [finishedIso, `cron_scen_${scenario.id}`]
      );
    } catch {}
  }

  savePgDB();

  try {
    DB.updateScenario(scenario.id, {
      enabled: markCompletedOnce ? false : scenario.enabled,
      lastStatus: persistedStatus,
      lastRunAt: finishedIso,
      lastSentAt: isActuallyPublished ? finishedIso : scenario.lastSentAt,
      lastRunSlot: markCompletedOnce
        ? 'once'
        : cronMeta?.scheduledSlotKey || scenario.lastRunSlot,
      isSent: isActuallyPublished ? true : Boolean(scenario.isSent),
      runsCount: nextRunsCount,
      nextRunAt: effectiveNextRunAt || undefined,
      lastError: deliveryError || undefined,
      generatedTopic: runningContext.title || runningContext.topic || scenario.name,
      generatedText: runningContext.text || '',
      generatedImageUrl:
        runningContext.imageUrl ||
        (Array.isArray(runningContext.imageUrls) ? runningContext.imageUrls[0] : '') ||
        '',
      testResults: mergedTestResults
    });
  } catch {}

  const finalPayload = {
    success: !deliveryError,
    deliveryError: deliveryError || undefined,
    generatedTitle: runningContext.title || runningContext.topic || scenario.name,
    generatedText: runningContext.text || '',
    generatedImageUrl:
      runningContext.imageUrl ||
      (Array.isArray(runningContext.imageUrls) ? runningContext.imageUrls[0] : '') ||
      '',
    inlineButtons: runningContext.inlineButtons || [],
    messageFormat: (runningContext.messageFormat || scenario.messageFormat || 'v2') as 'v2' | 'rich',
    targetChannels: runningContext.targetChannels || scenario.targetChannels || [],
    published: isActuallyPublished,
    scheduled: isActuallyScheduled,
    scheduledFor: pubOut.scheduledFor || '',
    publishTimingMode: pubOut.publishTimingMode || '',
    messageId: pubOut.messageId || '',
    draftId: runningContext.draftId || pubOut.draftId || '',
    cost: totalChargedCost,
    newBalance,
    testResults: mergedTestResults,
    message: deliveryError
      ? `Сценарий выполнен, но отправка в Telegram вернула ошибку: ${deliveryError}`
      : isActuallyPublished
      ? `Пост опубликован в ${targetChanLabel || 'Telegram'}`
      : isActuallyScheduled
      ? `Пост поставлен в очередь на ${formatMskDateTime(pubOut.scheduledFor) || 'расписание'} (МСК)`
      : 'Сценарий выполнен и сохранен на сервере'
  };

  onEvent?.({
    type: 'complete',
    percent: 100,
    result: finalPayload
  });

  return finalPayload;
}
