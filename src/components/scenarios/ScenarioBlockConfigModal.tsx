import React from 'react';
import {
  Settings2,
  X,
  HelpCircle,
  Sparkles,
  Trash2,
  Play,
  Eye,
  Loader2,
  Check,
  AlertTriangle,
  Plus
} from 'lucide-react';
import {
  Scenario,
  Channel,
  WorkflowNode,
  ScenarioNodeTestRecord,
  ScenarioTestProgressState
} from '../../types';
import {
  ScenarioImageNodeConfig,
  isScenarioImageNodeType,
  computeScenarioImageCost,
  buildScenarioImageSubtitle,
  ScenarioImageCosts
} from './ScenarioImageNodeConfig';
import {
  getDynamicNodeCost,
  getScenarioActiveFormat,
  scenarioHasV2MediaInChain,
  resolveNodeDef
} from './scenarioDefinitions';
import { DataHandoffSection } from './views/config/DataHandoffSection';
import { RichBlocksConfig } from './views/config/RichBlocksConfig';
import { V2AndButtonsConfig } from './views/config/V2AndButtonsConfig';
import { LogicAndPublishConfig } from './views/config/LogicAndPublishConfig';
import { UnifiedPostGeneratorPanel } from '../post-generator/UnifiedPostGeneratorPanel';
import { POST_STYLES } from '../post-editor/core/postStylesData';
import {
  VariableInsertDropdown,
  DEFAULT_SCENARIO_VARIABLES
} from '../ui-kit/GradientDropdown';
import { CollapsibleSection } from '../ui-kit/CollapsibleSection';
import { ResponsiveActionBtn, UnboxedMetaLine } from '../ui-kit/ResponsiveActionBtn';
import { AutoGrowVoiceTextarea } from '../ui-kit/AutoGrowVoiceTextarea';
import { TriggerScheduleConfig } from './schedule/TriggerScheduleConfig';
import { BeautyPostConfig } from './styling/BeautyPostConfig';

interface ScenarioBlockConfigModalProps {
  isOpen: boolean;
  selectedNode: WorkflowNode | null | undefined;
  currentScenario: Scenario;
  channels: Channel[];
  activeUserId: string;
  userBalance?: number;
  costs: ScenarioImageCosts;
  isTestingNode: boolean;
  testProgress?: ScenarioTestProgressState | null;
  dbTestResults: Record<string, ScenarioNodeTestRecord>;
  onClose: () => void;
  onUpdateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode, immediateSave?: boolean) => void;
  onOpenImageConstructor: () => void;
  onOpenTestChoice: (node: WorkflowNode) => void;
  onOpenResultModal: (node: WorkflowNode) => void;
  onOpenHelp: (e: React.MouseEvent, key: string, title: string, fallbackText: string) => void;
}

function formatCostLabel(cost: number): string {
  if (cost <= 0) return 'Бесплатно';
  if (cost === 1) return '1 Иирка';
  if (cost >= 2 && cost <= 4) return `${cost} Иирки`;
  return `${cost} Иирок`;
}

export const ScenarioBlockConfigModal: React.FC<ScenarioBlockConfigModalProps> = ({
  isOpen,
  selectedNode,
  currentScenario,
  channels,
  activeUserId,
  userBalance,
  costs,
  isTestingNode,
  testProgress,
  dbTestResults,
  onClose,
  onUpdateNode,
  onOpenImageConstructor,
  onOpenTestChoice,
  onOpenResultModal,
  onOpenHelp
}) => {
  const [anchorLabel, setAnchorLabel] = React.useState('');
  const [anchorUrl, setAnchorUrl] = React.useState('');

  if (!isOpen || !selectedNode) return null;

  const scenarioFormat = getScenarioActiveFormat(currentScenario);
  const isUnderDev = Boolean(selectedNode.isUnderDevelopment || selectedNode.type === 'ai_rewrite');
  const nodeCost = getDynamicNodeCost(selectedNode, costs, currentScenario);
  const savedRecord = dbTestResults?.[selectedNode.id];
  const hasDbResult = Boolean(savedRecord);
  const def = resolveNodeDef(selectedNode.type);

  const updateConfig = (patch: Record<string, any>, immediateSave = true) => {
    onUpdateNode(
      selectedNode.id,
      (n) => {
        const mergedConfig = { ...(n.config || {}), ...patch };
        return {
          ...n,
          config: mergedConfig,
          cost: getDynamicNodeCost({ ...n, config: mergedConfig }, costs, currentScenario)
        };
      },
      immediateSave
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-gradient-to-br from-sky-200/45 via-pink-200/45 via-orange-200/45 via-pink-200/45 to-sky-200/45 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-[920px] max-h-[92dvh] p-[2px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-2xl flex flex-col overflow-hidden my-auto"
      >
        <div className="bg-gradient-to-br from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xl rounded-[22px] flex flex-col max-h-[calc(92dvh-4px)] overflow-hidden">
          {/* Header with Inline Editable Title & Unboxed Metadata (Zero Duplicates) */}
          <div className="flex items-start justify-between gap-2.5 px-4 sm:px-6 py-3.5 border-b border-pink-300/75 shrink-0">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <span className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-2xs shrink-0 mt-0.5">
                <Settings2 size={18} />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <input
                  type="text"
                  value={selectedNode.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdateNode(selectedNode.id, (n) => ({ ...n, title: val }), false);
                  }}
                  onBlur={() => {
                    onUpdateNode(selectedNode.id, (n) => ({ ...n }), true);
                  }}
                  aria-label="Название шага"
                  placeholder="Название шага"
                  className="w-full min-w-0 bg-white/75 focus:bg-white border border-pink-300/80 rounded-xl px-3 py-1.5 text-[16px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
                <UnboxedMetaLine
                  items={[
                    def?.categoryTitle || 'Шаг сценария',
                    `Формат ${scenarioFormat === 'rich' ? 'Rich' : 'v2'}`,
                    isUnderDev ? 'В разработке' : formatCostLabel(nodeCost),
                    'Сохраняется автоматически'
                  ]}
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={(e) =>
                  onOpenHelp(
                    e,
                    `block_${selectedNode.type}`,
                    selectedNode.title,
                    def?.description || 'Справка по настройкам блока'
                  )
                }
                title="Инструкция к блоку"
                aria-label="Инструкция к блоку"
                className="min-w-[40px] min-h-[40px] rounded-xl bg-white/80 hover:bg-white border border-pink-300 text-pink-700 flex items-center justify-center cursor-pointer transition-colors"
              >
                <HelpCircle size={18} />
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Закрыть окно"
                aria-label="Закрыть окно"
                className="min-w-[40px] min-h-[40px] rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white flex items-center justify-center shadow-sm hover:brightness-105 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 min-h-0 min-w-0 text-[14px]">
            {/* Collapsible Step-to-Step Data Handoff */}
            {!isUnderDev && (
              <DataHandoffSection
                selectedNode={selectedNode}
                currentScenario={currentScenario}
                onUpdateConfig={updateConfig}
              />
            )}

            {/* Trigger Schedule (Multi-launch + Timezone + 1-Iirka AI Fill) */}
            {selectedNode.type === 'trigger_schedule' && (
              <TriggerScheduleConfig
                config={selectedNode.config || {}}
                activeUserId={activeUserId}
                userBalance={userBalance}
                onUpdateConfig={updateConfig}
              />
            )}

            {/* Trigger Manual */}
            {selectedNode.type === 'trigger_manual' && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/70 via-pink-100/70 via-orange-100/70 via-pink-100/70 to-sky-100/70 border border-pink-300 text-slate-800">
                Запускает цепочку вручную при нажатии кнопки запуска сценария или тестирования.
              </div>
            )}

            {/* AI Generate Topic (30-day archive analysis - 10 Iirki) */}
            {selectedNode.type === 'ai_generate_topic' && (
              <div className="space-y-3 pt-1 min-w-0">
                <AutoGrowVoiceTextarea
                  label="Рубрика или тематика канала"
                  value={selectedNode.config?.topicCategory || ''}
                  onChange={(val) => updateConfig({ topicCategory: val }, false)}
                  onBlur={() =>
                    updateConfig({ topicCategory: selectedNode.config?.topicCategory || '' }, true)
                  }
                  minRows={2}
                  showClearButton
                  placeholder="Технологии, нейросети, маркетинг"
                />
                <p className="text-slate-700 leading-snug">
                  Проверяет опубликованные посты и черновики за последние 30 дней и исключает смысловые повторы.
                </p>
              </div>
            )}

            {/* AI Generate Text — Unified 1-to-1 with Post Editor */}
            {selectedNode.type === 'ai_generate_text' &&
              (() => {
                const hasV2Media =
                  scenarioFormat === 'v2' && scenarioHasV2MediaInChain(currentScenario);
                const maxAllowedChars =
                  scenarioFormat === 'rich' ? 32000 : hasV2Media ? 1024 : 4096;
                const defaultMaxChars =
                  scenarioFormat === 'rich' ? 8000 : hasV2Media ? 900 : 2500;
                const rawConfigured = Number(selectedNode.config?.maxChars || defaultMaxChars);
                const currentMaxChars = Math.min(
                  maxAllowedChars,
                  Math.max(200, hasV2Media && rawConfigured > 1024 ? 900 : rawConfigured)
                );

                const matchedStyle = POST_STYLES.find(
                  (s) =>
                    s.id === selectedNode.config?.postStyleId ||
                    s.title === selectedNode.config?.postStyle
                );

                return (
                  <div className="space-y-3 pt-1">
                    <UnifiedPostGeneratorPanel
                      isScenarioMode={true}
                      messageFormat={scenarioFormat}
                      hasMediaAttachment={hasV2Media}
                      selectedStyleId={
                        selectedNode.config?.postStyleId ||
                        matchedStyle?.id ||
                        selectedNode.config?.postStyle ||
                        POST_STYLES[0].id
                      }
                      onSelectStyleId={(styleId) => {
                        const st = POST_STYLES.find((s) => s.id === styleId);
                        const resolvedPrompt = st?.prompt || selectedNode.config?.stylePromptOverride || selectedNode.config?.styleDesc || '';
                        updateConfig(
                          {
                            postStyleId: styleId,
                            postStyle: st?.title || styleId,
                            styleDesc: resolvedPrompt,
                            stylePromptOverride: resolvedPrompt,
                            messageFormat: scenarioFormat
                          },
                          true
                        );
                      }}
                      stylePromptOverride={selectedNode.config?.stylePromptOverride ?? selectedNode.config?.styleDesc ?? ''}
                      onStylePromptOverrideChange={(promptTxt) =>
                        updateConfig(
                          {
                            styleDesc: promptTxt,
                            stylePromptOverride: promptTxt,
                            messageFormat: scenarioFormat
                          },
                          true
                        )
                      }
                      promptValue={selectedNode.config?.userPrompt || ''}
                      onPromptValueChange={(val) =>
                        updateConfig({ userPrompt: val, messageFormat: scenarioFormat }, true)
                      }
                      maxChars={currentMaxChars}
                      onMaxCharsChange={(chars) =>
                        updateConfig({ maxChars: chars, maxCharsV2: scenarioFormat === 'v2' ? chars : selectedNode.config?.maxCharsV2, messageFormat: scenarioFormat }, true)
                      }
                      uniquenessMemoryCount={Number(
                        selectedNode.config?.uniquenessMemoryCount ?? 10
                      )}
                      onUniquenessMemoryCountChange={(cnt) =>
                        updateConfig({ uniquenessMemoryCount: cnt }, true)
                      }
                      structureFlags={{
                        includeHeading:
                          selectedNode.config?.includeTopicHeading !== undefined
                            ? Boolean(selectedNode.config.includeTopicHeading)
                            : selectedNode.config?.richIncludeHeadings !== false,
                        includeLists: selectedNode.config?.richIncludeLists !== false,
                        includeChecklist: Boolean(selectedNode.config?.richIncludeChecklist),
                        includeQuotes: Boolean(selectedNode.config?.richIncludeQuotes),
                        includeSpoilers: Boolean(selectedNode.config?.richIncludeSpoilers),
                        includeTable: Boolean(selectedNode.config?.richIncludeTables),
                        includeCallout: Boolean(selectedNode.config?.richIncludeCallout),
                        includeRichButtons: Boolean(selectedNode.config?.richIncludeButtons)
                      }}
                      onStructureFlagsChange={(flags) =>
                        updateConfig(
                          {
                            includeTopicHeading: flags.includeHeading,
                            richIncludeHeadings: flags.includeHeading,
                            richIncludeLists: flags.includeLists,
                            richIncludeChecklist: Boolean(flags.includeChecklist),
                            richIncludeQuotes: flags.includeQuotes,
                            richIncludeSpoilers: flags.includeSpoilers,
                            richIncludeTables: flags.includeTable,
                            richIncludeCallout: flags.includeCallout,
                            richIncludeButtons: Boolean(flags.includeRichButtons)
                          },
                          true
                        )
                      }
                      scenarioVariables={DEFAULT_SCENARIO_VARIABLES}
                      userId={activeUserId}
                    />

                    {scenarioFormat === 'v2' && (
                      <CollapsibleSection
                        title="Красивое оформление, макет и эталонный пример (v2)"
                        summary={
                          selectedNode.config?.formatExampleV2
                            ? 'Настроен свой эталонный пример v2 · заголовок темы и шрифты применяются сразу при генерации'
                            : `Макет: ${selectedNode.config?.v2LayoutPreset || 'magazine_v2'} · заголовок темы, акценты и шрифты сразу в этом блоке`
                        }
                        icon={<Sparkles size={16} />}
                        defaultOpen={Boolean(selectedNode.config?.formatExampleV2)}
                      >
                        <BeautyPostConfig
                          embeddedInTextGenerator={true}
                          config={selectedNode.config || {}}
                          scenarioFormat="v2"
                          hasMediaAttachment={hasV2Media}
                          scenarioCategory={currentScenario.category || currentScenario.topicCategory}
                          activeUserId={activeUserId}
                          onUpdateConfig={updateConfig}
                        />
                      </CollapsibleSection>
                    )}

                    {scenarioFormat === 'v2' && (
                      <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-sky-100/70 via-pink-100/70 via-orange-100/70 via-pink-100/70 to-sky-100/70 border border-pink-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedNode.config?.linkPreviewEnabled !== false}
                          onChange={(e) =>
                            updateConfig({ linkPreviewEnabled: e.target.checked }, true)
                          }
                          className="w-4 h-4 rounded border-pink-300 text-pink-600 cursor-pointer shrink-0"
                        />
                        <span className="font-semibold text-slate-900">
                          Показывать превью первой внешней ссылки в посте Telegram
                        </span>
                      </label>
                    )}
                  </div>
                );
              })()}

            {/* Rich & Fast AI Blocks */}
            <RichBlocksConfig
              selectedNode={selectedNode}
              currentScenario={currentScenario}
              costs={costs}
              activeUserId={activeUserId}
              userBalance={userBalance}
              onUpdateConfig={updateConfig}
              onOpenImageConstructor={onOpenImageConstructor}
            />

            {/* Unified Image Generation Block (1-to-1 with ImageBuilderModal + 791) */}
            {isScenarioImageNodeType(selectedNode.type) && (
              <ScenarioImageNodeConfig
                config={selectedNode.config || {}}
                nodeType={selectedNode.type}
                scenarioFormat={scenarioFormat}
                costs={costs}
                activeUserId={activeUserId}
                userBalance={userBalance}
                onOpenConstructor={onOpenImageConstructor}
                onOpenHelp={onOpenHelp}
                onUpdateConfig={(patch, immediateSave = true) => {
                  onUpdateNode(
                    selectedNode.id,
                    (n) => {
                      const mergedConfig = { ...(n.config || {}), ...patch };
                      return {
                        ...n,
                        config: mergedConfig,
                        cost: computeScenarioImageCost({ type: n.type, config: mergedConfig }, costs),
                        subtitle: buildScenarioImageSubtitle(
                          { type: n.type, config: mergedConfig },
                          scenarioFormat
                        )
                      };
                    },
                    immediateSave
                  );
                }}
              />
            )}

            {/* V2 Media Attachments & Inline Buttons */}
            <V2AndButtonsConfig
              selectedNode={selectedNode}
              currentScenario={currentScenario}
              channels={channels}
              activeUserId={activeUserId}
              dbTestResults={dbTestResults}
              onUpdateConfig={updateConfig}
              onOpenImageConstructor={onOpenImageConstructor}
            />

            {/* Logic Filter & Unified Publish Post */}
            <LogicAndPublishConfig
              selectedNode={selectedNode}
              currentScenario={currentScenario}
              channels={channels}
              onUpdateConfig={updateConfig}
            />

            {/* AI Rewrite -> Under Development */}
            {selectedNode.type === 'ai_rewrite' && (
              <div className="p-4 rounded-2xl bg-orange-100/80 border border-orange-300 space-y-1.5 text-slate-900">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle size={18} className="text-orange-600 shrink-0" />
                  <span>Блок «Рерайт и уникализация» в разработке</span>
                </div>
                <p className="leading-relaxed">
                  Поддержка безопасного чтения внешних ссылок нейросетью готовится к запуску — блок временно отключен и не списывает баланс.
                </p>
              </div>
            )}

            {/* Legacy Format Media compatibility */}
            {selectedNode.type === 'format_media' &&
              (() => {
                const mediaUrlsList: string[] = Array.isArray(selectedNode.config?.imageUrls)
                  ? selectedNode.config.imageUrls
                  : selectedNode.config?.imageUrl
                  ? [selectedNode.config.imageUrl]
                  : [''];

                return (
                  <div className="space-y-3 pt-1">
                    <ResponsiveActionBtn
                      variant="vivid"
                      showLabelFrom="always"
                      icon={<Sparkles size={16} />}
                      label="Открыть генератор картинки"
                      onClick={onOpenImageConstructor}
                      className="w-full"
                    />

                    <div className="space-y-2">
                      <span className="font-bold text-slate-800 block">
                        Ссылки на медиафайлы ({mediaUrlsList.filter(Boolean).length}/10)
                      </span>
                      {mediaUrlsList.map((urlVal, idx) => (
                        <div key={idx} className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-slate-700 w-6 text-center shrink-0">
                            #{idx + 1}
                          </span>
                          <input
                            type="url"
                            value={urlVal}
                            onChange={(e) => {
                              const copy = [...mediaUrlsList];
                              copy[idx] = e.target.value;
                              updateConfig({ imageUrls: copy, imageUrl: copy[0] || '' }, true);
                            }}
                            placeholder="https://..."
                            className="flex-1 min-w-0 bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-slate-900 font-mono"
                          />
                          {mediaUrlsList.length > 1 && (
                            <ResponsiveActionBtn
                              variant="danger"
                              showLabelFrom="never"
                              icon={<Trash2 size={15} />}
                              label="Удалить ссылку"
                              onClick={() => {
                                const copy = mediaUrlsList.filter((_, i) => i !== idx);
                                updateConfig({ imageUrls: copy, imageUrl: copy[0] || '' }, true);
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

            {/* Signature */}
            {selectedNode.type === 'format_signature' &&
              (() => {
                const pubNode = (currentScenario.nodes || []).find(
                  (n) => n.type === 'publish_post' || n.type === 'publish_telegram'
                );
                const rawCh =
                  pubNode?.config?.channels?.[0] ||
                  pubNode?.config?.channelId ||
                  currentScenario.targetChannels?.[0] ||
                  '';
                const targetCh =
                  channels.find(
                    (c) =>
                      c.id === rawCh ||
                      c.username?.replace(/^@/, '').toLowerCase() ===
                        String(rawCh).replace(/^@/, '').toLowerCase() ||
                      c.name?.toLowerCase() === String(rawCh).toLowerCase()
                  ) || channels[0];
                const chName = targetCh?.name || 'ИИSMM (@IIrkiBot)';
                const chLink = targetCh?.username
                  ? `https://t.me/${targetCh.username.replace(/^@/, '')}`
                  : targetCh?.inviteLink || 'https://t.me/IIrkiBot';

                return (
                  <div className="space-y-3 pt-1 min-w-0">
                    <AutoGrowVoiceTextarea
                      label="Текст подписи канала"
                      value={selectedNode.config?.signature || ''}
                      onChange={(val) => updateConfig({ signature: val }, false)}
                      onBlur={() =>
                        updateConfig({ signature: selectedNode.config?.signature || '' }, true)
                      }
                      minRows={2}
                      showClearButton
                      placeholder={`Подписывайтесь на [${chName}](${chLink})`}
                      headerExtra={
                        <div className="flex flex-wrap items-center gap-1.5">
                          <VariableInsertDropdown
                            onInsert={(token) => {
                              const prev = String(selectedNode.config?.signature || '');
                              updateConfig({ signature: prev ? `${prev} ${token}` : token }, true);
                            }}
                          />
                          <ResponsiveActionBtn
                            variant="vivid"
                            icon={<Check size={15} />}
                            label="Стандартная подпись"
                            onClick={() => {
                              const stdSig = `Подписывайтесь на [${chName}](${chLink}) · наш бот [@IIrkiBot](https://t.me/IIrkiBot)`;
                              updateConfig({ signature: stdSig }, true);
                            }}
                          />
                        </div>
                      }
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <input
                        type="text"
                        value={anchorLabel}
                        onChange={(e) => setAnchorLabel(e.target.value)}
                        placeholder="Текст ссылки (например: Наш бот)"
                        className="bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-slate-900 min-w-0"
                      />
                      <input
                        type="url"
                        value={anchorUrl}
                        onChange={(e) => setAnchorUrl(e.target.value)}
                        placeholder="https://t.me/IIrkiBot"
                        className="bg-white/85 border border-pink-300 rounded-xl px-3 py-2 font-mono text-slate-900 min-w-0"
                      />
                      <ResponsiveActionBtn
                        variant="outline"
                        icon={<Plus size={15} />}
                        label="Ссылка"
                        title="Вставить ссылку в подпись"
                        onClick={() => {
                          const lbl = anchorLabel.trim() || 'Перейти';
                          const rawU = anchorUrl.trim() || chLink;
                          const cleanU = /^https?:\/\//i.test(rawU) ? rawU : `https://${rawU}`;
                          const cur = String(selectedNode.config?.signature || '').trim();
                          const nextSig = cur ? `${cur} · [${lbl}](${cleanU})` : `[${lbl}](${cleanU})`;
                          updateConfig({ signature: nextSig }, true);
                          setAnchorLabel('');
                          setAnchorUrl('');
                        }}
                      />
                    </div>
                  </div>
                );
              })()}

            {/* Beauty Post Formatting (Styles + Rich Rules + Topic Heading + Char Limits) */}
            {selectedNode.type === 'format_beauty_post' && (
              <div className="space-y-3">
                {scenarioFormat === 'v2' && (
                  <div className="p-3.5 rounded-2xl bg-amber-100/85 border border-amber-300 text-amber-950 text-[14px] leading-snug">
                    В формате <b>v2</b> красивое оформление, заголовок темы и эталонный пример теперь применяются прямо в блоке <b>«Генератор текста поста»</b>, а этот устаревший шаг выполняется как бесплатная системная проверка лимитов (0 Иирок). Отдельный блок оформления нужен только в формате Rich.
                  </div>
                )}
                <BeautyPostConfig
                  config={selectedNode.config || {}}
                  scenarioFormat={scenarioFormat}
                  hasMediaAttachment={scenarioFormat === 'v2' && scenarioHasV2MediaInChain(currentScenario)}
                  scenarioCategory={currentScenario.category || currentScenario.topicCategory}
                  activeUserId={activeUserId}
                  onUpdateConfig={updateConfig}
                />
              </div>
            )}

            {/* Logic Delay */}
            {selectedNode.type === 'logic_delay' && (() => {
              const totalDelayMins = Math.min(1440, Math.max(1, Number(selectedNode.config?.delayMinutes || 15)));
              const curHours = Math.floor(totalDelayMins / 60);
              const curMins = totalDelayMins % 60;
              const applyHM = (nextH: number, nextM: number, save: boolean) => {
                const clampedH = Math.min(24, Math.max(0, nextH));
                const clampedM = clampedH >= 24 ? 0 : Math.min(59, Math.max(0, nextM));
                const nextTotal = Math.min(1440, Math.max(1, clampedH * 60 + clampedM));
                updateConfig({ delayMinutes: nextTotal }, save);
              };
              return (
                <div className="pt-1 space-y-2.5 text-[14px]">
                  <div className="font-bold text-slate-900">
                    Пауза перед следующим шагом (часов и минут)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Часов (0–24)</label>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={curHours}
                        onChange={(e) => applyHM(parseInt(e.target.value, 10) || 0, curMins, false)}
                        onBlur={() => applyHM(curHours, curMins, true)}
                        className="w-full bg-white/85 border border-pink-300 rounded-xl px-3.5 py-2 font-bold text-slate-900 text-[14px]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Минут (0–59)</label>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={curMins}
                        onChange={(e) => applyHM(curHours, parseInt(e.target.value, 10) || 0, false)}
                        onBlur={() => applyHM(curHours, curMins, true)}
                        className="w-full bg-white/85 border border-pink-300 rounded-xl px-3.5 py-2 font-bold text-slate-900 text-[14px]"
                      />
                    </div>
                  </div>
                  <div className="text-slate-700 font-medium">
                    Итоговая пауза: <span className="font-bold text-slate-900">{curHours} ч. {curMins} мин.</span> ({totalDelayMins} мин.)
                  </div>
                </div>
              );
            })()}

            {/* Notify Author */}
            {selectedNode.type === 'notify_author' && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/70 via-pink-100/70 via-orange-100/70 via-pink-100/70 to-sky-100/70 border border-pink-300 text-slate-800">
                После выполнения сценария бот отправит вам личный отчет с заголовком публикации, черновиком и временем выхода.
              </div>
            )}

            {/* Crosspost */}
            {selectedNode.type === 'publish_crosspost' && (
              <div className="p-3.5 rounded-2xl bg-orange-100/80 border border-orange-300 text-slate-900">
                Прямая интеграция автокросспостинга в социальные сети ВКонтакте, Сетка и Одноклассники находится в разработке.
              </div>
            )}

            {/* Collapsible Last Saved Test Result Preview */}
            {hasDbResult && savedRecord?.output && (
              <CollapsibleSection
                title="Последний результат теста"
                summary={
                  savedRecord.testedAt
                    ? `Обновлено: ${new Date(savedRecord.testedAt).toLocaleString('ru-RU')} · Списано: ${savedRecord.cost || 0} Иирок`
                    : `Списано: ${savedRecord.cost || 0} Иирок`
                }
                icon={<Eye size={16} />}
                defaultOpen={false}
              >
                <div className="space-y-2 text-slate-800">
                  {(savedRecord.output.topic || savedRecord.output.title) && (
                    <div className="font-bold text-slate-900 break-words">
                      {savedRecord.output.topic || savedRecord.output.title}
                    </div>
                  )}
                  {savedRecord.output.text && (
                    <div className="whitespace-pre-line break-words max-h-40 overflow-y-auto bg-white/75 p-2.5 rounded-xl border border-pink-200">
                      {savedRecord.output.text}
                    </div>
                  )}
                  {savedRecord.output.imageUrl && (
                    <img
                      src={savedRecord.output.imageUrl}
                      alt="Результат теста"
                      className="max-h-44 rounded-xl border border-pink-200 object-contain"
                    />
                  )}
                </div>
              </CollapsibleSection>
            )}
          </div>

          {/* Fixed Ergonomic Footer */}
          <div className="px-4 sm:px-6 py-3 border-t border-pink-300/75 space-y-2.5 shrink-0 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75">
            {testProgress?.isRunning && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[14px] font-bold text-pink-700">
                  <span className="truncate">
                    {testProgress.statusText || `Работает: ${testProgress.activeNodeTitle}`}
                  </span>
                  <span className="shrink-0">{testProgress.percent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/85 border border-pink-300 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-sky-500 transition-all duration-300"
                    style={{ width: `${Math.max(5, testProgress.percent)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ResponsiveActionBtn
                  variant="vivid"
                  icon={
                    isTestingNode ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Play size={15} fill="white" />
                    )
                  }
                  label="Тестировать"
                  title="Тестировать этот шаг или цепочку до него"
                  disabled={isTestingNode || isUnderDev}
                  onClick={() => onOpenTestChoice(selectedNode)}
                />

                <ResponsiveActionBtn
                  variant="outline"
                  icon={<Eye size={16} />}
                  label={hasDbResult ? 'Результат теста' : 'Результат'}
                  title="Открыть полный результат теста из базы данных"
                  onClick={() => onOpenResultModal(selectedNode)}
                />
              </div>

              <ResponsiveActionBtn
                variant="outline"
                showLabelFrom="always"
                icon={<Check size={16} />}
                label="Готово"
                onClick={onClose}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
