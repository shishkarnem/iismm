import React, { useState } from 'react';
import {
  Radio,
  ArrowRight,
  Sparkles,
  Send,
  Smartphone,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react';
import { Channel } from '../../types';
import { ChannelBotAddWizard } from '../channels/ChannelBotAddWizard';
import { ChannelBrandingEditor } from '../channels/ChannelBrandingEditor';
import { GradientSelect } from '../ui-kit/GradientDropdown';
import { STEP2_CHANNEL_LOGO_TEST_TEMPLATES } from './onboardingTypes';
import { OnboardingTelegramPreviewCard } from '../onboarding-preview/OnboardingTelegramPreviewCard';

export interface OnboardingStep2ChannelProps {
  userId: string;
  telegramId?: number;
  channels: Channel[];
  selectedChannelId: string;
  onSelectChannelId: (channelId: string) => void;
  onCompletedStep2: (channelId?: string) => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
}

interface Step2SentSnapshot {
  format: 'v2' | 'rich';
  title: string;
  content: string;
  attachmentType?: string;
  attachmentUrl?: string;
  inlineButtons?: any[][];
  targetLabel: string;
  messageId?: string | number;
  summary: string;
}

export const OnboardingStep2Channel: React.FC<OnboardingStep2ChannelProps> = ({
  userId,
  telegramId,
  channels,
  selectedChannelId,
  onSelectChannelId,
  onCompletedStep2,
  onRefresh
}) => {
  const [showAddAnother, setShowAddAnother] = useState(channels.length === 0);
  const [logoTplId, setLogoTplId] = useState<string>(STEP2_CHANNEL_LOGO_TEST_TEMPLATES[0].id);
  const [dmTelegramId, setDmTelegramId] = useState<string>(telegramId ? String(telegramId) : '');
  const [isSendingChannelTest, setIsSendingChannelTest] = useState(false);
  const [isSendingDmTest, setIsSendingDmTest] = useState(false);
  const [testStatusMsg, setTestStatusMsg] = useState('');
  const [testErrorMsg, setTestErrorMsg] = useState('');
  const [sentSnapshot, setSentSnapshot] = useState<Step2SentSnapshot | null>(null);

  const activeChannel =
    channels.find((c) => c.id === selectedChannelId) ||
    (channels.length > 0 ? channels[0] : null);

  const activeLogoTemplate =
    STEP2_CHANNEL_LOGO_TEST_TEMPLATES.find((t) => t.id === logoTplId) ||
    STEP2_CHANNEL_LOGO_TEST_TEMPLATES[0];

  const handleSendLogoTestToChannel = async () => {
    setTestErrorMsg('');
    setTestStatusMsg('');
    const chHandle = activeChannel?.username || activeChannel?.telegramId || '';
    if (!chHandle) {
      setTestErrorMsg(
        'Сначала подключите ваш канал выше или отправьте этот тестовый шаблон с логотипом себе в личку Telegram.'
      );
      return;
    }

    setIsSendingChannelTest(true);
    try {
      const res = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          channel: chHandle,
          title: activeLogoTemplate.title,
          content: activeLogoTemplate.content,
          rawText: activeLogoTemplate.content,
          format: activeLogoTemplate.format,
          attachmentType: activeLogoTemplate.attachmentType || 'none',
          attachmentUrl: activeLogoTemplate.attachmentUrl || '',
          inlineButtons: activeLogoTemplate.inlineButtons || [],
          linkPreviewEnabled: true
        })
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(
          data.error || 'Не удалось отправить тестовый пост на канал. Проверьте права бота.'
        );
      }
      setTestStatusMsg(
        `Тестовый шаблон (${activeLogoTemplate.format === 'rich' ? 'Rich' : 'v2'}) с нашим логотипом успешно отправлен на канал ${chHandle}!`
      );
      setSentSnapshot({
        format: activeLogoTemplate.format,
        title: activeLogoTemplate.title,
        content: activeLogoTemplate.content,
        attachmentType: activeLogoTemplate.attachmentType,
        attachmentUrl: activeLogoTemplate.attachmentUrl,
        inlineButtons: activeLogoTemplate.inlineButtons,
        targetLabel: chHandle,
        messageId: data.messageId,
        summary: `Доставлено на канал ${chHandle} с тестовым логотипом`
      });
    } catch (err: any) {
      setTestErrorMsg(err?.message || 'Ошибка отправки теста на канал');
    } finally {
      setIsSendingChannelTest(false);
    }
  };

  const handleSendLogoTestToDm = async () => {
    setTestErrorMsg('');
    setTestStatusMsg('');
    const cleanTg = parseInt(String(dmTelegramId || '').replace(/\D/g, ''), 10);
    if (!cleanTg || isNaN(cleanTg)) {
      setTestErrorMsg(
        'Укажите числовой идентификатор вашего Telegram для проверки шаблона с логотипом в личке.'
      );
      return;
    }

    setIsSendingDmTest(true);
    try {
      const res = await fetch('/api/telegram/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          telegramId: cleanTg,
          title: activeLogoTemplate.title,
          content: activeLogoTemplate.content,
          messageFormat: activeLogoTemplate.format,
          attachmentType: activeLogoTemplate.attachmentType || 'none',
          attachmentUrl: activeLogoTemplate.attachmentUrl || '',
          inlineButtons: activeLogoTemplate.inlineButtons || [],
          uppercaseHeader: false,
          linkPreviewEnabled: true
        })
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(
          data.error ||
            'Не удалось отправить сообщение в личку. Откройте @IIrkiBot в Telegram и нажмите «Запустить».'
        );
      }
      setTestStatusMsg(
        `Тестовый шаблон (${activeLogoTemplate.format === 'rich' ? 'Rich' : 'v2'}) с нашим логотипом отправлен в личку Telegram (${cleanTg})!`
      );
      setSentSnapshot({
        format: activeLogoTemplate.format,
        title: activeLogoTemplate.title,
        content: activeLogoTemplate.content,
        attachmentType: activeLogoTemplate.attachmentType,
        attachmentUrl: activeLogoTemplate.attachmentUrl,
        inlineButtons: activeLogoTemplate.inlineButtons,
        targetLabel: `Личка (${cleanTg})`,
        messageId: data.messageId,
        summary: `Доставлено в личные сообщения Telegram (${cleanTg}) с тестовым логотипом`
      });
    } catch (err: any) {
      setTestErrorMsg(err?.message || 'Ошибка тестовой отправки в личку');
    } finally {
      setIsSendingDmTest(false);
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      {channels.length > 0 && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 space-y-3 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <Radio className="w-5 h-5 text-pink-600 shrink-0" />
              <span className="text-[15px] font-extrabold text-slate-900 break-words">
                Подключенные каналы ({channels.length})
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowAddAnother((prev) => !prev)}
              className="px-3.5 py-1.5 rounded-xl bg-white/90 hover:bg-white border border-pink-300 text-slate-800 text-[14px] font-bold cursor-pointer"
            >
              {showAddAnother
                ? 'Скрыть инструкцию добавления нового канала'
                : '+ Подключить еще один канал'}
            </button>
          </div>

          <GradientSelect
            label="Выберите ваш канал для оформления аватарки и описания"
            value={activeChannel?.id || ''}
            onChange={(val) => onSelectChannelId(val)}
            options={channels.map((c) => ({
              value: c.id,
              label: `${c.name} (${c.username || c.id})`,
              hint: c.isActive ? 'Бот подключен и активен' : 'Требуется проверка прав бота'
            }))}
          />
        </div>
      )}

      {(channels.length === 0 || showAddAnother) && (
        <ChannelBotAddWizard
          userId={userId}
          onChannelConnected={async (ch) => {
            onSelectChannelId(ch.id);
            setShowAddAnother(false);
            await onRefresh();
          }}
          onChannelBrandingSaved={async (ch) => {
            onSelectChannelId(ch.id);
            await onRefresh();
          }}
          onRefresh={onRefresh}
        />
      )}

      {activeChannel && !showAddAnother && (
        <div className="space-y-3 min-w-0">
          <div className="flex items-center gap-2 px-1 text-[14px] font-bold text-slate-800">
            <Sparkles className="w-4 h-4 text-pink-600 shrink-0" />
            <span className="break-words">
              Отредактируйте аватарку (через конструктор генераций) и описание канала (доступна генерация за 1 Иирку):
            </span>
          </div>

          <ChannelBrandingEditor
            channel={activeChannel}
            userId={userId}
            compactMode={true}
            onSaved={async (updated) => {
              onSelectChannelId(updated.id);
              await onRefresh();
            }}
            onRefreshUser={onRefresh}
          />
        </div>
      )}

      {/* Test Logo Templates in v2 and Rich right on Step 2 */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-50/88 via-pink-50/88 via-orange-50/88 via-pink-50/88 to-sky-50/88 border border-pink-300 space-y-3.5 min-w-0">
        <div className="flex items-start gap-2.5 min-w-0">
          <ImageIcon className="w-5 h-5 text-pink-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h4 className="text-[15px] sm:text-[16px] font-extrabold text-slate-900 break-words">
              Быстрый тест шаблонов с нашим логотипом (форматы Telegram v2 и Rich)
            </h4>
            <p className="text-[14px] text-slate-700 font-medium break-words">
              Выберите формат шаблона с фирменным логотипом в качестве тестовой картинки, посмотрите живую верстку и отправьте проверочное сообщение на канал или в личку:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-0">
          {STEP2_CHANNEL_LOGO_TEST_TEMPLATES.map((tpl) => {
            const isSelected = tpl.id === activeLogoTemplate.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setLogoTplId(tpl.id)}
                className={`p-3 rounded-2xl border text-left text-[14px] font-extrabold transition-all cursor-pointer min-w-0 ${
                  isSelected
                    ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-pink-400 shadow-xs'
                    : 'bg-white/85 hover:bg-white text-slate-800 border-pink-300'
                }`}
              >
                <div className="break-words">{tpl.label}</div>
                <div
                  className={`text-[14px] font-medium mt-0.5 break-words ${
                    isSelected ? 'text-white/95' : 'text-pink-700'
                  }`}
                >
                  {tpl.badge}
                </div>
              </button>
            );
          })}
        </div>

        <OnboardingTelegramPreviewCard
          mode="draft_preview"
          format={activeLogoTemplate.format}
          title={activeLogoTemplate.title}
          content={activeLogoTemplate.content}
          attachmentType={activeLogoTemplate.attachmentType}
          attachmentUrl={activeLogoTemplate.attachmentUrl}
          inlineButtons={activeLogoTemplate.inlineButtons}
          deliverySummary="Тестовая картинка с официальным логотипом платформы"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 min-w-0">
          <button
            type="button"
            disabled={isSendingChannelTest || !activeChannel}
            onClick={handleSendLogoTestToChannel}
            className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 disabled:opacity-50 text-white text-[14px] font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {isSendingChannelTest ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Send className="w-4 h-4 shrink-0" />
            )}
            <span className="break-words">Отправить тест с логотипом на канал</span>
          </button>

          <div className="flex flex-col sm:flex-row gap-2 min-w-0">
            <input
              type="text"
              value={dmTelegramId}
              onChange={(e) => setDmTelegramId(e.target.value)}
              placeholder="Ваш ID Telegram (личка)"
              className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 font-mono focus:outline-none focus:border-pink-500"
            />
            <button
              type="button"
              disabled={isSendingDmTest}
              onClick={handleSendLogoTestToDm}
              className="py-2.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 disabled:opacity-50 text-white text-[14px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
            >
              {isSendingDmTest ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Smartphone className="w-4 h-4 shrink-0" />
              )}
              <span>Тест в личку</span>
            </button>
          </div>
        </div>

        {testErrorMsg && (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-100/85 to-orange-100/85 border border-rose-300 text-rose-800 text-[14px] font-bold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span className="break-words">{testErrorMsg}</span>
          </div>
        )}

        {testStatusMsg && (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 to-orange-50/90 border border-pink-300 text-slate-900 text-[14px] font-bold flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-pink-600" />
            <span className="break-words">{testStatusMsg}</span>
          </div>
        )}

        {sentSnapshot && (
          <OnboardingTelegramPreviewCard
            mode="sent_result"
            format={sentSnapshot.format}
            title={sentSnapshot.title}
            content={sentSnapshot.content}
            attachmentType={sentSnapshot.attachmentType}
            attachmentUrl={sentSnapshot.attachmentUrl}
            inlineButtons={sentSnapshot.inlineButtons}
            targetLabel={sentSnapshot.targetLabel}
            messageId={sentSnapshot.messageId}
            deliverySummary={sentSnapshot.summary}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-pink-200/80">
        <button
          type="button"
          onClick={() => onCompletedStep2(activeChannel?.id)}
          className="px-4 py-2.5 rounded-2xl bg-white/90 hover:bg-white border border-pink-300 text-slate-800 text-[14px] font-bold cursor-pointer"
        >
          Пропустить подключение канала (протестирую в личку)
        </button>

        <button
          type="button"
          onClick={() => onCompletedStep2(activeChannel?.id)}
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-extrabold flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <span>Далее: Шаг 3 (Тестовый пост)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
