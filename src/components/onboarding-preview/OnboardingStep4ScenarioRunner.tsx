import React, { useState } from 'react';
import {
  Workflow,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  Radio,
  Smartphone,
  FileText,
  Sparkles
} from 'lucide-react';
import { Channel } from '../../types';
import {
  SCENARIO_STARTER_TEMPLATES,
  createDefaultWorkflow
} from '../scenarios/views/scenarioTemplates';
import { GradientSelect } from '../ui-kit/GradientDropdown';
import { OnboardingTelegramPreviewCard } from './OnboardingTelegramPreviewCard';
import { OnboardingFormattedTextField } from './OnboardingFormattedTextField';
import { usePricingConfig } from '../../hooks/usePricingConfig';
import { formatIirkyCount } from '../../shared/pricingConfig';

export interface OnboardingStep4ScenarioRunnerProps {
  userId: string;
  telegramId?: number;
  channels: Channel[];
  selectedChannelId: string;
  initialScenarioId?: string;
  onScenarioTested: (scenarioId: string) => Promise<void> | void;
  onOpenVisualBuilder: (scenarioId: string) => Promise<void> | void;
  onContinueToFinal: (scenarioId: string) => Promise<void> | void;
}

interface LiveStepItem {
  nodeId: string;
  nodeTitle: string;
  nodeType: string;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'error';
  stepPercent: number;
  cost?: number;
  message?: string;
}

interface ScenarioRunFinalResult {
  success: boolean;
  deliveryError?: string;
  generatedTitle: string;
  generatedText: string;
  generatedImageUrl: string;
  inlineButtons?: any[][];
  messageFormat: 'v2' | 'rich';
  targetChannels?: string[];
  published?: boolean;
  publishTimingMode?: string;
  messageId?: string | number;
  draftId?: string;
  cost?: number;
  newBalance?: number;
  message?: string;
}

export const OnboardingStep4ScenarioRunner: React.FC<OnboardingStep4ScenarioRunnerProps> = ({
  userId,
  telegramId,
  channels,
  selectedChannelId,
  initialScenarioId = '',
  onScenarioTested,
  onOpenVisualBuilder,
  onContinueToFinal
}) => {
  const { pricing } = usePricingConfig(userId);
  const [scenarioTplId, setScenarioTplId] = useState<string>(SCENARIO_STARTER_TEMPLATES[0].id);
  const [scenarioName, setScenarioName] = useState<string>('Мой автосценарий контента');
  const [scenarioTopicCategory, setScenarioTopicCategory] = useState<string>(
    'Полезные разборы, кейсы и новости сферы'
  );
  const [scenarioCustomTextTemplate, setScenarioCustomTextTemplate] = useState<string>(
    'Напиши структурированный пост по теме «{{topic}}» с разделением на абзацы, живыми акцентами и практическими выводами.'
  );
  const [activeFormatOverride, setActiveFormatOverride] = useState<'v2' | 'rich'>(
    SCENARIO_STARTER_TEMPLATES[0].format
  );

  const defaultChannelObj =
    channels.find((c) => c.id === selectedChannelId) || channels[0] || null;
  const [targetChannelKey, setTargetChannelKey] = useState<string>(
    defaultChannelObj?.username || defaultChannelObj?.telegramId || ''
  );
  const [dmTelegramId, setDmTelegramId] = useState<string>(
    telegramId ? String(telegramId) : ''
  );
  const [deliveryMode, setDeliveryMode] = useState<'channel' | 'dm' | 'draft'>(() => {
    if (channels.length > 0) return 'channel';
    if (telegramId) return 'dm';
    return 'draft';
  });

  const [savedScenarioId, setSavedScenarioId] = useState<string>(initialScenarioId);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [overallPercent, setOverallPercent] = useState<number>(0);
  const [liveStatusDetail, setLiveStatusDetail] = useState<string>('');
  const [liveSteps, setLiveSteps] = useState<LiveStepItem[]>([]);
  const [runResult, setRunResult] = useState<ScenarioRunFinalResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const buildConfiguredScenario = () => {
    const tpl =
      SCENARIO_STARTER_TEMPLATES.find((t) => t.id === scenarioTplId) ||
      SCENARIO_STARTER_TEMPLATES[0];

    const cleanDmId = parseInt(String(dmTelegramId || '').replace(/\D/g, ''), 10);
    let effectiveChannels: string[] = [];
    let publishTimingMode: 'immediate' | 'draft_only' = 'immediate';

    if (deliveryMode === 'channel' && targetChannelKey) {
      effectiveChannels = [targetChannelKey];
      publishTimingMode = 'immediate';
    } else if (deliveryMode === 'dm' && cleanDmId && !isNaN(cleanDmId)) {
      effectiveChannels = ['bot_dm'];
      publishTimingMode = 'immediate';
    } else {
      effectiveChannels = [];
      publishTimingMode = 'draft_only';
    }

    const effectiveFormat = activeFormatOverride || tpl.format;
    const matchedTemplateId =
      tpl.format === effectiveFormat
        ? tpl.id
        : effectiveFormat === 'rich'
        ? 'rich_classic_longread'
        : 'v2_fast_autopost';

    const built = createDefaultWorkflow(
      scenarioName.trim() || 'Мой первый автосценарий',
      scenarioTopicCategory.trim() || 'Экспертный блог',
      channels,
      effectiveFormat,
      matchedTemplateId,
      effectiveChannels
    );

    if (savedScenarioId) {
      built.id = savedScenarioId;
    }

    built.targetChannels = effectiveChannels;
    built.nodes = built.nodes.map((n) => {
      if (n.type === 'ai_generate_text') {
        return {
          ...n,
          config: {
            ...n.config,
            messageFormat: effectiveFormat,
            ...(scenarioCustomTextTemplate.trim()
              ? { userPrompt: scenarioCustomTextTemplate.trim() }
              : {})
          }
        };
      }
      if (String(n.type).startsWith('publish_')) {
        const destSubtitle =
          publishTimingMode === 'draft_only'
            ? 'Черновик + предпоказ'
            : deliveryMode === 'dm'
            ? 'Сразу в личку Telegram'
            : `${effectiveChannels.join(', ')} • Сразу`;
        return {
          ...n,
          subtitle: destSubtitle,
          config: {
            ...n.config,
            channel: effectiveChannels[0] || '',
            channelId: effectiveChannels[0] || '',
            channels: effectiveChannels,
            publishTimingMode,
            publishToSocialFeed: true
          }
        };
      }
      return n;
    });
    built.messageFormat = activeFormatOverride || tpl.format;

    return { built, cleanDmId: !isNaN(cleanDmId) ? cleanDmId : undefined };
  };

  const saveScenarioToServer = async () => {
    const { built, cleanDmId } = buildConfiguredScenario();
    const isUpdate = Boolean(savedScenarioId);
    const endpoint = isUpdate ? `/api/scenarios/${encodeURIComponent(savedScenarioId)}` : '/api/scenarios';
    const method = isUpdate ? 'PUT' : 'POST';

    let res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({ ...built, userId })
    });

    // If POST rejected duplicate scenario name or PUT didn't find deleted scenario, retry cleanly
    if (!res.ok) {
      const retryScenario = {
        ...built,
        id: `scen_${Date.now()}`,
        name: `${built.name} (${new Date().toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        })})`
      };
      res = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ ...retryScenario, userId })
      });
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Не удалось сохранить сценарий на сервере');
    }

    const finalId = String(data?.scenario?.id || data?.id || built.id);
    setSavedScenarioId(finalId);
    return { finalId, cleanDmId, format: built.messageFormat || 'v2' };
  };

  const handleCreateAndRunImmediately = async () => {
    setErrorMsg('');
    if (deliveryMode === 'channel' && !targetChannelKey) {
      setErrorMsg(
        'Выберите ваш подключенный канал или переключите доставку теста на личку Telegram.'
      );
      return;
    }
    if (deliveryMode === 'dm') {
      const parsed = parseInt(String(dmTelegramId || '').replace(/\D/g, ''), 10);
      if (!parsed || isNaN(parsed)) {
        setErrorMsg(
          'Укажите ваш числовой идентификатор Telegram для мгновенной доставки результата в личку (или выберите сохранение в черновики с предпоказом).'
        );
        return;
      }
    }

    setIsRunning(true);
    setRunResult(null);
    setOverallPercent(4);
    setLiveStatusDetail('Сохраняем шаблон сценария и моментально запускаем цепочку...');
    setLiveSteps([]);

    try {
      const { finalId, cleanDmId } = await saveScenarioToServer();

      const streamRes = await fetch(
        `/api/scenarios/${encodeURIComponent(finalId)}/run-stream`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
          body: JSON.stringify({
            userId,
            telegramId: cleanDmId || telegramId
          })
        }
      );

      if (!streamRes.ok && !streamRes.body) {
        const errJson = await streamRes.json().catch(() => ({}));
        throw new Error(errJson?.error || 'Ошибка запуска сценария');
      }

      let completedPayload: ScenarioRunFinalResult | null = null;

      const handleEvent = (evt: any) => {
        if (!evt || typeof evt !== 'object') return;
        if (typeof evt.percent === 'number') {
          setOverallPercent((prev) => Math.max(prev, Math.round(evt.percent)));
        }
        if (evt.type === 'init' && Array.isArray(evt.steps)) {
          setLiveSteps(evt.steps);
          setLiveStatusDetail('Цепочка сценария запущена в реальном времени...');
        } else if (evt.type === 'step_start' || evt.type === 'step_progress') {
          if (evt.detail) setLiveStatusDetail(String(evt.detail));
          setLiveSteps((prev) =>
            prev.map((s) =>
              s.nodeId === evt.nodeId
                ? {
                    ...s,
                    status: 'running',
                    stepPercent: Math.max(
                      s.stepPercent || 0,
                      Number(evt.stepPercent || 15)
                    )
                  }
                : s
            )
          );
        } else if (evt.type === 'step_done') {
          if (evt.message) setLiveStatusDetail(String(evt.message));
          setLiveSteps((prev) =>
            prev.map((s) =>
              s.nodeId === evt.nodeId
                ? {
                    ...s,
                    status: 'done',
                    stepPercent: 100,
                    cost: evt.cost,
                    message: evt.message
                  }
                : s
            )
          );
        } else if (evt.type === 'complete' && evt.result) {
          completedPayload = evt.result as ScenarioRunFinalResult;
          setOverallPercent(100);
          setLiveStatusDetail(
            evt.result.message || 'Сценарий успешно протестирован и выполнен!'
          );
        } else if (evt.type === 'error') {
          throw new Error(evt.error || 'Ошибка выполнения этапа сценария');
        }
      };

      if (streamRes.body && typeof streamRes.body.getReader === 'function') {
        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let done = false;

        while (!done) {
          const { value, done: rDone } = await reader.read();
          done = rDone;
          if (value) {
            buffer += decoder.decode(value, { stream: !done });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const rawLine of lines) {
              const trimmed = rawLine.trim();
              if (!trimmed) continue;
              let parsedEvt: any = null;
              try {
                parsedEvt = JSON.parse(trimmed);
              } catch {
                parsedEvt = null;
              }
              if (parsedEvt) {
                handleEvent(parsedEvt);
              }
            }
          }
        }

        if (buffer.trim()) {
          let tailEvt: any = null;
          try {
            tailEvt = JSON.parse(buffer.trim());
          } catch {
            tailEvt = null;
          }
          if (tailEvt) handleEvent(tailEvt);
        }
      } else {
        const fallbackRes = await fetch(
          `/api/scenarios/${encodeURIComponent(finalId)}/run`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
            body: JSON.stringify({ userId, telegramId: cleanDmId || telegramId })
          }
        );
        const fallbackData = await fallbackRes.json();
        if (!fallbackRes.ok) {
          throw new Error(fallbackData?.error || 'Ошибка запуска сценария');
        }
        completedPayload = fallbackData;
      }

      if (completedPayload) {
        setRunResult(completedPayload);
        await onScenarioTested(finalId);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Ошибка при создании и запуске сценария');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveAndOpenBuilderOnly = async () => {
    setErrorMsg('');
    setIsRunning(true);
    try {
      const { finalId } = await saveScenarioToServer();
      await onOpenVisualBuilder(finalId);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Не удалось открыть схему сценария');
    } finally {
      setIsRunning(false);
    }
  };

  const targetDestinationLabel = (() => {
    if (!runResult) return '';
    if (runResult.publishTimingMode === 'draft_only') {
      return 'Сохранено в Черновики';
    }
    const chList = Array.isArray(runResult.targetChannels) ? runResult.targetChannels : [];
    if (chList.includes('bot_dm')) {
      return `Личка Telegram (${dmTelegramId || telegramId || '@IIrkiBot'})`;
    }
    if (chList.length > 0) {
      return chList.join(', ');
    }
    return deliveryMode === 'dm'
      ? `Личка Telegram (${dmTelegramId || telegramId || ''})`
      : targetChannelKey || 'Черновики';
  })();

  return (
    <div className="space-y-4 min-w-0">
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-50/88 via-pink-50/88 via-orange-50/88 via-pink-50/88 to-sky-50/88 border border-pink-300 space-y-3.5 min-w-0">
        <div className="flex items-start gap-2.5 min-w-0">
          <Workflow className="w-5 h-5 text-pink-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h4 className="text-[16px] font-extrabold text-slate-900 break-words">
              Создайте и сразу протестируйте автоматический сценарий в действии
            </h4>
            <p className="text-[14px] text-slate-700 font-medium break-words">
              При создании сценария по шаблону он моментально запустится прямо сейчас: сгенерирует тему, напишет и сразу оформит пост (в v2 — единым шагом за {formatIirkyCount(pricing.scenarioAi.textGeneration)} + системная проверка лимитов и медиа перед отправкой; в Rich — текст за {formatIirkyCount(pricing.scenarioAi.textGeneration)} и отдельная нейро-верстка за {formatIirkyCount(pricing.textAi.beautyPostAi)}; иллюстрации через модели 621, 784 или 791) и покажет готовый результат!
            </p>
          </div>
        </div>

        <GradientSelect
          label="Выберите готовый шаблон цепочки сценария (V2 или Rich)"
          value={scenarioTplId}
          onChange={(nextId) => {
            setScenarioTplId(nextId);
            const foundTpl = SCENARIO_STARTER_TEMPLATES.find((t) => t.id === nextId);
            if (foundTpl) {
              setActiveFormatOverride(foundTpl.format);
            }
          }}
          options={SCENARIO_STARTER_TEMPLATES.map((t) => ({
            value: t.id,
            label: t.title,
            hint: t.description
          }))}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
          <div className="min-w-0">
            <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
              Название вашего сценария
            </label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="Например: Ежедневный экспертный выпуск"
              className="w-full px-3.5 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
              Тематика для генерации тем и постов
            </label>
            <input
              type="text"
              value={scenarioTopicCategory}
              onChange={(e) => setScenarioTopicCategory(e.target.value)}
              placeholder="Например: маркетинг, дизайн, недвижимость..."
              className="w-full px-3.5 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
            />
          </div>
        </div>

        <div className="space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[14px] font-extrabold text-slate-800">
              Режим разметки текста в сценарии:
            </span>
            <div className="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-white/85 border border-pink-300">
              <button
                type="button"
                onClick={() => setActiveFormatOverride('v2')}
                className={`px-3 py-1 rounded-xl text-[14px] font-extrabold cursor-pointer transition-all ${
                  activeFormatOverride === 'v2'
                    ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-pink-50/80'
                }`}
              >
                V2
              </button>
              <button
                type="button"
                onClick={() => setActiveFormatOverride('rich')}
                className={`px-3 py-1 rounded-xl text-[14px] font-extrabold cursor-pointer transition-all ${
                  activeFormatOverride === 'rich'
                    ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-pink-50/80'
                }`}
              >
                Rich
              </button>
            </div>
          </div>

          <OnboardingFormattedTextField
            label={`Шаблон задания и примера оформления для поста (${
              activeFormatOverride === 'rich' ? 'Rich' : 'Telegram V2'
            })`}
            format={activeFormatOverride}
            userId={userId}
            minRows={3}
            value={scenarioCustomTextTemplate}
            onChange={setScenarioCustomTextTemplate}
            placeholder="Опишите пожелания или пример верстки поста — выделите фрагмент текста для открытия панели форматирования V2 / Rich..."
          />
        </div>

        {/* Delivery Target Selector (Vertical / Grid, zero horizontal scrolling) */}
        <div className="space-y-2.5 pt-1 min-w-0">
          <div className="text-[14px] font-extrabold text-slate-800">
            Куда моментально отправить результат тестового запуска сценария:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setDeliveryMode('channel')}
              className={`p-3 rounded-2xl border text-left text-[14px] font-extrabold flex items-center gap-2 cursor-pointer transition-all min-w-0 ${
                deliveryMode === 'channel'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-pink-400 shadow-xs'
                  : 'bg-white/85 hover:bg-white text-slate-800 border-pink-300'
              }`}
            >
              <Radio className="w-4 h-4 shrink-0" />
              <span className="break-words">На мой канал</span>
            </button>

            <button
              type="button"
              onClick={() => setDeliveryMode('dm')}
              className={`p-3 rounded-2xl border text-left text-[14px] font-extrabold flex items-center gap-2 cursor-pointer transition-all min-w-0 ${
                deliveryMode === 'dm'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-pink-400 shadow-xs'
                  : 'bg-white/85 hover:bg-white text-slate-800 border-pink-300'
              }`}
            >
              <Smartphone className="w-4 h-4 shrink-0" />
              <span className="break-words">В личку Telegram</span>
            </button>

            <button
              type="button"
              onClick={() => setDeliveryMode('draft')}
              className={`p-3 rounded-2xl border text-left text-[14px] font-extrabold flex items-center gap-2 cursor-pointer transition-all min-w-0 ${
                deliveryMode === 'draft'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-pink-400 shadow-xs'
                  : 'bg-white/85 hover:bg-white text-slate-800 border-pink-300'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span className="break-words">В черновики + предпоказ</span>
            </button>
          </div>

          {deliveryMode === 'channel' && (
            <div className="min-w-0">
              {channels.length > 0 ? (
                <GradientSelect
                  label="Выберите ваш подключенный канал"
                  value={targetChannelKey}
                  onChange={setTargetChannelKey}
                  options={channels.map((ch) => ({
                    value: ch.username || ch.telegramId || ch.id,
                    label: `${ch.name} (${ch.username || ch.id})`
                  }))}
                />
              ) : (
                <p className="text-[14px] text-slate-700 font-medium break-words">
                  У вас еще не подключен канал — выберите «В личку Telegram» или «В черновики + предпоказ», чтобы протестировать сценарий прямо сейчас.
                </p>
              )}
            </div>
          )}

          {deliveryMode === 'dm' && (
            <div className="min-w-0">
              <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
                Ваш числовой идентификатор в Telegram (предварительно нажмите «Запустить» в @IIrkiBot)
              </label>
              <input
                type="text"
                value={dmTelegramId}
                onChange={(e) => setDmTelegramId(e.target.value)}
                placeholder="Например: 169262990"
                className="w-full px-3.5 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 font-mono focus:outline-none focus:border-pink-500"
              />
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={isRunning}
          onClick={handleCreateAndRunImmediately}
          className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 disabled:opacity-60 text-white text-[15px] font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          {isRunning ? (
            <Loader2 className="w-5 h-5 animate-spin shrink-0" />
          ) : (
            <Play className="w-5 h-5 shrink-0" />
          )}
          <span className="break-words">
            {isRunning
              ? `Выполняется сценарий (${overallPercent}%)...`
              : runResult
              ? 'Пересоздать и повторно запустить тест сценария сейчас'
              : 'Создать сценарий по шаблону и сразу запустить тест сейчас'}
          </span>
        </button>

        {/* Real-time Execution Progress Block */}
        {(isRunning || liveSteps.length > 0) && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300 space-y-2.5 min-w-0">
            <div className="flex items-center justify-between gap-2 text-[14px] font-extrabold text-slate-900 flex-wrap">
              <span className="break-words">{liveStatusDetail || 'Выполнение этапов сценария...'}</span>
              <span className="text-pink-700 shrink-0">{overallPercent}%</span>
            </div>

            <div className="w-full h-3 rounded-full bg-white/90 border border-pink-300 overflow-hidden p-[1px]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 transition-all duration-300"
                style={{ width: `${Math.max(4, Math.min(100, overallPercent))}%` }}
              />
            </div>

            {liveSteps.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 min-w-0">
                {liveSteps.map((step, idx) => (
                  <div
                    key={step.nodeId || idx}
                    className="px-3 py-2 rounded-xl bg-white/85 border border-pink-200 flex items-start justify-between gap-2 text-[14px] min-w-0"
                  >
                    <div className="min-w-0">
                      <div className="font-extrabold text-slate-900 break-words">
                        {idx + 1}. {step.nodeTitle}
                      </div>
                      {step.message && (
                        <div className="text-[14px] text-slate-600 break-words line-clamp-2">
                          {step.message}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 font-extrabold text-pink-600 flex items-center gap-1">
                      {step.status === 'running' && (
                        <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                      )}
                      {step.status === 'done' && (
                        <CheckCircle2 className="w-4 h-4 text-pink-600" />
                      )}
                      <span>
                        {step.status === 'done'
                          ? '100%'
                          : step.status === 'running'
                          ? `${step.stepPercent || 15}%`
                          : 'Ожидание'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-100/85 to-orange-100/85 border border-rose-300 text-rose-800 text-[14px] font-bold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span className="break-words">{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Formatted Result Preview after Automatic Test Run */}
      {runResult && (
        <div className="space-y-3 min-w-0">
          {runResult.deliveryError && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-100/85 to-orange-100/85 border border-orange-300 text-slate-900 text-[14px] font-bold flex items-start gap-2">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-orange-600" />
              <span className="break-words">
                Сценарий успешно сгенерировал и сохранил публикацию в черновиках, примечание по доставке в Telegram: {runResult.deliveryError}
              </span>
            </div>
          )}

          <div className="p-4 rounded-3xl bg-gradient-to-r from-sky-50/88 via-pink-50/88 via-orange-50/88 via-pink-50/88 to-sky-50/88 border border-pink-300 space-y-2.5 min-w-0">
            <OnboardingFormattedTextField
              label={`Сгенерированный текст поста (${
                (runResult.messageFormat || activeFormatOverride) === 'rich' ? 'Rich' : 'Telegram V2'
              }) — выделите текст для редактирования разметки`}
              format={(runResult.messageFormat || activeFormatOverride) === 'rich' ? 'rich' : 'v2'}
              userId={userId}
              minRows={5}
              value={runResult.generatedText}
              onChange={(nextVal) =>
                setRunResult((prev) => (prev ? { ...prev, generatedText: nextVal } : prev))
              }
            />
          </div>

          <OnboardingTelegramPreviewCard
            mode="sent_result"
            format={runResult.messageFormat || activeFormatOverride || 'v2'}
            title={runResult.generatedTitle}
            content={runResult.generatedText}
            attachmentType={runResult.generatedImageUrl ? 'photo' : 'none'}
            attachmentUrl={runResult.generatedImageUrl || ''}
            inlineButtons={runResult.inlineButtons || []}
            targetLabel={targetDestinationLabel}
            messageId={runResult.messageId}
            deliverySummary={
              runResult.deliveryError
                ? 'Сформировано автосценарием и сохранено в черновики'
                : runResult.publishTimingMode === 'draft_only'
                ? `Автосценарий выполнен (списано ${runResult.cost ?? 0} Иирок) · сохранено в черновики`
                : `Автосценарий моментально выполнен и отправлен в ${targetDestinationLabel} (списано ${runResult.cost ?? 0} Иирок)`
            }
          />
        </div>
      )}

      {/* Bottom Navigation Actions */}
      <div className="flex items-center justify-between gap-2.5 flex-wrap pt-2 border-t border-pink-200/80">
        <button
          type="button"
          disabled={isRunning}
          onClick={handleSaveAndOpenBuilderOnly}
          className="px-4 py-2.5 rounded-2xl bg-white/90 hover:bg-white border border-pink-300 text-pink-700 text-[14px] font-extrabold flex items-center gap-1.5 cursor-pointer"
        >
          <ExternalLink className="w-4 h-4 shrink-0" />
          <span>Открыть визуальную схему сценария</span>
        </button>

        <button
          type="button"
          disabled={isRunning}
          onClick={async () => {
            if (savedScenarioId && runResult) {
              await onContinueToFinal(savedScenarioId);
            } else {
              await handleCreateAndRunImmediately();
            }
          }}
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 disabled:opacity-55 text-white text-[14px] font-extrabold flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <span>
            {runResult
              ? 'Далее: возможности тарифов (финал)'
              : 'Создать, протестировать сейчас и продолжить'}
          </span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </div>
  );
};
