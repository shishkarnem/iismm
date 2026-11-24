import React from 'react';
import {
  X,
  Check,
  AlertCircle,
  ZoomIn,
  Download,
  StopCircle,
  Trash2,
  Plus,
  Images,
  Layers,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { ImageTargetMode } from '../types';
import { NeurosphereLoader } from '../../loaders/NeurosphereLoader';

interface ResultBlockProps {
  generatedUrls: string[];
  activeIndex: number;
  onSelectIndex: (idx: number) => void;
  onRemoveIndex: (idx: number) => void;
  onClearAll: () => void;
  onOpenFullscreen: () => void;
  onGenerateMore: () => void;
  isGenerating: boolean;
  allowMultiple: boolean;
  editorFormat?: 'v2' | 'rich';
  defaultTargetMode?: ImageTargetMode;
  onApply: (targetMode: ImageTargetMode, singleOnly?: boolean) => void;
}

export const ImageBuilderResultBlock: React.FC<ResultBlockProps> = ({
  generatedUrls,
  activeIndex,
  onSelectIndex,
  onRemoveIndex,
  onClearAll,
  onOpenFullscreen,
  onGenerateMore,
  isGenerating,
  allowMultiple,
  editorFormat,
  defaultTargetMode,
  onApply
}) => {
  if (generatedUrls.length === 0) return null;

  const safeIdx = Math.min(activeIndex, generatedUrls.length - 1);
  const currentUrl = generatedUrls[safeIdx] || generatedUrls[0];
  const count = generatedUrls.length;

  return (
    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 border-2 border-pink-300 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5">
          <Check className="w-4 h-4 text-sky-600 shrink-0" />
          <span>
            {count > 1
              ? `Создано картинок: ${count} из 10 (нажмите для увеличения)`
              : 'Картинка создана (нажмите для увеличения)'}
          </span>
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {allowMultiple && count < 10 && (
            <button
              type="button"
              onClick={onGenerateMore}
              disabled={isGenerating}
              className="px-3 py-1 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs hover:opacity-95 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить еще (+1)</span>
            </button>
          )}
          {count > 1 && (
            <button
              type="button"
              onClick={onClearAll}
              disabled={isGenerating}
              className="px-2.5 py-1 rounded-xl bg-white/85 border border-pink-300 text-rose-600 hover:bg-white text-[14px] font-bold cursor-pointer"
            >
              Очистить список
            </button>
          )}
        </div>
      </div>

      {/* Main Active Preview */}
      <div
        onClick={onOpenFullscreen}
        className="relative group rounded-2xl overflow-hidden border border-pink-300 max-h-72 flex items-center justify-center bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 cursor-zoom-in"
        title="Нажмите для просмотра на весь экран"
      >
        <img
          src={currentUrl}
          alt={`Результат ${safeIdx + 1}`}
          className="w-full h-full object-contain max-h-72"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-sky-200/35 via-pink-200/35 via-orange-200/35 via-pink-200/35 to-sky-200/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 border border-pink-300 text-slate-900 font-bold text-[14px] flex items-center gap-1.5 shadow-md">
            <ZoomIn className="w-4 h-4 text-pink-600" />
            <span>Увеличить на весь экран</span>
          </div>
        </div>
      </div>

      {/* Thumbnails Strip when multiple or allowMultiple */}
      {count > 1 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-1">
          {generatedUrls.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              onClick={() => onSelectIndex(idx)}
              className={`relative rounded-xl overflow-hidden aspect-square cursor-pointer border-2 transition-all ${
                idx === safeIdx
                  ? 'border-pink-500 ring-2 ring-pink-300 shadow-sm'
                  : 'border-pink-200 opacity-85 hover:opacity-100'
              }`}
            >
              <img src={url} alt={`Миниатюра ${idx + 1}`} className="w-full h-full object-cover" />
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-white/90 text-slate-800 text-[14px] font-bold leading-none">
                {idx + 1}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveIndex(idx);
                }}
                className="absolute top-1 right-1 p-1 rounded-lg bg-white/90 text-rose-600 hover:bg-white shadow-2xs cursor-pointer"
                title="Удалить картинку"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Format-Aware Apply Actions */}
      <div className="pt-2 border-t border-pink-300/70 space-y-2">
        {editorFormat === 'v2' ? (
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-end gap-2">
            {count >= 2 ? (
              <>
                <button
                  type="button"
                  onClick={() => onApply('photo', true)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 border border-pink-300 text-slate-800 font-bold text-[14px] hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ImageIcon className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Взять текущую как 1 фото</span>
                </button>
                <button
                  type="button"
                  onClick={() => onApply('album', false)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] shadow-sm hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Images className="w-4 h-4 shrink-0" />
                  <span>Создать альбом ({count} фото)</span>
                </button>
              </>
            ) : (
              <>
                {defaultTargetMode === 'album' && (
                  <button
                    type="button"
                    onClick={() => onApply('album', false)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] shadow-sm hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Images className="w-4 h-4 shrink-0" />
                    <span>Добавить в альбом</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onApply('photo', true)}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-2xl font-bold text-[14px] transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    defaultTargetMode === 'album'
                      ? 'bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 border border-pink-300 text-slate-800'
                      : 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-sm hover:opacity-95'
                  }`}
                >
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Использовать как фото</span>
                </button>
              </>
            )}
          </div>
        ) : editorFormat === 'rich' ? (
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onApply('photo', true)}
              className={`w-full sm:w-auto px-4 py-2.5 rounded-2xl font-bold text-[14px] transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                count === 1 && (!defaultTargetMode || defaultTargetMode === 'photo')
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-sm'
                  : 'bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 border border-pink-300 text-slate-800'
              }`}
            >
              <ImageIcon className="w-4 h-4 shrink-0" />
              <span>{count > 1 ? 'Вставить 1 фото' : 'Вставить как фото'}</span>
            </button>
            <button
              type="button"
              onClick={() => onApply('slideshow', false)}
              className={`w-full sm:w-auto px-4 py-2.5 rounded-2xl font-bold text-[14px] transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                defaultTargetMode === 'slideshow' || (count >= 2 && defaultTargetMode !== 'collage')
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-sm'
                  : 'bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 border border-pink-300 text-slate-800'
              }`}
            >
              <Images className="w-4 h-4 shrink-0" />
              <span>Создать слайдер ({count})</span>
            </button>
            <button
              type="button"
              onClick={() => onApply('collage', false)}
              className={`w-full sm:w-auto px-4 py-2.5 rounded-2xl font-bold text-[14px] transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                defaultTargetMode === 'collage'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-sm'
                  : 'bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 border border-pink-300 text-slate-800'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>Создать коллаж ({count})</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onApply(count > 1 ? 'album' : 'photo', count === 1)}
              className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] shadow-sm hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 shrink-0" />
              <span>
                {count > 1 ? `Использовать картинки (${count} шт.)` : 'Использовать эту картинку'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface WaitingModalProps {
  isOpen: boolean;
  functionName: string;
  generationSeconds: number;
  batchCurrent: number;
  batchTotal: number;
  prompt: string;
  onStop: () => void;
}

export const ImageBuilderWaitingModal: React.FC<WaitingModalProps> = ({
  isOpen,
  functionName,
  generationSeconds,
  batchCurrent,
  batchTotal,
  prompt,
  onStop
}) => {
  if (!isOpen) return null;

  const mins = Math.floor(generationSeconds / 60);
  const secs = generationSeconds % 60;
  const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[270] flex items-center justify-center p-4 bg-transparent pointer-events-auto">
      <div className="w-full max-w-md rounded-3xl bg-gradient-to-r from-sky-200/95 via-pink-200/95 via-orange-200/95 via-pink-200/95 to-sky-200/95 border-2 border-pink-400 shadow-2xl p-6 text-center space-y-4">
        <div className="w-[min(22vmin,156px)] h-[min(22vmin,156px)] mx-auto flex items-center justify-center">
          <NeurosphereLoader variant="embed" />
        </div>

        <div className="space-y-1">
          <h4 className="text-[18px] font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600">
            {batchTotal > 1
              ? `Генерация картинки ${batchCurrent} из ${batchTotal}`
              : 'Идет генерация изображения'}
          </h4>
          <p className="text-[14px] font-bold text-slate-800">
            Функция: {functionName}
          </p>
        </div>

        <div className="py-2 px-4 rounded-2xl bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 border border-pink-300 inline-block shadow-2xs">
          <div className="text-[24px] font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-pink-600 to-orange-500 font-mono">
            {formattedTime}
          </div>
          <span className="text-[14px] text-slate-600">время генерации</span>
        </div>

        <p className="text-[14px] text-slate-800 line-clamp-2 px-2 italic break-words">
          «{prompt}»
        </p>

        <div className="p-3 rounded-2xl bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 border border-pink-300 text-slate-800 text-[14px] font-bold text-left flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-orange-600 mt-0.5" />
          <span>
            При остановке генерации потраченный баланс ИИрок не возвращается.
          </span>
        </div>

        <button
          type="button"
          onClick={onStop}
          className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-black shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <StopCircle className="w-5 h-5" />
          <span>Остановить генерацию</span>
        </button>
      </div>
    </div>
  );
};

interface FullscreenModalProps {
  isOpen: boolean;
  urls: string[];
  activeIndex: number;
  onChangeIndex: (idx: number) => void;
  onClose: () => void;
}

export const ImageBuilderFullscreenModal: React.FC<FullscreenModalProps> = ({
  isOpen,
  urls,
  activeIndex,
  onChangeIndex,
  onClose
}) => {
  if (!isOpen || urls.length === 0) return null;

  const safeIdx = Math.min(activeIndex, urls.length - 1);
  const currentUrl = urls[safeIdx] || urls[0];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[280] flex items-center justify-center p-3 sm:p-6 bg-transparent pointer-events-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-4xl max-h-[92vh] w-full flex flex-col rounded-3xl bg-gradient-to-r from-sky-200/95 via-pink-200/95 via-orange-200/95 via-pink-200/95 to-sky-200/95 border-2 border-pink-400 shadow-2xl p-4 overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-pink-300/80 flex-wrap">
          <span className="text-[14px] font-bold text-slate-900">
            {urls.length > 1
              ? `Предпросмотр изображения (${safeIdx + 1} из ${urls.length})`
              : 'Предпросмотр изображения'}
          </span>
          <div className="flex items-center gap-2">
            <a
              href={currentUrl}
              download={`generated_image_${safeIdx + 1}.png`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white hover:opacity-95 text-[14px] font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-4 h-4" />
              <span>Скачать</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/85 border border-pink-300 text-slate-700 hover:text-slate-900 hover:bg-white cursor-pointer"
              title="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 flex items-center justify-center p-2 overflow-hidden max-h-[78vh]">
          <img
            src={currentUrl}
            alt="Полноэкранный просмотр"
            className="max-w-full max-h-[76vh] object-contain rounded-2xl shadow-lg border border-pink-300"
          />
          {urls.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => onChangeIndex((safeIdx - 1 + urls.length) % urls.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 border border-pink-300 text-slate-800 hover:bg-white shadow-md cursor-pointer"
                title="Предыдущее"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => onChangeIndex((safeIdx + 1) % urls.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 border border-pink-300 text-slate-800 hover:bg-white shadow-md cursor-pointer"
                title="Следующее"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
