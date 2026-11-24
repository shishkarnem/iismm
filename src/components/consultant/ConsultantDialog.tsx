import React, { useEffect, useRef, useState } from 'react';
import { Send, Trash2, X, Paperclip, Sparkles } from 'lucide-react';
import { MiniAudioField } from '../MiniAudioField';
import { NeuralSphere } from '../NeuralSphere';
import { NeurosphereLoader } from '../loaders/NeurosphereLoader';
import { ConsultantMessageBubble } from './ConsultantMessageBubble';
import { ConsultantUiMessage } from './useAiConsultant';

interface ConsultantDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ConsultantUiMessage[];
  inputText: string;
  onChangeInputText: (val: string) => void;
  attachedImages: string[];
  onOpenMediaModal: () => void;
  onRemoveAttachedImage: (index: number) => void;
  isLoading: boolean;
  loadingStage: string;
  errorText: string | null;
  onSend: (overrideText?: string) => void;
  onClearHistory: () => void;
}

const STARTER_QUESTIONS = [
  'Какие тарифы есть и сколько бесплатных Иирок дается?',
  'Какой у меня сейчас баланс Иирок и активный тариф?',
  'Как создать и протестировать Ии-сценарий с картинкой?',
  'Как работают папки взаимного пиара и подборки каналов?'
];

export const ConsultantDialog: React.FC<ConsultantDialogProps> = ({
  isOpen,
  onClose,
  messages,
  inputText,
  onChangeInputText,
  attachedImages,
  onOpenMediaModal,
  onRemoveAttachedImage,
  isLoading,
  loadingStage,
  errorText,
  onSend,
  onClearHistory
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const prevInputHeightRef = useRef<number>(38);
  const [isTextareaOverflowing, setIsTextareaOverflowing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const scrollToEnd = () => {
      const el = scrollContainerRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    };
    const rafId = requestAnimationFrame(scrollToEnd);
    const timerId = window.setTimeout(scrollToEnd, 60);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const el = textareaRef.current;
    if (!el) return;

    const scrollEl = scrollContainerRef.current;
    const wasNearBottom = scrollEl
      ? scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight <= 60
      : false;

    el.style.height = '0px';
    const borderY = el.offsetHeight;
    const cs = window.getComputedStyle(el);
    const padY = (parseFloat(cs.paddingTop) || 8) + (parseFloat(cs.paddingBottom) || 8);
    const lineHeight = parseFloat(cs.lineHeight) || 20;

    // 1 line minimum, 10 lines maximum; beyond 10 lines show transparent scrollbar
    const minHeight = Math.round(lineHeight * 1 + padY + borderY);
    const maxHeight = Math.round(lineHeight * 10 + padY + borderY);
    const neededHeight = el.scrollHeight + borderY;
    const nextHeight = Math.min(Math.max(neededHeight, minHeight), maxHeight);

    el.style.height = `${nextHeight}px`;
    setIsTextareaOverflowing(neededHeight > maxHeight + 1);

    const delta = nextHeight - prevInputHeightRef.current;
    prevInputHeightRef.current = nextHeight;

    if (delta !== 0 && scrollEl && wasNearBottom) {
      requestAnimationFrame(() => {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      });
    }
  }, [inputText, isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onSend();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 768) {
      e.preventDefault();
      onSend();
    }
  };

  const showStarterChips = messages.length <= 1 && !isLoading;

  return (
    <>
      {/* Outer wrapper: 100% transparent, full-screen on mobile, floating bottom-left on desktop */}
      <div className="fixed inset-0 z-[85] w-full h-[100dvh] px-[2%] pt-2.5 pb-2.5 md:inset-auto md:bottom-5 md:left-5 md:w-[460px] md:max-w-[calc(100vw-2.5rem)] md:h-[660px] md:max-h-[calc(100dvh-2.5rem)] md:p-0 flex flex-col justify-between bg-transparent pointer-events-auto md:pointer-events-none">
        {/* Top floating controls row — transparent outer row, gradient buttons only */}
        <div className="flex items-center justify-between gap-2 shrink-0 bg-transparent pointer-events-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-md min-w-0">
            <NeuralSphere size={30} glow={false} className="shrink-0" />
            <span className="text-[15px] font-bold truncate">Ии-консультант</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onClearHistory}
              disabled={isLoading}
              title="Очистить историю диалога"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white text-[14px] font-bold shadow-md hover:opacity-95 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Очистить</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Свернуть окно консультанта"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white text-[14px] font-bold shadow-md hover:opacity-95 active:scale-95 transition-all cursor-pointer"
            >
              <X className="w-4 h-4 shrink-0" />
              <span>Закрыть</span>
            </button>
          </div>
        </div>

        {/* Middle scrollable message stream — completely transparent container with exact 5px clearance above input */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto no-scrollbar mt-2 mb-0 pt-1 pb-[5px] px-0.5 space-y-3 bg-transparent pointer-events-auto min-w-0"
        >
          {messages.map((m) => (
            <ConsultantMessageBubble
              key={m.id}
              message={m}
              onQuickImagePreview={(url) => setPreviewImageUrl(url)}
            />
          ))}

          {/* Quick starter topic buttons arranged cleanly without horizontal scrolling */}
          {showStarterChips && (
            <div className="pt-1 flex flex-col gap-2 min-w-0">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onSend(q)}
                  className="w-full text-left px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white text-[14px] font-bold shadow-md hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer flex items-center gap-2 break-words"
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span className="min-w-0 flex-1 break-words">{q}</span>
                </button>
              ))}
            </div>
          )}

          {/* Live thinking bubble with Neurosphere & Function 763 stage */}
          {isLoading && (
            <div className="w-full flex items-end justify-start gap-2">
              <div className="max-w-[92%] p-[1.5px] rounded-3xl rounded-bl-lg shadow-sm bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
                <div className="px-4 py-3 rounded-[22.5px] rounded-bl-[6.5px] bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-md flex items-center gap-3 text-slate-900">
                  <div className="w-12 h-12 shrink-0">
                    <NeurosphereLoader variant="embed" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[14px] font-bold text-pink-700">
                      <span className="break-words">{loadingStage || 'Ищу ответ в базе данных...'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error bubble if any */}
          {errorText && (
            <div className="w-full p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-md">
              <div className="px-3.5 py-2.5 rounded-[14.5px] bg-gradient-to-r from-sky-100/92 via-pink-100/92 via-orange-100/92 via-pink-100/92 to-sky-100/92 backdrop-blur-md text-[14px] font-semibold text-pink-800 break-words">
                {errorText}
              </div>
            </div>
          )}
        </div>

        {/* Bottom input block — signature translucent gradient + MiniAudioField */}
        <div className="shrink-0 pointer-events-auto w-full min-w-0">
          <div className="p-[2px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-xl">
            <div className="rounded-[22px] bg-gradient-to-r from-sky-100/92 via-pink-100/92 via-orange-100/92 via-pink-100/92 to-sky-100/92 backdrop-blur-md p-2.5 sm:p-3 space-y-2">
              {/* Attached images preview strip (up to 4 images for Function 763 images_urls) */}
              {attachedImages.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pb-1">
                  {attachedImages.map((img, idx) => (
                    <div
                      key={`${img}_${idx}`}
                      className="relative w-14 h-14 rounded-xl overflow-hidden border border-pink-400 shadow-2xs"
                    >
                      <img src={img} alt="Вложение" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => onRemoveAttachedImage(idx)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white flex items-center justify-center cursor-pointer shadow-xs"
                        title="Убрать изображение"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Textarea input: expands upward 1..10 lines, then transparent scrollbar for unlimited lines */}
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => onChangeInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isLoading}
                placeholder="Напишите вопрос или нажмите Голос..."
                className={`w-full resize-none bg-white/65 focus:bg-white/85 rounded-2xl px-3.5 py-2 text-[14px] leading-[20px] font-medium text-slate-900 placeholder:text-slate-600 border border-pink-300/80 focus:outline-none focus:ring-2 focus:ring-pink-400 transition-[background-color,box-shadow] ${
                  isTextareaOverflowing
                    ? 'overflow-y-auto consultant-transparent-scroll'
                    : 'overflow-y-hidden'
                }`}
              />

              {/* Action controls row: Gallery attach + MiniAudioField voice input + Send button */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={onOpenMediaModal}
                    disabled={isLoading || attachedImages.length >= 4}
                    title="Прикрепить скриншот или картинку из галереи (до 4 шт.)"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white text-[14px] font-bold shadow-2xs hover:opacity-95 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Paperclip className="w-4 h-4 shrink-0" />
                    <span>Фото</span>
                  </button>

                  <MiniAudioField
                    currentValue={inputText}
                    onTranscript={(recognized) => onChangeInputText(recognized)}
                    disabled={isLoading}
                    buttonText="Голос"
                    title="Голосовой ввод вопроса"
                    size="md"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => onSend()}
                  disabled={isLoading || (!inputText.trim() && attachedImages.length === 0)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white text-[14px] font-bold shadow-md hover:opacity-95 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4 shrink-0" />
                  <span>Отправить</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Light transparent image preview modal if user clicks an attached image */}
      {previewImageUrl && (
        <div
          onClick={() => setPreviewImageUrl(null)}
          className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl w-full p-[2px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-2xl"
          >
            <div className="rounded-[22px] bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 p-3 flex flex-col items-center gap-3">
              <img
                src={previewImageUrl}
                alt="Просмотр"
                className="max-h-[75dvh] w-auto rounded-2xl object-contain"
              />
              <button
                type="button"
                onClick={() => setPreviewImageUrl(null)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white text-[14px] font-bold cursor-pointer"
              >
                Закрыть просмотр
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
