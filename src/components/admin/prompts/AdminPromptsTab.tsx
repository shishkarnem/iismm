import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  Sparkles
} from 'lucide-react';
import { GradientSelect } from '../../ui-kit/GradientDropdown';
import { NeurosphereLoader } from '../../loaders/NeurosphereLoader';
import {
  getNodeHumanTitle,
  getPromptCategoryByNodeType,
  PROMPT_CATEGORY_OPTIONS,
  PromptCategoryKey,
  ScenarioPromptRecord,
  SystemPromptRecord
} from './promptAdminMetadata';
import {
  AdminPromptEditorModal,
  EditingPromptTarget
} from './AdminPromptEditorModal';

interface AdminPromptsTabProps {
  triggerToast: (type: 'success' | 'error', message: string) => void;
}

type StatusFilter = 'all' | 'active' | 'disabled';

export const AdminPromptsTab: React.FC<AdminPromptsTabProps> = ({ triggerToast }) => {
  const [scenarioPrompts, setScenarioPrompts] = useState<ScenarioPromptRecord[]>([]);
  const [systemPrompts, setSystemPrompts] = useState<SystemPromptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<PromptCategoryKey>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTarget, setEditingTarget] = useState<EditingPromptTarget | null>(null);

  const loadAllPromptsFromDb = useCallback(
    async (forceRefresh = false, showSuccessToast = false) => {
      if (forceRefresh) setSyncing(true);
      else setLoading(true);
      try {
        const qs = forceRefresh ? '?refresh=1' : '';
        const [scenRes, sysRes] = await Promise.all([
          fetch(`/api/scenarios/prompts${qs}`),
          fetch(`/api/system-prompts${qs}`)
        ]);
        const scenData = await scenRes.json();
        const sysData = await sysRes.json();

        if (!scenRes.ok || !scenData?.success) {
          throw new Error(scenData?.error || 'Не удалось загрузить промпты сценариев из БД');
        }
        setScenarioPrompts(Array.isArray(scenData.prompts) ? scenData.prompts : []);
        if (Array.isArray(sysData)) {
          setSystemPrompts(sysData);
        }
        setLastSyncedAt(new Date().toLocaleTimeString('ru-RU'));
        if (showSuccessToast) {
          triggerToast(
            'success',
            `Синхронизировано с PostgreSQL: ${scenData.prompts?.length || 0} промптов сценариев и ${Array.isArray(sysData) ? sysData.length : 0} системных ролей`
          );
        }
      } catch (err: any) {
        triggerToast('error', err?.message || 'Ошибка синхронизации промптов с базой данных');
      } finally {
        setLoading(false);
        setSyncing(false);
      }
    },
    [triggerToast]
  );

  useEffect(() => {
    loadAllPromptsFromDb(true, false);
  }, [loadAllPromptsFromDb]);

  const handleSeedMissing = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/scenarios/prompts/seed-missing', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Не удалось дозаполнить промпты');
      }
      await loadAllPromptsFromDb(true, false);
      triggerToast(
        'success',
        data.inserted > 0
          ? `Дозаполнено новых шаблонов: ${data.inserted} (всего в БД: ${data.total}). Ваши ручные правки сохранены.`
          : `Все заводские ключи уже присутствуют в базе данных (${data.total}).`
      );
    } catch (err: any) {
      triggerToast('error', err?.message || 'Ошибка дозаполнения недостающих промптов');
    } finally {
      setSeeding(false);
    }
  };

  const handleSaveScenario = async (id: string, patch: Partial<ScenarioPromptRecord>) => {
    const res = await fetch(`/api/scenarios/prompts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    const data = await res.json();
    if (!res.ok || !data?.success || !data?.prompt) {
      throw new Error(data?.error || 'Ошибка сохранения промпта в PostgreSQL');
    }
    setScenarioPrompts((prev) =>
      prev.map((item) => (item.id === id ? data.prompt : item))
    );
    setLastSyncedAt(new Date().toLocaleTimeString('ru-RU'));
    triggerToast('success', `Промпт «${data.prompt.title}» сохранен в БД и сразу активен для сценариев.`);
  };

  const handleCreateScenario = async (payload: {
    node_type: string;
    prompt_type: string;
    title: string;
    description: string;
    system_prompt: string;
    user_prompt_template: string;
    variables_hint: string;
    output_contract: string;
    is_active: number;
  }) => {
    const res = await fetch('/api/scenarios/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data?.success || !data?.prompt) {
      throw new Error(data?.error || 'Ошибка создания промпта в PostgreSQL');
    }
    setScenarioPrompts((prev) => [data.prompt, ...prev]);
    setLastSyncedAt(new Date().toLocaleTimeString('ru-RU'));
    triggerToast('success', `Промпт «${data.prompt.title}» добавлен в базу данных.`);
  };

  const handleResetScenario = async (id: string): Promise<ScenarioPromptRecord | null> => {
    const res = await fetch(`/api/scenarios/prompts/${encodeURIComponent(id)}/reset`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok || !data?.success || !data?.prompt) {
      throw new Error(data?.error || 'Не удалось восстановить эталон в PostgreSQL');
    }
    setScenarioPrompts((prev) =>
      prev.map((item) => (item.id === id ? data.prompt : item))
    );
    setLastSyncedAt(new Date().toLocaleTimeString('ru-RU'));
    triggerToast('success', `Эталонный шаблон «${data.prompt.title}» восстановлен в БД.`);
    return data.prompt;
  };

  const handleToggleActive = async (item: ScenarioPromptRecord) => {
    setTogglingId(item.id);
    try {
      const nextVal = Number(item.is_active) === 0 ? 1 : 0;
      await handleSaveScenario(item.id, { is_active: nextVal });
    } catch (err: any) {
      triggerToast('error', err?.message || 'Ошибка переключения активности промпта');
    } finally {
      setTogglingId(null);
    }
  };

  const handleSaveSystem = async (
    keyOrId: string,
    payload: { title: string; description: string; promptText: string }
  ) => {
    const res = await fetch(`/api/system-prompts/${encodeURIComponent(keyOrId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data?.success || !data?.prompt) {
      throw new Error(data?.error || 'Ошибка сохранения системного промпта в PostgreSQL');
    }
    setSystemPrompts((prev) =>
      prev.map((item) =>
        item.id === data.prompt.id || item.scenarioKey === data.prompt.scenarioKey
          ? data.prompt
          : item
      )
    );
    setLastSyncedAt(new Date().toLocaleTimeString('ru-RU'));
    triggerToast('success', `Системная роль «${data.prompt.title}» синхронизирована с БД.`);
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredScenarioPrompts = useMemo(() => {
    if (categoryFilter === 'system_roles') return [];
    return scenarioPrompts.filter((p) => {
      if (categoryFilter !== 'all' && getPromptCategoryByNodeType(p.node_type) !== categoryFilter) {
        return false;
      }
      const active = Number(p.is_active) !== 0;
      if (statusFilter === 'active' && !active) return false;
      if (statusFilter === 'disabled' && active) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        p.title,
        p.description,
        p.node_type,
        p.prompt_type,
        getNodeHumanTitle(p.node_type),
        p.system_prompt,
        p.user_prompt_template
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [scenarioPrompts, categoryFilter, statusFilter, normalizedQuery]);

  const filteredSystemPrompts = useMemo(() => {
    if (categoryFilter !== 'all' && categoryFilter !== 'system_roles') return [];
    if (statusFilter === 'disabled') return [];
    return systemPrompts.filter((s) => {
      if (!normalizedQuery) return true;
      const haystack = [s.title, s.description || '', s.scenarioKey, s.promptText]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [systemPrompts, categoryFilter, statusFilter, normalizedQuery]);

  const activeScenarioCount = useMemo(
    () => scenarioPrompts.filter((p) => Number(p.is_active) !== 0).length,
    [scenarioPrompts]
  );

  if (loading) {
    return (
      <NeurosphereLoader
        variant="inline"
        label="Загрузка промптов сценариев и системных ролей из PostgreSQL..."
      />
    );
  }

  return (
    <div className="space-y-5 text-left min-w-0">
      {/* Header & Sync Controls */}
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm">
        <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md p-4 sm:p-6 space-y-4 min-w-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles size={20} />
              </div>
              <div className="min-w-0 space-y-1">
                <h2 className="text-[18px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent break-words">
                  Единый центр промптов ИИ и сценариев
                </h2>
                <p className="text-[14px] text-slate-800 font-medium break-words">
                  Полная синхронизация с облачной базой PostgreSQL: любые правки сразу применяются при фоновых и ручных запусках без перезапуска сервера.
                </p>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[14px] font-semibold text-slate-700 tabular-nums">
                  <span>Блоки сценариев: {activeScenarioCount}/{scenarioPrompts.length}</span>
                  <span aria-hidden="true">·</span>
                  <span>Системные роли: {systemPrompts.length}</span>
                  {lastSyncedAt && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Синхронизация: {lastSyncedAt}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={() => loadAllPromptsFromDb(true, true)}
                disabled={syncing}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold shadow-sm hover:brightness-105 cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                <RefreshCw size={16} className={syncing ? 'animate-spin shrink-0' : 'shrink-0'} />
                <span>{syncing ? 'Синхронизация...' : 'Синхронизировать с БД'}</span>
              </button>

              <button
                type="button"
                onClick={handleSeedMissing}
                disabled={seeding}
                className="px-4 py-2.5 rounded-xl bg-white/85 hover:bg-white border border-pink-300 text-slate-900 text-[14px] font-bold cursor-pointer flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                <CheckCircle2 size={16} className="text-pink-600 shrink-0" />
                <span>{seeding ? 'Проверка...' : 'Дозаполнить недостающие'}</span>
              </button>

              <button
                type="button"
                onClick={() => setEditingTarget({ kind: 'create_scenario' })}
                className="px-4 py-2.5 rounded-xl bg-white/85 hover:bg-white border border-pink-300 text-slate-900 text-[14px] font-bold cursor-pointer flex items-center justify-center gap-2 transition-colors"
              >
                <Plus size={16} className="text-sky-600 shrink-0" />
                <span>Добавить шаблон</span>
              </button>
            </div>
          </div>

          {/* Search & Filters (mobile-safe vertical/dropdown layout, zero horizontal scroll tabs) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-pink-300/70 min-w-0">
            <div className="space-y-1.5 min-w-0">
              <label className="block text-[14px] font-bold text-slate-900">
                Поиск по названию, блоку или тексту
              </label>
              <div className="p-[1.5px] rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
                <div className="flex items-center gap-2 rounded-[10.5px] bg-white/90 px-3 py-2.5">
                  <Search size={17} className="text-pink-600 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Например: тема, Rich, 791, кнопки..."
                    className="w-full bg-transparent text-[14px] font-medium text-slate-900 focus:outline-none min-w-0"
                  />
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <GradientSelect
                label="Раздел и группа промптов"
                value={categoryFilter}
                onChange={(val) => setCategoryFilter(val as PromptCategoryKey)}
                options={PROMPT_CATEGORY_OPTIONS}
              />
            </div>

            <div className="min-w-0">
              <GradientSelect
                label="Статус активности"
                value={statusFilter}
                onChange={(val) => setStatusFilter(val as StatusFilter)}
                options={[
                  { value: 'all', label: 'Все записи (активные и выключенные)' },
                  { value: 'active', label: 'Только активные в работе' },
                  { value: 'disabled', label: 'Только отключенные (is_active = 0)' }
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Empty Filter State */}
      {filteredScenarioPrompts.length === 0 && filteredSystemPrompts.length === 0 && (
        <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
          <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md p-6 text-center space-y-3">
            <p className="text-[16px] font-bold text-slate-900">
              По выбранному фильтру промпты не найдены
            </p>
            <p className="text-[14px] text-slate-700 font-medium">
              Сбросьте строку поиска или выберите другой раздел из списка выше.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
                setStatusFilter('all');
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold cursor-pointer"
            >
              Показать все промпты
            </button>
          </div>
        </div>
      )}

      {/* Scenario Block Prompts List */}
      {filteredScenarioPrompts.length > 0 && (
        <div className="space-y-3 min-w-0">
          <div className="px-1 flex items-center justify-between gap-2">
            <h3 className="text-[16px] font-bold text-slate-900">
              Промпты блоков сценариев и генераторов ({filteredScenarioPrompts.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3.5 min-w-0">
            {filteredScenarioPrompts.map((item) => {
              const active = Number(item.is_active) !== 0;
              return (
                <div
                  key={item.id}
                  className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-xs min-w-0"
                >
                  <div className="rounded-[14.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md p-4 space-y-3 min-w-0">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 min-w-0">
                      <div className="space-y-1 min-w-0 flex-1">
                        <h4 className="text-[16px] font-bold text-slate-900 break-words">
                          {item.title || getNodeHumanTitle(item.node_type)}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold text-slate-700 break-words">
                          <span>{getNodeHumanTitle(item.node_type)}</span>
                          <span aria-hidden="true">·</span>
                          <span>Ключ: {item.node_type} / {item.prompt_type}</span>
                          <span aria-hidden="true">·</span>
                          <span className={active ? 'text-sky-700' : 'text-rose-700'}>
                            {active ? 'Активен в БД' : 'Отключен в БД'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            Обновлен: {new Date(item.updated_at).toLocaleString('ru-RU')}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-[14px] text-slate-800 font-medium break-words pt-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={togglingId === item.id}
                          onClick={() => handleToggleActive(item)}
                          className="px-3.5 py-2 rounded-xl bg-white/85 hover:bg-white border border-pink-300 text-[14px] font-bold text-slate-900 cursor-pointer transition-colors disabled:opacity-60"
                        >
                          {togglingId === item.id
                            ? 'Сохранение...'
                            : active
                            ? 'Выключить'
                            : 'Включить'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTarget({ kind: 'scenario', record: item })}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold shadow-xs hover:brightness-105 cursor-pointer flex items-center gap-1.5 transition-all"
                        >
                          <Edit3 size={15} className="shrink-0" />
                          <span>Редактировать</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 text-[14px] min-w-0">
                      <div className="p-3 rounded-xl bg-white/75 border border-pink-200 min-w-0">
                        <div className="font-bold text-slate-800 mb-1">Системная инструкция:</div>
                        <p className="text-slate-700 whitespace-pre-wrap break-words line-clamp-3">
                          {item.system_prompt || 'Не задана (используется только шаблон запроса)'}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-white/75 border border-pink-200 min-w-0">
                        <div className="font-bold text-slate-800 mb-1">Шаблон запроса:</div>
                        <p className="text-slate-700 whitespace-pre-wrap break-words line-clamp-3">
                          {item.user_prompt_template || 'Не задан'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* System Prompts List */}
      {filteredSystemPrompts.length > 0 && (
        <div className="space-y-3 pt-2 min-w-0">
          <div className="px-1 flex items-center justify-between gap-2">
            <h3 className="text-[16px] font-bold text-slate-900">
              Системные роли бота, модерации и редактора ({filteredSystemPrompts.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3.5 min-w-0">
            {filteredSystemPrompts.map((sysItem) => (
              <div
                key={sysItem.id}
                className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-xs min-w-0"
              >
                <div className="rounded-[14.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md p-4 space-y-2.5 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 min-w-0">
                    <div className="space-y-1 min-w-0 flex-1">
                      <h4 className="text-[16px] font-bold text-slate-900 break-words">
                        {sysItem.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold text-slate-700 break-words">
                        <span>Системная таблица: system_prompts</span>
                        <span aria-hidden="true">·</span>
                        <span>Ключ: {sysItem.scenarioKey}</span>
                      </div>
                      {sysItem.description && (
                        <p className="text-[14px] text-slate-800 font-medium break-words">
                          {sysItem.description}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditingTarget({ kind: 'system', record: sysItem })}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold shadow-xs hover:brightness-105 cursor-pointer flex items-center justify-center gap-1.5 shrink-0 transition-all"
                    >
                      <Edit3 size={15} className="shrink-0" />
                      <span>Редактировать</span>
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-white/75 border border-pink-200 text-[14px] min-w-0">
                    <p className="text-slate-700 whitespace-pre-wrap break-words line-clamp-3">
                      {sysItem.promptText}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AdminPromptEditorModal
        target={editingTarget}
        onClose={() => setEditingTarget(null)}
        onSaveScenario={handleSaveScenario}
        onCreateScenario={handleCreateScenario}
        onResetScenario={handleResetScenario}
        onSaveSystem={handleSaveSystem}
      />
    </div>
  );
};
