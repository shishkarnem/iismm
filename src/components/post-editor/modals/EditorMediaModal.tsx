import React, { useEffect, useState } from 'react';
import { Check, FolderOpen, Plus, Sparkles, Trash2 } from 'lucide-react';
import { GradientSelect } from '../../ui-kit/GradientDropdown';
import { GradientModalShell, ResponsiveActionBtn } from '../../ui-kit/ResponsiveActionBtn';
import { FileUpload } from '../../FileUpload';
import type { GalleryMediaFilter } from '../../GallerySelectModal';
import { formatAbsoluteUrl, isVideoMediaUrl } from '../../../utils/urlUtils';
import { CascadingCarouselPanel } from './rich-constructors/CascadingCarouselPanel';

export type RichMediaInsertTab =
  | 'photo'
  | 'video'
  | 'audio'
  | 'document'
  | 'collage'
  | 'slideshow'
  | 'slider';

type EditorMediaMode = 'photo' | 'collage' | 'slideshow' | 'video' | 'audio' | 'document';

interface ParsedSelectionMedia {
  detectedMode: EditorMediaMode | null;
  items: { url: string; caption: string }[];
  isVoice?: boolean;
}

function parseSelectionMediaSeed(raw?: string): ParsedSelectionMedia {
  if (!raw || !raw.trim()) {
    return { detectedMode: null, items: [] };
  }

  let detectedMode: EditorMediaMode | null = null;
  let isVoice = false;
  if (/<(?:tg-)?collage\b/i.test(raw)) {
    detectedMode = 'collage';
  } else if (/<(?:tg-)?(?:slideshow|carousel)\b/i.test(raw)) {
    detectedMode = 'slideshow';
  } else if (/<tg-document\b/i.test(raw)) {
    detectedMode = 'document';
  } else if (/<video\b/i.test(raw)) {
    detectedMode = 'video';
  } else if (/<audio\b/i.test(raw)) {
    detectedMode = 'audio';
    isVoice = /\bdata-voice=["']?true/i.test(raw) || /\.ogg(\?|$)/i.test(raw);
  }

  const items: { url: string; caption: string }[] = [];
  const seen = new Set<string>();

  const pushItem = (urlRaw: string, captionRaw = '') => {
    const cleanUrl = urlRaw.replace(/[,;]+$/, '').trim();
    if (!cleanUrl || seen.has(cleanUrl)) return;
    seen.add(cleanUrl);
    items.push({ url: cleanUrl, caption: captionRaw.trim() });
  };

  // Check <figure><tg-document src="..."></tg-document><figcaption>...</figcaption></figure>
  const figDocRegex =
    /<figure>\s*<tg-document\b[^>]*\bsrc=["']([^"']+)["'][^>]*>(?:<\/tg-document>)?\s*(?:<figcaption>([\s\S]*?)<\/figcaption>)?\s*<\/figure>/gi;
  let m: RegExpExecArray | null;
  let stripped = raw;
  while ((m = figDocRegex.exec(raw)) !== null) {
    pushItem(m[1], m[2] || '');
  }
  stripped = stripped.replace(figDocRegex, '\n');

  // Check standalone <tg-document src="...">
  const docTagRegex = /<tg-document\b([^>]*?)(?:\/>|><\/tg-document>|>([\s\S]*?)<\/tg-document>)/gi;
  while ((m = docTagRegex.exec(stripped)) !== null) {
    const srcM = (m[1] || '').match(/\bsrc=["']([^"']+)["']/i);
    const capM = (m[1] || '').match(/\bcaption=["']([^"']*)["']/i);
    if (srcM?.[1]) {
      pushItem(srcM[1], capM?.[1] || m[2] || '');
    }
  }
  stripped = stripped.replace(docTagRegex, '\n');

  // Check <video> and <audio> tags
  const avTagRegex = /<(video|audio)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((m = avTagRegex.exec(stripped)) !== null) {
    const srcM = (m[2] || '').match(/\bsrc=["']([^"']+)["']/i);
    const capM = (m[2] || '').match(/\b(?:title|caption|alt)=["']([^"']*)["']/i);
    if (srcM?.[1]) {
      pushItem(srcM[1], capM?.[1] || m[3] || '');
    }
  }
  stripped = stripped.replace(avTagRegex, '\n');

  const lines = stripped
    .replace(/<\/?(?:tg-)?(?:collage|slideshow|carousel)\b[^>]*>/gi, '\n')
    .split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let remaining = line;

    const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    while ((m = mdImgRegex.exec(line)) !== null) {
      pushItem(m[2], m[1] || '');
    }
    remaining = remaining.replace(mdImgRegex, ' ');

    const htmlImgRegex = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
    while ((m = htmlImgRegex.exec(line)) !== null) {
      const altMatch = m[0].match(/\balt=["']([^"']*)["']/i);
      pushItem(m[1], altMatch?.[1] || '');
    }
    remaining = remaining.replace(htmlImgRegex, ' ');

    const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/(?:file|uploads)\/[^\s)]+)\)/g;
    while ((m = mdLinkRegex.exec(remaining)) !== null) {
      pushItem(m[2], m[1] || '');
    }
    remaining = remaining.replace(mdLinkRegex, ' ');

    const bareUrlRegex = /(https?:\/\/[^\s<>")\],]+|\/(?:file|uploads)\/[^\s<>")\],]+)/g;
    while ((m = bareUrlRegex.exec(remaining)) !== null) {
      pushItem(m[1], '');
    }
  }

  return { detectedMode, items, isVoice };
}

interface EditorMediaModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: RichMediaInsertTab;
  selectedText?: string;
  userId?: string;
  onInsertMediaMarkup: (markup: string) => void;
  onOpenGalleryForItem: (cb: (url: string) => void, filter?: GalleryMediaFilter) => void;
  onOpenGalleryMultiple?: (cb: (urls: string[]) => void, filter?: GalleryMediaFilter) => void;
  onOpenImageBuilderForItem: (cb: (url: string) => void) => void;
}

export const EditorMediaModal: React.FC<EditorMediaModalProps> = ({
  open,
  onClose,
  initialTab = 'photo',
  selectedText = '',
  userId,
  onInsertMediaMarkup,
  onOpenGalleryForItem,
  onOpenGalleryMultiple,
  onOpenImageBuilderForItem
}) => {
  const [mode, setMode] = useState<EditorMediaMode>('photo');
  const [audioKind, setAudioKind] = useState<'audio' | 'voice'>('audio');
  const [singleUrl, setSingleUrl] = useState('');
  const [singleCaption, setSingleCaption] = useState('');
  const [multiItems, setMultiItems] = useState<{ url: string; caption: string }[]>([
    { url: '', caption: '' },
    { url: '', caption: '' }
  ]);

  useEffect(() => {
    if (!open) return;

    const seed = parseSelectionMediaSeed(selectedText);
    let nextMode: EditorMediaMode = 'photo';

    if (initialTab === 'slider' || initialTab === 'slideshow') {
      nextMode = 'slideshow';
    } else if (initialTab === 'collage') {
      nextMode = 'collage';
    } else if (initialTab === 'video') {
      nextMode = 'video';
    } else if (initialTab === 'audio') {
      nextMode = 'audio';
    } else if (initialTab === 'document') {
      nextMode = 'document';
    } else if (seed.detectedMode) {
      nextMode = seed.detectedMode;
    } else if (seed.items.length >= 2) {
      nextMode = 'collage';
    } else {
      nextMode = 'photo';
    }

    setMode(nextMode);
    setAudioKind(seed.isVoice ? 'voice' : 'audio');

    if (seed.items.length > 0) {
      setSingleUrl(seed.items[0].url);
      setSingleCaption(seed.items[0].caption);
      const seededMulti = seed.items.slice(0, 10);
      setMultiItems(
        seededMulti.length >= 2
          ? seededMulti
          : [seededMulti[0], { url: '', caption: '' }]
      );
    } else {
      setSingleUrl('');
      setSingleCaption('');
      setMultiItems([
        { url: '', caption: '' },
        { url: '', caption: '' }
      ]);
    }
  }, [open, initialTab, selectedText]);

  const handleModeChange = (nextVal: string) => {
    const nextMode = nextVal as EditorMediaMode;
    const nextIsMulti = nextMode === 'collage' || nextMode === 'slideshow';

    if (nextIsMulti) {
      const filledMulti = multiItems.filter((it) => it.url.trim());
      if (filledMulti.length === 0) {
        const combinedSeed = parseSelectionMediaSeed(
          [singleUrl, selectedText].filter(Boolean).join('\n')
        );
        if (combinedSeed.items.length > 0) {
          const seeded = combinedSeed.items.slice(0, 10);
          if (singleCaption.trim() && !seeded[0].caption) {
            seeded[0] = { ...seeded[0], caption: singleCaption.trim() };
          }
          setMultiItems(
            seeded.length >= 2 ? seeded : [seeded[0], { url: '', caption: '' }]
          );
        }
      } else if (filledMulti.length === 1 && selectedText.trim()) {
        const selSeed = parseSelectionMediaSeed(selectedText);
        if (selSeed.items.length >= 2) {
          setMultiItems(selSeed.items.slice(0, 10));
        }
      }
    } else if (!singleUrl.trim()) {
      const firstFilled = multiItems.find((it) => it.url.trim());
      if (firstFilled) {
        setSingleUrl(firstFilled.url);
        if (!singleCaption.trim() && firstFilled.caption) {
          setSingleCaption(firstFilled.caption);
        }
      }
    }

    setMode(nextMode);
  };

  const modeOptions = [
    { value: 'photo', label: 'Одиночная иллюстрация', sublabel: 'Фотография или инфографика с подписью' },
    { value: 'collage', label: 'Сетка коллажа (фото и видео)', sublabel: 'От 2 до 10 фото и видеороликов в единой плитке статьи' },
    { value: 'slideshow', label: 'Карусель слайдов (фото и видео)', sublabel: 'Листаемая галерея фото/видео и сюжетная каскадная ИИ-генерация' },
    { value: 'document', label: 'Документ / файл (<tg-document>)', sublabel: 'Нативное вложение PDF, DOCX, TXT, ZIP в тексте Rich 10.4' },
    { value: 'video', label: 'Видеоролик (mp4 / webm)', sublabel: 'Встроенный видеоплеер внутри статьи Rich' },
    { value: 'audio', label: 'Аудиодорожка или голос (mp3 / ogg)', sublabel: 'Аудиозапись или голосовая заметка в статье' }
  ];

  const isMulti = mode === 'collage' || mode === 'slideshow';
  const hasSelectionSeed = Boolean(selectedText && selectedText.trim());

  const singleGalleryFilter: GalleryMediaFilter =
    mode === 'photo' ? 'images' : 'all';

  const uploadAccept = isMulti
    ? 'image/*,video/*'
    : mode === 'photo'
    ? 'image/*'
    : mode === 'video'
    ? 'video/*'
    : mode === 'audio'
    ? 'audio/*'
    : '.pdf,.doc,.docx,.txt,.csv,.zip,.xls,.xlsx,application/*,text/*';

  const handleConfirm = () => {
    if (isMulti) {
      const valid = multiItems.filter((it) => it.url.trim());
      if (valid.length === 0) return;
      const tag = mode === 'collage' ? 'tg-collage' : 'tg-slideshow';
      const lines = valid.map((it) => `![${it.caption.trim()}](${it.url.trim()})`).join('\n');
      const block = `<${tag}>\n${lines}\n</${tag}>`;
      onInsertMediaMarkup(hasSelectionSeed ? block : `\n${block}\n`);
    } else {
      const cleanUrl = singleUrl.trim();
      if (!cleanUrl) return;
      const safeCap = singleCaption.replace(/"/g, '&quot;').trim();
      let itemMarkup = `![${singleCaption.trim()}](${cleanUrl})`;
      if (mode === 'document') {
        itemMarkup = singleCaption.trim()
          ? `<figure><tg-document src="${cleanUrl}"></tg-document><figcaption>${singleCaption.trim()}</figcaption></figure>`
          : `<tg-document src="${cleanUrl}"></tg-document>`;
      } else if (mode === 'video') {
        itemMarkup = safeCap
          ? `<video src="${cleanUrl}" title="${safeCap}"></video>`
          : `<video src="${cleanUrl}"></video>`;
      } else if (mode === 'audio') {
        const voiceAttr = audioKind === 'voice' || /\.ogg(\?|$)/i.test(cleanUrl) ? ' data-voice="true"' : '';
        const titleAttr = safeCap ? ` title="${safeCap}"` : '';
        itemMarkup = `<audio src="${cleanUrl}"${voiceAttr}${titleAttr}></audio>`;
      }
      onInsertMediaMarkup(hasSelectionSeed ? itemMarkup : `\n${itemMarkup}\n`);
    }
    onClose();
  };

  return (
    <GradientModalShell
      open={open}
      onClose={onClose}
      title="Вставка медиаблока в статью"
      subtitle="Загрузите файл, выберите из галереи или запустите каскадный сюжетный генератор"
      maxWidthClass="max-w-2xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <ResponsiveActionBtn
            icon={<Check size={16} />}
            label="Вставить в текст"
            alwaysShowLabel
            variant="vivid"
            onClick={handleConfirm}
          />
        </div>
      }
    >
      <div className="space-y-4">
        <GradientSelect
          label="Тип медиаблока"
          value={mode}
          onChange={handleModeChange}
          options={modeOptions}
        />

        {!isMulti ? (
          <div className="space-y-3 p-3.5 rounded-2xl bg-white/65 border border-pink-300/70">
            {mode === 'audio' && (
              <GradientSelect
                compact
                label="Тип аудио"
                value={audioKind}
                onChange={(v) => setAudioKind(v as 'audio' | 'voice')}
                options={[
                  { value: 'audio', label: 'Аудиозапись (mp3 / трек)' },
                  { value: 'voice', label: 'Голосовая заметка (ogg / voice_note)' }
                ]}
              />
            )}

            <div>
              <label className="block text-[14px] font-bold mb-1 text-slate-900">
                Прямая ссылка на файл
              </label>
              <input
                type="text"
                value={singleUrl}
                onChange={(e) => setSingleUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/85 border border-pink-300/80 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <FileUpload
                variant="compact"
                accept={uploadAccept}
                convertVoiceOgg={mode === 'audio' && audioKind === 'voice'}
                buttonLabel="Загрузить файл"
                onUploaded={(_k, url) => {
                  const finalUrl = formatAbsoluteUrl(url);
                  if (finalUrl) setSingleUrl(finalUrl);
                }}
              />
              <ResponsiveActionBtn
                icon={<FolderOpen size={16} />}
                label="Из галереи"
                title="Выбрать файл из личной галереи"
                variant="outline"
                onClick={() => onOpenGalleryForItem((url) => setSingleUrl(url), singleGalleryFilter)}
              />
              {mode === 'photo' && (
                <ResponsiveActionBtn
                  icon={<Sparkles size={16} />}
                  label="Сгенерировать картинку"
                  title="Открыть единый нейроконструктор картинок (модели 787, 621, 784, 791)"
                  variant="vivid"
                  onClick={() => onOpenImageBuilderForItem((url) => setSingleUrl(url))}
                />
              )}
            </div>

            {mode === 'photo' && singleUrl && (
              <img
                src={singleUrl}
                alt="Предпросмотр"
                className="w-full max-h-48 object-cover rounded-xl border border-pink-300/70"
              />
            )}

            {mode === 'video' && singleUrl && (
              <video
                src={singleUrl}
                controls
                className="w-full max-h-48 object-contain rounded-xl border border-pink-300/70 bg-sky-50"
              />
            )}

            {mode === 'audio' && singleUrl && (
              <audio src={singleUrl} controls className="w-full" />
            )}

            <div>
              <label className="block text-[14px] font-bold mb-1 text-slate-900">
                Подпись или название (необязательно)
              </label>
              <input
                type="text"
                value={singleCaption}
                onChange={(e) => setSingleCaption(e.target.value)}
                placeholder="Краткое пояснение к медиафайлу"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/85 border border-pink-300/80 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {mode === 'slideshow' && (
              <CascadingCarouselPanel
                userId={userId}
                onPickRefFromGallery={onOpenGalleryForItem}
                onSlidesGenerated={(slides) => {
                  if (slides.length > 0) {
                    setMultiItems(slides.slice(0, 10));
                  }
                }}
              />
            )}

            {multiItems.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-white/65 border border-pink-300/70 space-y-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[14px] font-bold text-slate-900">
                    Кадр {idx + 1}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <FileUpload
                      variant="compact"
                      accept="image/*,video/*"
                      buttonLabel="Загрузить"
                      onUploaded={(_k, url) => {
                        const finalUrl = formatAbsoluteUrl(url);
                        if (finalUrl) {
                          setMultiItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, url: finalUrl } : it))
                          );
                        }
                      }}
                    />
                    <ResponsiveActionBtn
                      icon={<FolderOpen size={15} />}
                      label="Галерея"
                      variant="outline"
                      onClick={() =>
                        onOpenGalleryForItem(
                          (url) =>
                            setMultiItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, url } : it))
                            ),
                          'images_and_videos'
                        )
                      }
                    />
                    <ResponsiveActionBtn
                      icon={<Sparkles size={15} />}
                      label="Нейрогенератор"
                      variant="vivid"
                      onClick={() =>
                        onOpenImageBuilderForItem((url) =>
                          setMultiItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, url } : it))
                          )
                        )
                      }
                    />
                    {multiItems.length > 2 && (
                      <ResponsiveActionBtn
                        icon={<Trash2 size={15} />}
                        label="Удалить"
                        showLabelFrom="never"
                        variant="danger"
                        onClick={() =>
                          setMultiItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {item.url.trim() && (
                    isVideoMediaUrl(item.url) ? (
                      <video
                        src={item.url}
                        muted
                        playsInline
                        preload="metadata"
                        className="w-12 h-12 rounded-xl object-cover border border-pink-300/80 shrink-0"
                      />
                    ) : (
                      <img
                        src={item.url}
                        alt={`Кадр ${idx + 1}`}
                        className="w-12 h-12 rounded-xl object-cover border border-pink-300/80 shrink-0"
                      />
                    )
                  )}
                  <input
                    type="text"
                    value={item.url}
                    onChange={(e) =>
                      setMultiItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, url: e.target.value } : it))
                      )
                    }
                    placeholder="Ссылка на фото или видео https://..."
                    className="w-full min-w-0 px-3 py-2 rounded-xl bg-white/85 border border-pink-300/80 text-[14px] text-slate-900 focus:outline-none"
                  />
                </div>

                <input
                  type="text"
                  value={item.caption}
                  onChange={(e) =>
                    setMultiItems((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, caption: e.target.value } : it))
                    )
                  }
                  placeholder="Подпись кадра (необязательно)"
                  className="w-full px-3 py-2 rounded-xl bg-white/85 border border-pink-300/80 text-[14px] text-slate-900 focus:outline-none"
                />
              </div>
            ))}

            <div className="flex items-center gap-2 flex-wrap">
              {multiItems.length < 10 && (
                <ResponsiveActionBtn
                  icon={<Plus size={16} />}
                  label="Добавить кадр"
                  alwaysShowLabel
                  variant="outline"
                  onClick={() => setMultiItems((prev) => [...prev, { url: '', caption: '' }])}
                />
              )}
              {multiItems.length < 10 && (
                <FileUpload
                  variant="compact"
                  accept="image/*,video/*"
                  multiple
                  buttonLabel="Загрузить фото/видео"
                  onUploaded={(_k, url) => {
                    const clean = formatAbsoluteUrl(url);
                    if (!clean) return;
                    setMultiItems((prev) => {
                      const existingFilled = prev.filter((it) => it.url.trim());
                      const combined = [...existingFilled, { url: clean, caption: '' }].slice(0, 10);
                      return combined.length >= 2 ? combined : [...combined, { url: '', caption: '' }];
                    });
                  }}
                  onBatchUploaded={(uploadedItems) => {
                    const urls = uploadedItems.map((it) => formatAbsoluteUrl(it.url)).filter(Boolean);
                    if (!urls.length) return;
                    setMultiItems((prev) => {
                      const existingFilled = prev.filter((it) => it.url.trim());
                      const added = urls.map((u) => ({ url: u, caption: '' }));
                      const combined = [...existingFilled, ...added].slice(0, 10);
                      return combined.length >= 2 ? combined : [...combined, { url: '', caption: '' }];
                    });
                  }}
                />
              )}
              {onOpenGalleryMultiple && multiItems.length < 10 && (
                <ResponsiveActionBtn
                  icon={<FolderOpen size={16} />}
                  label="Выбрать несколько из галереи"
                  variant="outline"
                  onClick={() =>
                    onOpenGalleryMultiple((urls) => {
                      if (!urls.length) return;
                      setMultiItems((prev) => {
                        const existingFilled = prev.filter((it) => it.url.trim());
                        const added = urls.map((u) => ({ url: u, caption: '' }));
                        const combined = [...existingFilled, ...added].slice(0, 10);
                        return combined.length >= 2
                          ? combined
                          : [...combined, { url: '', caption: '' }];
                      });
                    }, 'images_and_videos')
                  }
                />
              )}
            </div>
          </div>
        )}
      </div>
    </GradientModalShell>
  );
};
