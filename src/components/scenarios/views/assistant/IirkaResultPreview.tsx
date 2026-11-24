import React from 'react';
import {
  Check,
  Edit3,
  Layers,
  Loader2,
  RefreshCw,
  Send,
  Sliders,
  Sparkles
} from 'lucide-react';
import { AudioField } from '../../../AudioField';
import { NeuralSphere } from '../../../NeuralSphere';
import { IirkaClientResult } from './useIirkaAssistant';
import { usePricingConfig } from '../../../../hooks/usePricingConfig';
import { formatIirkyCount } from '../../../../shared/pricingConfig';

interface IirkaResultPreviewProps {
  result: IirkaClientResult;
  refinementText: string;
  refinementAudioUrl: string;
  isWorking: boolean;
  isCommitting: boolean;
  onRefinementTextChange: (val: string) => void;
  onRefinementAudioChange: (url: string) => void;
  onRunRefinement: () => void;
  onBackToForm: () => void;
  onApplyToCanvasOnly: () => void;
  onCommitAndSave: () => void;
}

const STATUS_LABELS: Record<
  'added' | 'modified' | 'unchanged' | 'removed',
  { text: string; toneClass: string }
> = {
  added: {
    text: 'Новый шаг',
    toneClass: 'text-sky-700 font-bold'
  },
  modified: {
    text: 'Изменен',
    toneClass: 'text-pink-700 font-bold'
  },
  unchanged: {
    text: 'Сохранен',
    toneClass: 'text-slate-600 font-medium'
  },
  removed: {
    text: 'Удален',
    toneClass: 'text-rose-700 font-bold line-through'
  }
};

export const IirkaResultPreview: React.FC<IirkaResultPreviewProps> = ({
  result,
  refinementText,
  refinementAudioUrl,
  isWorking,
  isCommitting,
  onRefinementTextChange,
  onRefinementAudioChange,
  onRunRefinement,
  onBackToForm,
  onApplyToCanvasOnly,
  onCommitAndSave
}) => {
  const { pricing } = usePricingConfig();
  const assistantCost = pricing.scenarioAi.assistantBuildOrEdit;
  const { scenario, stepDiffs, assistantSummary, highlights, estimatedRunCost } = result;
  const activeStepsCount = (scenario.nodes || []).length;

  return (
    <div className="space-y-4 text-[14px]">
      {/* Summary Header Card */}
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-sm">
        <div className="bg-gradient-to-r from-sky-50/88 via-pink-50/88 via-orange-50/88 via-pink-50/88 to-sky-50/88 backdrop-blur-md rounded-[22px] p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="shrink-0">
                <NeuralSphere size={48} glow={true} />
              </div>
              <div className="min-w-0 space-y-1">
                <h4 className="text-[17px] font-bold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 to-pink-600 bg-clip-text text-transparent break-words">
                  {scenario.name}
                </h4>
                <p className="text-[14px] text-slate-800 leading-relaxed break-words">
                  {assistantSummary}
                </p>
              </div>
            </div>

            <div className="text-[14px] text-slate-800 font-semibold shrink-0 sm:text-right space-y-0.5">
              <div>
                <span>Формат {scenario.messageFormat === 'rich' ? 'Rich' : 'v2'}</span>
                <span aria-hidden="true"> · </span>
                <span>{activeStepsCount} шаг.</span>
                <span aria-hidden="true"> · </span>
                <span className="text-pink-700 font-bold">{estimatedRunCost} Иирок / запуск</span>
              </div>
              <div className="text-sky-800 font-semibold">
                Списано за работу Иирки: {formatIirkyCount(result.chargedCost ?? assistantCost)}
                {typeof result.newBalance === 'number' ? ` (остаток: ${formatIirkyCount(result.newBalance)})` : ''}
              </div>
            </div>
          </div>

          {highlights.length > 0 && (
            <ul className="space-y-1 pl-5 list-disc text-slate-800 text-[14px]">
              {highlights.map((item, idx) => (
                <li key={idx} className="break-words leading-snug">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Step-by-step Chain Diff */}
      <div className="bg-gradient-to-r from-sky-50/82 via-pink-50/82 via-orange-50/82 via-pink-50/82 to-sky-50/82 backdrop-blur-md border border-pink-300 rounded-3xl p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h5 className="text-[15px] font-bold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
            <Layers size={16} className="text-pink-600 shrink-0" />
            <span>Цепочка блоков сценария ({stepDiffs.length})</span>
          </h5>
          <span className="text-[14px] text-slate-700 font-medium">
            Каналы: {(scenario.targetChannels || []).join(', ') || '@SAV_AI'}
          </span>
        </div>

        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
          {stepDiffs.map((st, idx) => {
            const stMeta = STATUS_LABELS[st.status];
            return (
              <div
                key={`${st.nodeId}-${idx}`}
                className="bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-200/90 rounded-2xl px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="text-[14px] font-bold text-slate-900 break-words">
                    {st.status !== 'removed' ? `${idx + 1}. ` : ''}
                    {st.title}
                  </div>
                  {st.subtitle && (
                    <div className="text-[14px] text-slate-600 break-words">{st.subtitle}</div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 text-[14px]">
                  <span className={stMeta.toneClass}>{stMeta.text}</span>
                  {st.status !== 'removed' && (
                    <>
                      <span aria-hidden="true" className="text-slate-400">
                        ·
                      </span>
                      <span className="text-slate-700 font-semibold">
                        {st.cost > 0 ? `${st.cost} Иирок` : 'Бесплатно'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Follow-up Voice / Text Refinement via AudioField */}
      <div className="bg-gradient-to-r from-sky-50/82 via-pink-50/82 via-orange-50/82 via-pink-50/82 to-sky-50/82 backdrop-blur-md border border-pink-300 rounded-3xl p-4 space-y-3">
        <AudioField
          id="iirka-refinement-field"
          label="Хотите что-то скорректировать? Скажите голосом или напишите Иирке:"
          value={refinementText}
          onChange={onRefinementTextChange}
          audioUrl={refinementAudioUrl}
          onAudioChange={onRefinementAudioChange}
          voiceFriendName="Иирка"
          titleVoice="Досказать правки для Иирки голосом"
          rows={2}
          placeholder="Например: перенеси запуск на 18:30, добавь подпись канала и сохраняй посты сразу в черновик..."
          disabled={isWorking || isCommitting}
        />

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onBackToForm}
            disabled={isWorking || isCommitting}
            className="p-[1.5px] rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 cursor-pointer disabled:opacity-50"
          >
            <span className="px-3.5 py-2 rounded-[10.5px] bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 text-slate-900 font-bold text-[14px] flex items-center justify-center gap-1.5">
              <Edit3 size={15} className="text-pink-600" />
              <span>Изменить исходный запрос</span>
            </span>
          </button>

          <button
            type="button"
            onClick={onRunRefinement}
            disabled={!refinementText.trim() || isWorking || isCommitting}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] shadow-xs hover:opacity-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={15} />
            <span>Уточнить с Ииркой · {formatIirkyCount(assistantCost)}</span>
          </button>
        </div>
      </div>

      {/* Commit Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-1">
        <button
          type="button"
          onClick={onApplyToCanvasOnly}
          disabled={isWorking || isCommitting}
          className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 cursor-pointer disabled:opacity-50"
        >
          <span className="px-4 py-2.5 rounded-[14.5px] bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 text-slate-900 font-bold text-[14px] flex items-center justify-center gap-2">
            <Sliders size={16} className="text-sky-600 shrink-0" />
            <span>Открыть на холсте без сохранения</span>
          </span>
        </button>

        <button
          type="button"
          onClick={onCommitAndSave}
          disabled={isWorking || isCommitting}
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] shadow-md hover:opacity-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isCommitting ? (
            <Loader2 size={16} className="animate-spin shrink-0" />
          ) : (
            <Check size={16} className="shrink-0" />
          )}
          <span>Сохранить в базу и открыть конструктор</span>
        </button>
      </div>
    </div>
  );
};
