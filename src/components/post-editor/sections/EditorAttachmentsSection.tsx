import React from 'react';
import { FolderOpen, Image as ImageIcon, Paperclip, Plus, Sparkles, Trash2 } from 'lucide-react';
import { CollapsibleSection } from '../../ui-kit/CollapsibleSection';
import { GradientSelect } from '../../ui-kit/GradientDropdown';
import { ResponsiveActionBtn } from '../../ui-kit/ResponsiveActionBtn';
import { FileUpload } from '../../FileUpload';
import { formatAbsoluteUrl, isVideoMediaUrl } from '../../../utils/urlUtils';

export type PostAttachmentType =
  | 'none'
  | 'photo'
  | 'album'
  | 'video'
  | 'video_note'
  | 'audio'
  | 'voice'
  | 'document';

interface EditorAttachmentsSectionProps {
  messageFormat: 'rich' | 'markdown_v2' | 'html';
  attachmentType: PostAttachmentType;
  onChangeAttachmentType: (next: PostAttachmentType) => void;
  attachmentUrl: string;
  onChangeAttachmentUrl: (url: string) => void;
  attachmentUrls: string[];
  onChangeAttachmentUrls: (urls: string[]) => void;
  audioFormat: 'audio' | 'voice';
  onChangeAudioFormat: (fmt: 'audio' | 'voice') => void;
  onOpenGallerySingle: () => void;
  onOpenGalleryAlbum: () => void;
  onOpenImageBuilderForCover: () => void;
  onOpenImageBuilderForAlbum: () => void;
}

const ATTACHMENT_OPTIONS: { value: PostAttachmentType; label: string; sublabel: string }[] = [
  { value: 'none', label: 'Без медиавложения (только текст)', sublabel: 'До 4096 символов текста' },
  { value: 'photo', label: 'Одна картинка / обложка', sublabel: 'Фотография или инфографика (подпись до 1024 симв.)' },
  { value: 'album', label: 'Альбом фото и видео (2–10 файлов)', sublabel: 'Смешанная серия фото и видеороликов в одном сообщении' },
  { value: 'video', label: 'Видеоролик (MP4)', sublabel: 'Прямая ссылка на видеофайл' },
  { value: 'video_note', label: 'Видеокружок (круглое видео)', sublabel: 'Квадратное видео до 60 секунд' },
  { value: 'audio', label: 'Аудиофайл / подкаст (MP3)', sublabel: 'Музыкальная дорожка или выпуск' },
  { value: 'voice', label: 'Голосовое сообщение (OGG)', sublabel: 'Голосовая заметка с волной звука' },
  { value: 'document', label: 'Документ / файл (PDF, ZIP, DOCX)', sublabel: 'Файл для скачивания подписчиками' }
];

export const EditorAttachmentsSection: React.FC<EditorAttachmentsSectionProps> = ({
  messageFormat,
  attachmentType,
  onChangeAttachmentType,
  attachmentUrl,
  onChangeAttachmentUrl,
  attachmentUrls,
  onChangeAttachmentUrls,
  audioFormat,
  onChangeAudioFormat,
  onOpenGallerySingle,
  onOpenGalleryAlbum,
  onOpenImageBuilderForCover,
  onOpenImageBuilderForAlbum
}) => {
  if (messageFormat === 'rich') {
    return null;
  }

  const currentOpt = ATTACHMENT_OPTIONS.find((o) => o.value === attachmentType);
  const summary =
    attachmentType === 'none'
      ? 'Без вложений'
      : attachmentType === 'album'
      ? `Альбом · ${attachmentUrls.filter(Boolean).length} кадр.`
      : currentOpt?.label || 'Медиафайл';

  return (
    <CollapsibleSection
      title="Вложения к посту"
      summary={summary}
      icon={<Paperclip size={17} />}
      defaultOpen={attachmentType !== 'none'}
    >
      <div className="space-y-3.5">
        <GradientSelect
          label="Формат вложения"
          value={attachmentType}
          onChange={(val) => {
            const next = val as PostAttachmentType;
            onChangeAttachmentType(next);
            if (next === 'audio' || next === 'voice') {
              onChangeAudioFormat(next);
            }
          }}
          options={ATTACHMENT_OPTIONS}
        />

        {(attachmentType === 'audio' || attachmentType === 'voice') && (
          <GradientSelect
            label="Режим отправки звука в Telegram"
            value={audioFormat}
            onChange={(val) => {
              const fmt = val as 'audio' | 'voice';
              onChangeAudioFormat(fmt);
              onChangeAttachmentType(fmt);
            }}
            options={[
              { value: 'audio', label: 'Аудиоплеер с названием файла (MP3 / M4A)' },
              { value: 'voice', label: 'Голосовое сообщение с звуковой волной (OGG)' }
            ]}
          />
        )}

        {attachmentType !== 'none' && attachmentType !== 'album' && (
          <div className="space-y-3 p-3.5 rounded-2xl bg-white/70 border border-pink-300/70">
            <div>
              <label className="block text-[14px] font-bold mb-1 text-slate-900">
                Ссылка на файл вложения
              </label>
              <input
                type="text"
                value={attachmentUrl}
                onChange={(e) => onChangeAttachmentUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ResponsiveActionBtn
                icon={<FolderOpen size={16} />}
                label="Выбрать из галереи"
                title="Открыть мою галерею файлов"
                variant="outline"
                onClick={onOpenGallerySingle}
              />

              {attachmentType === 'photo' && (
                <ResponsiveActionBtn
                  icon={<Sparkles size={16} />}
                  label="Нейроконструктор картинки"
                  title="Сгенерировать обложку (модели 787, 621, 784, 791)"
                  variant="vivid"
                  onClick={onOpenImageBuilderForCover}
                />
              )}

              {attachmentUrl && (
                <ResponsiveActionBtn
                  icon={<Trash2 size={16} />}
                  label="Очистить"
                  title="Убрать ссылку на вложение"
                  variant="danger"
                  showLabelFrom="md"
                  onClick={() => onChangeAttachmentUrl('')}
                />
              )}
            </div>

            {attachmentType === 'photo' && attachmentUrl && (
              <div className="rounded-xl overflow-hidden border border-pink-300/80 max-w-sm">
                <img src={attachmentUrl} alt="Обложка" className="w-full max-h-48 object-cover" />
              </div>
            )}
          </div>
        )}

        {attachmentType === 'album' && (
          <div className="space-y-3 p-3.5 rounded-2xl bg-white/70 border border-pink-300/70">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5">
                <ImageIcon size={16} className="text-pink-600" />
                <span>Кадры альбома ({attachmentUrls.length} / 10)</span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {attachmentUrls.length < 10 && (
                  <FileUpload
                    variant="compact"
                    multiple
                    accept="image/*,video/*"
                    buttonLabel="Загрузить фото/видео"
                    onUploaded={(_k, url) => {
                      const clean = formatAbsoluteUrl(url);
                      if (clean) {
                        onChangeAttachmentUrls([...attachmentUrls.filter(Boolean), clean].slice(0, 10));
                      }
                    }}
                    onBatchUploaded={(items) => {
                      const urls = items.map((it) => formatAbsoluteUrl(it.url)).filter(Boolean);
                      if (urls.length > 0) {
                        onChangeAttachmentUrls([...attachmentUrls.filter(Boolean), ...urls].slice(0, 10));
                      }
                    }}
                  />
                )}
                <ResponsiveActionBtn
                  icon={<FolderOpen size={15} />}
                  label="Из галереи"
                  variant="outline"
                  onClick={onOpenGalleryAlbum}
                  disabled={attachmentUrls.length >= 10}
                />
                <ResponsiveActionBtn
                  icon={<Sparkles size={15} />}
                  label="Сгенерировать кадр"
                  variant="vivid"
                  onClick={onOpenImageBuilderForAlbum}
                  disabled={attachmentUrls.length >= 10}
                />
              </div>
            </div>

            <div className="space-y-2">
              {attachmentUrls.map((url, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {url.trim() && (
                    isVideoMediaUrl(url) ? (
                      <video
                        src={url}
                        muted
                        playsInline
                        preload="metadata"
                        className="w-10 h-10 rounded-xl object-cover border border-pink-300 shrink-0"
                      />
                    ) : (
                      <img
                        src={url}
                        alt={`Кадр ${idx + 1}`}
                        className="w-10 h-10 rounded-xl object-cover border border-pink-300 shrink-0"
                      />
                    )
                  )}
                  <input
                    type="text"
                    value={url}
                    onChange={(e) =>
                      onChangeAttachmentUrls(
                        attachmentUrls.map((u, i) => (i === idx ? e.target.value : u))
                      )
                    }
                    placeholder={`Ссылка на фото или видео ${idx + 1} (https://...)`}
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none"
                  />
                  <ResponsiveActionBtn
                    icon={<Trash2 size={15} />}
                    label="Удалить"
                    showLabelFrom="never"
                    variant="danger"
                    onClick={() =>
                      onChangeAttachmentUrls(attachmentUrls.filter((_, i) => i !== idx))
                    }
                  />
                </div>
              ))}
            </div>

            {attachmentUrls.length < 10 && (
              <ResponsiveActionBtn
                icon={<Plus size={15} />}
                label="Добавить поле ссылки"
                variant="outline"
                onClick={() => onChangeAttachmentUrls([...attachmentUrls, ''])}
              />
            )}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};
