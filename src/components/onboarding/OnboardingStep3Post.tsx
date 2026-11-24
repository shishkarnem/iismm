import React, { useState } from 'react';
import {
  FileText,
  Send,
  Smartphone,
  Radio,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertCircle,
  ExternalLink,
  Image as ImageIcon
} from 'lucide-react';
import { Channel, DayRequest } from '../../types';
import {
  ONBOARDING_POST_TEMPLATES,
  IISMM_TEST_LOGO_URL,
  OnboardingInlineButtonItem
} from './onboardingTypes';
import { GradientSelect } from '../ui-kit/GradientDropdown';
import { OnboardingFormattedTextField } from '../onboarding-preview/OnboardingFormattedTextField';
import { OnboardingTelegramPreviewCard } from '../onboarding-preview/OnboardingTelegramPreviewCard';

export interface OnboardingStep3PostProps {
  userId: string;
  telegramId?: number;
  channels: Channel[];
  selectedChannelId: string;
  onAddDayRequest: (req: Omit<DayRequest, 'id'>) => Promise<DayRequest | any>;
  onOpenPostConstructor: (postId: string) => void;
  onCompletedStep3: (postId?: string) => Promise<void> | void;
}

interface SentPostSnapshot {
  format: 'v2' | 'rich';
  title: string;
  content: string;
  attachmentType: 'photo' | 'none';
  attachmentUrl: string;
  inlineButtons: OnboardingInlineButtonItem[][];
  targetLabel: string;
  messageId?: string | number;
  deliverySummary: string;
}

export const OnboardingStep3Post: React.FC<OnboardingStep3PostProps> = ({
  userId,
  telegramId,
  channels,
  selectedChannelId,
  onAddDayRequest,
  onOpenPostConstructor,
  onCompletedStep3
}) => {
  const firstTpl = ONBOARDING_POST_TEMPLATES[0];
  const [selectedTplId, setSelectedTplId] = useState(firstTpl.id);
  const [postFormat, setPostFormat] = useState<'v2' | 'rich'>(firstTpl.format);
  const [title, setTitle] = useState(firstTpl.title);
  const [content, setContent] = useState(firstTpl.content);
  const [useLogoPhoto, setUseLogoPhoto] = useState<boolean>(
    firstTpl.format === 'v2' ? Boolean(firstTpl.attachmentUrl) : true
  );
  const [inlineButtons, setInlineButtons] = useState<OnboardingInlineButtonItem[][]>(
    firstTpl.inlineButtons || []
  );

  const [targetChannelKey, setTargetChannelKey] = useState<string>(() => {
    const ch = channels.find((c) => c.id === selectedChannelId) || channels[0];
    return ch?.username || ch?.telegramId || '';
  });
  const [dmTelegramId, setDmTelegramId] = useState<string>(telegramId ? String(telegramId) : '');

  const [savedPostId, setSavedPostId] = useState<string>('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSendingDm, setIsSendingDm] = useState(false);
  const [isSendingChannel, setIsSendingChannel] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [sentResultSnapshot, setSentResultSnapshot] = useState<SentPostSnapshot | null>(null);

  const effectiveAttachmentType: 'photo' | 'none' =
    postFormat === 'v2' && useLogoPhoto ? 'photo' : 'none';
  const effectiveAttachmentUrl: string =
    postFormat === 'v2' && useLogoPhoto ? IISMM_TEST_LOGO_URL : '';

  const handleSelectTemplate = (tplId: string) => {
    setSelectedTplId(tplId);
    const found = ONBOARDING_POST_TEMPLATES.find((t) => t.id === tplId);
    if (found) {
      setPostFormat(found.format);
      setTitle(found.title);
      setContent(found.content);
      setUseLogoPhoto(found.format === 'v2' ? Boolean(found.attachmentUrl) : true);
      setInlineButtons(found.inlineButtons || []);
      setSavedPostId('');
    }
  };

  const ensureSavedDraft = async (): Promise<string> => {
    if (savedPostId) return savedPostId;
    setIsSavingDraft(true);
    try {
      const chosenChannels = targetChannelKey ? [targetChannelKey] : [];
      const created = await onAddDayRequest({
        userId,
        dayOfWeek: 'Черновик',
        category: 'Вводный тур',
        title: title.trim() || 'Первый пост по шаблону',
        requestTemplate: content,
        postText: content,
        generatedContent: content,
        channel: targetChannelKey || '',
        channels: chosenChannels,
        messageFormat: postFormat,
        attachmentType: effectiveAttachmentType,
        attachmentUrl: effectiveAttachmentUrl,
        inlineButtons,
        status: 'draft',
        linkPreviewEnabled: true
      } as any);
      const newId = created?.id ? String(created.id) : '';
      if (newId) setSavedPostId(newId);
      return newId;
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleTestSendToDm = async () => {
    setErrorMsg('');
    setStatusMsg('');
    const cleanTg = parseInt(String(dmTelegramId || '').replace(/\D/g, ''), 10);
    if (!cleanTg || isNaN(cleanTg)) {
      setErrorMsg(
        'Укажите числовой идентификатор вашего Telegram для отправки теста в личку (и убедитесь, что запустили диалог с @IIrkiBot).'
      );
      return;
    }

    setIsSendingDm(true);
    try {
      const draftId = await ensureSavedDraft();
      const res = await fetch('/api/telegram/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          telegramId: cleanTg,
          title: title.trim() || 'Тестовый пост',
          content,
          messageFormat: postFormat,
          attachmentType: effectiveAttachmentType,
          attachmentUrl: effectiveAttachmentUrl,
          inlineButtons,
          uppercaseHeader: false,
          linkPreviewEnabled: true
        })
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(
          data.error ||
            'Не удалось отправить сообщение в личку. Откройте @IIrkiBot в Telegram и нажмите кнопку Запустить.'
        );
      }
      setStatusMsg(
        `Тестовый пост успешно отправлен вам в личные сообщения Telegram (${cleanTg})! Ниже показан точный вид отправленной публикации.`
      );
      setSentResultSnapshot({
        format: postFormat,
        title: title.trim() || 'Тестовый пост',
        content,
        attachmentType: effectiveAttachmentType,
        attachmentUrl: effectiveAttachmentUrl,
        inlineButtons,
        targetLabel: `Личка Telegram (${cleanTg})`,
        messageId: data.messageId,
        deliverySummary: `Отправлено в личные сообщения Telegram (${cleanTg})`
      });
      if (draftId) setSavedPostId(draftId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка тестовой отправки в личку Telegram');
    } finally {
      setIsSendingDm(false);
    }
  };

  const handleTestSendToChannel = async () => {
    setErrorMsg('');
    setStatusMsg('');
    if (!targetChannelKey) {
      setErrorMsg(
        'У вас пока не выбран подключенный канал. Подключите канал на шаге 2 или отправьте тестовый пост себе в личку Telegram.'
      );
      return;
    }

    setIsSendingChannel(true);
    try {
      const draftId = await ensureSavedDraft();
      const res = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          channel: targetChannelKey,
          title: title.trim() || 'Тестовый пост',
          content,
          rawText: content,
          text: content,
          format: postFormat,
          attachmentType: effectiveAttachmentType,
          attachmentUrl: effectiveAttachmentUrl,
          inlineButtons,
          linkPreviewEnabled: true
        })
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(
          data.error ||
            'Не удалось опубликовать пост на канал. Проверьте права администратора у бота.'
        );
      }
      setStatusMsg(
        `Тестовый пост успешно опубликован на вашем канале (${targetChannelKey})! Ниже показан точный вид опубликованного сообщения.`
      );
      setSentResultSnapshot({
        format: postFormat,
        title: title.trim() || 'Тестовый пост',
        content,
        attachmentType: effectiveAttachmentType,
        attachmentUrl: effectiveAttachmentUrl,
        inlineButtons,
        targetLabel: targetChannelKey,
        messageId: data.messageId,
        deliverySummary: `Опубликовано на вашем канале ${targetChannelKey}`
      });
      if (draftId) setSavedPostId(draftId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка тестовой отправки на канал');
    } finally {
      setIsSendingChannel(false);
    }
  };

  const handleOpenFullEditor = async () => {
    const id = await ensureSavedDraft();
    if (id) {
      onOpenPostConstructor(id);
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 space-y-3.5 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-5 h-5 text-pink-600 shrink-0" />
            <h4 className="text-[16px] font-extrabold text-slate-900 break-words">
              Настройте пост по готовому шаблону конструктора
            </h4>
          </div>
          <button
            type="button"
            disabled={isSavingDraft}
            onClick={handleOpenFullEditor}
            className="px-3.5 py-1.5 rounded-xl bg-white/90 hover:bg-white border border-pink-300 text-pink-700 text-[14px] font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            <span>Открыть в полном конструкторе постов</span>
          </button>
        </div>

        <GradientSelect
          label="Выберите готовый шаблон поста (v2 или Rich с нашим логотипом)"
          value={selectedTplId}
          onChange={handleSelectTemplate}
          options={ONBOARDING_POST_TEMPLATES.map((t) => ({
            value: t.id,
            label: t.label,
            hint: t.badge
          }))}
        />

        <div>
          <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
            Заголовок черновика
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSavedPostId('');
            }}
            placeholder="Заголовок вашего поста"
            className="w-full px-3.5 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
          />
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[14px] font-extrabold text-slate-800">
            Режим разметки и панели выделения текста:
          </span>
          <div className="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-white/85 border border-pink-300">
            <button
              type="button"
              onClick={() => {
                setPostFormat('v2');
                setSavedPostId('');
              }}
              className={`px-3 py-1 rounded-xl text-[14px] font-extrabold cursor-pointer transition-all ${
                postFormat === 'v2'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-pink-50/80'
              }`}
            >
              V2
            </button>
            <button
              type="button"
              onClick={() => {
                setPostFormat('rich');
                setSavedPostId('');
              }}
              className={`px-3 py-1 rounded-xl text-[14px] font-extrabold cursor-pointer transition-all ${
                postFormat === 'rich'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-pink-50/80'
              }`}
            >
              Rich
            </button>
          </div>
        </div>

        <OnboardingFormattedTextField
          label={`Текст публикации (режим разметки: ${
            postFormat === 'rich' ? 'Rich' : 'Telegram V2'
          })`}
          format={postFormat}
          userId={userId}
          minRows={5}
          value={content}
          onChange={(val) => {
            setContent(val);
            setSavedPostId('');
          }}
          placeholder="Отредактируйте текст поста, продиктуйте голосом или выделите слова для открытия панели разметки..."
        />

        {postFormat === 'v2' && (
          <label className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-white/85 border border-pink-300 text-[14px] font-bold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={useLogoPhoto}
              onChange={(e) => {
                setUseLogoPhoto(e.target.checked);
                setSavedPostId('');
              }}
              className="w-4 h-4 accent-pink-600 rounded shrink-0"
            />
            <ImageIcon className="w-4 h-4 text-pink-600 shrink-0" />
            <span className="break-words">
              Прикрепить тестовую картинку с нашим фирменным логотипом к посту v2
            </span>
          </label>
        )}

        {/* Live Draft Preview */}
        <OnboardingTelegramPreviewCard
          mode="draft_preview"
          format={postFormat}
          title={title}
          content={content}
          attachmentType={effectiveAttachmentType}
          attachmentUrl={effectiveAttachmentUrl}
          inlineButtons={inlineButtons}
          deliverySummary="Так пост будет выглядеть у читателей при отправке"
        />
      </div>

      {/* Test Send Target Block: Channel OR Personal Telegram DM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 min-w-0">
        {/* Option A: Test to Channel */}
        <div className="p-4 rounded-3xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 flex flex-col justify-between gap-3 min-w-0">
          <div className="space-y-2.5 min-w-0">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-pink-600 shrink-0" />
              <span className="text-[15px] font-extrabold text-slate-900">
                Вариант 1: Отправить тест на свой канал
              </span>
            </div>
            {channels.length > 0 ? (
              <GradientSelect
                label="Ваш подключенный канал"
                value={targetChannelKey}
                onChange={setTargetChannelKey}
                options={channels.map((ch) => ({
                  value: ch.username || ch.telegramId || ch.id,
                  label: `${ch.name} (${ch.username || ch.id})`
                }))}
              />
            ) : (
              <p className="text-[14px] text-slate-700 font-medium break-words">
                Вы еще не подключили канал — вы можете вернуться на шаг 2 или сразу протестировать отправку поста себе в личку справа.
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={isSendingChannel || channels.length === 0}
            onClick={handleTestSendToChannel}
            className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 disabled:opacity-50 text-white text-[14px] font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {isSendingChannel ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Проверить тестом на канал</span>
          </button>
        </div>

        {/* Option B: Test to Personal Telegram DM */}
        <div className="p-4 rounded-3xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 flex flex-col justify-between gap-3 min-w-0">
          <div className="space-y-2.5 min-w-0">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-sky-600 shrink-0" />
              <span className="text-[15px] font-extrabold text-slate-900">
                Вариант 2: Отправить тест в личку Telegram
              </span>
            </div>
            <div>
              <label className="block text-[14px] font-extrabold text-slate-800 mb-1">
                Ваш числовой идентификатор в Telegram
              </label>
              <input
                type="text"
                value={dmTelegramId}
                onChange={(e) => setDmTelegramId(e.target.value)}
                placeholder="Например: 169262990"
                className="w-full px-3.5 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 font-mono focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={isSendingDm}
            onClick={handleTestSendToDm}
            className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 disabled:opacity-50 text-white text-[14px] font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {isSendingDm ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Smartphone className="w-4 h-4" />
            )}
            <span>Проверить тестом в личку Telegram</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-100/85 to-orange-100/85 border border-rose-300 text-rose-800 text-[14px] font-bold flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span className="break-words">{errorMsg}</span>
        </div>
      )}

      {statusMsg && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 to-orange-50/90 border border-pink-300 text-slate-900 text-[14px] font-bold flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-pink-600" />
          <span className="break-words">{statusMsg}</span>
        </div>
      )}

      {/* Sent Result Preview Card */}
      {sentResultSnapshot && (
        <OnboardingTelegramPreviewCard
          mode="sent_result"
          format={sentResultSnapshot.format}
          title={sentResultSnapshot.title}
          content={sentResultSnapshot.content}
          attachmentType={sentResultSnapshot.attachmentType}
          attachmentUrl={sentResultSnapshot.attachmentUrl}
          inlineButtons={sentResultSnapshot.inlineButtons}
          targetLabel={sentResultSnapshot.targetLabel}
          messageId={sentResultSnapshot.messageId}
          deliverySummary={sentResultSnapshot.deliverySummary}
        />
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-pink-200/80">
        <button
          type="button"
          onClick={async () => {
            const id = await ensureSavedDraft();
            await onCompletedStep3(id);
          }}
          className="px-4 py-2.5 rounded-2xl bg-white/90 hover:bg-white border border-pink-300 text-slate-800 text-[14px] font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-pink-600" />
          <span>Сохранить черновик без отправки</span>
        </button>

        <button
          type="button"
          onClick={async () => {
            const id = savedPostId || (await ensureSavedDraft());
            await onCompletedStep3(id);
          }}
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-extrabold flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <span>Далее: Шаг 4 (Автосценарий)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
