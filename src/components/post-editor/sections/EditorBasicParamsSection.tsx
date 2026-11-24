import React from 'react';
import { FileText, Hash, Plus, Radio, Settings2, X } from 'lucide-react';
import { CollapsibleSection } from '../../ui-kit/CollapsibleSection';
import { GradientMultiSelect, GradientSelect } from '../../ui-kit/GradientDropdown';
import { ResponsiveActionBtn } from '../../ui-kit/ResponsiveActionBtn';

export interface AvailableChannelOption {
  id: string;
  title?: string;
  username?: string;
  isTeamChannel?: boolean;
}

export interface EditorBasicParamsSectionProps {
  title: string;
  onChangeTitle: (val: string) => void;
  topic: string;
  onChangeTopic: (val: string) => void;
  existingTopics: string[];
  messageFormat: 'rich' | 'markdown_v2' | 'html';
  onChangeMessageFormat: (fmt: 'rich' | 'markdown_v2') => void;
  selectedChannels: string[];
  onChangeSelectedChannels: (channels: string[]) => void;
  availableChannels: AvailableChannelOption[];
  onNavigateToChannels?: () => void;
}

export const EditorBasicParamsSection: React.FC<EditorBasicParamsSectionProps> = ({
  title,
  onChangeTitle,
  topic,
  onChangeTopic,
  existingTopics,
  messageFormat,
  onChangeMessageFormat,
  selectedChannels,
  onChangeSelectedChannels,
  availableChannels,
  onNavigateToChannels
}) => {
  const formatSummary = messageFormat === 'rich' ? 'Rich статья' : 'Пост v2';
  const summaryParts = [
    formatSummary,
    topic.trim() ? `Рубрика: ${topic.trim()}` : '',
    selectedChannels.length > 0 ? `Каналов: ${selectedChannels.length}` : 'Канал не выбран'
  ].filter(Boolean);

  const channelByValue = new Map<string, AvailableChannelOption>();
  const channelOptions = availableChannels.map((ch) => {
    const labelText =
      ch.title && ch.title !== ch.id ? `${ch.title} (${ch.id})` : ch.id;
    channelByValue.set(ch.id, ch);
    return {
      value: ch.id,
      label: labelText,
      meta: ch.isTeamChannel ? 'Канал команды' : 'Мой канал'
    };
  });

  const validSelectedChannels = selectedChannels.filter((id) => channelByValue.has(id));

  const handleRemoveChannelTag = (channelId: string) => {
    onChangeSelectedChannels(validSelectedChannels.filter((c) => c !== channelId));
  };

  return (
    <CollapsibleSection
      title="Основные параметры и каналы"
      summary={summaryParts.join(' · ')}
      icon={<Settings2 size={17} />}
      defaultOpen={true}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <GradientSelect
            label="Формат публикации"
            value={messageFormat === 'rich' ? 'rich' : 'markdown_v2'}
            onChange={(val) => onChangeMessageFormat(val as 'rich' | 'markdown_v2')}
            options={[
              {
                value: 'markdown_v2',
                label: 'Пост Telegram v2',
                meta: 'До 1024 симв. с фото / 4096 текст',
                icon: <FileText size={16} />
              },
              {
                value: 'rich',
                label: 'Rich статья с версткой',
                meta: 'Коллажи, слайдеры, таблицы, сноски',
                icon: <FileText size={16} />
              }
            ]}
          />

          <div className="space-y-1.5 min-w-0">
            <label className="block text-[14px] font-bold text-slate-800 px-0.5">
              Тема или рубрика (до 15 симв.)
            </label>
            <div className="relative">
              <Hash
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-600 pointer-events-none"
              />
              <input
                type="text"
                maxLength={15}
                list="editor-topics-datalist"
                value={topic}
                onChange={(e) => onChangeTopic(e.target.value.slice(0, 15))}
                placeholder="Например: новости"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl text-[14px] font-medium text-slate-900 bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300/80 focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
              <datalist id="editor-topics-datalist">
                {existingTopics.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>
        </div>

        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <label className="text-[14px] font-bold text-slate-800">
              Заголовок поста
            </label>
            <span className="text-[14px] text-slate-600 font-medium">
              {title.length}/150
            </span>
          </div>
          <input
            type="text"
            maxLength={150}
            value={title}
            onChange={(e) => onChangeTitle(e.target.value)}
            placeholder="Введите заголовок публикации..."
            className="w-full px-3.5 py-2.5 rounded-2xl text-[14px] font-semibold text-slate-900 bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300/80 focus:outline-none focus:ring-2 focus:ring-pink-400"
          />
        </div>

        <div className="space-y-2.5 min-w-0">
          {channelOptions.length > 0 ? (
            <>
              <div className="flex items-end justify-between gap-2 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <GradientMultiSelect
                    label="Мои каналы и каналы команды для публикации"
                    values={validSelectedChannels}
                    options={channelOptions}
                    onChange={onChangeSelectedChannels}
                    placeholder="Выберите ваши подключенные каналы..."
                  />
                </div>
                {onNavigateToChannels && (
                  <ResponsiveActionBtn
                    icon={<Plus size={16} />}
                    label="Мои каналы"
                    title="Управление подключенными каналами"
                    variant="outline"
                    onClick={onNavigateToChannels}
                  />
                )}
              </div>

              {validSelectedChannels.length > 0 ? (
                <div className="space-y-1.5 pt-0.5">
                  <div className="text-[14px] font-bold text-slate-800 px-0.5">
                    Выбранные каналы ({validSelectedChannels.length}):
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {validSelectedChannels.map((chId) => {
                      const info = channelByValue.get(chId);
                      const tagTitle =
                        info?.title && info.title !== chId
                          ? `${info.title} · ${chId}`
                          : chId;
                      return (
                        <span
                          key={chId}
                          className="inline-flex items-center gap-1.5 max-w-full px-3 py-1.5 rounded-2xl text-[14px] font-bold text-slate-900 bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 border border-pink-400 shadow-2xs"
                        >
                          <Radio size={14} className="text-pink-600 shrink-0" />
                          <span className="truncate">{tagTitle}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveChannelTag(chId)}
                            title={`Убрать канал ${tagTitle}`}
                            aria-label={`Убрать канал ${tagTitle}`}
                            className="ml-0.5 w-5 h-5 rounded-full bg-white/85 hover:bg-white border border-pink-300 flex items-center justify-center text-slate-700 hover:text-rose-600 cursor-pointer shrink-0 transition-colors"
                          >
                            <X size={13} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-[14px] text-slate-700 px-1">
                  Канал не выбран — вы можете сохранить черновик и выбрать свой канал позже перед отправкой.
                </div>
              )}
            </>
          ) : (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 border border-pink-300 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="text-[14px] font-bold text-slate-900">
                  У вас пока нет закрепленных каналов
                </div>
                <div className="text-[14px] text-slate-700 leading-snug">
                  Добавлять в редактор можно только ваши собственные каналы из базы данных или каналы вашей команды (при поддержке тарифом).
                </div>
              </div>
              {onNavigateToChannels && (
                <ResponsiveActionBtn
                  icon={<Plus size={16} />}
                  label="Подключить канал"
                  variant="vivid"
                  alwaysShowLabel
                  onClick={onNavigateToChannels}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </CollapsibleSection>
  );
};
