import React from 'react';
import { ArrowDownUp } from 'lucide-react';
import {
  Scenario,
  WorkflowNode,
  ScenarioInputScope,
  ScenarioHandoffMode
} from '../../../../types';
import { getScenarioActiveFormat } from '../../scenarioDefinitions';
import { GradientSelect, GradientMultiSelect } from '../../../ui-kit/GradientDropdown';
import { CollapsibleSection } from '../../../ui-kit/CollapsibleSection';

interface DataHandoffSectionProps {
  selectedNode: WorkflowNode;
  currentScenario: Scenario;
  onUpdateConfig: (patch: Record<string, any>, immediateSave?: boolean) => void;
}

export const DataHandoffSection: React.FC<DataHandoffSectionProps> = ({
  selectedNode,
  currentScenario,
  onUpdateConfig
}) => {
  if (
    selectedNode.type === 'trigger_schedule' ||
    selectedNode.type === 'trigger_manual'
  ) {
    return null;
  }

  const format = getScenarioActiveFormat(currentScenario);
  const inputScope: ScenarioInputScope = selectedNode.config?.inputScope || 'upstream';
  const handoffMode: ScenarioHandoffMode = selectedNode.config?.handoffMode || 'full';
  const sourceNodeIds: string[] = Array.isArray(selectedNode.config?.sourceNodeIds)
    ? selectedNode.config.sourceNodeIds
    : [];

  const candidateNodes = (currentScenario.nodes || []).filter(
    (n) =>
      n.id !== selectedNode.id &&
      n.type !== 'trigger_schedule' &&
      n.type !== 'trigger_manual' &&
      !n.isUnderDevelopment
  );

  const scopeOptions = [
    { value: 'upstream', label: 'Только прошлый связанный шаг' },
    { value: 'full_chain', label: 'Все прошлые шаги цепочки' },
    { value: 'selected_nodes', label: 'Выбранные блоки цепочки' }
  ];

  const handoffOptions = [
    { value: 'full', label: 'Полный текст и вложения' },
    { value: 'summary', label: 'Краткая выжимка (до 600 симв.)' },
    { value: 'title_only', label: 'Только тема и заголовок' },
    { value: 'structured', label: 'Структурированный пакет' },
    ...(format === 'rich'
      ? [{ value: 'parts_stream', label: 'Поток частей Rich (1–10)' }]
      : [])
  ];

  const scopeLabel =
    scopeOptions.find((o) => o.value === inputScope)?.label || 'Прошлый шаг';
  const handoffLabel =
    handoffOptions.find((o) => o.value === handoffMode)?.label || 'Полный текст';

  return (
    <CollapsibleSection
      title="Источник и передача данных цепочки"
      summary={`Вход: ${scopeLabel} · Выход: ${handoffLabel}`}
      icon={<ArrowDownUp size={16} />}
      defaultOpen={false}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <GradientSelect
          label="Откуда брать данные"
          value={inputScope}
          onChange={(val) =>
            onUpdateConfig({ inputScope: val as ScenarioInputScope }, true)
          }
          options={scopeOptions}
        />

        <GradientSelect
          label="В каком виде передавать дальше"
          value={handoffMode}
          onChange={(val) =>
            onUpdateConfig({ handoffMode: val as ScenarioHandoffMode }, true)
          }
          options={handoffOptions}
        />
      </div>

      {inputScope === 'selected_nodes' && candidateNodes.length > 0 && (
        <GradientMultiSelect
          label="Объединить результаты выбранных шагов"
          values={sourceNodeIds}
          onChange={(nextIds) => onUpdateConfig({ sourceNodeIds: nextIds }, true)}
          options={candidateNodes.map((cn, idx) => ({
            value: cn.id,
            label: `${idx + 1}. ${cn.title}`
          }))}
          selectAllLabel="Все доступные шаги"
          placeholder="Выберите блоки цепочки"
        />
      )}
    </CollapsibleSection>
  );
};
