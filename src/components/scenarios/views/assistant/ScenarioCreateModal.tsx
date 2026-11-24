import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  X,
  FileText,
  Layers,
  Sparkles,
  Check,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { Channel, Scenario } from '../../../../types';
import { NeuralSphere } from '../../../NeuralSphere';
import {
  SCENARIO_STARTER_TEMPLATES,
  generateUniqueScenarioName,
  validateScenarioWorkflow
} from '../../scenarioDefinitions';
import { usePricingConfig } from '../../../../hooks/usePricingConfig';
import { formatIirkyCount } from '../../../../shared/pricingConfig';

interface ScenarioCreateModalProps {
  isOpen: boolean;
  existingScenarios: Scenario[];
  channels: Channel[];
  onClose: () => void;
  onSwitchToIirka?: () => void;
  onConfirmCreate: (params: {
    name: string;
    format: 'v2' | 'rich';
    templateId: string;
    category: string;
    targetChannels: string[];
  }) => void;
}

export const ScenarioCreateModal: React.FC<ScenarioCreateModalProps> = ({
  isOpen,
  existingScenarios,
  channels,
  onClose,
  onSwitchToIirka,
  onConfirmCreate
}) => {
  const { pricing } = usePricingConfig();
  const defaultChannel =
    (channels[0] as any)?.channel_id || channels[0]?.username || '@SAV_AI';

  const [format, setFormat] = useState<'v2' | 'rich'>('v2');
  const [templateId, setTemplateId] = useState<string>('v2_fast_autopost');
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<string>('Технологии и нейросети');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([defaultChannel]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      const suggested = generateUniqueScenarioName(existingScenarios, 'Новый сценарий');
      setName(suggested);
      setNameError(null);
      setFormat('v2');
      setTemplateId('v2_fast_autopost');
      setSelectedChannels([defaultChannel]);
    }
  }, [isOpen]);

  const checkUniqueness = (rawVal: string) => {
    const trimmed = rawVal.trim();
    if (!trimmed) {
      setNameError('Введите название сценария.');
      return;
    }
    const lower = trimmed.toLowerCase();
    const localDup = existingScenarios.some(
      (s) => String(s.name || '').trim().toLowerCase() === lower
    );
    if (localDup) {
      setNameError('Сценарий с таким названием уже есть в базе данных.');
      return;
    }
    setNameError(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setIsCheckingName(true);
      try {
        const res = await fetch(
          `/api/scenarios/check-name?name=${encodeURIComponent(trimmed)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.taken || data?.available === false) {
            setNameError('Сценарий с таким названием уже есть в базе данных.');
          }
        }
      } catch {
        // ignore transient network check
      } finally {
        setIsCheckingName(false);
      }
    }, 240);
  };

  if (!isOpen) return null;

  const filteredTemplates = SCENARIO_STARTER_TEMPLATES.filter((t) => t.format === format);

  const handleSelectFormat = (nextFmt: 'v2' | 'rich') => {
    setFormat(nextFmt);
    const firstTpl = SCENARIO_STARTER_TEMPLATES.find((t) => t.format === nextFmt);
    if (firstTpl) setTemplateId(firstTpl.id);
  };

  const toggleChannel = (chId: string) => {
    setSelectedChannels((prev) => {
      if (prev.includes(chId)) {
        return prev.length > 1 ? prev.filter((c) => c !== chId) : prev;
      }
      return [...prev, chId];
    });
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center px-[2vw] py-3 sm:py-5 bg-sky-100/35 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-[920px] max-h-[92dvh] p-[2px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="bg-gradient-to-r from-sky-50/92 via-pink-50/92 via-orange-50/92 via-pink-50/92 to-sky-50/92 backdrop-blur-md rounded-[22px] flex flex-col max-h-[calc(92dvh-4px)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 md:px-6 py-3.5 border-b border-pink-200/90 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 to-pink-500 text-white shadow-2xs shrink-0">
                <Plus size={18} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[17px] md:text-[18px] font-bold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 to-pink-600 bg-clip-text text-transparent truncate">
                  Создание нового сценария
                </h3>
                <span className="text-[14px] font-medium text-slate-700 block truncate">
                  Выберите шаблон конструктора (Rich или v2) или поручите сборку помощнику Иирке
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/85 hover:bg-white border border-pink-200 text-slate-700 hover:text-slate-900 cursor-pointer shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4 min-h-0 text-[14px]">
            {/* Quick jump to Iirka voice/text builder */}
            {onSwitchToIirka && (
              <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-xs">
                <div className="bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 rounded-[14.5px] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <NeuralSphere size={38} glow={true} />
                    <div className="min-w-0">
                      <div className="font-bold text-[15px] text-slate-900 break-words">
                        Хотите просто рассказать задачу своими словами?
                      </div>
                      <div className="text-[14px] text-slate-700 break-words">
                        Наговорите голосом или напишите — Иирка сама соберет блоки, промпты и расписание.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSwitchToIirka();
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] shadow-xs hover:opacity-95 cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles size={15} />
                    <span>Собрать с Ииркой · {formatIirkyCount(pricing.scenarioAi.assistantBuildOrEdit)}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 1. Format Choice (Rich vs v2) */}
            <div className="space-y-2">
              <label className="text-[14px] font-bold text-slate-900 block">
                1. Формат конструктора сценария (раздельные наборы блоков):
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectFormat('v2')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer space-y-1.5 ${
                    format === 'v2'
                      ? 'bg-gradient-to-r from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 border-pink-500 ring-2 ring-pink-300 shadow-sm'
                      : 'bg-white/85 border-pink-200 hover:border-pink-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[16px] text-slate-900 flex items-center gap-2">
                      <FileText size={17} className="text-sky-600 shrink-0" />
                      <span>Конструктор формата v2</span>
                    </span>
                    {format === 'v2' && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white font-bold text-[14px]">
                        Выбрано
                      </span>
                    )}
                  </div>
                  <p className="text-[14px] text-slate-700 leading-relaxed">
                    Посты до 4 096 символов (1 024 с медиа) и 7 типов вложений: фото, альбом, видео, видео-кружок, аудио, голосовое сообщение и файлы.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectFormat('rich')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer space-y-1.5 ${
                    format === 'rich'
                      ? 'bg-gradient-to-r from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 border-pink-500 ring-2 ring-pink-300 shadow-sm'
                      : 'bg-white/85 border-pink-200 hover:border-pink-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[16px] text-slate-900 flex items-center gap-2">
                      <Layers size={17} className="text-pink-600 shrink-0" />
                      <span>Конструктор формата Rich</span>
                    </span>
                    {format === 'rich' && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white font-bold text-[14px]">
                        Выбрано
                      </span>
                    )}
                  </div>
                  <p className="text-[14px] text-slate-700 leading-relaxed">
                    Статьи до 32 000 символов, смысловое разделение на 1–10 частей, генерация картинок, слайдеров и коллажей к частям и финальная сборка в единый пост.
                  </p>
                </button>
              </div>
            </div>

            {/* 2. Name & Rubric */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="text-[14px] font-bold text-slate-900 block mb-1">
                  2. Уникальное название сценария:
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      checkUniqueness(e.target.value);
                    }}
                    placeholder="Например: Ежедневный разбор технологий"
                    className={`w-full bg-white/95 border rounded-xl px-3.5 py-2 text-[14px] font-bold text-slate-900 focus:outline-none focus:ring-2 ${
                      nameError
                        ? 'border-rose-400 focus:ring-rose-400'
                        : 'border-pink-300 focus:ring-pink-400'
                    }`}
                  />
                  {isCheckingName && (
                    <Loader2 size={16} className="animate-spin text-pink-500 absolute right-3" />
                  )}
                </div>
                {nameError && (
                  <span className="text-[14px] text-rose-700 font-semibold mt-1 block">
                    {nameError}
                  </span>
                )}
              </div>

              <div>
                <label className="text-[14px] font-bold text-slate-900 block mb-1">
                  Рубрика / ниша контента:
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Технологии, маркетинг, образование..."
                  className="w-full bg-white/95 border border-pink-300 rounded-xl px-3.5 py-2 text-[14px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
              </div>
            </div>

            {/* 3. Starter Template */}
            <div className="space-y-2">
              <label className="text-[14px] font-bold text-slate-900 block">
                3. Стартовый шаблон цепочки ({format === 'rich' ? 'Rich' : 'v2'}):
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredTemplates.map((tpl) => {
                  const active = templateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setTemplateId(tpl.id)}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                        active
                          ? 'bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 border-pink-500 ring-2 ring-pink-300 shadow-xs'
                          : 'bg-white/80 border-pink-200 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-pink-700 font-bold text-[14px]">{tpl.badge}</span>
                        {active && <Check size={16} className="text-pink-600 shrink-0" />}
                      </div>
                      <div className="font-bold text-slate-900 text-[14px]">{tpl.title}</div>
                      <p className="text-[14px] text-slate-600 leading-snug">{tpl.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Target Channels */}
            <div className="space-y-2">
              <label className="text-[14px] font-bold text-slate-900 block">
                4. Целевые каналы для черновиков и публикации:
              </label>
              {channels && channels.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {channels.map((ch, idx) => {
                    const chId =
                      (ch as any).channel_id || (ch as any).id || ch.username || `ch-${idx}`;
                    const labelText = (ch as any).title || ch.name || chId;
                    const isSel = selectedChannels.includes(chId);
                    return (
                      <button
                        key={`${chId}-${idx}`}
                        type="button"
                        onClick={() => toggleChannel(chId)}
                        className={`px-3 py-1.5 rounded-xl border text-[14px] font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                          isSel
                            ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-transparent shadow-2xs'
                            : 'bg-white/90 border-pink-200 text-slate-800 hover:bg-white'
                        }`}
                      >
                        {isSel && <Check size={14} />}
                        <span>{labelText}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-white/85 border border-pink-200 text-slate-700">
                  По умолчанию выбран канал <strong>@SAV_AI</strong>. Вы сможете добавить другие каналы в блоке «Публикация».
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 md:px-6 py-3.5 border-t border-pink-200/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0 bg-white/40">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/95 hover:bg-white border border-pink-300 text-slate-800 text-[14px] font-bold cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={!name.trim() || Boolean(nameError) || isCheckingName}
              onClick={() =>
                onConfirmCreate({
                  name: name.trim(),
                  format,
                  templateId,
                  category: category.trim() || 'Технологии и нейросети',
                  targetChannels: selectedChannels.length > 0 ? selectedChannels : [defaultChannel]
                })
              }
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold shadow-md hover:opacity-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles size={16} />
              <span>Создать сценарий ({format === 'rich' ? 'Rich' : 'v2'})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ScenarioValidationBar: React.FC<{ scenario: Scenario | null }> = ({ scenario }) => {
  const warnings = validateScenarioWorkflow(scenario);
  if (warnings.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 border border-orange-300 rounded-2xl p-3.5 space-y-1.5 shadow-2xs text-[14px]">
      <div className="flex items-center gap-2 font-bold text-orange-800">
        <AlertTriangle size={16} className="text-orange-600 shrink-0" />
        <span>Рекомендации по проверке цепочки сценария:</span>
      </div>
      <ul className="space-y-1 text-slate-800 pl-5 list-disc">
        {warnings.map((w, i) => (
          <li key={i} className="leading-snug break-words">
            {w}
          </li>
        ))}
      </ul>
    </div>
  );
};
