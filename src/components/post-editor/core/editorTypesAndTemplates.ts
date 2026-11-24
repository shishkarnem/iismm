import { Channel, DayRequest, InlineButton, InlineButtonRow, PostTemplate, User } from '../../../types';

export const AI_IMAGE_MODELS = [
  {
    id: 'protalk-787',
    name: 'Модель 787 (быстрая)',
    provider: 'Функция 787',
    desc: 'Базовая быстрая нейромодель для иллюстраций и обложек постов',
    cost: 4
  },
  {
    id: 'protalk-621',
    name: 'Модель 621 (премиум арт)',
    provider: 'Функция 621',
    desc: 'Детализированные иллюстрации и художественные сцены',
    cost: 12
  },
  {
    id: 'protalk-784',
    name: 'Модель 784 (фото и референс)',
    provider: 'Функция 784',
    desc: 'Фотореализм, точная композиция и работа с референсом',
    cost: 15
  },
  {
    id: 'protalk-791',
    name: 'Модель 791 (текст на кириллице и инфографика)',
    provider: 'Функция 791',
    desc: 'Инфографика, баблы, надписи на кириллице в любом объеме и до 16 референсов',
    cost: 15
  }
];

export interface PostTelegramEditorProps {
  currentUser?: User | null;
  telegramId?: number | null;
  dayRequests: DayRequest[];
  templates?: PostTemplate[];
  channels?: Channel[];
  selectedPostId?: string | null;
  initialDayRequestId?: string | null;
  initialNeuroPlanData?: {
    id?: string;
    topic: string;
    title: string;
    prompt: string;
    dayIndex?: number;
    time?: string;
    channels?: string[];
    messageFormat?: 'rich' | 'markdown_v2' | 'v2';
    postStyle?: string;
  } | null;
  onClearInitialNeuroPlanData?: () => void;
  onSaveDayRequest: (req: Partial<DayRequest> & { id?: string }) => Promise<any>;
  onDeleteDayRequest?: (id: string) => Promise<void>;
  onPublishToTelegram: (
    title: string,
    text: string,
    postId: string,
    extra?: {
      messageFormat?: 'markdown_v2' | 'v2' | 'html' | 'rich';
      uppercaseHeader?: boolean;
      signature?: string;
      linkPreviewEnabled?: boolean;
      attachmentType?: 'none' | 'photo' | 'album' | 'video' | 'video_note' | 'audio' | 'voice' | 'document';
      attachmentUrl?: string;
      attachmentUrls?: string[];
      audioFormat?: 'audio' | 'voice';
      inlineButtons?: InlineButton[][] | InlineButtonRow[];
      channels?: string[];
      publishToSocialFeed?: boolean;
    }
  ) => Promise<void>;
  onSaveTemplate?: (template: {
    type: 'header' | 'postText' | 'signature' | 'full';
    name: string;
    category?: string;
    content: string;
  }) => Promise<void>;
  onBalanceRefresh?: () => Promise<void>;
  onBackToPosts?: () => void;
  onNavigate?: (tab: string) => void;
}

export type PromptEditorProps = PostTelegramEditorProps;

export interface ExtractedUrlInfo {
  url: string;
  domain: string;
  title: string;
  description: string;
  siteName: string;
}

export function extractFirstUrl(text: string): ExtractedUrlInfo | null {
  if (!text) return null;

  // Strip collage/slideshow blocks, HTML images, and Markdown images so media URLs never trigger a web link preview
  const stripped = text
    .replace(/<(?:tg-)?(?:collage|slideshow|carousel)\b[^>]*>[\s\S]*?<\/(?:tg-)?(?:collage|slideshow|carousel)>/gi, ' ')
    .replace(/<\/?(?:tg-)?(?:collage|slideshow|carousel)\b[^>]*>/gi, ' ')
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ');

  const mdMatch = stripped.match(/(?<!!)\[([^\]]+)\]\((https?:\/\/[^\s)]+|tg:\/\/[^\s)]+)\)/);
  const rawMatch = stripped.match(/(https?:\/\/[^\s)\]<>"']+)/);

  const rawUrl = mdMatch ? mdMatch[2] : rawMatch ? rawMatch[1] : null;
  if (!rawUrl || rawUrl.startsWith('tg://')) return null;

  const lowerUrl = rawUrl.toLowerCase();
  if (
    /\.(jpg|jpeg|png|webp|gif|svg|bmp|avif|mp4|webm|mov|mp3|ogg|wav|m4a|pdf|zip)(\?.*)?$/.test(lowerUrl) ||
    lowerUrl.includes('images.unsplash.com/') ||
    lowerUrl.includes('file.pro-talk.ru/tgf/')
  ) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const domain = parsed.hostname.replace(/^www\./, '');

    if (domain === 't.me' || domain === 'telegram.me') {
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      const handle = pathParts[0] || 'channel';
      return {
        url: rawUrl,
        domain: 'Telegram',
        siteName: 'Telegram',
        title: handle.startsWith('+') ? 'Приватное приглашение в Telegram' : `@${handle} — Канал / Бот в Telegram`,
        description: mdMatch?.[1]
          ? `Перейти к «${mdMatch[1]}» напрямую в мессенджере Telegram.`
          : 'Откройте канал, публикацию или мини-приложение в официальном клиенте Telegram.'
      };
    }

    if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
      return {
        url: rawUrl,
        domain: 'YouTube',
        siteName: 'YouTube',
        title: mdMatch?.[1] || 'Видеоролик на YouTube',
        description: 'Смотрите видео в высоком качестве со встроенным плеером прямо в ленте Telegram.'
      };
    }

    return {
      url: rawUrl,
      domain,
      siteName: domain,
      title: mdMatch?.[1] || `Страница на сайте ${domain}`,
      description: `Автоматическая карточка предпросмотра веб-страницы (${rawUrl.slice(0, 55)}${rawUrl.length > 55 ? '…' : ''})`
    };
  } catch {
    return null;
  }
}

export function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

export function extractHeadingsFromPost(text: string): { title: string; slug: string; level: number }[] {
  const results: { title: string; slug: string; level: number }[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      const rawTitle = hMatch[2].replace(/[*_~`[\]()]/g, '').trim();
      const slug = rawTitle
        .toLowerCase()
        .replace(/[^\w\u0400-\u04FF\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      if (rawTitle && slug) {
        results.push({ title: rawTitle, slug, level: hMatch[1].length });
      }
    }
    const anchorMatches = Array.from(line.matchAll(/<a\s+name="([^"]+)"\s*><\/a>/gi));
    for (const m of anchorMatches) {
      if (m[1] && !results.some((r) => r.slug === m[1])) {
        results.push({ title: `Якорь #${m[1]}`, slug: m[1], level: 0 });
      }
    }
  }
  return results;
}

export function ensureTitleHeadingInPostText(
  text: string,
  title?: string,
  messageFormat?: 'v2' | 'markdown_v2' | 'rich' | 'html'
): string {
  const rawText = String(text || '');
  if (!rawText.trim()) return rawText;
  const cleanTitle = String(title || '')
    .trim()
    .replace(/^#+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (
    !cleanTitle ||
    /^новый\s+пост\s+без\s+названия(?:\s*\(\d+\))?$/i.test(cleanTitle) ||
    /^черновик\s+поста$/i.test(cleanTitle) ||
    /^новая\s+публикация$/i.test(cleanTitle)
  ) {
    return rawText;
  }

  const isV2 = messageFormat === 'v2' || messageFormat === 'markdown_v2' || messageFormat === 'html';
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const firstIdx = lines.findIndex((l) => l.trim().length > 0);
  if (firstIdx === -1) return rawText;

  const firstLine = lines[firstIdx].trim();
  if (/^#{1,4}\s+/.test(firstLine)) {
    return rawText;
  }
  if (isV2 && (/^<(?:b|strong)>/i.test(firstLine) || /^\*[^*\n]{2,}\*/.test(firstLine))) {
    return rawText;
  }

  const stripDecor = (s: string) =>
    s
      .replace(/<\/?(?:b|strong|i|em|u|s)>/gi, '')
      .replace(/[*_~`]/g, '')
      .replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/g, '$1')
      .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  if (stripDecor(firstLine) === stripDecor(cleanTitle)) {
    lines[firstIdx] = isV2 ? `<b>${cleanTitle}</b>` : `# ${cleanTitle}`;
    return lines.join('\n');
  }

  return isV2 ? `<b>${cleanTitle}</b>\n\n${rawText.trimStart()}` : `# ${cleanTitle}\n\n${rawText.trimStart()}`;
}

export const DEFAULT_MARKDOWN_V2_TEMPLATE = `*Главный анонс недели: нейросети для ведения каналов* 🚀

Приветствуем подписчиков\\! Делимся свежей подборкой приёмов для оформления постов в *Telegram Markdown V2*\\.

> 💡 *Совет редакции:* Используйте визуальные акценты — *жирный шрифт*, _курсив_, __подчеркивание__ и ~зачеркивание~, чтобы удерживать внимание читателя до последней строчки\\.

*Что изменилось в обновлении:*
• Ускоренная генерация постов и визуала за секунды
• Поддержка скрытых инсайтов под спойлером: ||секретный промокод для подписчиков: IIRKA2025||
• Копируемые команды в один клик: \`/start_autopilot\`

> **Развернутый чек-лист подготовки поста**
> 1\\. Проверьте цепляющий заголовок в первой строке
> 2\\. Добавьте один главный визуальный акцент
> 3\\. Настройте инлайн\\-кнопку с целевым действием||

\`\`\`json
{
  "mode": "markdown_v2",
  "status": "ready_to_publish"
}
\`\`\`

Переходите в [официальный бот платформы](https://t.me/IIrkiBot) и тестируйте публикацию в один клик\\! ✨`;

export interface BuiltinTemplateItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  format: 'rich' | 'markdown_v2';
  category: string;
  postTitle: string;
  content: string;
}

export const BUILTIN_DRAFTS: BuiltinTemplateItem[] = [
  {
    id: 'tpl_v2_showcase',
    title: 'Короткий анонс для Telegram (Markdown V2)',
    format: 'markdown_v2',
    category: 'Анонс',
    postTitle: 'Главный анонс недели',
    content: DEFAULT_MARKDOWN_V2_TEMPLATE
  },
  {
    id: 'tpl_rich_article',
    title: 'Экспертный лонгрид с оглавлением (Rich / Instant View)',
    format: 'rich',
    category: 'Экспертиза',
    postTitle: 'Полный гид по контент-маркетингу в Telegram',
    content: `# Полный гид по контент-маркетингу в Telegram

Короткое вступление: почему структурные статьи в формате Instant View читают до конца в 3 раза чаще обычных простыней текста.

## 1. Главные элементы сильной статьи
• Чёткая структура с подзаголовками
• Короткие абзацы и наглядные списки
• Визуальные акценты и цитаты

> Читатель сканирует пост за первые 3 секунды — помогите ему сразу увидеть пользу.

## 2. Сравнение форматов публикаций
| Формат | Охват | Глубина чтения |
| :--- | :---: | ---: |
| Короткий пост V2 | Высокий | Быстрый скан |
| Rich-статья | Виральный репост | Глубокое чтение |

<details>
<summary>Дополнительный чек-лист перед публикацией</summary>
Проверьте заголовок, обложку и призыв к действию в финале статьи.
</details>

Подписывайтесь на наш канал и открывайте [бота @IIrkiBot](https://t.me/IIrkiBot) для автоматизации контента!`
  },
  {
    id: 'tpl_case_study',
    title: 'Кейс с цифрами и результатом (Markdown V2)',
    format: 'markdown_v2',
    category: 'Кейс',
    postTitle: 'Кейс: рост вовлеченности канала в 2.4 раза',
    content: `*Как мы увеличили охваты канала в 2\\.4 раза за 3 недели* 📈

*Исходная точка:*
Канал публиковал нерегулярные текстовые заметки без единого визуального стиля и расписания\\.

*Что внедрили:*
1\\. Ежедневный контент\\-план с чередованием рубрик
2\\. Единый визуальный стиль обложек с кириллическими заголовками
3\\. Интерактивные кнопки под каждым ключевым постом

> *Итог за 21 день:* средний ER вырос с \`3.8%\` до \`9.2%\`, а стоимость подписчика снизилась на ~38%~ *42%*\\!

Хотите повторить результат? Запускайте сценарий в [@IIrkiBot](https://t.me/IIrkiBot) 🚀`
  },
  {
    id: 'tpl_digest',
    title: 'Пятничный дайджест лучших материалов (Rich)',
    format: 'rich',
    category: 'Дайджест',
    postTitle: 'Главное за неделю: 5 материалов, которые стоит сохранить',
    content: `## Пятничный дайджест: топ-5 разборов недели

Собрали в одном месте самые полезные публикации за последние 7 дней, чтобы вы ничего не пропустили:

1. **Автоматизация рубрикатора** — как перестать тратить вечера на рутину
2. **Визуал с текстом на кириллице** — разбор новой модели 791 для инфографики
3. **Умное расписание** — в какие часы аудитория активнее всего реагирует на посты

[ ] Прочитать разбор по инфографике
[x] Сохранить дайджест в избранное

---

Какая тема зашла вам больше всего на этой неделе? Делитесь в комментариях и заглядывайте в [@IIrkiBot](https://t.me/IIrkiBot)!`
  }
];
