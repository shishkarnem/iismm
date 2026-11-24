import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Image as ImageIcon, Check, Loader2, Search, Video as VideoIcon, FileText } from 'lucide-react';
import { formatAbsoluteUrl, isVideoMediaUrl } from '../utils/urlUtils';
import { ResponsiveActionBtn } from './ui-kit/ResponsiveActionBtn';

export type GalleryMediaFilter = 'images' | 'images_and_videos' | 'all';

export interface GallerySelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selectedUrls: string[]) => void;
  multiple?: boolean;
  maxCount?: number;
  userId?: string;
  title?: string;
  allowedMediaTypes?: GalleryMediaFilter;
}

export const GallerySelectModal: React.FC<GallerySelectModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  multiple = false,
  maxCount = 10,
  userId = '16926299042',
  title = 'Выбор изображений из галереи',
  allowedMediaTypes = 'images'
}) => {
  const [files, setFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const effectiveLimit = Math.max(1, maxCount);

  useEffect(() => {
    if (!isOpen) {
      setSelectedUrls([]);
      setSearchQuery('');
      return;
    }

    const loadGalleryImages = async () => {
      setIsLoading(true);
      try {
        const cleanUid = userId || '16926299042';
        const res = await fetch(`/api/files?userId=${encodeURIComponent(cleanUid)}`);
        if (res.ok) {
          const data = await res.json();
          const allFiles = Array.isArray(data) ? data : data.files || [];
          const filtered = allFiles.filter((f: any) => {
            if (allowedMediaTypes === 'all') return true;
            const url = (f.originalUrl || f.fullUrl || f.url || '').toLowerCase();
            const fileName = (f.filename || f.name || '').toLowerCase();
            const type = (f.type || f.mimeType || f.mime_type || '').toLowerCase();
            const isImg =
              type.includes('image') ||
              Boolean(url.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i)) ||
              Boolean(fileName.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i));
            if (allowedMediaTypes === 'images_and_videos') {
              const isVid = type.includes('video') || isVideoMediaUrl(url) || isVideoMediaUrl(fileName);
              return isImg || isVid;
            }
            return isImg;
          });
          setFiles(filtered);
        }
      } catch (err) {
        console.error('Failed to load gallery files:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadGalleryImages();
  }, [isOpen, userId, allowedMediaTypes]);

  if (!isOpen) return null;

  const toggleSelect = (rawUrl: string) => {
    const url = formatAbsoluteUrl(rawUrl);
    if (!multiple) {
      setSelectedUrls([url]);
    } else {
      setSelectedUrls(prev =>
        prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url].slice(0, effectiveLimit)
      );
    }
  };

  const handleImageClick = (e: React.MouseEvent, rawUrl: string) => {
    e.stopPropagation();
    const url = formatAbsoluteUrl(rawUrl);
    if (!multiple) {
      onSelect([url]);
      onClose();
    } else {
      toggleSelect(url);
    }
  };

  const handleConfirm = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selectedUrls.length > 0) {
      const formatted = selectedUrls.map(formatAbsoluteUrl).filter(Boolean);
      onSelect(formatted);
      onClose();
    }
  };

  const filteredFiles = files.filter(f => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const name = (f.name || f.filename || f.slugName || '').toLowerCase();
    const url = (f.url || f.fullUrl || f.originalUrl || '').toLowerCase();
    return name.includes(q) || url.includes(q);
  });

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[290] flex items-center justify-center p-2.5 sm:p-4 bg-gradient-to-r from-sky-100/55 via-pink-100/55 via-orange-100/55 via-pink-100/55 to-sky-100/55 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xl border-2 border-pink-300 rounded-3xl p-4 sm:p-6 max-w-2xl w-full shadow-2xl space-y-3.5 max-h-[92vh] flex flex-col text-left text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-pink-300/70 pb-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-2xs shrink-0">
              <ImageIcon size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[16px] sm:text-[18px] font-bold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent truncate">
                {title}
              </h3>
              <p className="text-[14px] text-slate-700 truncate">
                {multiple
                  ? allowedMediaTypes === 'images_and_videos'
                    ? `Выберите до ${effectiveLimit} фото и видео и нажмите кнопку вставки`
                    : `Выберите до ${effectiveLimit} изображений и нажмите кнопку вставки`
                  : 'Нажмите на файл для мгновенного выбора'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть галерею"
            title="Закрыть"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 text-slate-800 border border-pink-300 transition-all cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative shrink-0">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию файла..."
            className="w-full pl-10 pr-24 py-2.5 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 rounded-2xl text-[14px] text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-pink-500 font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-700 hover:text-pink-900 text-[14px] font-bold cursor-pointer"
            >
              Очистить
            </button>
          )}
        </div>

        {selectedUrls.length > 0 && (
          <div className="p-2.5 rounded-2xl bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 border border-pink-300 space-y-1.5 shrink-0">
            <span className="text-[14px] font-bold text-slate-800 block">
              Выбрано: {selectedUrls.length}{multiple ? ` из ${effectiveLimit}` : ''}
            </span>
            <div className="flex gap-2 flex-wrap max-h-24 overflow-y-auto py-0.5">
              {selectedUrls.map((url, sIdx) => (
                <div key={`${url}-${sIdx}`} className="relative w-12 h-12 rounded-xl overflow-hidden border border-pink-300 shrink-0 group bg-white/80">
                  {isVideoMediaUrl(url) ? (
                    <video src={url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                  ) : (
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(url);
                    }}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white flex items-center justify-center shadow-2xs cursor-pointer"
                    title="Убрать"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[48vh] pr-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-44 space-y-3">
              <Loader2 size={28} className="animate-spin text-pink-600" />
              <span className="text-[14px] font-bold text-slate-700">Загрузка медиафайлов галереи...</span>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 text-center p-4 space-y-2">
              <ImageIcon size={36} className="text-pink-500" />
              <p className="text-[14px] font-bold text-slate-800">
                {searchQuery
                  ? 'По запросу ничего не найдено'
                  : allowedMediaTypes === 'images_and_videos'
                  ? 'В вашей галерее пока нет сохраненных фото и видео'
                  : 'В вашей галерее пока нет сохраненных файлов'}
              </p>
              <p className="text-[14px] text-slate-600">
                {searchQuery ? 'Измените поисковый запрос' : 'Загрузите файл с устройства или сгенерируйте в конструкторе'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 p-1">
              {filteredFiles.map((file, idx) => {
                const rawUrl = file.originalUrl || file.fullUrl || file.url;
                const url = formatAbsoluteUrl(rawUrl);
                const fileName = String(file.filename || file.name || '').toLowerCase();
                const mimeType = String(file.type || file.mimeType || file.mime_type || '').toLowerCase();
                const isVideo = mimeType.includes('video') || isVideoMediaUrl(url) || isVideoMediaUrl(fileName);
                const isImage =
                  mimeType.includes('image') ||
                  Boolean(url.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i)) ||
                  Boolean(fileName.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i));
                const isSelected = selectedUrls.includes(url);
                return (
                  <div
                    key={file.id || idx}
                    onClick={(e) => handleImageClick(e, url)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onSelect([url]);
                      onClose();
                    }}
                    title={multiple ? 'Нажмите для выбора' : 'Нажмите для вставки'}
                    className={`relative rounded-2xl overflow-hidden aspect-square border-2 cursor-pointer transition-all group ${
                      isSelected
                        ? 'border-pink-500 ring-2 ring-pink-300 shadow-md'
                        : 'border-pink-200 hover:border-pink-400'
                    }`}
                  >
                    {isVideo ? (
                      <>
                        <video
                          src={url}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white text-[14px] font-bold flex items-center gap-1 shadow-2xs">
                          <VideoIcon size={13} />
                          <span>Видео</span>
                        </span>
                      </>
                    ) : isImage ? (
                      <img
                        src={url}
                        alt={file.name || 'Картинка из галереи'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-pink-50 to-orange-50 p-3 text-slate-700">
                        <FileText size={28} className="text-pink-600 mb-1" />
                        <span className="text-[14px] font-semibold text-center truncate w-full">
                          {file.name || 'Файл'}
                        </span>
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 bg-gradient-to-r from-sky-200/40 via-pink-200/40 to-orange-200/40 flex items-center justify-center">
                        <span className="w-8 h-8 rounded-full bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white flex items-center justify-center shadow-md">
                          <Check size={18} className="stroke-[3]" />
                        </span>
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 border-t border-pink-300/70 px-2 py-1">
                      <p className="text-slate-900 text-[14px] font-medium truncate">
                        {file.name || (isVideo ? 'Видеоролик' : 'Файл')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-pink-300/70 shrink-0">
          <span className="text-[14px] font-bold text-slate-800 truncate">
            {selectedUrls.length > 0
              ? `Выбрано: ${selectedUrls.length}`
              : multiple
              ? `До ${effectiveLimit} шт.`
              : 'Нажмите на файл'}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <ResponsiveActionBtn
              icon={<X size={16} />}
              label="Отмена"
              variant="ghost"
              onClick={onClose}
            />
            <ResponsiveActionBtn
              icon={<Check size={16} />}
              label={`Вставить (${selectedUrls.length})`}
              variant="primary"
              disabled={selectedUrls.length === 0}
              onClick={() => handleConfirm()}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
