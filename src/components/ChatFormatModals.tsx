import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { 
  Link as LinkIcon, 
  X, 
  Table as TableIcon, 
  Image as ImageIcon, 
  Sparkles, 
  Clock, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Video, 
  Volume2,
  Quote
} from 'lucide-react';
import { RenderMathPreview, AI_IMAGE_MODELS } from './PostTelegramEditor';
import { GallerySelectModal } from './GallerySelectModal';
import { FileUpload } from './FileUpload';
import { formatAbsoluteUrl, isVideoMediaUrl } from '../utils/urlUtils';
import { ImageBuilderModal } from './image-builder';
import { GradientSelect } from './ui-kit/GradientDropdown';
import { CascadingCarouselPanel } from './post-editor/modals/rich-constructors/CascadingCarouselPanel';
import { GALLERY_STOCK_IMAGES } from '../constants/proTalkStorage';

export type ChatModalType = 'link' | 'quote' | 'table' | 'formula' | 'emoji_time' | 'anchors' | 'media' | 'carousel' | 'collage' | 'buttons' | null;

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  formatMode: 'v2' | 'rich';
}

// =========================================================================
// MODAL 1: LINK GENERATOR (ГЕНЕРАТОР ГИПЕРССЫЛОК)
// =========================================================================
export interface ChatLinkModalProps extends BaseModalProps {
  initialText?: string;
  onApply: (formattedText: string) => void;
}

export const ChatLinkModal: React.FC<ChatLinkModalProps> = ({
  isOpen,
  onClose,
  initialText = '',
  formatMode,
  onApply
}) => {
  const [linkText, setLinkText] = useState<string>(initialText);
  const [linkUrl, setLinkUrl] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setLinkText(initialText);
      setLinkUrl('');
      if (navigator.clipboard?.readText) {
        navigator.clipboard.readText()
          .then(clip => {
            if (clip && (clip.startsWith('http://') || clip.startsWith('https://') || clip.startsWith('tg://'))) {
              setLinkUrl(clip.trim());
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen, initialText]);

  if (!isOpen) return null;

  const handleInsertLink = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const cleanUrl = linkUrl.trim();
    if (!cleanUrl) return;
    const displayText = linkText.trim() || cleanUrl;

    // Both Rich and V2 modes use standard markdown links: [выделенный текст](url адрес ссылки)
    const formatted = `[${displayText}](${cleanUrl})`;
    onApply(formatted);
    onClose();
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-sky-950/20 backdrop-blur-md overflow-y-auto text-left"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 border border-pink-300 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-pink-200 pb-3">
          <div className="flex items-center space-x-2">
            <LinkIcon size={18} className="text-pink-600" />
            <h3 className="text-[14px] font-extrabold text-slate-900">Генератор гиперссылок</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900 cursor-pointer p-1">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 text-[14px]">
          <div>
            <label className="block text-[14px] font-bold text-slate-700 mb-1">Текст гиперссылки:</label>
            <input
              type="text"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleInsertLink(e);
                }
              }}
              placeholder="Текст ссылки..."
              autoFocus={!linkText}
              className="w-full bg-white/90 border border-pink-200 rounded-xl px-3 py-2 text-slate-900 font-medium text-[14px] focus:outline-hidden focus:ring-2 focus:ring-pink-300"
            />
          </div>

          <div>
            <label className="block text-[14px] font-bold text-slate-700 mb-1">Адрес ссылки (URL или Telegram):</label>
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleInsertLink(e);
                }
              }}
              placeholder="https://t.me/IIrkiBot или https://..."
              className="w-full bg-white/90 border border-pink-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-[14px] focus:outline-hidden focus:ring-2 focus:ring-pink-300"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-pink-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/80 text-slate-700 border border-pink-200 text-[14px] font-bold hover:bg-white cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleInsertLink(e);
              }}
              disabled={!linkUrl.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white text-[14px] font-extrabold hover:opacity-95 cursor-pointer shadow-2xs disabled:opacity-50"
            >
              Вставить ссылку
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// =========================================================================
// MODAL: QUOTE MODAL (ЦИТАТА)
// =========================================================================
export interface ChatQuoteModalProps extends BaseModalProps {
  initialText?: string;
  onApply: (formattedText: string) => void;
}

export const ChatQuoteModal: React.FC<ChatQuoteModalProps> = ({
  isOpen,
  onClose,
  initialText = '',
  formatMode,
  onApply
}) => {
  const [quoteText, setQuoteText] = useState<string>(initialText);
  const [isExpandable, setIsExpandable] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setQuoteText(initialText);
    }
  }, [isOpen, initialText]);

  if (!isOpen) return null;

  const handleInsertQuote = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = quoteText.trim();
    if (!text) return;

    let formatted = '';
    if (formatMode === 'rich') {
      formatted = isExpandable
        ? `<blockquote expandable>\n${text}\n</blockquote>\n`
        : `<blockquote>\n${text}\n</blockquote>\n`;
    } else {
      formatted = text.split('\n').map(line => `>${line}`).join('\n') + '\n';
    }
    onApply(formatted);
    onClose();
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-sky-950/20 backdrop-blur-md overflow-y-auto text-left"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 border border-pink-300 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-pink-200 pb-3">
          <div className="flex items-center space-x-2">
            <Quote size={18} className="text-pink-600" />
            <h3 className="text-[14px] font-extrabold text-slate-900">Оформление цитаты</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900 cursor-pointer p-1">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 text-[14px]">
          <div>
            <label className="block text-[14px] font-bold text-slate-700 mb-1">Текст цитаты:</label>
            <textarea
              rows={3}
              value={quoteText}
              onChange={(e) => setQuoteText(e.target.value)}
              placeholder="Введите текст цитаты..."
              className="w-full bg-white/90 border border-pink-200 rounded-xl px-3 py-2 text-slate-900 font-medium text-[14px] focus:outline-hidden focus:ring-2 focus:ring-pink-300"
            />
          </div>

          {formatMode === 'rich' && (
            <label className="flex items-center gap-2 text-[14px] font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isExpandable}
                onChange={(e) => setIsExpandable(e.target.checked)}
                className="rounded text-pink-600 focus:ring-pink-300 w-4 h-4"
              />
              <span>Сворачиваемая цитата (expandable)</span>
            </label>
          )}

          <div className="flex justify-end space-x-2 pt-2 border-t border-pink-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/80 text-slate-700 border border-pink-200 text-[14px] font-bold hover:bg-white cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleInsertQuote(e);
              }}
              disabled={!quoteText.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white text-[14px] font-extrabold hover:opacity-95 cursor-pointer shadow-2xs disabled:opacity-50"
            >
              Вставить цитату
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// =========================================================================
// MODAL 2: MEDIA CONSTRUCTOR (PHOTOS, COLLAGE, SLIDESHOW)
// =========================================================================
export interface ChatMediaModalProps extends BaseModalProps {
  initialType?: 'photo' | 'collage' | 'slideshow' | 'video' | 'audio' | 'document';
  initialCaption?: string;
  onApply: (formattedText: string) => void;
}

export const ChatMediaModal: React.FC<ChatMediaModalProps> = ({
  isOpen,
  onClose,
  initialType = 'photo',
  initialCaption = '',
  onApply
}) => {
  const [modalMediaType, setModalMediaType] = useState<'photo' | 'collage' | 'slideshow' | 'video' | 'audio' | 'document'>(initialType || 'photo');
  const [modalMediaUrls, setModalMediaUrls] = useState<string[]>([GALLERY_STOCK_IMAGES[0]]);
  const [modalMediaCaption, setModalMediaCaption] = useState<string>(initialCaption || '');
  const [modalSlideIdx, setModalSlideIdx] = useState<number>(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState<boolean>(false);
  const [refGalleryCb, setRefGalleryCb] = useState<((url: string) => void) | null>(null);
  const [isImageBuilderOpen, setIsImageBuilderOpen] = useState<boolean>(false);
  const [aiGenPrompt, setAiGenPrompt] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const targetType = initialType || 'photo';
      setModalMediaType(targetType);
      setModalMediaCaption(initialCaption || '');
      if (targetType === 'collage' || targetType === 'slideshow') {
        if (modalMediaUrls.length <= 1) {
          setModalMediaUrls([
            GALLERY_STOCK_IMAGES[0],
            GALLERY_STOCK_IMAGES[1]
          ]);
        }
      } else if (targetType !== 'photo') {
        setModalMediaUrls(['']);
      }
    }
  }, [isOpen, initialType, initialCaption]);

  if (!isOpen) return null;

  const isSingleMedia =
    modalMediaType === 'photo' ||
    modalMediaType === 'document' ||
    modalMediaType === 'video' ||
    modalMediaType === 'audio';

  const currentUserId = (() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('currentUser') || '{}');
      return parsed.telegramId || parsed.id || '16926299042';
    } catch {
      return '16926299042';
    }
  })();

  const handleInsertMedia = () => {
    let generatedCode = '';
    const mainUrl = (modalMediaUrls[0] || '').trim() || 'https://';
    const validUrls = modalMediaUrls.filter(u => u.trim());
    const caption = modalMediaCaption ? modalMediaCaption.trim() : '';

    if (modalMediaType === 'collage') {
      generatedCode = `<tg-collage>\n${(validUrls.length > 0 ? validUrls : [mainUrl]).map(u => `![](${u})`).join('\n')}\n</tg-collage>\n\n`;
    } else if (modalMediaType === 'slideshow') {
      generatedCode = `<tg-slideshow>\n${(validUrls.length > 0 ? validUrls : [mainUrl]).map(u => `![](${u})`).join('\n')}\n</tg-slideshow>\n\n`;
    } else if (modalMediaType === 'document') {
      generatedCode = caption
        ? `<figure><tg-document src="${mainUrl}"></tg-document><figcaption>${caption}</figcaption></figure>\n\n`
        : `<tg-document src="${mainUrl}"></tg-document>\n\n`;
    } else if (modalMediaType === 'video') {
      const titleAttr = caption ? ` title="${caption.replace(/"/g, '&quot;')}"` : '';
      generatedCode = `<video src="${mainUrl}"${titleAttr}></video>\n\n`;
    } else if (modalMediaType === 'audio') {
      const voiceAttr = /\.ogg(\?|$)/i.test(mainUrl) ? ' data-voice="true"' : '';
      const titleAttr = caption ? ` title="${caption.replace(/"/g, '&quot;')}"` : '';
      generatedCode = `<audio src="${mainUrl}"${voiceAttr}${titleAttr}></audio>\n\n`;
    } else {
      generatedCode = caption ? `![${caption}](${mainUrl})\n\n` : `![](${mainUrl})\n\n`;
    }

    onApply(generatedCode);
    onClose();
  };

  const modalContent = ReactDOM.createPortal(
    <div className="fixed inset-0 bg-sky-100/40 backdrop-blur-xs z-[200] flex items-center justify-center p-3 sm:p-4 overflow-y-auto text-left" onClick={onClose}>
      <div 
        style={{
          background: 'linear-gradient(135deg, rgba(224,242,254,0.95) 0%, rgba(252,231,243,0.95) 25%, rgba(254,237,213,0.95) 50%, rgba(252,231,243,0.95) 75%, rgba(224,242,254,0.95) 100%)'
        }}
        className="border-2 border-pink-300 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-pink-300 pb-3">
          <div className="flex items-center space-x-2">
            <ImageIcon size={20} className="text-pink-600" />
            <h3 className="text-[16px] font-extrabold text-slate-900">Конструктор медиаблоков</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900 cursor-pointer p-1">
            <X size={20} />
          </button>
        </div>

        <div className="text-[14px] text-slate-800 bg-white/85 border border-pink-300 p-3.5 rounded-2xl leading-relaxed font-medium">
          В режиме <b>Markdown Rich</b> поддерживаются фото, коллажи <b>&lt;tg-collage&gt;</b>, карусели <b>&lt;tg-slideshow&gt;</b> (включая каскадную ИИ-генерацию в едином стиле), документы <b>&lt;tg-document&gt;</b>, видео и аудио.
        </div>

        <div className="space-y-4 text-[14px]">
          <GradientSelect
            label="Тип медиаконтента"
            value={modalMediaType}
            onChange={(val) => setModalMediaType(val as any)}
            options={[
              { value: 'photo', label: 'Одиночное фото / иллюстрация' },
              { value: 'collage', label: 'Сетка коллажа (фото и видео)' },
              { value: 'slideshow', label: 'Карусель / Слайдер (фото и видео)' },
              { value: 'document', label: 'Документ / файл (<tg-document>)' },
              { value: 'video', label: 'Видеоролик (mp4 / webm)' },
              { value: 'audio', label: 'Аудио или голос (mp3 / ogg)' }
            ]}
          />

          {/* Upload and AI Generation block */}
          {isSingleMedia ? (
            <div className="space-y-3 bg-white/85 p-3.5 rounded-2xl border border-pink-300">
              <label className="text-[14px] font-bold text-slate-900 block">
                Загрузка файла:
              </label>

              <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
                <FileUpload
                  variant="button"
                  multiple={false}
                  accept={
                    modalMediaType === 'photo'
                      ? 'image/*'
                      : modalMediaType === 'video'
                      ? 'video/*'
                      : modalMediaType === 'audio'
                      ? 'audio/*'
                      : '.pdf,.doc,.docx,.txt,.csv,.zip,.xls,.xlsx,application/*,text/*'
                  }
                  buttonLabel="Загрузить файл"
                  className="w-full"
                  onUploaded={(_key, url) => {
                    const finalUrl = formatAbsoluteUrl(url);
                    if (finalUrl) {
                      setModalMediaUrls([finalUrl]);
                    }
                  }}
                  onBatchUploaded={(items) => {
                    const firstUrl = items[0]?.url;
                    const finalUrl = formatAbsoluteUrl(firstUrl);
                    if (finalUrl) {
                      setModalMediaUrls([finalUrl]);
                    }
                  }}
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setRefGalleryCb(null);
                    setIsGalleryOpen(true);
                  }}
                  className="px-4 py-2 bg-white/90 hover:bg-white text-slate-800 border border-pink-300 rounded-xl text-[14px] font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                  title="Выбрать файл из сохраненной галереи"
                >
                  <ImageIcon size={16} className="text-pink-600" />
                  <span>Из галереи</span>
                </button>
                {modalMediaType === 'photo' && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setIsImageBuilderOpen(true)}
                    className="px-4 py-2 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white rounded-xl text-[14px] font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                    title="Генерация картинки через конструктор"
                  >
                    <Sparkles size={16} />
                    <span>Генерация картинки</span>
                  </button>
                )}
              </div>

              {/* Single media URL input */}
              <div className="space-y-1">
                <label className="block text-[14px] font-bold text-slate-700">
                  Прямая ссылка на файл:
                </label>
                <input
                  type="url"
                  value={modalMediaUrls[0] || ''}
                  onChange={(e) => setModalMediaUrls([e.target.value])}
                  onBlur={(e) => {
                    const formatted = formatAbsoluteUrl(e.target.value);
                    if (formatted && formatted !== e.target.value) {
                      setModalMediaUrls([formatted]);
                    }
                  }}
                  placeholder="https://example.com/file"
                  className="w-full bg-white/90 border border-pink-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-[14px]"
                />
              </div>
            </div>
          ) : (
            /* Multi-file Collage / Slideshow Uploader */
            <div className="space-y-3 bg-white/85 p-3.5 rounded-2xl border border-pink-300">
              {modalMediaType === 'slideshow' && (
                <CascadingCarouselPanel
                  userId={currentUserId}
                  onPickRefFromGallery={(cb) => {
                    setRefGalleryCb(() => cb);
                    setIsGalleryOpen(true);
                  }}
                  onSlidesGenerated={(slides) => {
                    if (slides.length > 0) {
                      setModalMediaUrls(slides.map((s) => s.url).slice(0, 10));
                    }
                  }}
                />
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-[14px] font-bold text-slate-900">
                  Массовая загрузка файлов на сервер (до 10 файлов):
                </label>
                <span className="text-[14px] font-mono font-bold text-pink-700 bg-pink-50 px-2.5 py-0.5 rounded-xl border border-pink-300">
                  {modalMediaUrls.filter(u => u && u.trim()).length} / 10 файлов
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <FileUpload
                  variant="button"
                  multiple={true}
                  accept="image/*,video/*"
                  buttonLabel="Массовая загрузка фото и видео до 10 файлов"
                  className="w-full"
                  onBatchUploaded={(items) => {
                    const urls = items.map(i => formatAbsoluteUrl(i.url)).filter(Boolean);
                    if (urls.length > 0) {
                      setModalMediaUrls(prev => {
                        const cleanPrev = prev.filter(u => u && u.trim().length > 0);
                        return [...cleanPrev, ...urls].slice(0, 10);
                      });
                    }
                  }}
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setRefGalleryCb(null);
                    setIsGalleryOpen(true);
                  }}
                  className="px-4 py-2 bg-white/90 hover:bg-white text-slate-800 border border-pink-300 rounded-xl text-[14px] font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                  title="Выбрать фото или видео из сохраненной галереи"
                >
                  <ImageIcon size={16} className="text-pink-600" />
                  <span>Из галереи</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setIsImageBuilderOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white rounded-xl text-[14px] font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                  title="Генерация картинок через конструктор"
                >
                  <Sparkles size={16} />
                  <span>Генерация картинки</span>
                </button>
              </div>

              <FileUpload
                variant="dropzone"
                multiple={true}
                accept="image/*,video/*"
                buttonLabel="Или перетащите фото и видео в эту область (каскадная загрузка)"
                className="w-full"
                onBatchUploaded={(items) => {
                  const urls = items.map(i => formatAbsoluteUrl(i.url)).filter(Boolean);
                  if (urls.length > 0) {
                    setModalMediaUrls(prev => {
                      const cleanPrev = prev.filter(u => u && u.trim().length > 0);
                      return [...cleanPrev, ...urls].slice(0, 10);
                    });
                  }
                }}
              />

              {/* URLs input for collage/slideshow */}
              <div className="space-y-2 pt-1">
                <div className="flex justify-between items-center">
                  <label className="block text-[14px] font-bold text-slate-700">
                    Ссылки на фото и видео:
                  </label>
                  {modalMediaUrls.length < 10 && (
                    <button
                      type="button"
                      onClick={() => setModalMediaUrls(prev => [...prev, ''])}
                      className="text-pink-600 hover:text-pink-700 font-bold text-[14px] bg-white/90 px-3 py-1 rounded-xl border border-pink-300 cursor-pointer"
                    >
                      + Добавить ссылку
                    </button>
                  )}
                </div>

                {modalMediaUrls.map((url, i) => (
                  <div key={i} className="flex items-center space-x-2">
                    <span className="text-[14px] font-mono text-pink-700 font-bold w-6 text-center">{i + 1}.</span>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => {
                        const copy = [...modalMediaUrls];
                        copy[i] = e.target.value;
                        setModalMediaUrls(copy);
                      }}
                      onBlur={(e) => {
                        const formatted = formatAbsoluteUrl(e.target.value);
                        if (formatted && formatted !== e.target.value) {
                          const copy = [...modalMediaUrls];
                          copy[i] = formatted;
                          setModalMediaUrls(copy);
                        }
                      }}
                      placeholder={`https://example.com/file_${i + 1}.jpg`}
                      className="flex-1 bg-white/90 border border-pink-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-[14px]"
                    />
                    {modalMediaUrls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setModalMediaUrls(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-rose-500 hover:text-rose-600 p-2 cursor-pointer bg-white/90 border border-pink-300 rounded-xl"
                        title="Удалить"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Caption */}
          {isSingleMedia && (
            <div>
              <label className="block text-[14px] font-bold text-slate-700 mb-1">Заголовок или подпись к медиафайлу:</label>
              <input
                type="text"
                value={modalMediaCaption}
                onChange={(e) => setModalMediaCaption(e.target.value)}
                placeholder="Например: Анонс обновлений"
                className="w-full bg-white/90 border border-pink-300 rounded-xl px-3 py-2 text-slate-900 font-semibold text-[14px]"
              />
            </div>
          )}

          {/* Modal Live Preview matching post card preview */}
          <div className="bg-white/85 p-4 rounded-2xl border border-pink-300 space-y-2">
            <span className="text-[14px] font-bold text-slate-700 block">
              Предпросмотр:
            </span>
            
            {modalMediaType === 'photo' && (
              <div className="rounded-2xl overflow-hidden bg-white border border-pink-300 p-2 text-center">
                <img
                  src={modalMediaUrls[0] || GALLERY_STOCK_IMAGES[0]}
                  alt="preview"
                  className="w-auto max-w-full max-h-60 object-contain rounded-xl mx-auto shadow-2xs block"
                />
                {modalMediaCaption && modalMediaCaption.trim() && (
                  <div className="text-center text-[14px] text-slate-700 font-medium py-1 px-3">
                    {modalMediaCaption.trim()}
                  </div>
                )}
              </div>
            )}

            {modalMediaType === 'collage' && (() => {
              const validUrls = modalMediaUrls.filter(u => u && u.trim().length > 0);
              const displayUrls = validUrls.length > 0 ? validUrls : [GALLERY_STOCK_IMAGES[0]];
              return (
                <div className="my-2 space-y-1.5 bg-white/90 p-3 rounded-2xl border border-pink-300 shadow-2xs">
                  <div className="text-[14px] text-pink-700 font-mono font-bold flex items-center space-x-1.5">
                    <ImageIcon size={16} />
                    <span>Коллаж ({displayUrls.length} медиа):</span>
                  </div>
                  <div className={`grid gap-1.5 rounded-2xl overflow-hidden ${
                    displayUrls.length <= 1 ? 'grid-cols-1' : displayUrls.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
                  }`}>
                    {displayUrls.map((url, i) => (
                      <div key={i} className="aspect-video bg-white/90 overflow-hidden relative rounded-xl border border-pink-200">
                        {isVideoMediaUrl(url) ? (
                          <video src={url} controls muted playsInline preload="metadata" className="w-full h-full object-cover" />
                        ) : (
                          <img src={url} alt={`collage-${i}`} className="w-full h-full object-cover" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {modalMediaType === 'slideshow' && (() => {
              const validUrls = modalMediaUrls.filter(u => u && u.trim().length > 0);
              const displayUrls = validUrls.length > 0 ? validUrls : [GALLERY_STOCK_IMAGES[0]];
              const activeIdx = (modalSlideIdx % displayUrls.length + displayUrls.length) % displayUrls.length;
              return (
                <div className="my-2 space-y-2 bg-white/90 p-3 rounded-2xl border border-pink-300 shadow-2xs">
                  <div className="flex items-center justify-between text-[14px] text-pink-700 font-mono">
                    <span className="flex items-center space-x-1.5 font-bold">
                      <ImageIcon size={16} />
                      <span>Слайдер фото и видео</span>
                    </span>
                    <span className="bg-pink-100 text-pink-800 px-2.5 py-0.5 rounded-lg border border-pink-200 font-bold text-[14px]">
                      {activeIdx + 1} / {displayUrls.length}
                    </span>
                  </div>
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center border border-pink-200">
                    {isVideoMediaUrl(displayUrls[activeIdx]) ? (
                      <video src={displayUrls[activeIdx]} controls muted playsInline className="w-full h-full object-contain" />
                    ) : (
                      <img src={displayUrls[activeIdx]} alt="slide" className="w-full h-full object-contain" />
                    )}
                    {displayUrls.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setModalSlideIdx(prev => (prev - 1 + displayUrls.length) % displayUrls.length)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-slate-800 p-2 rounded-full cursor-pointer shadow-md border border-pink-200"
                          title="Предыдущий слайд"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalSlideIdx(prev => (prev + 1) % displayUrls.length)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-slate-800 p-2 rounded-full cursor-pointer shadow-md border border-pink-200"
                          title="Следующий слайд"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-2xl bg-white/90 text-slate-800 border border-pink-300 text-[14px] font-bold hover:bg-white cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleInsertMedia}
            className="px-5 py-2 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white text-[14px] font-extrabold hover:opacity-95 cursor-pointer shadow-2xs border-2 border-pink-400"
          >
            Вставить медиа
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {modalContent}
      {isImageBuilderOpen && (
        <ImageBuilderModal
          isOpen={isImageBuilderOpen}
          onClose={() => setIsImageBuilderOpen(false)}
          title="Генерация картинки"
          editorFormat="rich"
          defaultTargetMode={modalMediaType}
          initialPrompt={aiGenPrompt}
          userId={localStorage.getItem('currentUser') ? (JSON.parse(localStorage.getItem('currentUser') || '{}').telegramId || JSON.parse(localStorage.getItem('currentUser') || '{}').id) : '16926299042'}
          onSelectImage={(url) => {
            if (modalMediaType === 'photo') {
              setModalMediaUrls([url]);
            } else {
              setModalMediaUrls(prev => {
                const clean = prev.filter(u => u && u.trim() && !u.includes('photo-1507525428034-b723cf961d3e'));
                return Array.from(new Set([...clean, url])).slice(0, 10);
              });
            }
            setIsImageBuilderOpen(false);
          }}
          onSelectImages={(urls, targetMode) => {
            if (targetMode === 'slideshow' || targetMode === 'collage') {
              setModalMediaType(targetMode);
              setModalMediaUrls(prev => {
                const clean = prev.filter(u => u && u.trim() && !u.includes('photo-1507525428034-b723cf961d3e'));
                return Array.from(new Set([...clean, ...urls])).slice(0, 10);
              });
            } else {
              setModalMediaType('photo');
              setModalMediaUrls([urls[0]]);
            }
            setIsImageBuilderOpen(false);
          }}
        />
      )}
      {isGalleryOpen && (
        <GallerySelectModal
          isOpen={isGalleryOpen}
          onClose={() => {
            setIsGalleryOpen(false);
            setRefGalleryCb(null);
          }}
          multiple={!refGalleryCb && (modalMediaType === 'collage' || modalMediaType === 'slideshow')}
          allowedMediaTypes={
            refGalleryCb
              ? 'images'
              : modalMediaType === 'photo'
              ? 'images'
              : isSingleMedia
              ? 'all'
              : 'images_and_videos'
          }
          title={
            refGalleryCb
              ? 'Выбор референса из галереи'
              : isSingleMedia
              ? 'Выбор файла из галереи'
              : 'Выбор фото и видео из галереи'
          }
          userId={currentUserId}
          onSelect={(selected) => {
            const rawUrls = Array.isArray(selected) ? selected : [selected];
            const urls = rawUrls.map(u => formatAbsoluteUrl(u)).filter(Boolean);
            if (refGalleryCb && urls[0]) {
              refGalleryCb(urls[0]);
            } else if (urls.length > 0) {
              if (isSingleMedia) {
                if (urls[0]) {
                  setModalMediaUrls([urls[0]]);
                }
              } else {
                setModalMediaUrls(prev => {
                  const clean = prev.filter(u => u && u.trim());
                  return [...clean, ...urls].slice(0, 10);
                });
              }
            }
            setIsGalleryOpen(false);
            setRefGalleryCb(null);
          }}
        />
      )}
    </>
  );
};

// Aliases for Carousel & Collage that open the Media constructor in the right tab
export const ChatCarouselModal: React.FC<BaseModalProps & { onApply: (t: string) => void }> = (props) => (
  <ChatMediaModal {...props} initialType="slideshow" />
);

export const ChatCollageModal: React.FC<BaseModalProps & { onApply: (t: string) => void }> = (props) => (
  <ChatMediaModal {...props} initialType="collage" />
);

// =========================================================================
// MODAL 3: TABLE CONSTRUCTOR (DYNAMIC ANY COLUMNS & EXPANDING MODAL)
// В точности из PostTelegramEditor.tsx lines 8071-8298
// =========================================================================
export interface ChatTableModalProps extends BaseModalProps {
  onApply: (formattedText: string) => void;
}

export const ChatTableModal: React.FC<ChatTableModalProps> = ({
  isOpen,
  onClose,
  onApply
}) => {
  const [tableCols, setTableCols] = useState<number>(3);
  const [tableHeaders, setTableHeaders] = useState<string[]>(['Колонка 1', 'Колонка 2', 'Колонка 3']);
  const [tableAlignments, setTableAlignments] = useState<('left' | 'center' | 'right')[]>(['left', 'left', 'left']);
  const [tableRows, setTableRows] = useState<string[][]>([
    ['Значение 1.1', 'Значение 1.2', 'Значение 1.3'],
    ['Значение 2.1', 'Значение 2.2', 'Значение 2.3']
  ]);

  if (!isOpen) return null;

  const handleAddTableColumn = () => {
    if (tableCols >= 10) return;
    const nextCol = tableCols + 1;
    setTableCols(nextCol);
    setTableHeaders(prev => [...prev, `Колонка ${nextCol}`]);
    setTableAlignments(prev => [...prev, 'left']);
    setTableRows(prev => prev.map((row, rIdx) => [...row, `Значение ${rIdx + 1}.${nextCol}`]));
  };

  const handleRemoveTableColumn = (colIdxToRemove?: number) => {
    if (tableCols <= 1) return;
    const idx = colIdxToRemove !== undefined ? colIdxToRemove : tableCols - 1;
    setTableCols(prev => prev - 1);
    setTableHeaders(prev => prev.filter((_, i) => i !== idx));
    setTableAlignments(prev => prev.filter((_, i) => i !== idx));
    setTableRows(prev => prev.map(row => row.filter((_, i) => i !== idx)));
  };

  const handleAddTableRow = () => {
    const nextRowIdx = tableRows.length + 1;
    const newRow = Array.from({ length: tableCols }, (_, i) => `Значение ${nextRowIdx}.${i + 1}`);
    setTableRows(prev => [...prev, newRow]);
  };

  const handleRemoveTableRow = (rowIndex: number) => {
    if (tableRows.length <= 1) return;
    setTableRows(prev => prev.filter((_, i) => i !== rowIndex));
  };

  const handleInsertTable = () => {
    if (tableCols === 0) return;
    const headers = Array.from({ length: tableCols }, (_, i) => (tableHeaders[i] || `Колонка ${i + 1}`).trim());
    let alignRow = '|';
    for (let i = 0; i < tableCols; i++) {
      const align = tableAlignments[i] || 'left';
      if (align === 'center') alignRow += ' :---: |';
      else if (align === 'right') alignRow += ' ---: |';
      else alignRow += ' :--- |';
    }

    let tableMd = `\n| ${headers.join(' | ')} |\n${alignRow}\n`;
    tableRows.forEach((row, rIdx) => {
      const cells = Array.from({ length: tableCols }, (_, cIdx) => (row[cIdx] !== undefined ? row[cIdx] : `Значение ${rIdx + 1}.${cIdx + 1}`).trim());
      tableMd += `| ${cells.join(' | ')} |\n`;
    });

    onApply(tableMd);
    onClose();
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-sky-950/20 backdrop-blur-md z-[200] flex items-center justify-center p-3 sm:p-4 overflow-y-auto text-left" onClick={onClose}>
      <div 
        className={`bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 border border-pink-300 rounded-3xl w-full p-4 md:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto backdrop-blur-md transition-all duration-200 ${
          tableCols <= 2 ? 'max-w-xl' : tableCols <= 4 ? 'max-w-3xl' : tableCols <= 6 ? 'max-w-5xl' : 'max-w-7xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-pink-200 pb-3">
          <div className="flex items-center space-x-2">
            <TableIcon size={20} className="text-pink-600" />
            <h3 className="text-[16px] font-extrabold text-slate-900">Редактор таблиц</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900 cursor-pointer p-1 rounded-lg hover:bg-white/60">
            <X size={18} />
          </button>
        </div>

        {/* Column count and row actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white/80 p-3 rounded-2xl border border-pink-200">
          <div className="flex items-center space-x-2">
            <span className="text-[14px] font-bold text-slate-700">Количество колонок:</span>
            <div className="flex items-center border border-pink-300 rounded-xl bg-white overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => handleRemoveTableColumn()}
                disabled={tableCols <= 1}
                className="px-2.5 py-1 text-slate-700 hover:bg-pink-100 disabled:opacity-40 font-extrabold cursor-pointer transition-all"
                title="Уменьшить колонки"
              >
                -
              </button>
              <span className="px-3 py-1 font-mono font-extrabold text-[14px] text-pink-700 bg-pink-50/50 min-w-[3rem] text-center">
                {tableCols}
              </span>
              <button
                type="button"
                onClick={() => handleAddTableColumn()}
                disabled={tableCols >= 10}
                className="px-2.5 py-1 text-slate-700 hover:bg-pink-100 disabled:opacity-40 font-extrabold cursor-pointer transition-all"
                title="Увеличить колонки"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleAddTableColumn()}
              className="px-3 py-1.5 bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white rounded-xl text-[14px] font-bold cursor-pointer shadow-2xs hover:opacity-95 transition-all"
            >
              + Колонка
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleAddTableRow}
              className="px-3 py-1.5 bg-white/90 hover:bg-white text-slate-800 border border-pink-300 rounded-xl text-[14px] font-bold cursor-pointer shadow-2xs transition-all"
            >
              + Добавить строку
            </button>
          </div>
        </div>

        {/* Table Editing Area with dynamic scroll */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[14px] font-bold text-slate-800">
            <span>Заголовки колонок и выравнивание:</span>
            <span className="text-[12px] font-mono text-slate-500">Колонок: {tableCols} | Строк: {tableRows.length}</span>
          </div>

          <div className="overflow-x-auto pb-2 -mx-1 px-1 rounded-2xl border border-pink-200 bg-white/60 p-3">
            <div className="min-w-max space-y-2">
              {/* Column Headers & Alignments */}
              <div className="flex items-start gap-2">
                <div className="w-8 pt-2 text-[12px] font-mono text-slate-400 font-bold shrink-0 text-center">
                  #
                </div>
                {Array.from({ length: tableCols }, (_, i) => (
                  <div key={i} className="min-w-[150px] flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <input
                        type="text"
                        value={tableHeaders[i] || `Колонка ${i + 1}`}
                        onChange={(e) => {
                          const copy = [...tableHeaders];
                          while (copy.length <= i) copy.push(`Колонка ${copy.length + 1}`);
                          copy[i] = e.target.value;
                          setTableHeaders(copy);
                        }}
                        className="w-full bg-white border border-pink-300 rounded-xl px-2.5 py-1.5 text-slate-900 text-[14px] font-bold shadow-2xs focus:ring-2 focus:ring-pink-300"
                        placeholder={`Колонка ${i + 1}`}
                      />
                      {tableCols > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTableColumn(i)}
                          className="text-rose-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="Удалить эту колонку"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {/* Alignment buttons */}
                    <div className="flex items-center justify-center gap-1 bg-white/90 p-1 rounded-xl border border-pink-200 text-[12px]">
                      {(['left', 'center', 'right'] as const).map(align => (
                        <button
                          key={align}
                          type="button"
                          onClick={() => {
                            const copy = [...tableAlignments];
                            while (copy.length <= i) copy.push('left');
                            copy[i] = align;
                            setTableAlignments(copy);
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[12px] font-bold cursor-pointer transition-all ${
                            (tableAlignments[i] || 'left') === align
                              ? 'bg-gradient-to-r from-sky-400 to-pink-500 text-white shadow-2xs'
                              : 'text-slate-600 hover:bg-pink-50'
                          }`}
                          title={`Выравнивание: ${align === 'left' ? 'по левому краю' : align === 'center' ? 'по центру' : 'по правому краю'}`}
                        >
                          {align === 'left' ? '←' : align === 'center' ? '↔' : '→'}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="w-8 shrink-0" />
              </div>

              {/* Rows */}
              {tableRows.map((row, rIdx) => (
                <div key={rIdx} className="flex items-center gap-2">
                  <div className="w-8 text-[12px] font-mono text-slate-500 font-bold shrink-0 text-center">
                    {rIdx + 1}
                  </div>
                  {Array.from({ length: tableCols }, (_, cIdx) => (
                    <div key={cIdx} className="min-w-[150px] flex-1">
                      <input
                        type="text"
                        value={row[cIdx] !== undefined ? row[cIdx] : `Значение ${rIdx + 1}.${cIdx + 1}`}
                        onChange={(e) => {
                          const copy = tableRows.map(r => [...r]);
                          while (copy[rIdx].length <= cIdx) copy[rIdx].push(`Значение ${rIdx + 1}.${copy[rIdx].length + 1}`);
                          copy[rIdx][cIdx] = e.target.value;
                          setTableRows(copy);
                        }}
                        className="w-full bg-white border border-pink-200 rounded-xl px-2.5 py-1.5 text-slate-900 text-[14px] font-medium shadow-2xs focus:ring-2 focus:ring-pink-300"
                        placeholder={`Ячейка ${rIdx + 1}.${cIdx + 1}`}
                      />
                    </div>
                  ))}
                  <div className="w-8 shrink-0 flex items-center justify-center">
                    {tableRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTableRow(rIdx)}
                        className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-pink-100 cursor-pointer"
                        title="Удалить строку"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Table Preview */}
        <div className="bg-white/85 p-3.5 rounded-2xl border border-pink-200 space-y-2">
          <span className="text-[13px] text-pink-700 font-bold block">Предпросмотр таблицы:</span>
          <div className="overflow-x-auto pb-1">
            <table className="w-full text-[14px] border-collapse border border-pink-200 min-w-max">
              <thead>
                <tr className="bg-gradient-to-r from-sky-100 to-pink-100 text-slate-900 font-extrabold">
                  {Array.from({ length: tableCols }, (_, i) => (
                    <th
                      key={i}
                      className="p-2 border border-pink-200 font-bold min-w-[120px]"
                      style={{ textAlign: tableAlignments[i] || 'left' }}
                    >
                      {tableHeaders[i] || `Колонка ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, rIdx) => (
                  <tr key={rIdx} className="border-t border-pink-200 text-slate-800">
                    {Array.from({ length: tableCols }, (_, cIdx) => (
                      <td
                        key={cIdx}
                        className="p-2 border border-pink-200 min-w-[120px]"
                        style={{ textAlign: tableAlignments[cIdx] || 'left' }}
                      >
                        {row[cIdx] !== undefined ? row[cIdx] : `Значение ${rIdx + 1}.${cIdx + 1}`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-2 border-t border-pink-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-2xl bg-white/90 text-slate-700 border border-pink-200 text-[14px] font-bold hover:bg-pink-50 cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleInsertTable}
            className="px-5 py-2 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white text-[14px] font-extrabold hover:opacity-95 cursor-pointer shadow-2xs"
          >
            Вставить таблицу
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// =========================================================================
// MODAL 4: EMOJI, TIME & LATEX CONSTRUCTOR
// В точности из PostTelegramEditor.tsx lines 8301-8509
// =========================================================================
export interface ChatEmojiTimeModalProps extends BaseModalProps {
  initialTab?: 'emoji' | 'time' | 'latex';
  onApply: (formattedText: string) => void;
}

export const ChatEmojiTimeModal: React.FC<ChatEmojiTimeModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'emoji',
  onApply
}) => {
  const [emojiTimeTab, setEmojiTimeTab] = useState<'emoji' | 'time' | 'latex'>(initialTab);
  const [emojiId, setEmojiId] = useState<string>('5368324170671202287');
  const [emojiAlt, setEmojiAlt] = useState<string>('🔥');
  const [timeString, setTimeString] = useState<string>('');
  const [timeFormat, setTimeFormat] = useState<string>('wDT');
  const [latexFormula, setLatexFormula] = useState<string>('E = mc^2');

  useEffect(() => {
    if (isOpen) {
      setEmojiTimeTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleInsertEmojiTime = () => {
    let generated = '';
    if (emojiTimeTab === 'emoji') {
      const id = emojiId || '5368324170671202287';
      const alt = emojiAlt || '🔥';
      generated = `![${alt}](tg://emoji?id=${id})`;
    } else if (emojiTimeTab === 'time') {
      const dateObj = timeString ? new Date(timeString) : new Date();
      const unixTime = Math.floor(dateObj.getTime() / 1000);
      const displayLabel = dateObj.toLocaleString('ru-RU', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
      generated = `<tg-time unix="${unixTime}" format="${timeFormat}">${displayLabel}</tg-time>`;
    } else if (emojiTimeTab === 'latex') {
      generated = `$${latexFormula || 'E = mc^2'}$`;
    }
    onApply(generated);
    onClose();
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-sky-950/20 backdrop-blur-md z-[200] flex items-center justify-center p-3 sm:p-4 overflow-y-auto text-left" onClick={onClose}>
      <div 
        className="bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 border border-pink-300 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-pink-200 pb-3">
          <div className="flex items-center space-x-2">
            <Sparkles size={18} className="text-pink-600" />
            <h3 className="text-[14px] font-extrabold text-slate-900">Эмодзи, Время и LaTeX</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="flex bg-white/80 p-1 rounded-xl border border-pink-200 text-[14px] font-extrabold">
          <button
            type="button"
            onClick={() => setEmojiTimeTab('emoji')}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
              emojiTimeTab === 'emoji' 
                ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-2xs' 
                : 'text-slate-600'
            }`}
          >
            Премиум Эмодзи
          </button>
          <button
            type="button"
            onClick={() => setEmojiTimeTab('time')}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
              emojiTimeTab === 'time' 
                ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-2xs' 
                : 'text-slate-600'
            }`}
          >
            Динамич. Время
          </button>
          <button
            type="button"
            onClick={() => setEmojiTimeTab('latex')}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
              emojiTimeTab === 'latex' 
                ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-2xs' 
                : 'text-slate-600'
            }`}
          >
            LaTeX
          </button>
        </div>

        <div className="space-y-3 text-[14px]">
          {emojiTimeTab === 'emoji' && (
            <>
              <div className="bg-white/80 border border-pink-200 p-3.5 rounded-xl text-[12px] text-slate-800 leading-relaxed space-y-2">
                <span className="font-extrabold text-pink-700 block">💡 Как получить Telegram Emoji ID:</span>
                <p>1. Отправьте кастомный эмодзи или стикер боту:</p>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <a
                    href="https://t.me/IIrkiBot"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-gradient-to-r from-sky-100 to-pink-100 text-pink-700 hover:text-pink-800 rounded-lg font-mono text-[14px] font-bold flex items-center space-x-1 border border-pink-300"
                  >
                    <span>🤖 @IIrkiBot</span>
                  </a>
                </div>
                <p>2. Бот мгновенно пришлет ID эмодзи и готовый код для вставки.</p>
              </div>
              <div>
                <label className="block text-[12px] font-mono text-slate-600 uppercase mb-1">ID Telegram Custom Emoji или tg:// URL:</label>
                <input
                  type="text"
                  value={emojiId}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    if (val.includes('id=')) {
                      const extracted = val.split('id=')[1]?.split('&')[0];
                      if (extracted) setEmojiId(extracted);
                      else setEmojiId(val);
                    } else {
                      setEmojiId(val);
                    }
                  }}
                  placeholder="5368324170671202287"
                  className="w-full bg-white/90 border border-pink-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-[14px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-mono text-slate-600 uppercase mb-1">Символ подмены (Alt):</label>
                <input
                  type="text"
                  value={emojiAlt}
                  onChange={(e) => setEmojiAlt(e.target.value)}
                  placeholder="🔥"
                  className="w-full bg-white/90 border border-pink-200 rounded-xl px-3 py-2 text-slate-900 text-lg font-bold"
                />
              </div>
              <div className="bg-white/80 p-3 rounded-xl border border-pink-200 space-y-1">
                <span className="text-[12px] font-mono text-slate-500 uppercase block mb-1">Предпросмотр тега:</span>
                <code className="text-pink-700 font-mono font-bold text-[13px] block">{`![${emojiAlt}](tg://emoji?id=${emojiId})`}</code>
              </div>
            </>
          )}

          {emojiTimeTab === 'time' && (
            <>
              <div>
                <label className="block text-[12px] font-mono text-slate-600 uppercase mb-1">Дата и время публикации:</label>
                <input
                  type="datetime-local"
                  value={timeString}
                  onChange={(e) => setTimeString(e.target.value)}
                  className="w-full bg-white/90 border border-pink-200 rounded-xl px-3 py-2 text-slate-900 font-mono font-semibold text-[14px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-mono text-slate-600 uppercase mb-1">Формат отображения:</label>
                <select
                  value={timeFormat}
                  onChange={(e) => setTimeFormat(e.target.value)}
                  className="w-full bg-white/90 border border-pink-200 rounded-xl px-3 py-2 text-slate-900 font-semibold text-[14px]"
                >
                  <option value="wDT">Вторник, 15:00 (Полный со днем недели)</option>
                  <option value="d">22.07.2026 (Краткая дата)</option>
                  <option value="t">15:00 (Только время)</option>
                  <option value="R">Относительное время (через 2 часа)</option>
                </select>
              </div>
              <div className="bg-white/80 p-3 rounded-xl border border-pink-200">
                <span className="text-[12px] font-mono text-slate-500 uppercase block mb-1">Предпросмотр &lt;tg-time&gt;:</span>
                <div className="text-pink-700 font-extrabold flex items-center space-x-1.5 text-[14px]">
                  <Clock size={16} />
                  <span>{new Date(timeString || Date.now()).toLocaleString('ru-RU', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </>
          )}

          {emojiTimeTab === 'latex' && (
            <>
              <div>
                <label className="block text-[12px] font-mono text-slate-600 uppercase mb-1">Инженерная панель символов:</label>
                <div className="flex flex-wrap gap-1 bg-white/80 p-2 rounded-xl border border-pink-200 mb-2">
                  {[
                    { label: 'a/b', sym: '\\frac{a}{b}' },
                    { label: '√x', sym: '\\sqrt{x}' },
                    { label: 'x²', sym: 'x^2' },
                    { label: 'xᵢ', sym: 'x_i' },
                    { label: '∫', sym: '\\int_{a}^{b}' },
                    { label: '∑', sym: '\\sum_{i=1}^{n}' },
                    { label: 'lim', sym: '\\lim_{x \\to \\infty}' },
                    { label: 'π', sym: '\\pi' },
                    { label: 'α', sym: '\\alpha' },
                    { label: 'β', sym: '\\beta' },
                    { label: '∞', sym: '\\infty' },
                    { label: '±', sym: '\\pm' },
                    { label: '≈', sym: '\\approx' },
                    { label: '≠', sym: '\\neq' },
                    { label: '≤', sym: '\\le' },
                    { label: '≥', sym: '\\ge' }
                  ].map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setLatexFormula(prev => prev ? `${prev} ${item.sym}` : item.sym)}
                      className="px-2 py-1 bg-white border border-pink-200 hover:bg-pink-50 rounded text-pink-700 font-mono text-[12px] font-bold cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-mono text-slate-600 uppercase mb-1">Формула LaTeX:</label>
                <input
                  type="text"
                  value={latexFormula}
                  onChange={(e) => setLatexFormula(e.target.value)}
                  placeholder="E = mc^2"
                  className="w-full bg-white/90 border border-pink-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-[14px]"
                />
              </div>
              <div className="bg-white/80 p-3 rounded-xl border border-pink-200">
                <span className="text-[12px] font-mono text-slate-500 uppercase block mb-1">Рендеринг формулы:</span>
                <RenderMathPreview formula={latexFormula} />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/80 text-slate-700 border border-pink-200 text-[14px] font-bold hover:bg-white cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleInsertEmojiTime}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white text-[14px] font-extrabold hover:opacity-95 cursor-pointer shadow-2xs"
          >
            Вставить
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// =========================================================================
// MODAL: FORMULA & REGISTER CONSTRUCTOR
// В точности из PostTelegramEditor.tsx lines 8740-8895
// =========================================================================
export interface ChatFormulaModalProps extends BaseModalProps {
  initialText?: string;
  onApply: (formattedText: string) => void;
}

export const ChatFormulaModal: React.FC<ChatFormulaModalProps> = ({
  isOpen,
  onClose,
  initialText = '',
  onApply
}) => {
  const [formulaMode, setFormulaMode] = useState<'inline' | 'block' | 'sub_sup'>('inline');
  const [formulaInput, setFormulaInput] = useState<string>(initialText || 'E = mc^2');
  const [subSupType, setSubSupType] = useState<'sup' | 'sub'>('sup');
  const [subSupBase, setSubSupBase] = useState<string>('x');
  const [subSupIndex, setSubSupIndex] = useState<string>('2');

  useEffect(() => {
    if (isOpen && initialText) {
      setFormulaInput(initialText);
    }
  }, [isOpen, initialText]);

  if (!isOpen) return null;

  const handleInsertFormula = () => {
    let generated = '';
    if (formulaMode === 'inline') {
      generated = `$${formulaInput || 'E = mc^2'}$`;
    } else if (formulaMode === 'block') {
      generated = `\n$$\n${formulaInput || 'E = mc^2'}\n$$\n`;
    } else if (formulaMode === 'sub_sup') {
      const base = subSupBase || 'x';
      const idx = subSupIndex || '2';
      if (subSupType === 'sup') {
        generated = `${base}<sup>${idx}</sup>`;
      } else {
        generated = `${base}<sub>${idx}</sub>`;
      }
    }
    onApply(generated);
    onClose();
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-sky-950/20 backdrop-blur-md z-[200] flex items-center justify-center p-3 sm:p-4 overflow-y-auto text-left" onClick={onClose}>
      <div 
        className="bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 border border-pink-300 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-pink-200 pb-3">
          <div className="flex items-center space-x-2">
            <span className="text-pink-600 font-extrabold text-base">∑</span>
            <h3 className="text-[14px] font-extrabold text-slate-900">Конструктор математических формул</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-3 gap-1 bg-white/80 p-1 rounded-2xl border border-pink-200 text-[14px] font-bold">
          <button
            type="button"
            onClick={() => setFormulaMode('inline')}
            className={`py-1.5 rounded-xl transition-all cursor-pointer ${
              formulaMode === 'inline'
                ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-2xs'
                : 'text-slate-700 hover:bg-pink-50'
            }`}
          >
            Встроенная ($...$)
          </button>
          <button
            type="button"
            onClick={() => setFormulaMode('block')}
            className={`py-1.5 rounded-xl transition-all cursor-pointer ${
              formulaMode === 'block'
                ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-2xs'
                : 'text-slate-700 hover:bg-pink-50'
            }`}
          >
            Блок ($$...$$)
          </button>
          <button
            type="button"
            onClick={() => setFormulaMode('sub_sup')}
            className={`py-1.5 rounded-xl transition-all cursor-pointer ${
              formulaMode === 'sub_sup'
                ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-2xs'
                : 'text-slate-700 hover:bg-pink-50'
            }`}
          >
            Индекс (x² / x₂)
          </button>
        </div>

        {formulaMode !== 'sub_sup' ? (
          <div className="space-y-3">
            <div>
              <label className="block text-[14px] font-bold text-slate-800 mb-1">
                {formulaMode === 'inline' ? 'Текст или LaTeX формула:' : 'Блочная формула (многострочная):'}
              </label>
              <textarea
                rows={formulaMode === 'block' ? 3 : 2}
                value={formulaInput}
                onChange={(e) => setFormulaInput(e.target.value)}
                placeholder="E = mc^2 или \frac{-b \pm \sqrt{D}}{2a}"
                className="w-full bg-white/90 border border-pink-200 rounded-2xl px-3.5 py-2.5 text-slate-900 font-mono text-[14px] focus:outline-hidden focus:ring-2 focus:ring-pink-300"
              />
            </div>

            {/* Quick Math Symbols */}
            <div>
              <span className="text-[13px] text-slate-600 font-bold block mb-1">Быстрая вставка символов:</span>
              <div className="flex flex-wrap gap-1">
                {['±', '≈', '≠', '≤', '≥', '√', '∫', '∑', 'π', '∞', 'α', 'β', 'γ', '\\frac{a}{b}', 'x^2', 'x_2'].map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => setFormulaInput((prev) => prev + (sym.includes('\\') ? ` ${sym} ` : sym))}
                    className="px-2 py-0.5 bg-white/90 hover:bg-pink-100 border border-pink-200 rounded-lg text-slate-800 font-mono text-[14px] cursor-pointer shadow-2xs"
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white/80 p-3 rounded-2xl border border-pink-200">
              <span className="text-[12px] font-mono text-slate-500 uppercase block mb-1">Рендеринг:</span>
              <RenderMathPreview formula={formulaInput || 'E = mc^2'} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSubSupType('sup')}
                className={`flex-1 py-1.5 rounded-xl border text-[14px] font-bold cursor-pointer transition-all ${
                  subSupType === 'sup'
                    ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white border-pink-400'
                    : 'bg-white/90 border-pink-200 text-slate-800'
                }`}
              >
                Верхний индекс (x²)
              </button>
              <button
                type="button"
                onClick={() => setSubSupType('sub')}
                className={`flex-1 py-1.5 rounded-xl border text-[14px] font-bold cursor-pointer transition-all ${
                  subSupType === 'sub'
                    ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white border-pink-400'
                    : 'bg-white/90 border-pink-200 text-slate-800'
                }`}
              >
                Нижний индекс (x₂)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[14px] font-bold text-slate-800 mb-1">База:</label>
                <input
                  type="text"
                  value={subSupBase}
                  onChange={(e) => setSubSupBase(e.target.value)}
                  placeholder="x"
                  className="w-full bg-white/90 border border-pink-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-[14px]"
                />
              </div>
              <div>
                <label className="block text-[14px] font-bold text-slate-800 mb-1">Индекс:</label>
                <input
                  type="text"
                  value={subSupIndex}
                  onChange={(e) => setSubSupIndex(e.target.value)}
                  placeholder="2"
                  className="w-full bg-white/90 border border-pink-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-[14px]"
                />
              </div>
            </div>

            <div className="bg-white/80 p-3 rounded-2xl border border-pink-200 text-center">
              <span className="text-[12px] font-mono text-slate-500 uppercase block mb-1">Предпросмотр:</span>
              <span className="font-mono text-xl font-bold text-slate-900">
                {subSupBase}
                {subSupType === 'sup' ? (
                  <sup className="text-pink-600 align-super ml-0.5">{subSupIndex}</sup>
                ) : (
                  <sub className="text-sky-600 align-sub ml-0.5">{subSupIndex}</sub>
                )}
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-2 pt-1 border-t border-pink-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/80 text-slate-700 border border-pink-200 text-[14px] font-bold hover:bg-white cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleInsertFormula}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white text-[14px] font-extrabold hover:opacity-95 cursor-pointer shadow-2xs"
          >
            Вставить формулу
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// =========================================================================
// MODAL 5: ANCHORS, NAVIGATION & FOOTNOTES CONSTRUCTOR
// В точности из PostTelegramEditor.tsx lines 8513-8735
// =========================================================================
export interface ChatAnchorModalProps extends BaseModalProps {
  initialText?: string;
  initialTab?: 'create' | 'link' | 'tg_ref' | 'footnote';
  onApply: (formattedText: string) => void;
}

export const ChatAnchorModal: React.FC<ChatAnchorModalProps> = ({
  isOpen,
  onClose,
  initialText = '',
  initialTab = 'create',
  onApply
}) => {
  const [anchorTab, setAnchorTab] = useState<'create' | 'link' | 'tg_ref' | 'footnote'>(initialTab);
  const [anchorName, setAnchorName] = useState<string>('chapter-1');
  const [anchorLabel, setAnchorLabel] = useState<string>(initialText || 'Перейти к разделу');
  const [tgRefName, setTgRefName] = useState<string>('note-1');
  const [tgRefText, setTgRefText] = useState<string>(initialText || 'Текст');
  const [footnoteRef, setFootnoteRef] = useState<string>('1');
  const [footnoteText, setFootnoteText] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setAnchorTab(initialTab);
      if (initialText) {
        setAnchorLabel(initialText);
        setTgRefText(initialText);
      }
    }
  }, [isOpen, initialTab, initialText]);

  if (!isOpen) return null;

  const handleInsertAnchor = () => {
    let generated = '';
    if (anchorTab === 'create') {
      const id = (anchorName || 'chapter-1').trim();
      generated = `<a id="${id}"></a>\n`;
    } else if (anchorTab === 'link') {
      const id = (anchorName || 'chapter-1').trim();
      const label = (anchorLabel || 'Перейти к разделу').trim();
      generated = `<a href="#${id}">${label}</a>`;
    } else if (anchorTab === 'tg_ref') {
      const ref = (tgRefName || 'note-1').trim();
      const txt = (tgRefText || 'Текст').trim();
      generated = `<tg-reference name="${ref}">${txt}</tg-reference>`;
    } else if (anchorTab === 'footnote') {
      const ref = (footnoteRef || '1').trim();
      const txt = (footnoteText || '').trim();
      generated = `[^${ref}]` + (txt ? `\n\n[^${ref}]: ${txt}` : '');
    }
    onApply(generated);
    onClose();
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-sky-950/20 backdrop-blur-md z-[200] flex items-center justify-center p-3 sm:p-4 overflow-y-auto text-left" onClick={onClose}>
      <div 
        className="bg-gradient-to-r from-sky-50/95 via-pink-50/95 via-orange-50/95 via-pink-50/95 to-sky-50/95 border border-pink-300 rounded-3xl max-w-lg w-full p-4 md:p-6 shadow-2xl space-y-4 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-pink-200 pb-3">
          <div className="flex items-center space-x-2">
            <LinkIcon size={20} className="text-pink-600" />
            <h3 className="text-[16px] font-extrabold text-slate-900">Якоря, ссылки и сноски</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900 cursor-pointer p-1 rounded-lg hover:bg-white/60">
            <X size={18} />
          </button>
        </div>

        {/* Navigation tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-white/80 p-1.5 rounded-2xl border border-pink-200 text-[14px] font-bold">
          <button
            type="button"
            onClick={() => setAnchorTab('create')}
            className={`py-2 px-2 text-center rounded-xl transition-all cursor-pointer ${
              anchorTab === 'create'
                ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-2xs'
                : 'text-slate-700 hover:bg-pink-50'
            }`}
          >
            Якорь
          </button>
          <button
            type="button"
            onClick={() => setAnchorTab('link')}
            className={`py-2 px-2 text-center rounded-xl transition-all cursor-pointer ${
              anchorTab === 'link'
                ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-2xs'
                : 'text-slate-700 hover:bg-pink-50'
            }`}
          >
            Ссылка
          </button>
          <button
            type="button"
            onClick={() => setAnchorTab('tg_ref')}
            className={`py-2 px-2 text-center rounded-xl transition-all cursor-pointer ${
              anchorTab === 'tg_ref'
                ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-2xs'
                : 'text-slate-700 hover:bg-pink-50'
            }`}
          >
            Реф-ссылка
          </button>
          <button
            type="button"
            onClick={() => setAnchorTab('footnote')}
            className={`py-2 px-2 text-center rounded-xl transition-all cursor-pointer ${
              anchorTab === 'footnote'
                ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-2xs'
                : 'text-slate-700 hover:bg-pink-50'
            }`}
          >
            Сноска
          </button>
        </div>

        <div className="space-y-3 text-[14px]">
          {/* Tab 1: Create anchor */}
          {anchorTab === 'create' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[14px] font-bold text-slate-800 mb-1">Имя якоря (id без решётки):</label>
                <input
                  type="text"
                  value={anchorName}
                  onChange={(e) => setAnchorName(e.target.value)}
                  placeholder="chapter-1"
                  className="w-full bg-white border border-pink-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-[14px]"
                />
              </div>
              <div className="bg-white/80 p-3 rounded-2xl border border-pink-200">
                <span className="text-[13px] text-pink-700 font-bold block mb-1">Генерируемый код:</span>
                <code className="text-pink-700 font-mono font-bold text-[14px]">{`<a id="${anchorName || 'chapter-1'}"></a>`}</code>
              </div>
            </div>
          )}

          {/* Tab 2: Link to anchor */}
          {anchorTab === 'link' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[14px] font-bold text-slate-800 mb-1">ID якоря для перехода:</label>
                <input
                  type="text"
                  value={anchorName}
                  onChange={(e) => setAnchorName(e.target.value)}
                  placeholder="chapter-1"
                  className="w-full bg-white border border-pink-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-[14px]"
                />
              </div>
              <div>
                <label className="block text-[14px] font-bold text-slate-800 mb-1">Текст ссылки:</label>
                <input
                  type="text"
                  value={anchorLabel}
                  onChange={(e) => setAnchorLabel(e.target.value)}
                  placeholder="Перейти к разделу"
                  className="w-full bg-white border border-pink-200 rounded-xl px-3 py-2 text-slate-900 font-medium text-[14px]"
                />
              </div>
              <div className="bg-white/80 p-3 rounded-2xl border border-pink-200">
                <span className="text-[13px] text-pink-700 font-bold block mb-1">Предпросмотр:</span>
                <a href={`#${anchorName || 'chapter-1'}`} className="text-pink-600 underline font-bold text-[14px]">
                  {anchorLabel || 'Перейти к разделу'}
                </a>
              </div>
            </div>
          )}

          {/* Tab 3: Telegram Ref link */}
          {anchorTab === 'tg_ref' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[14px] font-bold text-slate-800 mb-1">Имя референса (name):</label>
                <input
                  type="text"
                  value={tgRefName}
                  onChange={(e) => setTgRefName(e.target.value)}
                  placeholder="note-1"
                  className="w-full bg-white border border-pink-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-[14px]"
                />
              </div>
              <div>
                <label className="block text-[14px] font-bold text-slate-800 mb-1">Текст референса:</label>
                <input
                  type="text"
                  value={tgRefText}
                  onChange={(e) => setTgRefText(e.target.value)}
                  placeholder="Текст для ссылки"
                  className="w-full bg-white border border-pink-200 rounded-xl px-3 py-2 text-slate-900 font-medium text-[14px]"
                />
              </div>
              <div className="bg-white/80 p-3 rounded-2xl border border-pink-200">
                <span className="text-[13px] text-pink-700 font-bold block mb-1">Генерируемый тег:</span>
                <code className="text-pink-700 font-mono font-bold text-[14px]">{`<tg-reference name="${tgRefName || 'note-1'}">${tgRefText || 'Текст'}</tg-reference>`}</code>
              </div>
            </div>
          )}

          {/* Tab 4: Footnote */}
          {anchorTab === 'footnote' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[14px] font-bold text-slate-800 mb-1">Идентификатор сноски (например, 1 или note):</label>
                <input
                  type="text"
                  value={footnoteRef}
                  onChange={(e) => setFootnoteRef(e.target.value)}
                  placeholder="1"
                  className="w-full bg-white border border-pink-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-[14px]"
                />
              </div>
              <div>
                <label className="block text-[14px] font-bold text-slate-800 mb-1">Текст определения сноски:</label>
                <textarea
                  rows={2}
                  value={footnoteText}
                  onChange={(e) => setFootnoteText(e.target.value)}
                  placeholder="Пояснение термина или источник"
                  className="w-full bg-white border border-pink-200 rounded-xl px-3 py-2 text-slate-900 font-medium text-[14px]"
                />
              </div>
              <div className="bg-white/80 p-3 rounded-2xl border border-pink-200">
                <span className="text-[13px] text-pink-700 font-bold block mb-1">Синтаксис в тексте и конце:</span>
                <div className="font-mono text-[14px] space-y-1">
                  <div className="text-sky-700 font-bold">В месте курсора: [^{footnoteRef || '1'}]</div>
                  <div className="text-pink-700 font-bold">В конце: [^{footnoteRef || '1'}]: {footnoteText || 'Текст'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-2 border-t border-pink-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-2xl bg-white/90 text-slate-700 border border-pink-200 text-[14px] font-bold hover:bg-pink-50 cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleInsertAnchor}
            className="px-5 py-2 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white text-[14px] font-extrabold hover:opacity-95 cursor-pointer shadow-2xs"
          >
            Вставить
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
