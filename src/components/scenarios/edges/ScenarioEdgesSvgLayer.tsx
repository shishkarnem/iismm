import React from 'react';
import { X, MousePointerClick } from 'lucide-react';
import { WorkflowEdge, WorkflowNode } from '../../../types';
import {
  CanvasWireMode,
  ScenarioEdgeFocusPart,
  computeScenarioEdgeGeometry
} from './edgeOperations';

interface ScenarioEdgesSvgLayerProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onSelectEdge: (edgeId: string, focus: ScenarioEdgeFocusPart) => void;
}

export const ScenarioEdgesSvgLayer: React.FC<ScenarioEdgesSvgLayerProps> = ({
  nodes,
  edges,
  onSelectEdge
}) => {
  return (
    <svg
      className="absolute inset-0 overflow-visible pointer-events-none"
      style={{ zIndex: 4, width: 3800, height: 4800 }}
    >
      <defs>
        <marker
          id="scenario-arrow-pink"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#ec4899" />
        </marker>
        <marker
          id="scenario-arrow-sky"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#0284c7" />
        </marker>
        <marker
          id="scenario-arrow-orange"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#ea580c" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const geom = computeScenarioEdgeGeometry(edge, nodes, edges);
        if (!geom) return null;

        const isLogicSource = geom.src.type === 'logic_filter';
        const branchKind: 'yes' | 'no' | 'default' = isLogicSource
          ? edge.branch === 'no'
            ? 'no'
            : 'yes'
          : 'default';

        const mainStroke =
          branchKind === 'yes'
            ? '#0284c7'
            : branchKind === 'no'
            ? '#ea580c'
            : '#ec4899';
        const glowStroke =
          branchKind === 'yes'
            ? '#7dd3fc'
            : branchKind === 'no'
            ? '#fdba74'
            : '#fda4af';
        const markerId =
          branchKind === 'yes'
            ? 'url(#scenario-arrow-sky)'
            : branchKind === 'no'
            ? 'url(#scenario-arrow-orange)'
            : 'url(#scenario-arrow-pink)';

        const startHandleY = geom.startY + 9;
        const endHandleY = geom.endY - 9;

        return (
          <g key={edge.id} className="group">
            {/* Soft glow */}
            <path
              d={geom.pathD}
              fill="none"
              stroke={glowStroke}
              strokeWidth="6"
              strokeOpacity="0.42"
            />
            {/* Visible dotted line */}
            <path
              d={geom.pathD}
              fill="none"
              stroke={mainStroke}
              strokeWidth="2.8"
              strokeDasharray="6,4"
              markerEnd={markerId}
            />
            {/* Wide invisible clickable hit stroke along the entire dotted line */}
            <path
              d={geom.pathD}
              fill="none"
              stroke="transparent"
              strokeWidth="24"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEdge(edge.id, 'line');
              }}
            >
              <title>
                Кликните по линии связи, чтобы вставить сюда блок, перенести концы, добавить параллельную линию или удалить связь
              </title>
            </path>

            {/* Midpoint interactive badge (+ or Да/Нет) */}
            <g
              transform={`translate(${geom.midX}, ${geom.midY})`}
              style={{ pointerEvents: 'all', cursor: 'pointer' }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEdge(edge.id, 'line');
              }}
            >
              <title>Настроить линию связи или вставить блок на линию</title>
              {isLogicSource ? (
                <>
                  <rect
                    x="-28"
                    y="-12"
                    width="56"
                    height="24"
                    rx="10"
                    fill="#ffffff"
                    stroke={mainStroke}
                    strokeWidth="1.8"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill={mainStroke}
                    fontSize="14"
                    fontWeight="700"
                  >
                    {branchKind === 'no' ? 'Нет +' : 'Да +'}
                  </text>
                </>
              ) : (
                <>
                  <circle
                    cx="0"
                    cy="0"
                    r="11"
                    fill="#ffffff"
                    stroke={mainStroke}
                    strokeWidth="2"
                  />
                  <text
                    x="0"
                    y="4.5"
                    textAnchor="middle"
                    fill={mainStroke}
                    fontSize="15"
                    fontWeight="800"
                  >
                    +
                  </text>
                </>
              )}
            </g>

            {/* Start endpoint handle (near source output) */}
            <g
              transform={`translate(${geom.startX}, ${startHandleY})`}
              style={{ pointerEvents: 'all', cursor: 'pointer' }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEdge(edge.id, 'start');
              }}
            >
              <title>
                Начало линии («{geom.src.title}»): кликните, чтобы перенести выход на другой блок или добавить параллельную линию
              </title>
              <circle
                cx="0"
                cy="0"
                r="7"
                fill="#0ea5e9"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>

            {/* End endpoint handle (near target input) */}
            <g
              transform={`translate(${geom.endX}, ${endHandleY})`}
              style={{ pointerEvents: 'all', cursor: 'pointer' }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEdge(edge.id, 'end');
              }}
            >
              <title>
                Конец линии («{geom.dst.title}»): кликните, чтобы перенести вход на другой блок
              </title>
              <circle
                cx="0"
                cy="0"
                r="7"
                fill="#ec4899"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          </g>
        );
      })}
    </svg>
  );
};

export const ScenarioWireModeBanner: React.FC<{
  wireMode: CanvasWireMode | null;
  onCancel: () => void;
}> = ({ wireMode, onCancel }) => {
  if (!wireMode) return null;

  const label =
    wireMode.kind === 'move_start'
      ? 'Кликните на любой блок на карте, чтобы перенести туда начало линии'
      : wireMode.kind === 'move_end'
      ? 'Кликните на любой блок на карте, чтобы перенести туда конец линии'
      : 'Кликните на любой блок на карте, чтобы провести к нему параллельную линию';

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute top-3 left-3 right-3 sm:right-auto sm:max-w-lg z-30 bg-gradient-to-r from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 backdrop-blur-md border-2 border-pink-500 rounded-2xl px-3.5 py-2.5 shadow-lg flex items-center justify-between gap-2.5 text-[14px]"
    >
      <div className="flex items-center gap-2 font-bold text-slate-900 min-w-0">
        <MousePointerClick size={17} className="text-pink-600 shrink-0" />
        <span className="break-words">{label}</span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        className="px-2.5 py-1 rounded-xl bg-white/90 border border-pink-300 text-pink-700 font-bold flex items-center gap-1 cursor-pointer shrink-0"
      >
        <X size={14} />
        <span>Отмена</span>
      </button>
    </div>
  );
};
