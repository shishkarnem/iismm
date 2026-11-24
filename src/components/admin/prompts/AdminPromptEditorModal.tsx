import React, { useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw, RotateCcw, Sparkles, X } from 'lucide-react';
import {
  extractVariableTokens,
  getNodeHumanTitle,
  SCENARIO_NODE_TYPE_OPTIONS,
  ScenarioPromptRecord,
  SystemPromptRecord
} from './promptAdminMetadata';
import { GradientSelect } from '../../ui-kit/GradientDropdown';

export type EditingPromptTarget =
  | { kind: 'scenario'; record: ScenarioPromptRecord }
  | { kind: 'create_scenario' }
  | { kind: 'system'; record: SystemPromptRecord };

interface AdminPromptEditorModalProps {
  target: EditingPromptTarget | null;
  onClose: () => void;
  onSaveScenario: (
    id: string,
    patch: Partial<ScenarioPromptRecord>
  ) => Promise<void>;
  onCreateScenario: (payload: {
    node_type: string;
    prompt_type: string;
    title: string;
    description: string;
    system_prompt: string;
    user_prompt_template: string;
    variables_hint: string;
    output_contract: string;
    is_active: number;
  }) => Promise<void>;
  onResetScenario: (id: string) => Promise<ScenarioPromptRecord | null>;
  onSaveSystem: (
    keyOrId: string,
    payload: { title: string; description: string; promptText: string }
  ) => Promise<void>;
}

export const AdminPromptEditorModal: React.FC<AdminPromptEditorModalProps> = ({
  target,
  onClose,
  onSaveScenario,
  onCreateScenario,
  onResetScenario,
  onSaveSystem
}) => {
  const [nodeType, setNodeType] = useState('ai_generate_text');
  const [promptType, setPromptType] = useState('default');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userTemplate, setUserTemplate] = useState('');
  const [variablesHint, setVariablesHint] = useState('');
  const [outputContract, setOutputContract] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setLocalError(null);
    setConfirmResetOpen(false);
    if (!target) return;

    if (target.kind === 'scenario') {
      const r = target.record;
      setNodeType(r.node_type);
      setPromptType(r.prompt_type);
      setTitle(r.title);
      setDescription(r.description || '');
      setSystemPrompt(r.system_prompt || '');
      setUserTemplate(r.user_prompt_template || '');
      setVariablesHint(r.variables_hint || '');
      setOutputContract(r.output_contract || '');
      setIsActive(Number(r.is_active) !== 0);
    } else if (target.kind === 'create_scenario') {
      setNodeType('ai_generate_text');
      setPromptType('');
      setTitle('');
      setDescription('');
      setSystemPrompt('');
      setUserTemplate('');
      setVariablesHint('{{topic}}, {{user_prompt}}, {{category}}');
      setOutputContract('');
      setIsActive(true);
    } else {
      const s = target.record;
      setNodeType(s.scenarioKey);
      setPromptType('system');
      setTitle(s.title);
      setDescription(s.description || '');
      setSystemPrompt(s.promptText || '');
      setUserTemplate('');
      setVariablesHint('');
      setOutputContract('');
      setIsActive(true);
    }
  }, [target]);

  const variableTokens = useMemo(() => extractVariableTokens(variablesHint), [variablesHint]);

  if (!target) return null;

  const isScenario = target.kind === 'scenario';
  const isCreate = target.kind === 'create_scenario';
  const isSystem = target.kind === 'system';

  const handleInsertVariable = (token: string) => {
    setUserTemplate((prev) => (prev ? `${prev}${prev.endsWith(' ') || prev.endsWith('\n') ? '' : ' '}${token}` : token));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!title.trim()) {
      setLocalError('Укажите понятное название промпта.');
      return;
    }
    if (isSystem) {
      if (!systemPrompt.trim()) {
        setLocalError('Текст системного промпта не может быть пустым.');
        return;
      }
    } else if (!systemPrompt.trim() && !userTemplate.trim()) {
      setLocalError('Заполните системную инструкцию или шаблон пользовательского запроса.');
      return;
    }

    setSaving(true);
    try {
      if (isScenario) {
        await onSaveScenario(target.record.id, {
          title: title.trim(),
          description: description.trim(),
          system_prompt: systemPrompt,
          user_prompt_template: userTemplate,
          variables_hint: variablesHint.trim(),
          output_contract: outputContract.trim(),
          is_active: isActive ? 1 : 0
        });
        onClose();
      } else if (isCreate) {
        if (!promptType.trim()) {
          setLocalError('Укажите ключ варианта (prompt_type), например v2 или custom.');
          setSaving(false);
          return;
        }
        await onCreateScenario({
          node_type: nodeType.trim(),
          prompt_type: promptType.trim(),
          title: title.trim(),
          description: description.trim(),
          system_prompt: systemPrompt,
          user_prompt_template: userTemplate,
          variables_hint: variablesHint.trim(),
          output_contract: outputContract.trim(),
          is_active: isActive ? 1 : 0
        });
        onClose();
      } else if (isSystem) {
        await onSaveSystem(target.record.id, {
          title: title.trim(),
          description: description.trim(),
          promptText: systemPrompt
        });
        onClose();
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Ошибка синхронизации с базой данных.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetConfirm = async () => {
    if (!isScenario) return;
    setResetting(true);
    setLocalError(null);
    try {
      const restored = await onResetScenario(target.record.id);
      if (restored) {
        setTitle(restored.title);
        setDescription(restored.description || '');
        setSystemPrompt(restored.system_prompt || '');
        setUserTemplate(restored.user_prompt_template || '');
        setVariablesHint(restored.variables_hint || '');
        setOutputContract(restored.output_contract || '');
        setIsActive(Number(restored.is_active) !== 0);
      }
      setConfirmResetOpen(false);
    } catch (err: any) {
      setLocalError(err?.message || 'Не удалось восстановить эталонный шаблон.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-sky-100/50 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-4xl my-auto p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-2xl">
        <div className="rounded-[22.5px] bg-gradient-to-br from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 backdrop-blur-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto space-y-5 text-left min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-pink-300/80 pb-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles size={19} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[18px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent break-words">
                  {isCreate
                    ? 'Новый промпт блока сценария'
                    : isSystem
                    ? 'Редактирование системной роли ИИ'
                    : 'Редактирование промпта блока сценария'}
                </h3>
                <p className="text-[14px] text-slate-700 font-medium break-words mt-0.5">
                  {isCreate
                    ? 'Запись создается сразу в облачной базе PostgreSQL и немедленно используется при запуске.'
                    : isSystem
                    ? `Системный ключ: ${target.record.scenarioKey} · Синхронизация с таблицей system_prompts`
                    : `${getNodeHumanTitle(target.record.node_type)} · Ключ: ${target.record.node_type} / ${target.record.prompt_type}`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть окно редактирования"
              className="p-2.5 rounded-xl bg-white/80 hover:bg-white border border-pink-300 text-slate-800 cursor-pointer shrink-0 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
            {isCreate && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                <div className="min-w-0">
                  <GradientSelect
                    label="Блок сценария (node_type)"
                    value={nodeType}
                    onChange={setNodeType}
                    options={SCENARIO_NODE_TYPE_OPTIONS}
                    searchable
                  />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <label className="block text-[14px] font-bold text-slate-900">
                    Вариант шаблона (prompt_type)
                  </label>
                  <div className="p-[1.5px] rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
                    <input
                      type="text"
                      value={promptType}
                      onChange={(e) => setPromptType(e.target.value)}
                      placeholder="например: custom_v2"
                      className="w-full rounded-[10.5px] bg-white/90 px-3.5 py-2.5 text-[14px] font-medium text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end min-w-0">
              <div className="sm:col-span-2 space-y-1.5 min-w-0">
                <label className="block text-[14px] font-bold text-slate-900">
                  Название в админке
                </label>
                <div className="p-[1.5px] rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-[10.5px] bg-white/90 px-3.5 py-2.5 text-[14px] font-semibold text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {!isSystem && (
                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-white/75 border border-pink-300 min-w-0">
                  <span className="text-[14px] font-bold text-slate-900">Активен в БД</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActive}
                    onClick={() => setIsActive((v) => !v)}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500'
                        : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                        isActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1.5 min-w-0">
              <label className="block text-[14px] font-bold text-slate-900">
                Пояснение назначения (где и когда срабатывает)
              </label>
              <div className="p-[1.5px] rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Кратко опишите, за какой шаг отвечает шаблон..."
                  className="w-full rounded-[10.5px] bg-white/90 px-3.5 py-2.5 text-[14px] font-medium text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5 min-w-0">
              <label className="block text-[14px] font-bold text-slate-900">
                {isSystem
                  ? 'Текст системной инструкции (prompt_text)'
                  : 'Системная роль и строгие правила (system_prompt)'}
              </label>
              <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={isSystem ? 10 : 5}
                  placeholder="Введите роль, формат вывода, запреты и стиль подачи..."
                  className="w-full rounded-[14.5px] bg-white/90 p-3.5 text-[14px] leading-relaxed text-slate-900 font-medium focus:outline-none resize-y"
                />
              </div>
            </div>

            {!isSystem && (
              <>
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="block text-[14px] font-bold text-slate-900">
                      Шаблон запроса с макросами (user_prompt_template)
                    </label>
                    {variableTokens.length > 0 && (
                      <span className="text-[14px] text-slate-700 font-medium">
                        Нажмите на переменную для вставки:
                      </span>
                    )}
                  </div>

                  {variableTokens.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {variableTokens.map((tok) => (
                        <button
                          key={tok}
                          type="button"
                          onClick={() => handleInsertVariable(tok)}
                          className="px-3 py-1.5 rounded-xl bg-white/85 hover:bg-white border border-pink-300 text-[14px] font-semibold text-slate-900 cursor-pointer transition-colors"
                        >
                          + {tok}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
                    <textarea
                      value={userTemplate}
                      onChange={(e) => setUserTemplate(e.target.value)}
                      rows={8}
                      placeholder="Шаблон запроса с {{переменными}} и условными блоками {{#if ...}}...{{/if}}"
                      className="w-full rounded-[14.5px] bg-white/90 p-3.5 text-[14px] leading-relaxed text-slate-900 font-medium focus:outline-none resize-y"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                  <div className="space-y-1.5 min-w-0">
                    <label className="block text-[14px] font-bold text-slate-900">
                      Доступные переменные (variables_hint)
                    </label>
                    <div className="p-[1.5px] rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
                      <input
                        type="text"
                        value={variablesHint}
                        onChange={(e) => setVariablesHint(e.target.value)}
                        className="w-full rounded-[10.5px] bg-white/90 px-3.5 py-2.5 text-[14px] font-medium text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <label className="block text-[14px] font-bold text-slate-900">
                      Ожидаемый формат ответа (output_contract)
                    </label>
                    <div className="p-[1.5px] rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
                      <input
                        type="text"
                        value={outputContract}
                        onChange={(e) => setOutputContract(e.target.value)}
                        className="w-full rounded-[10.5px] bg-white/90 px-3.5 py-2.5 text-[14px] font-medium text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {localError && (
              <div className="p-3.5 rounded-2xl bg-rose-50/90 border border-rose-300 text-rose-800 text-[14px] font-bold break-words">
                {localError}
              </div>
            )}

            {confirmResetOpen && isScenario && (
              <div className="p-4 rounded-2xl bg-white/85 border border-orange-300 space-y-3">
                <p className="text-[14px] font-bold text-slate-900 break-words">
                  Восстановить эталонный текст этого промпта и перезаписать текущие правки в базе данных?
                </p>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmResetOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white border border-pink-300 text-[14px] font-bold text-slate-800 cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    disabled={resetting}
                    onClick={handleResetConfirm}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold cursor-pointer flex items-center gap-2"
                  >
                    {resetting && <RefreshCw size={15} className="animate-spin" />}
                    <span>Да, восстановить и синхронизировать</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-pink-300/70">
              <div>
                {isScenario && !confirmResetOpen && (
                  <button
                    type="button"
                    onClick={() => setConfirmResetOpen(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/85 hover:bg-white border border-pink-300 text-slate-800 text-[14px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <RotateCcw size={16} className="text-pink-600 shrink-0" />
                    <span>Восстановить эталон</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-white/85 hover:bg-white border border-pink-300 text-slate-800 text-[14px] font-bold cursor-pointer transition-colors"
                >
                  Закрыть
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold shadow-md hover:brightness-105 cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                >
                  {saving ? (
                    <RefreshCw size={16} className="animate-spin shrink-0" />
                  ) : (
                    <Check size={16} className="shrink-0" />
                  )}
                  <span>
                    {saving ? 'Синхронизация с БД...' : 'Сохранить и синхронизировать с БД'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
