import React from 'react';
import {
  Plus,
  Trash2,
  Clock,
  Layers,
  Sliders,
  RefreshCw,
  HelpCircle,
  Check,
  X,
  Copy,
  Loader2
} from 'lucide-react';
import { Scenario, ScenarioLog, WorkflowNode, WorkflowEdge } from '../../../types';
import { ImageBuilderModal } from '../../image-builder';
import { NeuralSphere } from '../../NeuralSphere';
import { NeurosphereLoader } from '../../loaders/NeurosphereLoader';
import { ScenarioModalShell } from './ScenarioModals';
import { AcademyHelpButton } from '../../academy/AcademyHelpModal';
import { ResponsiveActionBtn, UnboxedMetaLine } from '../../ui-kit/ResponsiveActionBtn';
import {
  isScenarioImageNodeType,
  isScenarioRichVisualNodeType,
  isAnyScenarioVisualBuilderNode,
  resolveScenarioImageFunction,
  computeScenarioImageCost,
  buildScenarioImageSubtitle,
  ScenarioImageCosts
} from '../ScenarioImageNodeConfig';
import {
  getScenarioActiveFormat,
  calculateTotalCost,
  getDynamicNodeCost,
  buildBasicNodeSubtitle
} from '../scenarioDefinitions';

interface ScenarioListTabProps {
  scenarios: Scenario[];
  isLoading: boolean;
  costs: ScenarioImageCosts;
  duplicatingScenarioId?: string | null;
  onCreateNew: () => void;
  onOpenIirkaCreate: () => void;
  onOpenIirkaEditScenario: (scen: Scenario) => void;
  onOpenScenario: (scen: Scenario) => void;
  onDuplicateScenario: (scen: Scenario) => void;
  onRequestDelete: (scen: Scenario) => void;
}

export const ScenarioListTab: React.FC<ScenarioListTabProps> = ({
  scenarios,
  isLoading,
  costs,
  duplicatingScenarioId,
  onCreateNew,
  onOpenIirkaCreate,
  onOpenIirkaEditScenario,
  onOpenScenario,
  onDuplicateScenario,
  onRequestDelete
}) => (
  <div className="space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[18px] font-bold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent">
          Ваши автоматические сценарии
        </h2>
        <span className="text-[14px] text-slate-700 block break-words">
          Конструкторы форматов Rich и v2 и умная сборка голосом или текстом с Ииркой
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <ResponsiveActionBtn
          variant="secondary"
          icon={<NeuralSphere size={20} glow={false} />}
          label="Поручить Иирке"
          title="Поручить Иирке создать или обновить сценарий голосом или текстом"
          onClick={onOpenIirkaCreate}
        />

        <ResponsiveActionBtn
          variant="primary"
          icon={<Plus size={18} />}
          label="Создать сценарий"
          title="Создать новый сценарий"
          onClick={onCreateNew}
        />

        <AcademyHelpButton
          sectionSlug="automation-scenarios"
          showLabelOnDesktop={true}
          label="Справка"
        />
      </div>
    </div>

    {isLoading ? (
      <NeurosphereLoader variant="inline" label="Загрузка сценариев..." />
    ) : scenarios.length === 0 ? (
      <div className="bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md rounded-3xl border border-pink-300 p-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 flex items-center justify-center text-pink-500 shadow-sm">
          <NeuralSphere size={48} glow={true} />
        </div>
        <div className="space-y-1">
          <h3 className="text-[18px] font-bold text-slate-900">У вас пока нет сценариев</h3>
          <p className="text-[14px] text-slate-700 max-w-md mx-auto">
            Расскажите голосом или текстом помощнику Иирке, какие посты выпускать, или создайте цепочку из шаблонов v2 и Rich.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={onOpenIirkaCreate}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-bold shadow-md cursor-pointer transition-all inline-flex items-center gap-2"
          >
            <NeuralSphere size={22} glow={false} />
            <span>Поручить задачу Иирке</span>
          </button>
          <button
            type="button"
            onClick={onCreateNew}
            className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 cursor-pointer"
          >
            <span className="px-5 py-2.5 rounded-[14.5px] bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 text-slate-900 text-[14px] font-bold inline-flex items-center gap-2">
              <Plus size={18} className="text-pink-600" />
              <span>Выбрать шаблон вручную</span>
            </span>
          </button>
        </div>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scenarios.map((scen) => {
          const nodeCount = scen.nodes?.length || scen.steps?.length || 0;
          const cost = calculateTotalCost(scen, costs);
          const fmt = getScenarioActiveFormat(scen);

          return (
            <div
              key={scen.id}
              className="bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md border border-pink-300 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between min-w-0"
            >
              <div className="space-y-3 min-w-0">
                <UnboxedMetaLine
                  items={[
                    scen.category || scen.topicCategory || 'Автопостинг',
                    fmt === 'rich' ? 'Формат Rich' : 'Формат v2',
                    cost > 0 ? `${cost} Иирок / запуск` : 'Бесплатно'
                  ]}
                />

                <h3 className="text-[17px] font-bold text-slate-900 leading-snug break-words">
                  {scen.name}
                </h3>

                <p className="text-[14px] text-slate-700 line-clamp-2 break-words">
                  {scen.description || 'Пошаговый сценарий автоматизации контента'}
                </p>

                <div className="bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 p-3 rounded-2xl border border-pink-300/75 space-y-1.5 text-[14px] text-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} className="text-pink-600 shrink-0" />
                      <span>Периодичность:</span>
                    </span>
                    <span className="font-bold text-right break-words">
                      {scen.schedule || 'Ежедневно в 10:00'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <Layers size={14} className="text-sky-600 shrink-0" />
                      <span>Шагов в цепочке:</span>
                    </span>
                    <span className="font-bold">{nodeCount}</span>
                  </div>
                  {scen.lastRunAt && (
                    <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-pink-200/80">
                      <span>Последний запуск:</span>
                      <span>{new Date(scen.lastRunAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 pt-2 border-t border-pink-300/70">
                <button
                  type="button"
                  onClick={() => onOpenScenario(scen)}
                  title={`Открыть конструктор ${fmt === 'rich' ? 'Rich' : 'v2'}`}
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold shadow-2xs hover:opacity-95 cursor-pointer flex items-center justify-center gap-1.5 transition-all min-w-0"
                >
                  <Sliders size={16} className="shrink-0" />
                  <span className="truncate">Конструктор {fmt === 'rich' ? 'Rich' : 'v2'}</span>
                </button>

                <ResponsiveActionBtn
                  variant="secondary"
                  icon={<NeuralSphere size={18} glow={false} />}
                  label="Иирка"
                  title="Отредактировать сценарий с помощью Иирки"
                  onClick={() => onOpenIirkaEditScenario(scen)}
                />

                <button
                  type="button"
                  disabled={duplicatingScenarioId === scen.id}
                  onClick={() => onDuplicateScenario(scen)}
                  title="Создать копию сценария"
                  aria-label="Создать копию сценария"
                  className="min-w-[40px] min-h-[40px] px-2.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] shadow-2xs inline-flex items-center justify-center hover:opacity-95 transition-all cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed shrink-0"
                >
                  {duplicatingScenarioId === scen.id ? (
                    <Loader2 size={16} className="animate-spin text-white" />
                  ) : (
                    <Copy size={16} className="text-white" />
                  )}
                </button>

                <ResponsiveActionBtn
                  variant="danger"
                  icon={<Trash2 size={16} />}
                  label="Удалить"
                  alwaysIconOnly={true}
                  title="Удалить сценарий"
                  onClick={() => onRequestDelete(scen)}
                />
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

interface ScenarioLogsTabProps {
  logs: ScenarioLog[];
  onRefresh: () => void;
}

export const ScenarioLogsTab: React.FC<ScenarioLogsTabProps> = ({ logs, onRefresh }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="min-w-0">
        <h2 className="text-[18px] font-bold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent">
          История запусков сценариев
        </h2>
        <span className="text-[14px] text-slate-700 block break-words">
          Отчеты о генерациях, сохранении черновиков, стоимости и статусе публикации
        </span>
      </div>
      <ResponsiveActionBtn
        variant="secondary"
        icon={<RefreshCw size={15} />}
        label="Обновить"
        title="Обновить историю запусков"
        onClick={onRefresh}
      />
    </div>

    {logs.length === 0 ? (
      <div className="bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md rounded-3xl border border-pink-300 p-8 text-center text-slate-700 text-[14px] font-medium">
        История запусков пока пуста. Запустите сценарий или тест, чтобы увидеть отчет.
      </div>
    ) : (
      <div className="space-y-3">
        {logs.map((log) => (
          <div
            key={log.id}
            className="bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md rounded-2xl border border-pink-300 p-4 space-y-2 shadow-2xs"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold text-[15px] text-slate-900 break-words">
                  {log.scenarioName}
                </span>
                <span
                  className={`text-[14px] font-bold ${
                    log.status === 'success' ? 'text-sky-700' : 'text-rose-700'
                  }`}
                >
                  · {log.status === 'success' ? 'Успешно' : 'Ошибка'}
                </span>
              </div>

              <UnboxedMetaLine
                items={[
                  `Списано: ${log.cost || 0} Иирок`,
                  new Date(log.runAt || '').toLocaleString('ru-RU')
                ]}
              />
            </div>

            <p className="text-[14px] text-slate-800 whitespace-pre-line bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 p-3 rounded-xl border border-pink-200 break-words">
              {log.details}
            </p>
          </div>
        ))}
      </div>
    )}
  </div>
);

interface ScenarioImageBuilderBridgeProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNode: WorkflowNode | null;
  currentScenario: Scenario | null;
  activeUserId: string;
  userBalance: number;
  costs: ScenarioImageCosts;
  onCommitNodes: (updatedNodes: WorkflowNode[], edges: WorkflowEdge[], notice?: string) => void;
}

export const ScenarioImageBuilderBridge: React.FC<ScenarioImageBuilderBridgeProps> = ({
  isOpen,
  onClose,
  selectedNode,
  currentScenario,
  activeUserId,
  userBalance,
  costs,
  onCommitNodes
}) => {
  const defaultTargetMode =
    selectedNode?.type === 'rich_part_slideshow'
      ? 'slideshow'
      : selectedNode?.type === 'rich_part_collage'
      ? 'collage'
      : selectedNode?.type === 'v2_media_attachment' &&
        selectedNode?.config?.v2AttachmentKind === 'album'
      ? 'album'
      : (selectedNode?.config?.mediaType as any) || 'photo';

  const initialCount =
    selectedNode?.type === 'rich_part_slideshow' || selectedNode?.type === 'rich_part_collage'
      ? Number(selectedNode?.config?.slidesPerPart || selectedNode?.config?.imageCount || 3)
      : Number(selectedNode?.config?.imageCount || 1);

  const canSaveNodeSettings = Boolean(
    selectedNode &&
      (isScenarioImageNodeType(selectedNode.type) ||
        isScenarioRichVisualNodeType(selectedNode.type))
  );

  const resolvedFn =
    selectedNode && isAnyScenarioVisualBuilderNode(selectedNode.type)
      ? resolveScenarioImageFunction(selectedNode)
      : 'func_621';

  return (
    <ImageBuilderModal
      isOpen={isOpen}
      onClose={onClose}
      title="Конструктор генерации картинки"
      editorFormat={
        selectedNode?.config?.messageFormat || getScenarioActiveFormat(currentScenario)
      }
      defaultTargetMode={defaultTargetMode}
      initialCount={initialCount}
      initialPrompt={
        selectedNode?.config?.imagePrompt || selectedNode?.config?.styleHint || ''
      }
      initialMode={resolvedFn}
      initialAspectRatio={
        resolvedFn === 'func_791'
          ? selectedNode?.config?.aspect_ratio || selectedNode?.config?.aspectRatio || 'auto'
          : selectedNode?.config?.aspectRatio || (resolvedFn === 'func_784' ? '9:16' : '16:9')
      }
      initialReferenceUrl={selectedNode?.config?.referenceUrl || ''}
      initialFunc787Config={
        selectedNode?.config
          ? {
              size: selectedNode.config.size,
              quality: selectedNode.config.quality,
              output_format: selectedNode.config.output_format,
              response_format: selectedNode.config.response_format,
              background: selectedNode.config.background,
              mode: selectedNode.config.mode,
              debug: selectedNode.config.debug,
              images: selectedNode.config.images,
              images_url: selectedNode.config.images_url
            }
          : undefined
      }
      initialFunc791Config={
        selectedNode?.config
          ? {
              aspect_ratio:
                selectedNode.config.aspect_ratio || selectedNode.config.aspectRatio || 'auto',
              images_urls:
                selectedNode.config.images_urls ||
                selectedNode.config.images_url ||
                selectedNode.config.referenceUrl ||
                '',
              debug: Boolean(selectedNode.config.debug),
              resolution: '1K'
            }
          : undefined
      }
      saveConfigButtonLabel={
        canSaveNodeSettings ? 'Сохранить настройки в блок' : undefined
      }
      onSyncConfig={(synced) => {
        if (!selectedNode || !currentScenario?.nodes || !canSaveNodeSettings) {
          return;
        }
        const updatedNodes = currentScenario.nodes.map((n) => {
          if (n.id !== selectedNode.id) return n;
          const isRichMulti =
            n.type === 'rich_part_slideshow' || n.type === 'rich_part_collage';
          const is791 = synced.mode === 'func_791';
          const mergedConfig = {
            ...(n.config || {}),
            functionMode: synced.mode,
            aspectRatio: is791 ? synced.func791.aspect_ratio : synced.aspectRatio,
            aspect_ratio: synced.func791.aspect_ratio,
            resolution: '1K',
            imageCount: synced.imageCount,
            ...(isRichMulti ? { slidesPerPart: Math.max(2, synced.imageCount) } : {}),
            mediaType:
              n.type === 'rich_part_slideshow'
                ? 'slideshow'
                : n.type === 'rich_part_collage'
                ? 'collage'
                : n.type === 'rich_part_image'
                ? 'photo'
                : synced.targetMode,
            referenceUrl: synced.referenceUrl,
            ...(synced.prompt
              ? {
                  promptMode: 'custom_template',
                  imagePrompt: synced.prompt
                }
              : {}),
            ai_model: is791 ? 'gpt-image-2.5-sunburst' : synced.func787.ai_model,
            size: is791 ? '' : synced.func787.size,
            quality: synced.func787.quality,
            output_format: synced.func787.output_format,
            response_format: synced.func787.response_format,
            images: synced.func787.images,
            images_url: synced.func787.images_url,
            images_urls: synced.func791.images_urls,
            background: synced.func787.background,
            mode: synced.func787.mode,
            debug: is791 ? Boolean(synced.func791.debug) : Boolean(synced.func787.debug)
          };
          const updatedNode = { ...n, config: mergedConfig };
          return {
            ...updatedNode,
            cost: getDynamicNodeCost(updatedNode, costs, currentScenario),
            subtitle: buildBasicNodeSubtitle(updatedNode, currentScenario)
          };
        });
        onCommitNodes(
          updatedNodes,
          currentScenario.edges || [],
          'Параметры генерации картинки сохранены в блок сценария.'
        );
      }}
      userId={activeUserId}
      userBalance={userBalance}
      onRefreshUser={() => {}}
      onSelectImage={(url) => {
        if (selectedNode && currentScenario?.nodes) {
          const updatedNodes = currentScenario.nodes.map((n) => {
            if (n.id !== selectedNode.id) return n;
            if (n.type === 'v2_media_attachment') {
              const kind = n.config?.v2AttachmentKind || 'photo';
              const existing = Array.isArray(n.config?.attachmentUrls)
                ? n.config.attachmentUrls.filter(Boolean)
                : [];
              const nextUrls =
                kind === 'album' ? Array.from(new Set([...existing, url])).slice(0, 10) : [url];
              const updatedNode = {
                ...n,
                config: {
                  ...n.config,
                  attachmentUrls: nextUrls,
                  imageUrls: nextUrls,
                  imageUrl: nextUrls[0] || url
                }
              };
              return {
                ...updatedNode,
                subtitle: buildBasicNodeSubtitle(updatedNode, currentScenario)
              };
            }

            const mergedConfig = {
              ...n.config,
              imageUrl: url,
              imageUrls: [url],
              imageCount: 1,
              mediaType: 'photo'
            };
            const updatedNode = { ...n, config: mergedConfig };
            return {
              ...updatedNode,
              ...(isScenarioImageNodeType(n.type) || isScenarioRichVisualNodeType(n.type)
                ? {
                    cost: getDynamicNodeCost(updatedNode, costs, currentScenario),
                    subtitle: buildBasicNodeSubtitle(updatedNode, currentScenario)
                  }
                : {})
            };
          });
          onCommitNodes(updatedNodes, currentScenario.edges || []);
        }
        onClose();
      }}
      onSelectImages={(urls, targetMode) => {
        if (!urls || urls.length === 0) return;
        if (selectedNode && currentScenario?.nodes) {
          const fmt = getScenarioActiveFormat(currentScenario);
          const updatedNodes = currentScenario.nodes.map((n) => {
            if (n.id !== selectedNode.id) return n;
            if (n.type === 'v2_media_attachment') {
              const existing = Array.isArray(n.config?.attachmentUrls)
                ? n.config.attachmentUrls.filter(Boolean)
                : [];
              const merged =
                urls.length > 1
                  ? Array.from(new Set([...existing, ...urls])).slice(0, 10)
                  : urls;
              const updatedNode = {
                ...n,
                config: {
                  ...n.config,
                  v2AttachmentKind: merged.length > 1 ? 'album' : 'photo',
                  mediaType: merged.length > 1 ? 'album' : 'photo',
                  attachmentUrls: merged,
                  imageUrls: merged,
                  imageUrl: merged[0]
                }
              };
              return {
                ...updatedNode,
                subtitle: buildBasicNodeSubtitle(updatedNode, currentScenario)
              };
            }
            if (n.type === 'format_media' && targetMode !== 'photo') {
              const existing = Array.isArray(n.config?.imageUrls)
                ? n.config.imageUrls.filter(Boolean)
                : [];
              const merged = Array.from(new Set([...existing, ...urls])).slice(0, 10);
              return {
                ...n,
                config: {
                  ...n.config,
                  mediaType: targetMode,
                  imageUrls: merged,
                  imageUrl: merged[0] || urls[0]
                }
              };
            }
            const mergedConfig = {
              ...n.config,
              mediaType: targetMode,
              imageCount: urls.length,
              ...(n.type === 'rich_part_slideshow' || n.type === 'rich_part_collage'
                ? { slidesPerPart: Math.max(2, urls.length) }
                : {}),
              imageUrls: urls,
              imageUrl: urls[0]
            };
            const updatedNode = { ...n, config: mergedConfig };
            return {
              ...updatedNode,
              ...(isScenarioImageNodeType(n.type) || isScenarioRichVisualNodeType(n.type)
                ? {
                    cost: computeScenarioImageCost({ type: n.type, config: mergedConfig }, costs),
                    subtitle: buildScenarioImageSubtitle({ type: n.type, config: mergedConfig }, fmt)
                  }
                : {})
            };
          });
          onCommitNodes(updatedNodes, currentScenario.edges || []);
        }
        onClose();
      }}
    />
  );
};

export const ScenarioHelpModal: React.FC<{
  helpPopup: {
    title: string;
    summary: string;
    instructionText: string;
    examples?: string;
  } | null;
  onClose: () => void;
}> = ({ helpPopup, onClose }) => {
  if (!helpPopup) return null;

  return (
    <ScenarioModalShell
      title={helpPopup.title}
      subtitle="Справка по работе блока и параметров"
      icon={<HelpCircle size={18} />}
      onClose={onClose}
      zIndexClass="z-[70]"
      footer={
        <div className="flex justify-end">
          <ResponsiveActionBtn
            variant="primary"
            icon={<Check size={16} />}
            label="Понятно"
            title="Закрыть справку"
            onClick={onClose}
          />
        </div>
      }
    >
      {helpPopup.summary && (
        <div className="text-[15px] font-bold text-slate-900">{helpPopup.summary}</div>
      )}
      <div className="text-[14px] text-slate-800 whitespace-pre-line leading-relaxed bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 p-4 rounded-2xl border border-pink-200">
        {helpPopup.instructionText}
      </div>
      {helpPopup.examples && (
        <div className="text-[14px] text-pink-900 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 p-3.5 rounded-2xl border border-pink-300">
          <strong className="block mb-1 font-bold">Пример:</strong>
          {helpPopup.examples}
        </div>
      )}
    </ScenarioModalShell>
  );
};

export const ScenarioDeleteConfirmModal: React.FC<{
  scenarioToDelete: Scenario | null;
  blockToDeleteNode: WorkflowNode | null;
  onCancel: () => void;
  onConfirmScenario: (id: string) => void;
  onConfirmBlock: (id: string) => void;
}> = ({
  scenarioToDelete,
  blockToDeleteNode,
  onCancel,
  onConfirmScenario,
  onConfirmBlock
}) => {
  if (!scenarioToDelete && !blockToDeleteNode) return null;

  const isScenario = Boolean(scenarioToDelete);
  const title = isScenario ? 'Удалить сценарий?' : 'Удалить выбранный блок?';
  const subtitle = isScenario
    ? 'Цепочка и сохраненные результаты теста будут удалены из базы данных'
    : 'Блок и связанные с ним стрелки будут удалены из сценария';

  return (
    <ScenarioModalShell
      title={title}
      subtitle={subtitle}
      icon={<Trash2 size={18} />}
      onClose={onCancel}
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <ResponsiveActionBtn
            variant="secondary"
            icon={<X size={16} />}
            label="Отмена"
            title="Отменить удаление"
            onClick={onCancel}
          />
          <ResponsiveActionBtn
            variant="primary"
            icon={<Trash2 size={16} />}
            label={isScenario ? 'Удалить сценарий' : 'Удалить блок'}
            title={isScenario ? 'Подтвердить удаление сценария' : 'Подтвердить удаление блока'}
            onClick={() => {
              if (scenarioToDelete) onConfirmScenario(scenarioToDelete.id);
              else if (blockToDeleteNode) onConfirmBlock(blockToDeleteNode.id);
            }}
          />
        </div>
      }
    >
      <div className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-4 rounded-2xl border border-pink-300 space-y-1">
        <div className="text-[15px] font-bold text-slate-900 break-words">
          {scenarioToDelete ? scenarioToDelete.name : blockToDeleteNode?.title}
        </div>
        <div className="text-[14px] text-slate-700 break-words">
          {scenarioToDelete
            ? `${scenarioToDelete.category || 'Автопостинг'} · ${scenarioToDelete.nodes?.length || 0} блоков`
            : blockToDeleteNode?.subtitle || 'Шаг сценария'}
        </div>
      </div>
    </ScenarioModalShell>
  );
};
