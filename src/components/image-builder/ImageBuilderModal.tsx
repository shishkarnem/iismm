import React from 'react';
import ReactDOM from 'react-dom';
import { Sparkles, X } from 'lucide-react';
import { ImageBuilderModalProps } from './types';
import { UnifiedImageGeneratorPanel } from './core/UnifiedImageGeneratorPanel';

export const ImageBuilderModal: React.FC<ImageBuilderModalProps> = ({
  isOpen,
  onClose,
  onSelectImage,
  onSelectImages,
  onSyncConfig,
  saveConfigButtonLabel,
  editorFormat,
  defaultTargetMode,
  allowMultiple = true,
  initialCount,
  initialPrompt = '',
  initialMode = 'func_621',
  initialAspectRatio = '16:9',
  initialReferenceUrl = '',
  initialFunc787Config,
  initialFunc791Config,
  title = 'Генератор изображений',
  userId,
  userBalance,
  onRefreshUser
}) => {
  if (!isOpen) return null;

  const subtitle =
    editorFormat === 'rich'
      ? 'Формат статьи: одиночное фото, слайдер или коллаж до 10 кадров'
      : editorFormat === 'v2'
      ? 'Формат поста: одиночное фото или альбом до 10 кадров'
      : 'Все сгенерированные кадры автоматически сохраняются в вашу галерею';

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center p-2.5 sm:p-4 bg-gradient-to-r from-sky-100/55 via-pink-100/55 via-orange-100/55 via-pink-100/55 to-sky-100/55 backdrop-blur-md overflow-y-auto pointer-events-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-gradient-to-r from-sky-100/92 via-pink-100/92 via-orange-100/92 via-pink-100/92 to-sky-100/92 backdrop-blur-xl border-2 border-pink-300 shadow-2xl overflow-hidden text-slate-900"
      >
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 border-b border-pink-300/75">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0 shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] sm:text-[18px] font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 truncate">
                {title}
              </h3>
              <p className="text-[14px] text-slate-700 truncate">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть генератор изображений"
            title="Закрыть"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 border border-pink-300 text-slate-800 hover:text-slate-950 transition-all cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <UnifiedImageGeneratorPanel
            editorFormat={editorFormat}
            defaultTargetMode={defaultTargetMode}
            allowMultiple={allowMultiple}
            initialCount={initialCount}
            initialPrompt={initialPrompt}
            initialMode={initialMode}
            initialAspectRatio={initialAspectRatio}
            initialReferenceUrl={initialReferenceUrl}
            initialFunc787Config={initialFunc787Config}
            initialFunc791Config={initialFunc791Config}
            saveConfigButtonLabel={saveConfigButtonLabel}
            userId={userId}
            userBalance={userBalance}
            onRefreshUser={onRefreshUser}
            onClose={onClose}
            onSaveConfigOnly={(synced) => {
              onSyncConfig?.(synced);
              onClose();
            }}
            onApplyResult={(chosenList, targetMode, synced) => {
              onSyncConfig?.(synced);
              if (onSelectImages) {
                onSelectImages(chosenList, targetMode);
              } else if (chosenList[0]) {
                onSelectImage(chosenList[0]);
              }
              onClose();
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
