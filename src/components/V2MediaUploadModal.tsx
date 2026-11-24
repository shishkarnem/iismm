import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Image as ImageIcon, 
  Video, 
  Music, 
  FileText, 
  Layers, 
  Trash2, 
  Check, 
  Link as LinkIcon,
  Sparkles,
  Download,
  Loader2
} from 'lucide-react';
import { GallerySelectModal } from './GallerySelectModal';
import { ImageBuilderModal } from './image-builder';
import { isVideoMediaUrl } from '../utils/urlUtils';
import { usePricingConfig } from '../hooks/usePricingConfig';
import { formatIirkyCount } from '../shared/pricingConfig';

export type V2MediaType = 'photo' | 'video' | 'audio' | 'document' | 'album';

export interface V2FileItem {
  url: string;
  name: string;
  size?: number;
}

export interface V2MediaAttachment {
  type: V2MediaType;
  url?: string;
  urls?: string[];
  files?: V2FileItem[];
  name?: string;
  size?: number;
}

interface V2MediaUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAttach: (attachment: V2MediaAttachment) => void;
  initialType?: V2MediaType;
}

export const V2MediaUploadModal: React.FC<V2MediaUploadModalProps> = ({
  isOpen,
  onClose,
  onAttach,
  initialType = 'photo'
}) => {
  const { pricing } = usePricingConfig();
  const [selectedType, setSelectedType] = useState<V2MediaType>(initialType);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [directUrl, setDirectUrl] = useState<string>('');
  
  // Single media state (photo, video)
  const [uploadedUrl, setUploadedUrl] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  
  // Multi file state for album, audio, and document
  const [albumUrls, setAlbumUrls] = useState<string[]>([]);
  const [multiFileList, setMultiFileList] = useState<V2FileItem[]>([]);

  // AI image generation state (Function 621)
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiAspectRatio, setAiAspectRatio] = useState<string>('16:9');
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiDownloadUrl, setAiDownloadUrl] = useState<string>('');
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string>('');
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState<boolean>(false);
  const [isImageBuilderOpen, setIsImageBuilderOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const isMultiSelectMode = selectedType === 'album' || selectedType === 'audio' || selectedType === 'document';

  const mediaTypes: { id: V2MediaType; label: string; icon: React.ReactNode; accept: string; hint: string }[] = [
    { 
      id: 'photo', 
      label: 'Фото', 
      icon: <ImageIcon className="w-4 h-4" />, 
      accept: 'image/*',
      hint: 'Изображения JPG, PNG, WebP'
    },
    { 
      id: 'video', 
      label: 'Видео', 
      icon: <Video className="w-4 h-4" />, 
      accept: 'video/*',
      hint: 'Видеофайлы MP4, MOV, WebM'
    },
    { 
      id: 'audio', 
      label: 'Аудио', 
      icon: <Music className="w-4 h-4" />, 
      accept: 'audio/*',
      hint: 'Множественный выбор треков MP3, WAV, M4A'
    },
    { 
      id: 'document', 
      label: 'Документ', 
      icon: <FileText className="w-4 h-4" />, 
      accept: '.pdf,.doc,.docx,.zip,.txt,.xlsx,.csv',
      hint: 'Множественный выбор файлов PDF, DOC, ZIP, таблиц'
    },
    { 
      id: 'album', 
      label: 'Альбом', 
      icon: <Layers className="w-4 h-4" />, 
      accept: 'image/*,video/*',
      hint: 'До 10 фото или видео вместе'
    }
  ];

  const currentTypeConfig = mediaTypes.find(t => t.id === selectedType) || mediaTypes[0];

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setErrorMessage('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.url || data.path || data.fileUrl) {
        const fileUrl = data.url || data.path || data.fileUrl;
        if (selectedType === 'album') {
          setAlbumUrls(prev => [...prev, fileUrl].slice(0, 10));
        } else if (selectedType === 'audio' || selectedType === 'document') {
          setMultiFileList(prev => [...prev, { url: fileUrl, name: file.name, size: file.size }]);
        } else {
          setUploadedUrl(fileUrl);
          setFileName(file.name);
        }
      } else {
        setErrorMessage(data.error || 'Ошибка при загрузке файла');
      }
    } catch (e: any) {
      setErrorMessage('Не удалось загрузить файл на сервер');
    } finally {
      setIsUploading(false);
    }
  };

  const handleMultipleFiles = async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      if (selectedType === 'album' && albumUrls.length >= 10) break;
      await handleFileUpload(files[i]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (isMultiSelectMode) {
        handleMultipleFiles(e.dataTransfer.files);
      } else {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    }
  };

  const handleAddUrl = () => {
    if (!directUrl.trim()) return;
    const cleanUrl = directUrl.trim();
    const inferredName = cleanUrl.split('/').pop() || 'файл';

    if (selectedType === 'album') {
      if (albumUrls.length < 10) {
        setAlbumUrls(prev => [...prev, cleanUrl]);
        setDirectUrl('');
      }
    } else if (selectedType === 'audio' || selectedType === 'document') {
      setMultiFileList(prev => [...prev, { url: cleanUrl, name: inferredName }]);
      setDirectUrl('');
    } else {
      setUploadedUrl(cleanUrl);
      setFileName(inferredName);
      setDirectUrl('');
    }
  };

  const handleGenerateAIImage = async () => {
    if (!aiPrompt.trim()) {
      setErrorMessage('Пожалуйста, введите промпт для генерации картинки');
      return;
    }
    setIsGeneratingAI(true);
    setErrorMessage('');
    setAiSuccessMsg('');
    try {
      const prefix = selectedType === 'album' ? 'album_' : 'media_v2_';
      const res = await fetch('/api/protalk/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePrompt: aiPrompt.trim(),
          aspectRatio: aiAspectRatio,
          prefix,
          model: 'protalk-621'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка генерации картинки');
      }

      const generatedUrl = data.imageUrl;
      setAiDownloadUrl(data.downloadUrl || generatedUrl);
      const charged = data.costIirky !== undefined ? Number(data.costIirky) : pricing.imageModels.func_621;
      setAiSuccessMsg(
        `Картинка сгенерирована через ИИ и добавлена в галерею! ${charged === 0 ? 'Бесплатно.' : `Списано: ${formatIirkyCount(charged)}.`}`
      );

      if (selectedType === 'album') {
        setAlbumUrls(prev => [...prev, generatedUrl].slice(0, 10));
      } else {
        setUploadedUrl(generatedUrl);
        setFileName(data.file?.name || 'ИИ_генерация.png');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка генерации изображения. ИИрки не списаны.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleConfirm = () => {
    if (selectedType === 'album') {
      if (albumUrls.length === 0) {
        setErrorMessage('Добавьте хотя бы один элемент в альбом');
        return;
      }
      onAttach({
        type: 'album',
        urls: albumUrls,
        url: albumUrls[0]
      });
    } else if (selectedType === 'audio' || selectedType === 'document') {
      if (multiFileList.length === 0 && !uploadedUrl) {
        setErrorMessage('Загрузите файлы или укажите прямую ссылку');
        return;
      }
      const allFiles = multiFileList.length > 0 
        ? multiFileList 
        : [{ url: uploadedUrl, name: fileName || 'файл' }];
      
      onAttach({
        type: selectedType,
        url: allFiles[0]?.url,
        urls: allFiles.map(f => f.url),
        files: allFiles,
        name: allFiles.map(f => f.name).join(', ')
      });
    } else {
      if (!uploadedUrl) {
        setErrorMessage('Загрузите файл или укажите прямую ссылку');
        return;
      }
      onAttach({
        type: selectedType,
        url: uploadedUrl,
        name: fileName
      });
    }
    onClose();
  };

  const handleClear = () => {
    setUploadedUrl('');
    setFileName('');
    setAlbumUrls([]);
    setMultiFileList([]);
    setDirectUrl('');
    setErrorMessage('');
  };

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-sky-100/40 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative max-w-xl w-full bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-md rounded-3xl p-5 sm:p-6 border-2 border-pink-400 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-pink-300/70 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-none">
                Вложение медиафайла V2
              </h3>
              <p className="text-sm text-slate-600 font-medium mt-1">
                Выберите тип медиаконтента для отправки в сообщении (поддерживается множественный выбор)
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 rounded-xl text-slate-500 hover:text-pink-600 hover:bg-white/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media type selector (tabs with responsive flex/wrap) */}
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">
            Тип вложения:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {mediaTypes.map((t) => {
              const isActive = selectedType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedType(t.id);
                    setErrorMessage('');
                  }}
                  className={`py-2 px-2.5 rounded-2xl flex items-center justify-center gap-1.5 text-sm font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs border-2 border-pink-400'
                      : 'bg-white/80 text-slate-700 border border-pink-200 hover:bg-white'
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Drag & drop upload area */}
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-pink-300 hover:border-pink-500 rounded-3xl p-5 bg-white/70 hover:bg-white/90 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 shadow-xs"
        >
          <input 
            ref={fileInputRef}
            type="file" 
            accept={currentTypeConfig.accept}
            multiple={isMultiSelectMode}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                if (isMultiSelectMode) {
                  handleMultipleFiles(e.target.files);
                } else {
                  handleFileUpload(e.target.files[0]);
                }
              }
            }}
            className="hidden" 
          />
          <div className="p-3 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs">
            {isUploading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">
              {isUploading ? 'Загрузка файлов на сервер...' : isMultiSelectMode ? 'Нажмите для выбора списка файлов или перетащите их сюда' : 'Нажмите для выбора файла или перетащите сюда'}
            </p>
            <p className="text-sm text-slate-600 font-medium">
              {currentTypeConfig.hint}
            </p>
          </div>
        </div>

        {/* Gallery selection button for image types (Task 10) */}
        {(selectedType === 'photo' || selectedType === 'album') && (
          <button
            type="button"
            onClick={() => setIsGalleryModalOpen(true)}
            className="w-full py-2.5 rounded-2xl bg-white/90 hover:bg-white text-slate-800 border border-pink-300 text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
          >
            <ImageIcon className="w-4 h-4 text-pink-600" />
            <span>
              {selectedType === 'album'
                ? 'Выбрать фото или видео из галереи'
                : 'Выбрать ранее сохраненную картинку из галереи'}
            </span>
          </button>
        )}

        {/* Direct URL input option */}
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">
            Или укажите прямую ссылку:
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                value={directUrl} 
                onChange={(e) => setDirectUrl(e.target.value)} 
                placeholder="https://example.com/file.mp3"
                className="w-full bg-white/90 border border-pink-200 focus:border-pink-400 pl-9 pr-3 py-2 rounded-2xl text-sm text-slate-800 focus:outline-none shadow-xs"
              />
            </div>
            <button 
              type="button" 
              onClick={handleAddUrl}
              className="px-4 py-2 bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white font-bold text-sm rounded-2xl shadow-xs hover:opacity-95 transition-all cursor-pointer shrink-0"
            >
              Добавить
            </button>
          </div>
        </div>

        {/* AI Image Generation Button */}
        {(selectedType === 'photo' || selectedType === 'album') && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsImageBuilderOpen(true)}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white font-bold text-[14px] rounded-2xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Генерация картинки</span>
            </button>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-pink-100/90 border border-pink-300 text-sm font-bold text-pink-700">
            {errorMessage}
          </div>
        )}

        {/* Preview of selected attachment(s) */}
        {selectedType === 'album' ? (
          albumUrls.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-bold text-slate-800">
                <span>Элементы альбома ({albumUrls.length}/10):</span>
                <button 
                  type="button" 
                  onClick={() => setAlbumUrls([])} 
                  className="text-pink-600 hover:text-pink-700 text-sm cursor-pointer"
                >
                  Очистить все
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-2 bg-white/80 rounded-2xl border border-pink-200">
                {albumUrls.map((url, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-pink-200 aspect-square bg-slate-100 flex items-center justify-center">
                    {isVideoMediaUrl(url) ? (
                      <video src={url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                    ) : (
                      <img src={url} alt="Item" className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => setAlbumUrls(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 p-1 rounded-lg bg-white/90 text-pink-600 hover:bg-white shadow-xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (selectedType === 'audio' || selectedType === 'document') ? (
          multiFileList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-bold text-slate-800">
                <span>Выбранные файлы ({multiFileList.length}):</span>
                <button 
                  type="button" 
                  onClick={() => setMultiFileList([])} 
                  className="text-pink-600 hover:text-pink-700 text-sm cursor-pointer"
                >
                  Очистить все
                </button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto p-2 bg-white/80 rounded-2xl border border-pink-200">
                {multiFileList.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-white border border-pink-200 flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="p-1.5 rounded-lg bg-pink-50 text-pink-600 shrink-0">
                        {currentTypeConfig.icon}
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-bold text-slate-800 truncate">{item.name}</p>
                        <p className="text-xs text-slate-400 font-mono truncate">{item.url}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMultiFileList(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1 rounded-lg text-slate-400 hover:text-pink-600 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          uploadedUrl && (
            <div className="p-3 rounded-2xl bg-white/90 border border-pink-300 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="p-2 rounded-xl bg-pink-50 border border-pink-200 text-pink-600 shrink-0">
                  {currentTypeConfig.icon}
                </div>
                <div className="truncate">
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {fileName || 'Прикрепленный медиафайл'}
                  </p>
                  <p className="text-sm text-slate-500 truncate font-mono">
                    {uploadedUrl}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={handleClear} 
                className="p-1.5 rounded-xl text-slate-400 hover:text-pink-600 hover:bg-pink-50 transition-colors cursor-pointer shrink-0"
                title="Удалить"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-pink-300/70">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 rounded-2xl text-sm font-bold text-slate-700 bg-white/80 hover:bg-white border border-pink-200 transition-all cursor-pointer"
          >
            Отмена
          </button>
          <button 
            type="button" 
            onClick={handleConfirm} 
            className="px-5 py-2 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-4 h-4 text-white" />
            <span>Прикрепить</span>
          </button>
        </div>
      </div>

      {/* Gallery Picker Modal */}
      <GallerySelectModal
        isOpen={isGalleryModalOpen}
        onClose={() => setIsGalleryModalOpen(false)}
        onSelect={(urls) => {
          if (!urls || urls.length === 0) return;
          if (selectedType === 'album') {
            setAlbumUrls(prev => Array.from(new Set([...prev, ...urls])).slice(0, 10));
          } else {
            setUploadedUrl(urls[0]);
            setFileName('Изображение из галереи');
          }
        }}
        multiple={selectedType === 'album'}
        allowedMediaTypes={selectedType === 'album' ? 'images_and_videos' : 'images'}
        title={selectedType === 'album' ? 'Выбор фото и видео для альбома из галереи' : 'Выбор изображения из галереи'}
      />

      {/* Image Builder Modal */}
      <ImageBuilderModal
        isOpen={isImageBuilderOpen}
        onClose={() => setIsImageBuilderOpen(false)}
        title="Генерация картинки"
        editorFormat="v2"
        defaultTargetMode={selectedType === 'album' ? 'album' : 'photo'}
        initialPrompt={aiPrompt}
        initialAspectRatio={aiAspectRatio as any}
        onSelectImage={(url) => {
          if (selectedType === 'album') {
            setAlbumUrls(prev => Array.from(new Set([...prev, url])).slice(0, 10));
          } else {
            setUploadedUrl(url);
            setFileName('ai_generated.jpg');
          }
          setIsImageBuilderOpen(false);
        }}
        onSelectImages={(urls, targetMode) => {
          if (targetMode === 'album' || urls.length > 1 || selectedType === 'album') {
            setSelectedType('album');
            setAlbumUrls(prev => Array.from(new Set([...prev, ...urls])).slice(0, 10));
          } else {
            setSelectedType('photo');
            setUploadedUrl(urls[0]);
            setFileName('ai_generated.jpg');
          }
          setIsImageBuilderOpen(false);
        }}
      />
    </div>
  );
};

export default V2MediaUploadModal;
