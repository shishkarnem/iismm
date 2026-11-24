import React, { useRef, useState } from 'react';
import {
  Image as ImageIcon,
  Images,
  Video,
  CircleDot,
  Music,
  Mic,
  FileText,
  Upload,
  Sparkles,
  Plus,
  Trash2,
  Loader2,
  Sliders
} from 'lucide-react';
import {
  Scenario,
  Channel,
  WorkflowNode,
  V2ScenarioAttachmentKind,
  ScenarioNodeTestRecord
} from '../../../../types';
import { GradientSelect } from '../../../ui-kit/GradientDropdown';
import { CollapsibleSection } from '../../../ui-kit/CollapsibleSection';
import {
  AiInlineButtonsDbPromptSection,
  INLINE_LAYOUT_RULE_OPTIONS,
  InlineButtonsLayoutRuleOption,
  InlineKeyboardVisualGrid
} from '../../../ui-kit/InlineKeyboardVisualGrid';
import { ResponsiveActionBtn } from '../../../ui-kit/ResponsiveActionBtn';
import { AutoGrowVoiceTextarea } from '../../../ui-kit/AutoGrowVoiceTextarea';
import {
  normalizeToButtonRows,
  serializeButtonRowsTo2D
} from '../../../post-editor/usePostEditorPersistence';
import { usePricingConfig } from '../../../../hooks/usePricingConfig';
import { formatIirkyCount } from '../../../../shared/pricingConfig';

interface V2AndButtonsConfigProps {
  selectedNode: WorkflowNode;
  currentScenario: Scenario;
  channels?: Channel[];
  activeUserId: string;
  dbTestResults: Record<string, ScenarioNodeTestRecord>;
  onUpdateConfig: (patch: Record<string, any>, immediateSave?: boolean) => void;
  onOpenImageConstructor: () => void;
}

const V2_MEDIA_OPTIONS: Array<{
  id: V2ScenarioAttachmentKind;
  title: string;
  accept: string;
  maxFiles: number;
  hint: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'photo',
    title: 'Одиночное фото',
    accept: 'image/*',
    maxFiles: 1,
    hint: 'Пост v2 с одной фотографией и подписью до 1 024 символов (поддерживает инлайн-кнопки).',
    icon: <ImageIcon size={16} />
  },
  {
    id: 'album',
    title: 'Альбом (2–10 фото)',
    accept: 'image/*',
    maxFiles: 10,
    hint: 'Медиа-группа до 10 фотографий в одном сообщении v2 (подпись до 1 024 символов на первом кадре).',
    icon: <Images size={16} />
  },
  {
    id: 'video',
    title: 'Видеофайл',
    accept: 'video/*',
    maxFiles: 1,
    hint: 'Видео в плеере Telegram с подписью до 1 024 символов и поддержкой кнопок.',
    icon: <Video size={16} />
  },
  {
    id: 'video_note',
    title: 'Видео-кружок',
    accept: 'video/*',
    maxFiles: 1,
    hint: 'Круглое видеосообщение Telegram (текст поста при наличии уйдет следом).',
    icon: <CircleDot size={16} />
  },
  {
    id: 'audio',
    title: 'Аудиозапись',
    accept: 'audio/*',
    maxFiles: 10,
    hint: 'Музыкальный трек или подкаст с названием и исполнителем в аудиоплеере Telegram.',
    icon: <Music size={16} />
  },
  {
    id: 'voice',
    title: 'Голосовое сообщение',
    accept: 'audio/*,.ogg,.mp3,.wav,.m4a',
    maxFiles: 1,
    hint: 'Голосовое сообщение со звуковой волной в Telegram.',
    icon: <Mic size={16} />
  },
  {
    id: 'document',
    title: 'Файлы и документы',
    accept: '*/*',
    maxFiles: 10,
    hint: 'Презентации, архивы, таблицы, гайды или фото без сжатия (до 10 файлов).',
    icon: <FileText size={16} />
  }
];

export const V2AndButtonsConfig: React.FC<V2AndButtonsConfigProps> = ({
  selectedNode,
  currentScenario,
  channels = [],
  activeUserId,
  dbTestResults,
  onUpdateConfig,
  onOpenImageConstructor
}) => {
  const { pricing } = usePricingConfig(activeUserId);
  const inlineButtonsCostLabel = formatIirkyCount(pricing.textAi.inlineButtons);
  const cfg = selectedNode.config || {};
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [libraryItems, setLibraryItems] = useState<
    Array<{ id: string; name: string; url: string; fileType: string }>
  >([]);

  const [isGeneratingButtons, setIsGeneratingButtons] = useState(false);
  const [buttonsNotice, setButtonsNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [aiDbPromptText, setAiDbPromptText] = useState<string>('');

  /* ========================================================================= */
  /* 1. v2 MEDIA ATTACHMENT (7 TYPES VIA VERTICAL GRADIENT DROPDOWN)           */
  /* ========================================================================= */
  if (selectedNode.type === 'v2_media_attachment') {
    const kind: V2ScenarioAttachmentKind = cfg.v2AttachmentKind || 'photo';
    const activeOpt = V2_MEDIA_OPTIONS.find((o) => o.id === kind) || V2_MEDIA_OPTIONS[0];
    const urls: string[] =
      Array.isArray(cfg.attachmentUrls) && cfg.attachmentUrls.length > 0
        ? cfg.attachmentUrls
        : Array.isArray(cfg.imageUrls) && cfg.imageUrls.length > 0
        ? cfg.imageUrls
        : [''];

    const commitUrls = (nextUrls: string[]) => {
      const normalized = nextUrls.slice(0, activeOpt.maxFiles);
      onUpdateConfig(
        {
          v2AttachmentKind: kind,
          mediaType: kind,
          attachmentUrls: normalized,
          imageUrls: kind === 'photo' || kind === 'album' ? normalized : cfg.imageUrls || [],
          imageUrl: kind === 'photo' || kind === 'album' ? normalized[0] || '' : ''
        },
        true
      );
    };

    const loadMediaLibrary = async () => {
      const nextOpen = !showLibrary;
      setShowLibrary(nextOpen);
      if (!nextOpen) return;
      setIsLoadingLibrary(true);
      try {
        const res = await fetch(`/api/files?userId=${encodeURIComponent(activeUserId)}`);
        const data = await res.json();
        const rawList = Array.isArray(data?.files) ? data.files : Array.isArray(data) ? data : [];
        const mapped = rawList
          .map((f: any) => {
            const rawUrl = String(f.fullUrl || f.url || f.originalUrl || '').trim();
            const fullUrl = rawUrl.startsWith('http')
              ? rawUrl
              : rawUrl
              ? `${window.location.origin}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`
              : '';
            return {
              id: String(f.id || rawUrl),
              name: String(f.name || f.originalName || rawUrl.split('/').pop() || 'Файл'),
              url: fullUrl,
              fileType: String(f.fileType || f.mimeType || f.type || '').toLowerCase()
            };
          })
          .filter((item: any) => Boolean(item.url));
        setLibraryItems(mapped);
      } catch {
        setLibraryItems([]);
      } finally {
        setIsLoadingLibrary(false);
      }
    };

    const filteredLibrary = libraryItems.filter((item) => {
      const ext = item.url.toLowerCase();
      if (kind === 'photo' || kind === 'album') {
        return item.fileType.includes('image') || /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(ext);
      }
      if (kind === 'video' || kind === 'video_note') {
        return item.fileType.includes('video') || /\.(mp4|mov|webm|mkv)(\?|$)/i.test(ext);
      }
      if (kind === 'audio' || kind === 'voice') {
        return (
          item.fileType.includes('audio') || /\.(mp3|ogg|oga|wav|m4a|flac)(\?|$)/i.test(ext)
        );
      }
      return true;
    });

    const handlePickFromLibrary = (pickedUrl: string) => {
      const existingClean = urls.filter((u) => u && u.trim());
      if (activeOpt.maxFiles === 1) {
        commitUrls([pickedUrl]);
        setShowLibrary(false);
      } else if (!existingClean.includes(pickedUrl)) {
        commitUrls([...existingClean, pickedUrl].slice(0, activeOpt.maxFiles));
      }
    };

    const handleUploadFiles = async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setIsUploading(true);
      setUploadNotice(null);
      try {
        const uploadedUrls: string[] = [];
        for (let i = 0; i < files.length; i++) {
          const fd = new FormData();
          fd.append('file', files[i]);
          fd.append('userId', activeUserId);
          const res = await fetch('/api/upload', { method: 'POST', body: fd });
          const data = await res.json();
          if (res.ok && data?.url) {
            const fullUrl = data.url.startsWith('http')
              ? data.url
              : `${window.location.origin}${data.url.startsWith('/') ? '' : '/'}${data.url}`;
            uploadedUrls.push(fullUrl);
          }
        }
        if (uploadedUrls.length > 0) {
          const existingClean = urls.filter((u) => u && u.trim());
          const merged =
            activeOpt.maxFiles === 1
              ? [uploadedUrls[0]]
              : [...existingClean, ...uploadedUrls].slice(0, activeOpt.maxFiles);
          commitUrls(merged);
          setUploadNotice(`Загружено в галерею: ${uploadedUrls.length} шт.`);
        }
      } catch (e: any) {
        setUploadNotice(e?.message || 'Ошибка загрузки файла на сервер');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    return (
      <div className="space-y-3.5 pt-1 text-[14px]">
        <GradientSelect
          label="Тип медиа-вложения для формата v2"
          value={kind}
          onChange={(val) => {
            const nextKind = val as V2ScenarioAttachmentKind;
            const nextMax = V2_MEDIA_OPTIONS.find((o) => o.id === nextKind)?.maxFiles || 1;
            onUpdateConfig(
              {
                v2AttachmentKind: nextKind,
                mediaType: nextKind,
                attachmentUrls: urls.slice(0, nextMax)
              },
              true
            );
          }}
          options={V2_MEDIA_OPTIONS.map((opt) => ({
            value: opt.id,
            label: opt.title,
            sublabel: opt.hint,
            icon: opt.icon,
            meta: opt.maxFiles > 1 ? `до ${opt.maxFiles} шт.` : '1 файл'
          }))}
        />

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={activeOpt.accept}
            multiple={activeOpt.maxFiles > 1}
            className="hidden"
            onChange={(e) => handleUploadFiles(e.target.files)}
          />

          <ResponsiveActionBtn
            variant="outline"
            icon={isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            label="С устройства"
            title="Загрузить файл с устройства в галерею"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          />

          <ResponsiveActionBtn
            variant="outline"
            icon={<Images size={16} />}
            label={showLibrary ? 'Скрыть медиатеку' : 'Из медиатеки'}
            title="Выбрать из вашей медиатеки"
            onClick={loadMediaLibrary}
          />

          {(kind === 'photo' || kind === 'album') && (
            <ResponsiveActionBtn
              variant="vivid"
              icon={<Sparkles size={16} />}
              label="Генератор картинок"
              title="Открыть генератор картинок (787 / 621 / 784 / 791)"
              onClick={onOpenImageConstructor}
            />
          )}
        </div>

        {showLibrary && (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 border border-pink-300 space-y-2 max-h-56 overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-900">
                Файлы медиатеки ({filteredLibrary.length})
              </span>
              {isLoadingLibrary && <Loader2 size={15} className="animate-spin text-pink-600" />}
            </div>
            {!isLoadingLibrary && filteredLibrary.length === 0 ? (
              <p className="text-slate-700">
                Подходящих файлов пока нет — загрузите с устройства или сгенерируйте.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredLibrary.slice(0, 24).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handlePickFromLibrary(item.url)}
                    className="p-2 rounded-xl bg-white/80 hover:bg-white border border-pink-300 text-left flex items-center gap-2.5 cursor-pointer"
                  >
                    {kind === 'photo' || kind === 'album' ? (
                      <img
                        src={item.url}
                        alt={item.name}
                        className="w-10 h-10 rounded-lg object-cover border border-pink-200 shrink-0"
                      />
                    ) : (
                      <FileText size={18} className="text-pink-600 shrink-0" />
                    )}
                    <span className="font-medium text-slate-900 truncate">{item.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {uploadNotice && (
          <div className="px-3 py-2 rounded-xl bg-sky-100/80 border border-sky-300 text-slate-900 font-medium">
            {uploadNotice}
          </div>
        )}

        {kind === 'audio' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Название трека</label>
              <input
                type="text"
                value={cfg.audioTitle || ''}
                onChange={(e) => onUpdateConfig({ audioTitle: e.target.value }, false)}
                onBlur={() => onUpdateConfig({ audioTitle: cfg.audioTitle || '' }, true)}
                placeholder="Выпуск подкаста #1"
                className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-slate-900"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-800 mb-1">Исполнитель</label>
              <input
                type="text"
                value={cfg.audioPerformer || ''}
                onChange={(e) => onUpdateConfig({ audioPerformer: e.target.value }, false)}
                onBlur={() => onUpdateConfig({ audioPerformer: cfg.audioPerformer || '' }, true)}
                placeholder="Автор канала"
                className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-slate-900"
              />
            </div>
          </div>
        )}

        <CollapsibleSection
          title="Ссылки и дополнительные параметры медиа"
          summary={`Слотов: ${urls.filter((u) => u && u.trim()).length} из ${activeOpt.maxFiles}${cfg.protectContent ? ' · Защита от пересылки' : ''}`}
          defaultOpen={urls.some((u) => Boolean(u && u.trim()))}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-bold text-slate-800">
                Прямые ссылки ({urls.filter((u) => u && u.trim()).length} / {activeOpt.maxFiles})
              </span>
              {activeOpt.maxFiles > 1 && urls.length < activeOpt.maxFiles && (
                <ResponsiveActionBtn
                  variant="outline"
                  icon={<Plus size={15} />}
                  label="Добавить слот"
                  onClick={() => commitUrls([...urls, ''])}
                />
              )}
            </div>

            {urls.map((val, idx) => (
              <div key={idx} className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-slate-700 w-6 text-center shrink-0">#{idx + 1}</span>
                <input
                  type="url"
                  value={val}
                  onChange={(e) => {
                    const copy = [...urls];
                    copy[idx] = e.target.value;
                    onUpdateConfig({ attachmentUrls: copy }, false);
                  }}
                  onBlur={() => commitUrls(urls)}
                  placeholder="https://... (или автоматически с прошлого шага)"
                  className="flex-1 min-w-0 bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-slate-900 font-mono"
                />
                {urls.length > 1 && (
                  <ResponsiveActionBtn
                    variant="danger"
                    showLabelFrom="never"
                    icon={<Trash2 size={15} />}
                    label="Удалить слот"
                    onClick={() => commitUrls(urls.filter((_, i) => i !== idx))}
                  />
                )}
              </div>
            ))}
          </div>

          <AutoGrowVoiceTextarea
            label="Резервная подпись (если нет блока текста)"
            value={cfg.captionText || ''}
            onChange={(val) => onUpdateConfig({ captionText: val }, false)}
            onBlur={() => onUpdateConfig({ captionText: cfg.captionText || '' }, true)}
            minRows={2}
            showClearButton
            placeholder="Необязательно"
          />

          <label className="flex items-center gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={Boolean(cfg.protectContent)}
              onChange={(e) => onUpdateConfig({ protectContent: e.target.checked }, true)}
              className="w-4 h-4 rounded border-pink-300 text-pink-600 cursor-pointer shrink-0"
            />
            <span className="font-semibold text-slate-900">
              Защитить контент в Telegram от копирования и пересылки
            </span>
          </label>
        </CollapsibleSection>
      </div>
    );
  }

  /* ========================================================================= */
  /* 2. INLINE BUTTONS + COLLAPSIBLE 1-IIRKA AI GENERATOR                      */
  /* ========================================================================= */
  if (selectedNode.type === 'format_inline_buttons') {
    const buttonsMode = cfg.buttonsMode === 'ai_from_post' ? 'ai_from_post' : 'manual';
    const publishNode = (currentScenario.nodes || []).find(
      (n) => n.type === 'publish_post' || n.type === 'publish_telegram'
    );
    const rawTargetCh =
      publishNode?.config?.channels?.[0] ||
      publishNode?.config?.channelId ||
      currentScenario.targetChannels?.[0] ||
      '';
    const matchedCh =
      channels.find(
        (c) =>
          c.id === rawTargetCh ||
          c.username?.replace(/^@/, '').toLowerCase() ===
            String(rawTargetCh).replace(/^@/, '').toLowerCase() ||
          c.name?.toLowerCase() === String(rawTargetCh).toLowerCase()
      ) || channels[0];
    const currentChannelUrl = matchedCh?.username
      ? `https://t.me/${matchedCh.username.replace(/^@/, '')}`
      : matchedCh?.inviteLink || 'https://t.me/IIrkiBot';

    const rows2D: Array<Array<{ id?: string; text: string; url: string; style?: string }>> =
      Array.isArray(cfg.inlineButtons) && cfg.inlineButtons.length > 0
        ? cfg.inlineButtons
        : [
            [
              {
                id: 'btn_init_0',
                text: 'Читать продолжение',
                url: cfg.defaultButtonUrl || currentChannelUrl,
                style: 'primary'
              }
            ]
          ];

    const visualRows = normalizeToButtonRows(rows2D);

    const aiCount = Math.min(6, Math.max(1, Number(cfg.aiButtonsCount || 2)));
    const resolvedLayoutRule: InlineButtonsLayoutRuleOption =
      cfg.aiButtonsLayoutRule ||
      (Number(cfg.aiButtonsPerRow) === 3
        ? '3_per_row'
        : Number(cfg.aiButtonsPerRow) === 2
        ? '2_per_row'
        : '1_per_row');
    const customInstruction = String(cfg.aiButtonsCustomInstruction ?? cfg.aiButtonsTone ?? '');

    const flatExistingUrls = rows2D.flat().map((b) => b?.url || '').filter(Boolean);
    const aiButtonUrls: string[] = Array.from({ length: aiCount }, (_, idx) => {
      if (Array.isArray(cfg.aiButtonUrls) && cfg.aiButtonUrls[idx] !== undefined) {
        return String(cfg.aiButtonUrls[idx]);
      }
      return flatExistingUrls[idx] || cfg.defaultButtonUrl || currentChannelUrl;
    });

    const updateAiButtonUrl = (idx: number, nextUrl: string, immediate: boolean) => {
      const updated = [...aiButtonUrls];
      updated[idx] = nextUrl;
      onUpdateConfig(
        {
          aiButtonUrls: updated,
          defaultButtonUrl: updated[0] || currentChannelUrl
        },
        immediate
      );
    };

    const findBestSampleText = (): { title: string; text: string } => {
      const records: ScenarioNodeTestRecord[] = Object.values(dbTestResults || {});
      for (let i = records.length - 1; i >= 0; i--) {
        const out = records[i]?.output;
        if (out?.text) {
          return { title: out.title || out.topic || currentScenario.name, text: out.text };
        }
      }
      return {
        title: currentScenario.name,
        text:
          currentScenario.category ||
          currentScenario.topicCategory ||
          'Экспертная публикация в канале'
      };
    };

    const handleGenerateButtonsNow = async () => {
      setIsGeneratingButtons(true);
      setButtonsNotice(null);
      try {
        const sample = findBestSampleText();
        const perRowNum =
          resolvedLayoutRule === '3_per_row' ? 3 : resolvedLayoutRule === '2_per_row' ? 2 : 1;
        const res = await fetch('/api/scenarios/generate-inline-buttons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: activeUserId,
            postTitle: sample.title,
            postText: sample.text,
            buttonsCount: aiCount,
            buttonsPerRow: perRowNum,
            layoutRule: resolvedLayoutRule,
            customInstruction,
            customPrompt: aiDbPromptText || undefined,
            defaultUrl: aiButtonUrls[0] || currentChannelUrl,
            targetUrls: aiButtonUrls,
            existingRows: rows2D,
            tone: customInstruction
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Не удалось сгенерировать кнопки');
        if (Array.isArray(data.inlineButtons)) {
          onUpdateConfig({ inlineButtons: data.inlineButtons, aiButtonUrls }, true);
          setButtonsNotice({
            type: 'ok',
            text: `Кнопки сгенерированы по контексту поста и правилу раскладки (списано: ${formatIirkyCount(data.cost ?? pricing.textAi.inlineButtons)}).`
          });
        }
      } catch (err: any) {
        setButtonsNotice({
          type: 'err',
          text: err?.message || 'Ошибка генерации инлайн-кнопок'
        });
      } finally {
        setIsGeneratingButtons(false);
      }
    };

    const totalBtns = rows2D.reduce((acc, r) => acc + r.length, 0);

    return (
      <div className="space-y-3.5 pt-1 text-[14px] min-w-0">
        <GradientSelect
          label="Режим формирования инлайн-кнопок"
          value={buttonsMode}
          onChange={(val) => onUpdateConfig({ buttonsMode: val }, true)}
          options={[
            {
              value: 'manual',
              label: 'Фиксированные кнопки',
              meta: 'Бесплатно',
              sublabel: 'К каждому посту добавляются настроенные вами строки кнопок'
            },
            {
              value: 'ai_from_post',
              label: 'Автогенерация по тексту поста',
              meta: inlineButtonsCostLabel,
              sublabel: 'Нейросеть придумывает призывы на кнопках по вашему правилу и промпту'
            }
          ]}
        />

        <CollapsibleSection
          title="Нейрогенератор кнопок по тексту поста"
          summary={`Кнопок: ${aiCount} · Правило раскладки и свой промпт · ${inlineButtonsCostLabel}`}
          icon={<Sparkles size={16} />}
          defaultOpen={buttonsMode === 'ai_from_post'}
        >
          <div className="space-y-3 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
              <GradientSelect
                label="Всего кнопок"
                value={String(aiCount)}
                onChange={(val) => {
                  const nextCnt = Number(val);
                  const resized = Array.from(
                    { length: nextCnt },
                    (_, i) => aiButtonUrls[i] || currentChannelUrl
                  );
                  onUpdateConfig({ aiButtonsCount: nextCnt, aiButtonUrls: resized }, true);
                }}
                options={[
                  { value: '1', label: '1 кнопка' },
                  { value: '2', label: '2 кнопки' },
                  { value: '3', label: '3 кнопки' },
                  { value: '4', label: '4 кнопки' },
                  { value: '5', label: '5 кнопок' },
                  { value: '6', label: '6 кнопок' }
                ]}
              />

              <GradientSelect
                label="Правило раскладки кнопок"
                value={resolvedLayoutRule}
                onChange={(val) => {
                  const nextRule = val as InlineButtonsLayoutRuleOption;
                  const perRow =
                    nextRule === '3_per_row' ? 3 : nextRule === '2_per_row' ? 2 : 1;
                  onUpdateConfig(
                    { aiButtonsLayoutRule: nextRule, aiButtonsPerRow: perRow },
                    true
                  );
                }}
                options={INLINE_LAYOUT_RULE_OPTIONS}
              />
            </div>

            <div className="space-y-2 min-w-0">
              <span className="block font-bold text-slate-800">Целевые ссылки для кнопок</span>
              {aiButtonUrls.map((uVal, uIdx) => (
                <div
                  key={uIdx}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0"
                >
                  <span className="font-bold text-slate-700 shrink-0 sm:w-24">
                    Кнопка #{uIdx + 1}
                  </span>
                  <input
                    type="url"
                    value={uVal}
                    onChange={(e) => updateAiButtonUrl(uIdx, e.target.value, false)}
                    onBlur={() => updateAiButtonUrl(uIdx, uVal || currentChannelUrl, true)}
                    placeholder="https://t.me/..."
                    className="flex-1 min-w-0 bg-gradient-to-r from-sky-50/90 via-pink-50/90 to-sky-50/90 border border-pink-300 rounded-xl px-3 py-2 text-slate-900 font-mono"
                  />
                  <ResponsiveActionBtn
                    variant="outline"
                    icon={<Sliders size={15} />}
                    label={matchedCh?.name || 'Текущий канал'}
                    title="Подставить ссылку текущего канала"
                    onClick={() => updateAiButtonUrl(uIdx, currentChannelUrl, true)}
                  />
                </div>
              ))}
            </div>

            <AiInlineButtonsDbPromptSection
              userId={activeUserId}
              layoutRule={resolvedLayoutRule}
              onChangeLayoutRule={(nextRule) => {
                const perRow = nextRule === '3_per_row' ? 3 : nextRule === '2_per_row' ? 2 : 1;
                onUpdateConfig({ aiButtonsLayoutRule: nextRule, aiButtonsPerRow: perRow }, true);
              }}
              customInstruction={customInstruction}
              onChangeCustomInstruction={(nextInst) =>
                onUpdateConfig(
                  { aiButtonsCustomInstruction: nextInst, aiButtonsTone: nextInst },
                  true
                )
              }
              promptText={aiDbPromptText}
              onChangePromptText={setAiDbPromptText}
            />

            <ResponsiveActionBtn
              variant="vivid"
              showLabelFrom="always"
              icon={
                isGeneratingButtons ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )
              }
              label={`Сгенерировать кнопки сейчас (${inlineButtonsCostLabel})`}
              disabled={isGeneratingButtons}
              onClick={handleGenerateButtonsNow}
              className="w-full"
            />

            {buttonsNotice && (
              <div
                className={`p-2.5 rounded-xl border font-medium ${
                  buttonsNotice.type === 'ok'
                    ? 'bg-sky-100/80 border-sky-300 text-slate-900'
                    : 'bg-rose-100/80 border-rose-300 text-rose-900'
                }`}
              >
                {buttonsNotice.text}
              </div>
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Настроенные строки инлайн-кнопок"
          summary={`Строк: ${rows2D.length} · Всего кнопок: ${totalBtns}`}
          icon={<Sliders size={16} />}
          defaultOpen={true}
        >
          <InlineKeyboardVisualGrid
            rows={visualRows}
            onChangeRows={(nextVisualRows) =>
              onUpdateConfig({ inlineButtons: serializeButtonRowsTo2D(nextVisualRows) }, true)
            }
            defaultUrl={cfg.defaultButtonUrl || currentChannelUrl}
            allowButtonTypes={false}
            maxButtonsPerRow={3}
          />
        </CollapsibleSection>
      </div>
    );
  }

  return null;
};
