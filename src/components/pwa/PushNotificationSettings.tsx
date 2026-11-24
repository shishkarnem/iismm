import React from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  CreditCard,
  FolderKanban,
  Info,
  Loader2,
  MessageSquare,
  Radio,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/pwa/usePWAInstall';
import {
  NotificationChannelKey,
  PushCategoryKey,
  usePushNotifications,
} from '../../hooks/pwa/usePushNotifications';

interface PushNotificationSettingsProps {
  userId: string;
}

const CHANNEL_OPTIONS: Array<{
  key: NotificationChannelKey;
  shortLabel: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColorClass: string;
}> = [
  {
    key: 'push',
    shortLabel: 'Push',
    title: 'Push на устройство',
    description: 'Всплывающие оповещения на экран телефона и компьютера.',
    icon: Smartphone,
    iconColorClass: 'text-sky-600',
  },
  {
    key: 'telegram',
    shortLabel: 'Telegram',
    title: 'Telegram-бот',
    description: 'Личные сообщения от бота в Telegram (сервисные коды входа приходят всегда).',
    icon: Send,
    iconColorClass: 'text-pink-600',
  },
  {
    key: 'bell',
    shortLabel: 'Колокольчик',
    title: 'Колокольчик на сайте',
    description: 'События в верхнем меню оповещений внутри личного кабинета.',
    icon: BellRing,
    iconColorClass: 'text-orange-600',
  },
];

const CATEGORY_OPTIONS: Array<{
  key: PushCategoryKey;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
}> = [
  {
    key: 'publish',
    title: 'Автопостинг и публикации',
    description: 'Отчеты о выходе постов по расписанию и мгновенные предупреждения об ошибках отправки в каналы.',
    icon: Radio,
    accentClass: 'text-sky-600',
  },
  {
    key: 'folders',
    title: 'Папки и подборки взаимного пиара',
    description: 'Напоминания за 1 час до выхода, уведомления о переносе времени, приглашениях, удалении и итогах.',
    icon: FolderKanban,
    accentClass: 'text-pink-600',
  },
  {
    key: 'balance',
    title: 'Баланс ИИрок и тарифы',
    description: 'Пополнение ИИрок, начисление реферальных бонусов, автопродление и скорое окончание тарифа.',
    icon: CreditCard,
    accentClass: 'text-orange-600',
  },
  {
    key: 'social',
    title: 'Соцсеть, комментарии и чаты',
    description: 'Новые комментарии под вашими публикациями, ответы на ветки и активность подписчиков.',
    icon: MessageSquare,
    accentClass: 'text-sky-600',
  },
  {
    key: 'ai',
    title: 'Нейросеть, сценарии и автопилот',
    description: 'Завершение генерации постов и обложек нейросетью, а также результаты работы сценариев.',
    icon: Sparkles,
    accentClass: 'text-pink-600',
  },
  {
    key: 'system',
    title: 'Системные уведомления',
    description: 'Важные сервисные оповещения, статус подключения каналов и безопасность вашего аккаунта.',
    icon: ShieldCheck,
    accentClass: 'text-orange-600',
  },
];

export const PushNotificationSettings: React.FC<PushNotificationSettingsProps> = ({ userId }) => {
  const { isInstalled } = usePWAInstall();
  const {
    isSupported,
    permission,
    isSubscribedOnThisDevice,
    channels,
    devices,
    loading,
    actionBusy,
    statusMessage,
    enableDevicePush,
    disableThisDevicePush,
    removeDeviceById,
    updateChannelMaster,
    updateChannelCategory,
    sendTestPush,
  } = usePushNotifications(userId);

  const scrollToInstallCard = () => {
    const el = document.getElementById('pwa-install-card');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-pink-300 shadow-md text-left space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pink-200/80 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 flex items-center justify-center text-white shadow-xs shrink-0">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[16px] sm:text-[18px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 to-orange-500 bg-clip-text text-transparent leading-snug">
              Уведомления: Push, Telegram и Колокольчик
            </h2>
            <p className="text-[14px] text-slate-700 font-medium leading-snug">
              Настройте, какие события отправлять в push на устройство, в Telegram-бот и в колокольчик в кабинете
            </p>
          </div>
        </div>

        <span
          className={`px-3.5 py-1.5 rounded-2xl text-[14px] font-bold border inline-flex items-center gap-1.5 shrink-0 ${
            isSubscribedOnThisDevice
              ? 'bg-white/90 border-sky-300 text-sky-800'
              : 'bg-white/90 border-pink-300 text-pink-800'
          }`}
        >
          {isSubscribedOnThisDevice ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
              <span>Устройство подключено</span>
            </>
          ) : (
            <>
              <BellOff className="w-4 h-4 text-pink-500 shrink-0" />
              <span>Устройство не подключено</span>
            </>
          )}
        </span>
      </div>

      {/* Why Push + Recommendation to install PWA */}
      <div className="p-4 rounded-2xl bg-white/80 border border-sky-200 space-y-2.5 text-[14px] text-slate-800">
        <div className="flex items-start gap-2.5">
          <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5 min-w-0">
            <p className="font-bold text-slate-900">
              Для чего нужны Push-уведомления и установка приложения
            </p>
            <p className="leading-relaxed text-slate-700">
              С включёнными push-уведомлениями важные события приходят прямо на экран блокировки телефона или компьютера даже при закрытой вкладке: вы не пропустите выход подборки или папки за 1 час, перенос даты организатором, ошибку публикации в канале или пополнение ИИрок.
            </p>
            {!isInstalled && (
              <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-slate-800 font-medium leading-relaxed">
                  Чтобы уведомления стабильно падали в push на телефоне (особенно на iPhone iOS 16.4+), рекомендуем сначала установить иконку ИИSMM на рабочий стол.
                </p>
                <button
                  type="button"
                  onClick={scrollToInstallCard}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white text-[14px] font-bold shadow-2xs hover:opacity-95 transition-all cursor-pointer shrink-0"
                >
                  Перейти к установке
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Device subscription action row */}
      <div className="p-4 rounded-2xl bg-white/80 border border-pink-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="text-[15px] font-bold text-slate-900">
              Подключение этого устройства для Push
            </div>
            <div className="text-[14px] text-slate-700 font-medium">
              {!isSupported
                ? 'Браузер не поддерживает Web Push. Откройте сайт в Safari на «Экране Домой» (iOS) или Chrome/Яндекс Браузере (Android).'
                : permission === 'denied'
                ? 'Разрешение на уведомления запрещено в настройках браузера — разрешите его для сайта и нажмите «Подключить».'
                : isSubscribedOnThisDevice
                ? 'Это устройство активно получает push-оповещения от ИИSMM.'
                : 'Нажмите кнопку справа, чтобы разрешить браузеру принимать push-уведомления на этом устройстве.'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {!isSubscribedOnThisDevice ? (
              <button
                type="button"
                onClick={() => void enableDevicePush()}
                disabled={actionBusy}
                className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold shadow-sm hover:opacity-95 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                <span>Включить push-уведомления</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void sendTestPush()}
                  disabled={actionBusy}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold shadow-sm hover:opacity-95 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Тестовый push</span>
                </button>
                <button
                  type="button"
                  onClick={() => void disableThisDevicePush()}
                  disabled={actionBusy}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl bg-white hover:bg-pink-50 text-slate-800 border border-pink-300 text-[14px] font-bold transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <BellOff className="w-4 h-4 text-pink-500" />
                  <span>Отключить это устройство</span>
                </button>
              </>
            )}
          </div>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-2xl border text-[14px] font-medium flex items-start gap-2 ${
              statusMessage.type === 'error'
                ? 'bg-orange-50/90 border-orange-300 text-orange-900'
                : 'bg-sky-50/90 border-sky-300 text-slate-800'
            }`}
          >
            {statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Connected devices list */}
        {devices.length > 0 && (
          <div className="pt-2 border-t border-pink-200/70 space-y-2">
            <div className="text-[14px] font-bold text-slate-800">
              Подключенные устройства ({devices.length}):
            </div>
            <div className="flex flex-wrap gap-2">
              {devices.map((dev) => (
                <div
                  key={dev.id}
                  className="px-3 py-1.5 rounded-2xl bg-gradient-to-r from-sky-50 via-pink-50 to-orange-50 border border-pink-200 flex items-center gap-2 text-[14px] text-slate-800"
                >
                  <Smartphone className="w-4 h-4 text-pink-500 shrink-0" />
                  <span className="font-semibold">{dev.deviceLabel}</span>
                  <button
                    type="button"
                    onClick={() => void removeDeviceById(dev.id)}
                    disabled={actionBusy}
                    title="Удалить устройство"
                    className="p-1 rounded-lg hover:bg-white text-slate-500 hover:text-pink-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3 Master Channel Toggles side-by-side: Push, Telegram, Bell */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {CHANNEL_OPTIONS.map((ch) => {
            const ChannelIcon = ch.icon;
            const isMasterOn = channels[ch.key].enabled;
            return (
              <label
                key={ch.key}
                className={`p-4 rounded-2xl border flex items-start justify-between gap-3 cursor-pointer transition-all shadow-2xs ${
                  isMasterOn
                    ? 'bg-white/90 border-pink-300'
                    : 'bg-white/65 border-pink-200/80 opacity-85'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-50 via-pink-50 to-orange-50 border border-pink-200 flex items-center justify-center shrink-0 mt-0.5">
                    <ChannelIcon className={`w-4 h-4 ${ch.iconColorClass}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-extrabold text-slate-900 leading-snug">
                      {ch.title}
                    </div>
                    <p className="text-[14px] text-slate-700 font-medium leading-snug mt-0.5">
                      {ch.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 pt-0.5">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isMasterOn}
                    disabled={loading}
                    onChange={(e) => void updateChannelMaster(ch.key, e.target.checked)}
                  />
                  <span
                    className={`inline-flex items-center w-12 h-7 rounded-full p-1 transition-all ${
                      isMasterOn
                        ? 'bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 justify-end'
                        : 'bg-slate-200 justify-start'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                  </span>
                </div>
              </label>
            );
          })}
        </div>

        {/* Category cards with side-by-side Push / Telegram / Bell toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CATEGORY_OPTIONS.map((cat) => {
            const IconComp = cat.icon;
            const anyActive = CHANNEL_OPTIONS.some(
              (ch) => channels[ch.key].enabled && channels[ch.key].categories[cat.key]
            );

            return (
              <div
                key={cat.key}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                  anyActive
                    ? 'bg-white/90 border-pink-300 shadow-2xs'
                    : 'bg-white/70 border-pink-200'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-50 via-pink-50 to-orange-50 border border-pink-200 flex items-center justify-center shrink-0 mt-0.5">
                    <IconComp className={`w-4 h-4 ${cat.accentClass}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-bold text-slate-900 leading-snug">
                      {cat.title}
                    </div>
                    <p className="text-[14px] text-slate-700 leading-snug mt-0.5">
                      {cat.description}
                    </p>
                  </div>
                </div>

                {/* Side-by-side toggles for Push, Telegram, Bell */}
                <div className="pt-2.5 border-t border-pink-200/70 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {CHANNEL_OPTIONS.map((ch) => {
                    const ChanIcon = ch.icon;
                    const masterOn = channels[ch.key].enabled;
                    const catChecked = channels[ch.key].categories[cat.key];
                    const toggleDisabled = !masterOn || loading;

                    return (
                      <label
                        key={ch.key}
                        className={`px-2.5 py-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                          toggleDisabled
                            ? 'bg-slate-50/70 border-slate-200 opacity-60 cursor-not-allowed'
                            : catChecked
                            ? 'bg-gradient-to-r from-sky-50/90 via-pink-50/90 to-orange-50/90 border-pink-300 cursor-pointer'
                            : 'bg-white/80 border-slate-200 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <ChanIcon className={`w-4 h-4 shrink-0 ${ch.iconColorClass}`} />
                          <span className="text-[14px] font-semibold text-slate-800 truncate">
                            {ch.shortLabel}
                          </span>
                        </div>
                        <div className="shrink-0">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={catChecked}
                            disabled={toggleDisabled}
                            onChange={(e) =>
                              void updateChannelCategory(ch.key, cat.key, e.target.checked)
                            }
                          />
                          <span
                            className={`inline-flex items-center w-10 h-5 rounded-full p-0.5 transition-all ${
                              catChecked && masterOn
                                ? 'bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 justify-end'
                                : 'bg-slate-200 justify-start'
                            }`}
                          >
                            <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
