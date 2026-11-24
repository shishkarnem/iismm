import React, { useEffect, useState } from 'react';
import { Check, Clock, Cpu, Key, RefreshCw, Settings as SettingsIcon, Sparkles, Tag } from 'lucide-react';
import { Settings } from '../../types';
import { CollapsibleSection } from '../ui-kit/CollapsibleSection';
import { ResponsiveActionBtn } from '../ui-kit/ResponsiveActionBtn';
import {
  FALLBACK_APP_VERSION,
  fetchCurrentAppVersion,
  updateAppVersionOnServer
} from '../footer/useAppVersion';

interface AdminSettingsTabProps {
  settings: Settings | null;
  settingsLoading: boolean;
  isSavingSettings: boolean;
  onChangeSettings: (next: Settings) => void;
  onSaveSettings: () => Promise<void>;
  triggerToast: (type: 'success' | 'error', message: string) => void;
}

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({
  settings,
  settingsLoading,
  isSavingSettings,
  onChangeSettings,
  onSaveSettings,
  triggerToast
}) => {
  const [appVersionInput, setAppVersionInput] = useState<string>(FALLBACK_APP_VERSION);
  const [versionUpdatedAt, setVersionUpdatedAt] = useState<string | null>(null);
  const [isSavingVersion, setIsSavingVersion] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    fetchCurrentAppVersion(true).then((res) => {
      if (!active) return;
      if (res.version) setAppVersionInput(res.version);
      setVersionUpdatedAt(res.updatedAt);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSaveAppVersion = async () => {
    const clean = appVersionInput.trim();
    if (!clean) {
      triggerToast('error', 'Укажите корректную версию сборки, например v.1.56');
      return;
    }
    setIsSavingVersion(true);
    try {
      const saved = await updateAppVersionOnServer(clean);
      setAppVersionInput(saved.version);
      setVersionUpdatedAt(saved.updatedAt);
      if (settings) {
        onChangeSettings({ ...settings, appVersion: saved.version });
      }
      triggerToast('success', `Версия сборки обновлена на ${saved.version} для всех страниц сайта`);
    } catch (err: any) {
      triggerToast('error', err?.message || 'Не удалось сохранить версию сборки');
    } finally {
      setIsSavingVersion(false);
    }
  };

  return (
    <div className="space-y-5 min-w-0">
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm">
        <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md p-4 sm:p-6 space-y-5 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pink-300/70 pb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <SettingsIcon size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[16px] sm:text-[18px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent break-words">
                  Интеграции, версия сборки и нейромодели
                </h3>
                <p className="text-[14px] text-slate-700 font-medium break-words">
                  Единое управление версией сайта, токенами бота, расходами Иирок и расписанием
                </p>
              </div>
            </div>
          </div>

          {/* 1. Управление версией сборки сайта */}
          <CollapsibleSection
            title="Версия сборки приложения"
            summary={`Текущая версия: ${appVersionInput || FALLBACK_APP_VERSION}`}
            icon={<Tag size={18} />}
            defaultOpen={true}
          >
            <div className="space-y-3">
              <p className="text-[14px] text-slate-700 leading-relaxed break-words">
                Укажите актуальную версию сборки (например, v.1.56). После сохранения она автоматически отобразится в подвале и информационных блоках на всех страницах без ручного редактирования кода.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 p-[1.5px] rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
                  <input
                    type="text"
                    value={appVersionInput}
                    onChange={(e) => setAppVersionInput(e.target.value)}
                    placeholder="v.1.56"
                    className="w-full rounded-[10.5px] bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 px-3.5 py-2.5 text-[14px] font-bold text-slate-900 focus:outline-none"
                  />
                </div>
                <ResponsiveActionBtn
                  icon={isSavingVersion ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                  label="Обновить версию везде"
                  onClick={handleSaveAppVersion}
                  disabled={isSavingVersion}
                  variant="vivid"
                  alwaysShowLabel={true}
                />
              </div>
              {versionUpdatedAt && (
                <div className="text-[14px] text-slate-600 font-medium">
                  Последнее обновление версии: {new Date(versionUpdatedAt).toLocaleString('ru-RU')}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {settingsLoading ? (
            <div className="py-8 text-center text-slate-700 text-[14px] font-medium flex items-center justify-center gap-2">
              <RefreshCw className="animate-spin text-pink-600" size={18} />
              <span>Загрузка системной конфигурации...</span>
            </div>
          ) : settings ? (
            <div className="space-y-4">
              {/* 2. Модели генерации картинок (787 / 621 / 784 / 791) и тарифы в Иирках */}
              <CollapsibleSection
                title="Генерация картинок (функции 787, 621, 784, 791)"
                summary={`787: ${settings.costImage787Iirky ?? 0} · 621: ${settings.costImage621Iirky ?? 5} · 784: ${settings.costImage784Iirky ?? 10} · 791: ${settings.costImage791Iirky ?? 15} Иирок`}
                icon={<Sparkles size={18} />}
                defaultOpen={true}
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
                      <div className="rounded-[14.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 p-3 space-y-2">
                        <span className="block text-[14px] font-bold text-slate-900">787 · Без текста</span>
                        <label className="block text-[14px] text-slate-700">Стоимость (Иирки)</label>
                        <input
                          type="number"
                          min="0"
                          value={settings.costImage787Iirky ?? 0}
                          onChange={(e) =>
                            onChangeSettings({
                              ...settings,
                              costImage787Iirky: Math.max(0, parseInt(e.target.value || '0', 10) || 0)
                            })
                          }
                          className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-[14px] font-bold text-slate-900 focus:outline-none"
                        />
                        <label className="block text-[14px] text-slate-700">Номер функции</label>
                        <input
                          type="number"
                          min="1"
                          value={settings.function787Id ?? 787}
                          onChange={(e) =>
                            onChangeSettings({
                              ...settings,
                              function787Id: parseInt(e.target.value || '787', 10) || 787
                            })
                          }
                          className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-[14px] text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
                      <div className="rounded-[14.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 p-3 space-y-2">
                        <span className="block text-[14px] font-bold text-slate-900">621 · Иллюстрация</span>
                        <label className="block text-[14px] text-slate-700">Стоимость (Иирки)</label>
                        <input
                          type="number"
                          min="0"
                          value={settings.costImage621Iirky ?? 5}
                          onChange={(e) =>
                            onChangeSettings({
                              ...settings,
                              costImage621Iirky: Math.max(0, parseInt(e.target.value || '0', 10) || 0)
                            })
                          }
                          className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-[14px] font-bold text-slate-900 focus:outline-none"
                        />
                        <label className="block text-[14px] text-slate-700">Номер функции</label>
                        <input
                          type="number"
                          min="1"
                          value={settings.function621Id ?? 621}
                          onChange={(e) =>
                            onChangeSettings({
                              ...settings,
                              function621Id: parseInt(e.target.value || '621', 10) || 621
                            })
                          }
                          className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-[14px] text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
                      <div className="rounded-[14.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 p-3 space-y-2">
                        <span className="block text-[14px] font-bold text-slate-900">784 · Заголовок</span>
                        <label className="block text-[14px] text-slate-700">Стоимость (Иирки)</label>
                        <input
                          type="number"
                          min="0"
                          value={settings.costImage784Iirky ?? 10}
                          onChange={(e) =>
                            onChangeSettings({
                              ...settings,
                              costImage784Iirky: Math.max(0, parseInt(e.target.value || '0', 10) || 0)
                            })
                          }
                          className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-[14px] font-bold text-slate-900 focus:outline-none"
                        />
                        <label className="block text-[14px] text-slate-700">Номер функции</label>
                        <input
                          type="number"
                          min="1"
                          value={settings.function784Id ?? 784}
                          onChange={(e) =>
                            onChangeSettings({
                              ...settings,
                              function784Id: parseInt(e.target.value || '784', 10) || 784
                            })
                          }
                          className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-[14px] text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
                      <div className="rounded-[14.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 p-3 space-y-2">
                        <span className="block text-[14px] font-bold text-slate-900">791 · Инфографика и кириллица</span>
                        <label className="block text-[14px] text-slate-700">Стоимость (Иирки)</label>
                        <input
                          type="number"
                          min="0"
                          value={settings.costImage791Iirky ?? 15}
                          onChange={(e) =>
                            onChangeSettings({
                              ...settings,
                              costImage791Iirky: Math.max(0, parseInt(e.target.value || '0', 10) || 0)
                            })
                          }
                          className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-[14px] font-bold text-slate-900 focus:outline-none"
                        />
                        <label className="block text-[14px] text-slate-700">Номер функции</label>
                        <input
                          type="number"
                          min="1"
                          value={settings.function791Id ?? 791}
                          onChange={(e) =>
                            onChangeSettings({
                              ...settings,
                              function791Id: parseInt(e.target.value || '791', 10) || 791
                            })
                          }
                          className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-[14px] text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-[14px] text-slate-700 leading-relaxed break-words">
                    Все четыре функции передают идентификатор вида img791_идентификатор в поле журнала и автоматически сохраняют сгенерированные кадры в галерею пользователя.
                  </p>
                </div>
              </CollapsibleSection>

              {/* 3. Учетные данные нейросети и функция 763 */}
              <CollapsibleSection
                title="Параметры нейросети и модерации (функция 763)"
                summary={`Бот: ${settings.protalkBotId || '66275'} · Тариф токена: ${settings.costPerTokenRub ?? 0.001} ₽`}
                icon={<Cpu size={18} />}
                defaultOpen={false}
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">
                        Идентификатор бота нейросети (bot_id)
                      </label>
                      <input
                        type="text"
                        value={settings.protalkBotId || ''}
                        onChange={(e) => onChangeSettings({ ...settings, protalkBotId: e.target.value })}
                        className="w-full bg-white/85 border border-pink-300 rounded-xl px-3.5 py-2.5 text-[14px] text-slate-900 focus:outline-none"
                        placeholder="66275"
                      />
                    </div>
                    <div>
                      <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">
                        Секретный ключ бота (bot_token)
                      </label>
                      <input
                        type="password"
                        value={settings.protalkBotToken || ''}
                        onChange={(e) => onChangeSettings({ ...settings, protalkBotToken: e.target.value })}
                        className="w-full bg-white/85 border border-pink-300 rounded-xl px-3.5 py-2.5 text-[14px] text-slate-900 focus:outline-none"
                        placeholder="GaycdyJeSzd3Jja0E2S9jVTQiekUVkrE"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="block text-[14px] font-semibold text-slate-800">
                        Таблица логирования проверок и генераций (log_url)
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onChangeSettings({
                              ...settings,
                              moderationLogUrl:
                                'https://docs.google.com/spreadsheets/d/1C04sirbTrOfW4aj70PLM4xzSri1UYPDlH7NKH8Z2_9A/edit?usp=sharing'
                            })
                          }
                          className="text-[14px] text-pink-700 hover:text-pink-900 underline font-semibold cursor-pointer"
                        >
                          Стандартная таблица
                        </button>
                        <span className="text-pink-400">·</span>
                        <button
                          type="button"
                          onClick={() => onChangeSettings({ ...settings, moderationLogUrl: '' })}
                          className="text-[14px] text-orange-700 hover:text-orange-900 underline font-semibold cursor-pointer"
                        >
                          Очистить поле
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={settings.moderationLogUrl ?? ''}
                      onChange={(e) => onChangeSettings({ ...settings, moderationLogUrl: e.target.value })}
                      className="w-full bg-white/85 border border-pink-300 rounded-xl px-3.5 py-2.5 text-[14px] text-slate-900 focus:outline-none"
                      placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
                    />
                  </div>

                  <div>
                    <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">
                      Стоимость 1 токена в рублях (для учета модерации)
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={settings.costPerTokenRub ?? 0.001}
                        onChange={(e) =>
                          onChangeSettings({
                            ...settings,
                            costPerTokenRub: parseFloat(e.target.value) || 0
                          })
                        }
                        className="w-44 bg-white/85 border border-pink-300 rounded-xl px-3.5 py-2 text-[14px] text-slate-900 focus:outline-none"
                      />
                      <span className="text-[14px] text-slate-700">
                        руб./токен (например, 0.001 ₽ за токен = 1 ₽ за 1000 токенов)
                      </span>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* 4. Настройки бота в Телеграме и планировщика */}
              <CollapsibleSection
                title="Параметры бота в Телеграме и планировщик"
                summary={`Канал: ${settings.channelId || '@IIrkiBot'} · Автопостинг: ${settings.autoPostSchedule ? `в ${settings.autoPostTime || '07:00'}` : 'выключен'}`}
                icon={<Key size={18} />}
                defaultOpen={false}
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">
                      Токен бота в Телеграме
                    </label>
                    <input
                      type="password"
                      value={settings.telegramBotToken || ''}
                      onChange={(e) => onChangeSettings({ ...settings, telegramBotToken: e.target.value })}
                      className="w-full bg-white/85 border border-pink-300 rounded-xl px-3.5 py-2.5 text-[14px] text-slate-900 focus:outline-none"
                      placeholder="Токен вашего бота"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">
                        Канал назначения по умолчанию
                      </label>
                      <input
                        type="text"
                        value={settings.channelId || ''}
                        onChange={(e) => onChangeSettings({ ...settings, channelId: e.target.value })}
                        className="w-full bg-white/85 border border-pink-300 rounded-xl px-3.5 py-2.5 text-[14px] text-slate-900 focus:outline-none"
                        placeholder="@IIrkiBot"
                      />
                    </div>
                    <div>
                      <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">
                        Бот технической поддержки
                      </label>
                      <input
                        type="text"
                        value={settings.backupChannelId || ''}
                        onChange={(e) => onChangeSettings({ ...settings, backupChannelId: e.target.value })}
                        className="w-full bg-white/85 border border-pink-300 rounded-xl px-3.5 py-2.5 text-[14px] text-slate-900 focus:outline-none"
                        placeholder="@IIrkiBot"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-pink-300/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <label className="flex items-center gap-3 text-[14px] text-slate-800 font-semibold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(settings.autoPostSchedule)}
                        onChange={(e) =>
                          onChangeSettings({ ...settings, autoPostSchedule: e.target.checked })
                        }
                        className="w-5 h-5 rounded accent-pink-500 cursor-pointer"
                      />
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={16} className="text-pink-600" />
                        <span>Включить автоматическую отправку постов (@IIrkiBot)</span>
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] text-slate-700 font-medium">Время рассылки:</span>
                      <input
                        type="text"
                        value={settings.autoPostTime || ''}
                        onChange={(e) => onChangeSettings({ ...settings, autoPostTime: e.target.value })}
                        className="bg-white/85 border border-pink-300 text-slate-900 text-[14px] font-bold rounded-xl px-3 py-1.5 w-24 text-center focus:outline-none"
                        placeholder="07:00"
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              <div className="pt-2 flex justify-end">
                <ResponsiveActionBtn
                  icon={isSavingSettings ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                  label="Сохранить настройки системы"
                  onClick={onSaveSettings}
                  disabled={isSavingSettings}
                  variant="vivid"
                  alwaysShowLabel={true}
                />
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-rose-700 text-[14px] font-semibold">
              Не удалось загрузить настройки с сервера.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
