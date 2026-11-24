import React, { useState } from 'react';
import { Upload, Link, Image as ImageIcon, X, Loader2, Plus, FolderOpen } from 'lucide-react';
import { ReferenceMode } from './types';
import { GradientSelect } from '../ui-kit/GradientDropdown';
import { ResponsiveActionBtn } from '../ui-kit/ResponsiveActionBtn';
import { GallerySelectModal } from '../GallerySelectModal';
import { formatAbsoluteUrl } from '../../utils/urlUtils';

interface ReferenceImageSelectorProps {
  referenceUrl: string;
  onReferenceUrlChange: (url: string) => void;
  userId?: string;
  title?: string;
  maxCount?: number;
}

const REFERENCE_SOURCE_OPTIONS: { value: ReferenceMode; label: string; hint: string }[] = [
  {
    value: 'upload',
    label: 'Загрузить с устройства в галерею',
    hint: 'Файлы сохранятся в вашу галерею и получат общедоступные ссылки'
  },
  {
    value: 'url',
    label: 'Вставить публичные ссылки через запятую',
    hint: 'Одна или несколько прямых https-ссылок на исходные изображения'
  },
  {
    value: 'gallery',
    label: 'Выбрать из вашей галереи',
    hint: 'Использовать ранее загруженные или сгенерированные картинки'
  }
];

export const ReferenceImageSelector: React.FC<ReferenceImageSelectorProps> = ({
  referenceUrl,
  onReferenceUrlChange,
  userId,
  title = 'Картинки-референсы',
  maxCount = 1
}) => {
  const [activeTab, setActiveTab] = useState<ReferenceMode>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);

  const urlsList = referenceUrl
    ? referenceUrl
        .split(/[\n,]+/)
        .map(u => u.trim())
        .filter(Boolean)
    : [];

  const mergeImageUrls = (incomingUrls: string[]) => {
    const cleaned = incomingUrls
      .map(u => formatAbsoluteUrl(u.trim()))
      .filter(u => /^https?:\/\//i.test(u));

    if (cleaned.length === 0) {
      setUploadError('Укажите корректную ссылку, начинающуюся с https://');
      return;
    }

    if (maxCount <= 1) {
      onReferenceUrlChange(cleaned[0]);
      setUploadError('');
      return;
    }

    const combined = [...urlsList];
    for (const u of cleaned) {
      if (!combined.includes(u) && combined.length < maxCount) {
        combined.push(u);
      }
    }

    if (urlsList.length + cleaned.length > maxCount) {
      setUploadError(`Добавлено до лимита (${maxCount} шт.)`);
    } else {
      setUploadError('');
    }
    onReferenceUrlChange(combined.join(', '));
  };

  const removeImageUrl = (indexToRemove: number) => {
    if (maxCount <= 1) {
      onReferenceUrlChange('');
      return;
    }
    const updated = urlsList.filter((_, idx) => idx !== indexToRemove);
    onReferenceUrlChange(updated.join(', '));
  };

  const handleMultiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles: File[] = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const remainingSlots = maxCount <= 1 ? 1 : Math.max(0, maxCount - urlsList.length);
    if (remainingSlots <= 0) {
      setUploadError(`Достигнут лимит в ${maxCount} изображений`);
      e.target.value = '';
      return;
    }

    const filesToUpload = selectedFiles.slice(0, remainingSlots);
    setIsUploading(true);
    setUploadError('');

    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        setUploadProgressText(
          filesToUpload.length > 1
            ? `Загрузка в галерею: ${i + 1} из ${filesToUpload.length}...`
            : 'Загрузка файла в галерею...'
        );

        const formData = new FormData();
        formData.append('file', file);
        if (userId) formData.append('userId', userId);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (!res.ok || (!data.url && !data.imageUrl && !data.fileUrl)) {
          throw new Error(data.error || `Ошибка загрузки файла ${file.name}`);
        }

        const rawUploaded = data.url || data.imageUrl || data.fileUrl;
        uploadedUrls.push(formatAbsoluteUrl(rawUploaded));
      }

      if (uploadedUrls.length > 0) {
        mergeImageUrls(uploadedUrls);
      }
    } catch (err: any) {
      if (uploadedUrls.length > 0) {
        mergeImageUrls(uploadedUrls);
      }
      setUploadError(err.message || 'Не удалось загрузить картинку');
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
      e.target.value = '';
    }
  };

  const handleApplyUrlsInput = () => {
    if (!urlInput.trim()) return;
    const parts = urlInput
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(Boolean);
    mergeImageUrls(parts);
    setUrlInput('');
  };

  return (
    <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-sky-100/70 via-pink-100/70 via-orange-100/70 via-pink-100/70 to-sky-100/70 border border-pink-300/90 space-y-3 min-w-0">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5 min-w-0">
          <ImageIcon className="w-4 h-4 text-pink-600 shrink-0" />
          <span className="truncate">{title}</span>
          <span className="text-slate-600 font-medium">
            · {urlsList.length}/{maxCount}
          </span>
        </div>
        {urlsList.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onReferenceUrlChange('');
              setUploadError('');
            }}
            className="text-[14px] text-pink-700 hover:text-pink-900 font-bold flex items-center gap-1 cursor-pointer shrink-0"
            title="Очистить референсы"
          >
            <X className="w-4 h-4" />
            <span>Очистить</span>
          </button>
        )}
      </div>

      {urlsList.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {urlsList.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className="relative group p-1.5 rounded-xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 flex items-center gap-2 min-w-0"
            >
              <img
                src={url}
                alt={`Референс ${idx + 1}`}
                className="w-10 h-10 object-cover rounded-lg border border-pink-200 shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="text-[14px] text-slate-800 truncate flex-1 min-w-0" title={url}>
                #{idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeImageUrl(idx)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-rose-600 cursor-pointer shrink-0"
                title="Удалить референс"
                aria-label="Удалить референс"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <GradientSelect
        label="Способ добавления референса"
        value={activeTab}
        onChange={(val) => setActiveTab(val as ReferenceMode)}
        options={REFERENCE_SOURCE_OPTIONS}
      />

      {activeTab === 'upload' && (
        <div className="space-y-2">
          <label className="block p-3.5 rounded-2xl border-2 border-dashed border-pink-300 hover:border-pink-500 bg-gradient-to-r from-sky-50/75 via-pink-50/75 via-orange-50/75 via-pink-50/75 to-sky-50/75 text-center cursor-pointer transition-all">
            <input
              type="file"
              accept="image/*"
              multiple={maxCount > 1}
              className="hidden"
              onChange={handleMultiFileUpload}
              disabled={isUploading || (maxCount > 1 && urlsList.length >= maxCount)}
            />
            {isUploading ? (
              <div className="flex items-center justify-center gap-2 text-[14px] font-bold text-slate-800 py-1">
                <Loader2 className="w-5 h-5 animate-spin text-pink-600 shrink-0" />
                <span>{uploadProgressText || 'Загрузка в галерею...'}</span>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="w-5 h-5 mx-auto text-pink-600" />
                <span className="text-[14px] font-bold text-slate-900 block">
                  {maxCount > 1
                    ? `Выбрать от 1 до ${maxCount} файлов с устройства`
                    : 'Выбрать картинку с устройства'}
                </span>
                <span className="text-[14px] text-slate-600 block">
                  Автоматически загружается в вашу галерею и формирует публичные ссылки
                </span>
              </div>
            )}
          </label>
        </div>
      )}

      {activeTab === 'url' && (
        <div className="space-y-2">
          {maxCount > 1 ? (
            <textarea
              rows={2}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Вставьте от 1 до 16 публичных https-ссылок через запятую или с новой строки..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 text-slate-900 text-[14px] font-medium focus:outline-none focus:border-pink-500 resize-y"
            />
          ) : (
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://file.pro-talk.ru/tgf/..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 text-slate-900 text-[14px] font-medium focus:outline-none focus:border-pink-500"
            />
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] text-slate-600">
              {maxCount > 1 ? `Поддерживается список до ${maxCount} https-ссылок` : 'Прямая https-ссылка'}
            </span>
            <ResponsiveActionBtn
              icon={<Plus className="w-4 h-4" />}
              label="Добавить ссылки"
              onClick={handleApplyUrlsInput}
              disabled={!urlInput.trim()}
            />
          </div>
        </div>
      )}

      {activeTab === 'gallery' && (
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 border border-pink-300">
          <span className="text-[14px] text-slate-800 font-medium">
            Откройте вашу галерею для выбора до {maxCount} референсов
          </span>
          <ResponsiveActionBtn
            icon={<FolderOpen className="w-4 h-4" />}
            label="Открыть галерею"
            onClick={() => setIsGalleryModalOpen(true)}
          />
        </div>
      )}

      {uploadError && (
        <p className="text-[14px] font-bold text-rose-700 break-words">{uploadError}</p>
      )}

      <GallerySelectModal
        isOpen={isGalleryModalOpen}
        onClose={() => setIsGalleryModalOpen(false)}
        multiple={maxCount > 1}
        maxCount={maxCount}
        userId={userId}
        title={maxCount > 1 ? `Выбор референсов из галереи (до ${maxCount} шт.)` : 'Выбор референса из галереи'}
        onSelect={(selected) => mergeImageUrls(selected)}
      />
    </div>
  );
};
