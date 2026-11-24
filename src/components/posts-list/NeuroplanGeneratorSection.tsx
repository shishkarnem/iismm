import React from 'react';
import { Check, Clock, Loader2, Lock, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { TariffGateBanner } from '../tariffs/TariffGateBanner';
import { CollapsibleSection } from '../ui-kit/CollapsibleSection';
import { ResponsiveActionBtn } from '../ui-kit/ResponsiveActionBtn';
import { usePricingConfig } from '../../hooks/usePricingConfig';
import { formatIirkyCount } from '../../shared/pricingConfig';

export interface NeuroplanTopicItem {
  id: string;
  title: string;
  postText?: string;
  imagePrompt?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  selected: boolean;
  expanded?: boolean;
}

interface NeuroplanGeneratorSectionProps {
  hasRazgonAccess: boolean;
  neuroplanIdea: string;
  onChangeNeuroplanIdea: (val: string) => void;
  isGeneratingNeuroplan: boolean;
  onGenerateTopics: () => Promise<void>;
  generatedTopics: NeuroplanTopicItem[];
  onChangeGeneratedTopics: React.Dispatch<React.SetStateAction<NeuroplanTopicItem[]>>;
  isApprovingNeuroplan: boolean;
  onApproveDrafts: () => Promise<void>;
  onCancel: () => void;
  neuroplanStatus: string | null;
}

export const NeuroplanGeneratorSection: React.FC<NeuroplanGeneratorSectionProps> = ({
  hasRazgonAccess,
  neuroplanIdea,
  onChangeNeuroplanIdea,
  isGeneratingNeuroplan,
  onGenerateTopics,
  generatedTopics,
  onChangeGeneratedTopics,
  isApprovingNeuroplan,
  onApproveDrafts,
  onCancel,
  neuroplanStatus
}) => {
  const { pricing } = usePricingConfig();
  const neuroplanCostLabel = formatIirkyCount(pricing.textAi.neuroplan);
  const selectedCount = generatedTopics.filter((t) => t.selected).length;

  return (
    <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm min-w-0">
      <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md p-4 sm:p-6 space-y-5 text-left min-w-0">
        <div className="flex items-start gap-3 border-b border-pink-300/70 pb-4">
          <span className="p-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-sm shrink-0">
            <Sparkles size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[18px] sm:text-[20px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent break-words">
              Нейроплан — генерация 15 тем, текстов и обложек
            </h2>
            <p className="text-[14px] text-slate-700 font-medium leading-relaxed break-words mt-0.5">
              Укажите идею или нишу — нейросеть создаст 15 тем на 15 дней вперед с текстами публикаций, датами и промптами для обложек на русском языке. Стоимость: {neuroplanCostLabel}.
            </p>
          </div>
        </div>

        {!hasRazgonAccess && (
          <TariffGateBanner
            requiredTariff="Разгон"
            featureTitle="Нейроплан — генерация 15 постов наперед"
            description="Генерация контент-плана на 15 дней вперед по вашей теме с готовыми текстами публикаций и промптами для обложек доступна с тарифа Разгон."
          />
        )}

        {neuroplanStatus && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 border border-pink-300 text-[14px] font-bold text-pink-700 break-words">
            {neuroplanStatus}
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-[14px] font-bold text-slate-800">
            Ваша идея, ниша или тематика для контент-плана
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1 p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
              <input
                type="text"
                value={neuroplanIdea}
                onChange={(e) => onChangeNeuroplanIdea(e.target.value)}
                placeholder="Например: Продвижение бизнеса через автоворонки и ботов"
                className="w-full rounded-[14.5px] bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 px-4 py-3 text-[14px] font-medium text-slate-900 focus:outline-none placeholder-slate-500"
              />
            </div>
            <ResponsiveActionBtn
              icon={
                isGeneratingNeuroplan ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : !hasRazgonAccess ? (
                  <Lock size={17} />
                ) : (
                  <Sparkles size={18} />
                )
              }
              label={
                isGeneratingNeuroplan
                  ? 'Генерация 15 постов...'
                  : !hasRazgonAccess
                  ? 'Доступно на тарифе Разгон'
                  : `Создать 15 тем (${neuroplanCostLabel})`
              }
              disabled={isGeneratingNeuroplan || (hasRazgonAccess && !neuroplanIdea.trim())}
              onClick={onGenerateTopics}
              variant="vivid"
              alwaysShowLabel={true}
            />
          </div>
        </div>

        {generatedTopics.length > 0 && (
          <div className="space-y-4 pt-3 border-t border-pink-300/70">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-[16px] font-bold text-slate-900">
                Выбрано тем: {selectedCount} из {generatedTopics.length}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <ResponsiveActionBtn
                  icon={<Check size={16} />}
                  label="Выбрать все"
                  onClick={() =>
                    onChangeGeneratedTopics((prev) => prev.map((t) => ({ ...t, selected: true })))
                  }
                  variant="outline"
                />
                <ResponsiveActionBtn
                  icon={<Plus size={16} />}
                  label="Добавить тему"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + generatedTopics.length + 1);
                    onChangeGeneratedTopics((prev) => [
                      ...prev,
                      {
                        id: `np_top_${Date.now()}_${prev.length}`,
                        title: 'Новая тема для поста',
                        postText: 'Текст поста...',
                        imagePrompt: 'Иллюстрация к посту на русском языке',
                        scheduledDate: d.toISOString().split('T')[0],
                        scheduledTime: '10:00',
                        selected: true,
                        expanded: true
                      }
                    ]);
                  }}
                  variant="outline"
                />
              </div>
            </div>

            <div className="space-y-3">
              {generatedTopics.map((top, idx) => (
                <CollapsibleSection
                  key={top.id}
                  title={`#${idx + 1}. ${top.title || 'Тема публикации'}`}
                  summary={`${top.scheduledDate || 'Без даты'} в ${top.scheduledTime || '10:00'} · ${(top.postText || 'Текст готов').slice(0, 85)}`}
                  open={Boolean(top.expanded)}
                  onToggle={(nextOpen) =>
                    onChangeGeneratedTopics((prev) =>
                      prev.map((t) => (t.id === top.id ? { ...t, expanded: nextOpen } : t))
                    )
                  }
                  rightSlot={
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={top.selected}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          onChangeGeneratedTopics((prev) =>
                            prev.map((t) => (t.id === top.id ? { ...t, selected: checked } : t))
                          );
                        }}
                        title="Включить тему в создание черновиков"
                        className="w-5 h-5 rounded accent-pink-500 cursor-pointer"
                      />
                      <ResponsiveActionBtn
                        icon={<Trash2 size={16} />}
                        label="Удалить тему"
                        showLabelFrom="never"
                        onClick={() =>
                          onChangeGeneratedTopics((prev) => prev.filter((t) => t.id !== top.id))
                        }
                        variant="danger"
                      />
                    </div>
                  }
                >
                  <div className="space-y-3 text-left">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[14px] font-semibold text-slate-800 mb-1">
                          Заголовок темы
                        </label>
                        <input
                          type="text"
                          value={top.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            onChangeGeneratedTopics((prev) =>
                              prev.map((t) => (t.id === top.id ? { ...t, title: val } : t))
                            );
                          }}
                          className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-[14px] font-bold text-slate-900 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[14px] font-semibold text-slate-800 mb-1">
                          Дата и время выхода
                        </label>
                        <div className="flex items-center gap-1.5 bg-white/85 border border-pink-300 rounded-xl px-2.5 py-2 text-[14px] text-slate-900">
                          <Clock size={15} className="text-pink-600 shrink-0" />
                          <input
                            type="date"
                            value={top.scheduledDate || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              onChangeGeneratedTopics((prev) =>
                                prev.map((t) => (t.id === top.id ? { ...t, scheduledDate: val } : t))
                              );
                            }}
                            className="bg-transparent text-[14px] font-semibold text-slate-900 focus:outline-none w-full"
                          />
                          <input
                            type="time"
                            value={top.scheduledTime || '10:00'}
                            onChange={(e) => {
                              const val = e.target.value;
                              onChangeGeneratedTopics((prev) =>
                                prev.map((t) => (t.id === top.id ? { ...t, scheduledTime: val } : t))
                              );
                            }}
                            className="bg-transparent text-[14px] font-semibold text-slate-900 focus:outline-none w-20"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[14px] font-semibold text-slate-800 mb-1">
                        Готовый текст публикации
                      </label>
                      <textarea
                        rows={4}
                        value={top.postText || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          onChangeGeneratedTopics((prev) =>
                            prev.map((t) => (t.id === top.id ? { ...t, postText: val } : t))
                          );
                        }}
                        className="w-full bg-white/85 border border-pink-300 rounded-xl p-3 text-[14px] text-slate-900 focus:outline-none"
                        placeholder="Текст публикации..."
                      />
                    </div>

                    <div>
                      <label className="block text-[14px] font-semibold text-slate-800 mb-1">
                        Промпт для генерации обложки (на русском языке)
                      </label>
                      <input
                        type="text"
                        value={top.imagePrompt || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          onChangeGeneratedTopics((prev) =>
                            prev.map((t) => (t.id === top.id ? { ...t, imagePrompt: val } : t))
                          );
                        }}
                        className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-[14px] text-slate-900 focus:outline-none"
                        placeholder="Промпт для картинки на русском языке..."
                      />
                    </div>
                  </div>
                </CollapsibleSection>
              ))}
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
              <ResponsiveActionBtn
                icon={<X size={16} />}
                label="Отмена"
                onClick={onCancel}
                variant="outline"
                alwaysShowLabel={true}
              />
              <ResponsiveActionBtn
                icon={
                  isApprovingNeuroplan ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Check size={17} />
                  )
                }
                label={
                  isApprovingNeuroplan
                    ? 'Создание публикаций...'
                    : `Создать ${selectedCount} постов в базе`
                }
                disabled={isApprovingNeuroplan || selectedCount === 0}
                onClick={onApproveDrafts}
                variant="vivid"
                alwaysShowLabel={true}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
