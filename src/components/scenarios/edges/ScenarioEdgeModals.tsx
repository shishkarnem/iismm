import React, { useState, useEffect, useMemo } from 'react';
import {
  GitBranch,
  Plus,
  Trash2,
  X,
  ArrowRight,
  Move,
  MousePointerClick,
  Layers,
  Check
} from 'lucide-react';
import { Scenario, WorkflowEdge, WorkflowNode } from '../../../types';
import {
  NODE_DEFINITIONS,
  NodeTypeDefinition,
  getScenarioActiveFormat
} from '../scenarioDefinitions';
import { GradientSelect } from '../../ui-kit/GradientDropdown';
import { ResponsiveActionBtn, UnboxedMetaLine } from '../../ui-kit/ResponsiveActionBtn';
import {
  ScenarioEdgeFocusPart,
  CanvasWireMode
} from './edgeOperations';

interface ScenarioEdgeInfoModalProps {
  isOpen: boolean;
  edge: WorkflowEdge | null;
  initialFocus: ScenarioEdgeFocusPart;
  currentScenario: Scenario;
  onClose: () => void;
  onInsertBlockOnEdge: (edgeId: string, def: NodeTypeDefinition) => void;
  onReconnectEndpoint: (edgeId: string, side: 'start' | 'end', newNodeId: string) => string | undefined;
  onChangeEdgeBranch: (edgeId: string, branch: 'yes' | 'no' | 'default') => void;
  onAddParallelToExisting: (
    sourceNodeId: string,
    targetNodeId: string,
    branch: 'yes' | 'no' | 'default'
  ) => string | undefined;
  onAddParallelNewBlock: (
    sourceNodeId: string,
    def: NodeTypeDefinition,
    branch: 'yes' | 'no' | 'default'
  ) => void;
  onStartCanvasWireMode: (mode: CanvasWireMode) => void;
  onDeleteEdge: (edgeId: string) => void;
}

export const ScenarioEdgeInfoModal: React.FC<ScenarioEdgeInfoModalProps> = ({
  isOpen,
  edge,
  initialFocus,
  currentScenario,
  onClose,
  onInsertBlockOnEdge,
  onReconnectEndpoint,
  onChangeEdgeBranch,
  onAddParallelToExisting,
  onAddParallelNewBlock,
  onStartCanvasWireMode,
  onDeleteEdge
}) => {
  const nodes = currentScenario.nodes || [];
  const activeFormat = getScenarioActiveFormat(currentScenario);

  const compatibleDefs = useMemo(
    () =>
      NODE_DEFINITIONS.filter(
        (d) =>
          !d.isLegacyHidden &&
          !d.isUnderDevelopment &&
          d.category !== 'trigger' &&
          (!d.supportedFormats || d.supportedFormats.includes(activeFormat))
      ),
    [activeFormat]
  );

  const defaultInsertType = activeFormat === 'rich' ? 'format_beauty_post' : 'ai_generate_text';
  const [selectedInsertType, setSelectedInsertType] = useState<string>(defaultInsertType);
  const [selectedStartNodeId, setSelectedStartNodeId] = useState<string>('');
  const [selectedEndNodeId, setSelectedEndNodeId] = useState<string>('');
  const [parallelTargetNodeId, setParallelTargetNodeId] = useState<string>('');
  const [parallelNewType, setParallelNewType] = useState<string>('ai_generate_image');
  const [parallelBranch, setParallelBranch] = useState<'yes' | 'no' | 'default'>('default');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!compatibleDefs.some((d) => d.type === selectedInsertType)) {
      setSelectedInsertType(compatibleDefs.some((d) => d.type === defaultInsertType) ? defaultInsertType : (compatibleDefs[0]?.type || 'ai_generate_text'));
    }
  }, [compatibleDefs, defaultInsertType, selectedInsertType]);

  useEffect(() => {
    if (!edge) return;
    setSelectedStartNodeId(edge.sourceNodeId);
    setSelectedEndNodeId(edge.targetNodeId);
    const src = nodes.find((n) => n.id === edge.sourceNodeId);
    setParallelBranch(src?.type === 'logic_filter' ? (edge.branch === 'no' ? 'no' : 'yes') : 'default');
    const candidateExisting = nodes.find(
      (n) =>
        n.id !== edge.sourceNodeId &&
        n.id !== edge.targetNodeId &&
        n.type !== 'trigger_schedule' &&
        n.type !== 'trigger_manual'
    );
    setParallelTargetNodeId(candidateExisting?.id || '');
    setFeedbackMsg(null);
  }, [edge, nodes]);

  if (!isOpen || !edge) return null;

  const srcNode = nodes.find((n) => n.id === edge.sourceNodeId);
  const dstNode = nodes.find((n) => n.id === edge.targetNodeId);

  const startOptions = nodes
    .filter((n) => n.id !== edge.targetNodeId)
    .map((n, idx) => ({
      value: n.id,
      label: `${idx + 1}. ${n.title}`,
      hint: n.subtitle || ''
    }));

  const endOptions = nodes
    .filter(
      (n) =>
        n.id !== edge.sourceNodeId &&
        n.type !== 'trigger_schedule' &&
        n.type !== 'trigger_manual'
    )
    .map((n, idx) => ({
      value: n.id,
      label: `${idx + 1}. ${n.title}`,
      hint: n.subtitle || ''
    }));

  const parallelExistingOptions = nodes
    .filter(
      (n) =>
        n.id !== edge.sourceNodeId &&
        n.id !== edge.targetNodeId &&
        n.type !== 'trigger_schedule' &&
        n.type !== 'trigger_manual'
    )
    .map((n, idx) => ({
      value: n.id,
      label: `${idx + 1}. ${n.title}`,
      hint: n.subtitle || ''
    }));

  const focusHint =
    initialFocus === 'start'
      ? 'Вы кликнули на начало линии (выход из блока)'
      : initialFocus === 'end'
      ? 'Вы кликнули на конец линии (вход в блок)'
      : 'Вы кликнули на пунктирную линию связи';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-gradient-to-br from-sky-200/45 via-pink-200/45 via-orange-200/45 via-pink-200/45 to-sky-200/45 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[92dvh] p-[2px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-2xl flex flex-col overflow-hidden my-auto"
      >
        <div className="bg-gradient-to-br from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xl rounded-[22px] flex flex-col max-h-[calc(92dvh-4px)] overflow-hidden text-[14px]">
          {/* Header */}
          <div className="flex items-start justify-between gap-2.5 px-4 sm:px-6 py-3.5 border-b border-pink-300/80 shrink-0">
            <div className="flex items-start gap-2.5 min-w-0">
              <span className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0">
                <GitBranch size={18} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[17px] font-extrabold text-slate-900 leading-tight">
                  Управление линией связи
                </h3>
                <UnboxedMetaLine
                  items={[
                    focusHint,
                    `Формат ${activeFormat === 'rich' ? 'Rich' : 'v2'}`
                  ]}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть окно линии связи"
              className="min-w-[40px] min-h-[40px] rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white flex items-center justify-center cursor-pointer shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 min-h-0 min-w-0">
            {/* Current route card */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300 space-y-2">
              <div className="text-slate-700 font-semibold">Текущий маршрут передачи данных:</div>
              <div className="flex flex-wrap items-center gap-2 font-bold text-slate-900">
                <span className="px-3 py-1.5 rounded-xl bg-white/85 border border-sky-300 break-words">
                  {srcNode?.title || 'Блок-источник'}
                </span>
                <ArrowRight size={16} className="text-pink-600 shrink-0" />
                <span className="px-3 py-1.5 rounded-xl bg-white/85 border border-pink-300 break-words">
                  {dstNode?.title || 'Целевой блок'}
                </span>
              </div>

              {srcNode?.type === 'logic_filter' && (
                <div className="pt-2">
                  <GradientSelect
                    label="Условие перехода по этой линии"
                    value={edge.branch === 'no' ? 'no' : 'yes'}
                    onChange={(val) =>
                      onChangeEdgeBranch(edge.id, val === 'no' ? 'no' : 'yes')
                    }
                    options={[
                      { value: 'yes', label: 'Ветка «Да» (условие выполнено)' },
                      { value: 'no', label: 'Ветка «Нет» (иначе)' }
                    ]}
                  />
                </div>
              )}
            </div>

            {feedbackMsg && (
              <div className="p-3 rounded-xl bg-white/85 border border-pink-400 font-semibold text-pink-800">
                {feedbackMsg}
              </div>
            )}

            {/* 1. Insert new block onto this dotted line */}
            <div
              className={`p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 border ${
                initialFocus === 'line' ? 'border-pink-500 ring-2 ring-pink-300/70' : 'border-pink-300'
              } space-y-3 min-w-0`}
            >
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Plus size={17} className="text-pink-600 shrink-0" />
                <span>Вставить новый блок прямо на эту линию</span>
              </div>
              <p className="text-slate-700 leading-snug">
                Новый блок автоматически встроится между «{srcNode?.title}» и «{dstNode?.title}».
              </p>
              <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                <div className="flex-1 min-w-0">
                  <GradientSelect
                    label="Выберите блок для вставки на линию"
                    value={selectedInsertType}
                    searchable
                    onChange={(val) => setSelectedInsertType(val)}
                    options={compatibleDefs.map((d) => ({
                      value: d.type,
                      label: d.title,
                      hint: `${d.categoryTitle} · ${d.cost > 0 ? `${d.cost} Иирок` : 'Бесплатно'}`
                    }))}
                  />
                </div>
                <ResponsiveActionBtn
                  variant="vivid"
                  alwaysShowLabel
                  icon={<Plus size={16} />}
                  label="Добавить на линию"
                  onClick={() => {
                    const def = compatibleDefs.find((d) => d.type === selectedInsertType) || compatibleDefs[0];
                    if (def) {
                      onInsertBlockOnEdge(edge.id, def);
                      onClose();
                    }
                  }}
                />
              </div>
            </div>

            {/* 2. Move start / end endpoints */}
            <div
              className={`p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 border ${
                initialFocus === 'start' || initialFocus === 'end'
                  ? 'border-pink-500 ring-2 ring-pink-300/70'
                  : 'border-pink-300'
              } space-y-3 min-w-0`}
            >
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Move size={17} className="text-pink-600 shrink-0" />
                <span>Перенести концы линии на другие блоки</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Start endpoint */}
                <div className="p-3 rounded-xl bg-white/75 border border-pink-300 space-y-2 min-w-0">
                  <GradientSelect
                    label="Начало линии (откуда выходит)"
                    value={selectedStartNodeId}
                    onChange={(val) => {
                      setSelectedStartNodeId(val);
                      const err = onReconnectEndpoint(edge.id, 'start', val);
                      setFeedbackMsg(err || 'Начало линии перенесено и сохранено');
                    }}
                    options={startOptions}
                  />
                  <ResponsiveActionBtn
                    variant="outline"
                    alwaysShowLabel
                    icon={<MousePointerClick size={15} />}
                    label="Указать начало на карте"
                    onClick={() => {
                      onStartCanvasWireMode({ kind: 'move_start', edgeId: edge.id });
                      onClose();
                    }}
                  />
                </div>

                {/* End endpoint */}
                <div className="p-3 rounded-xl bg-white/75 border border-pink-300 space-y-2 min-w-0">
                  <GradientSelect
                    label="Конец линии (куда входит)"
                    value={selectedEndNodeId}
                    onChange={(val) => {
                      setSelectedEndNodeId(val);
                      const err = onReconnectEndpoint(edge.id, 'end', val);
                      setFeedbackMsg(err || 'Конец линии перенесен и сохранен');
                    }}
                    options={endOptions}
                  />
                  <ResponsiveActionBtn
                    variant="outline"
                    alwaysShowLabel
                    icon={<MousePointerClick size={15} />}
                    label="Указать конец на карте"
                    onClick={() => {
                      onStartCanvasWireMode({ kind: 'move_end', edgeId: edge.id });
                      onClose();
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 3. Add a parallel dotted line */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300 space-y-3 min-w-0">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Layers size={17} className="text-pink-600 shrink-0" />
                <span>Добавить параллельную линию от «{srcNode?.title || 'блока'}»</span>
              </div>
              <p className="text-slate-700 leading-snug">
                Позволяет запустить параллельную ветку одновременно (например, генерацию текста и иллюстрации параллельно).
              </p>

              {srcNode?.type === 'logic_filter' && (
                <GradientSelect
                  label="Ветка для новой параллельной линии"
                  value={parallelBranch === 'no' ? 'no' : 'yes'}
                  onChange={(val) => setParallelBranch(val === 'no' ? 'no' : 'yes')}
                  options={[
                    { value: 'yes', label: 'Ветка «Да»' },
                    { value: 'no', label: 'Ветка «Нет»' }
                  ]}
                />
              )}

              {/* Option A: Connect to existing block or pick on map */}
              <div className="p-3 rounded-xl bg-white/75 border border-pink-300 space-y-2 min-w-0">
                {parallelExistingOptions.length > 0 ? (
                  <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <GradientSelect
                        label="Провести параллельную линию к существующему блоку"
                        value={parallelTargetNodeId}
                        onChange={(val) => setParallelTargetNodeId(val)}
                        options={parallelExistingOptions}
                      />
                    </div>
                    <ResponsiveActionBtn
                      variant="secondary"
                      alwaysShowLabel
                      icon={<GitBranch size={15} />}
                      label="Соединить"
                      onClick={() => {
                        if (!parallelTargetNodeId) return;
                        const err = onAddParallelToExisting(
                          edge.sourceNodeId,
                          parallelTargetNodeId,
                          parallelBranch
                        );
                        if (err) setFeedbackMsg(err);
                        else onClose();
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-slate-700">
                    Все текущие блоки уже соединены — вы можете создать новый параллельный блок ниже.
                  </div>
                )}

                <ResponsiveActionBtn
                  variant="outline"
                  alwaysShowLabel
                  icon={<MousePointerClick size={15} />}
                  label="Выбрать блок для параллельной линии на карте"
                  onClick={() => {
                    onStartCanvasWireMode({
                      kind: 'add_parallel',
                      sourceNodeId: edge.sourceNodeId,
                      branch: parallelBranch
                    });
                    onClose();
                  }}
                />
              </div>

              {/* Option B: Create a brand-new parallel block */}
              <div className="p-3 rounded-xl bg-white/75 border border-pink-300 flex flex-col sm:flex-row sm:items-end gap-2 min-w-0">
                <div className="flex-1 min-w-0">
                  <GradientSelect
                    label="Или создать рядом новый параллельный блок"
                    value={parallelNewType}
                    searchable
                    onChange={(val) => setParallelNewType(val)}
                    options={compatibleDefs.map((d) => ({
                      value: d.type,
                      label: d.title,
                      hint: d.categoryTitle
                    }))}
                  />
                </div>
                <ResponsiveActionBtn
                  variant="vivid"
                  alwaysShowLabel
                  icon={<Plus size={16} />}
                  label="Создать параллельно"
                  onClick={() => {
                    const def = compatibleDefs.find((d) => d.type === parallelNewType) || compatibleDefs[0];
                    if (def) {
                      onAddParallelNewBlock(edge.sourceNodeId, def, parallelBranch);
                      onClose();
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-3 border-t border-pink-300/80 flex flex-wrap items-center justify-between gap-2 shrink-0 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75">
            <ResponsiveActionBtn
              variant="danger"
              alwaysShowLabel
              icon={<Trash2 size={16} />}
              label="Удалить линию связи"
              onClick={() => {
                onDeleteEdge(edge.id);
                onClose();
              }}
            />
            <ResponsiveActionBtn
              variant="vivid"
              alwaysShowLabel
              icon={<Check size={16} />}
              label="Готово"
              onClick={onClose}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
