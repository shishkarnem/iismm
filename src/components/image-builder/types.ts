export type ImageBuilderMode =
  | 'func_787'
  | 'func_621'
  | 'func_784'
  | 'func_791'
  | 'no_text'
  | 'with_text'
  | 'free';

export type NormalizedImageFunctionMode = 'func_787' | 'func_621' | 'func_784' | 'func_791';

export type ImageAspectRatio =
  | 'auto'
  | '1:1'
  | '3:2'
  | '2:3'
  | '4:3'
  | '3:4'
  | '5:4'
  | '4:5'
  | '16:9'
  | '9:16'
  | '2:1'
  | '1:2'
  | '3:1'
  | '1:3'
  | '21:9'
  | '9:21';

export type ImageTargetMode = 'photo' | 'album' | 'slideshow' | 'collage';
export type ReferenceMode = 'upload' | 'url' | 'gallery';

export const ASPECT_RATIO_OPTIONS_791: { value: ImageAspectRatio; label: string }[] = [
  { value: 'auto', label: 'auto · Авто (по умолчанию квадрат)' },
  { value: '1:1', label: '1:1 · Квадрат' },
  { value: '16:9', label: '16:9 · Горизонтальная обложка' },
  { value: '9:16', label: '9:16 · Вертикальная история' },
  { value: '4:3', label: '4:3 · Классический альбомный' },
  { value: '3:4', label: '3:4 · Классический портретный' },
  { value: '3:2', label: '3:2 · Фотоальбом' },
  { value: '2:3', label: '2:3 · Постер' },
  { value: '5:4', label: '5:4 · Лента соцсетей' },
  { value: '4:5', label: '4:5 · Вертикальный пост' },
  { value: '2:1', label: '2:1 · Широкий баннер' },
  { value: '1:2', label: '1:2 · Длинный скролл / инфографика' },
  { value: '3:1', label: '3:1 · Панорамная шапка' },
  { value: '1:3', label: '1:3 · Высокая инфографика / вебтун' },
  { value: '21:9', label: '21:9 · Киноформат' },
  { value: '9:21', label: '9:21 · Ультра-вертикальный экран' }
];

export const ASPECT_RATIO_OPTIONS_BASIC: { value: '16:9' | '9:16' | '1:1'; label: string }[] = [
  { value: '16:9', label: '16:9 · Горизонтальная обложка' },
  { value: '9:16', label: '9:16 · Вертикальный кадр' },
  { value: '1:1', label: '1:1 · Квадрат для поста' }
];

export interface ImageBuilderSettings {
  cost621: number;
  cost784: number;
  cost787: number;
  cost791: number;
  costNoText: number;
  costWithText: number;
}

export interface Function787Config {
  ai_model: string;
  size: string;
  quality: string;
  output_format: string;
  response_format: string;
  images: string;
  images_url: string;
  background: string;
  mode: 'sync' | 'async' | 'stream';
  debug: boolean;
}

export interface Function791Config {
  aspect_ratio: string;
  images_urls: string;
  debug: boolean;
}

export interface ImageBuilderSyncedConfig {
  mode: NormalizedImageFunctionMode;
  prompt: string;
  promptMode?: 'auto' | 'custom';
  aspectRatio: string;
  imageCount: number;
  targetMode: ImageTargetMode;
  referenceUrl: string;
  func787: Function787Config;
  func791: Function791Config;
}

export interface ImageBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string) => void;
  onSelectImages?: (imageUrls: string[], targetMode: ImageTargetMode) => void;
  onSyncConfig?: (config: ImageBuilderSyncedConfig) => void;
  saveConfigButtonLabel?: string;
  editorFormat?: 'v2' | 'rich';
  defaultTargetMode?: ImageTargetMode;
  allowMultiple?: boolean;
  initialCount?: number;
  initialPrompt?: string;
  initialMode?: ImageBuilderMode | string;
  initialAspectRatio?: ImageAspectRatio | string;
  initialReferenceUrl?: string;
  initialFunc787Config?: Partial<Function787Config>;
  initialFunc791Config?: Partial<Function791Config>;
  title?: string;
  userId?: string;
  userBalance?: number;
  onRefreshUser?: () => void;
}

export interface GalleryFileItem {
  id: string;
  name: string;
  url: string;
  originalUrl?: string;
  mimeType?: string;
}

export function normalizeImageFunctionMode(m?: ImageBuilderMode | string): NormalizedImageFunctionMode {
  if (m === 'func_791' || m === '791') return 'func_791';
  if (m === 'func_621' || m === 'no_text' || m === '621') return 'func_621';
  if (m === 'func_784' || m === 'with_text' || m === '784') return 'func_784';
  if (m === 'func_787' || m === '787' || m === 'free') return 'func_787';
  return 'func_621';
}

export function buildRichMediaMarkdown(
  urls: string[],
  targetMode: 'photo' | 'slideshow' | 'collage',
  caption?: string
): string {
  const cleanUrls = urls.map(u => u.trim()).filter(Boolean);
  if (cleanUrls.length === 0) return '';
  if (targetMode === 'slideshow') {
    return `<tg-slideshow>\n${cleanUrls.map(u => `![](${u})`).join('\n')}\n</tg-slideshow>`;
  }
  if (targetMode === 'collage') {
    return `<tg-collage>\n${cleanUrls.map(u => `![](${u})`).join('\n')}\n</tg-collage>`;
  }
  const cleanCaption = caption ? caption.trim() : '';
  return cleanCaption ? `![${cleanCaption}](${cleanUrls[0]})` : `![](${cleanUrls[0]})`;
}
