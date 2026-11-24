export interface ScenarioPromptRecord {
  id: string;
  node_type: string;
  prompt_type: string;
  title: string;
  description: string;
  system_prompt: string;
  user_prompt_template: string;
  variables_hint: string;
  output_contract: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface SystemPromptRecord {
  id: string;
  scenarioKey: string;
  title: string;
  promptText: string;
  description?: string;
  createdAt?: string;
}

export type PromptCategoryKey =
  | 'all'
  | 'neuroplan_posts'
  | 'topics'
  | 'text_beauty'
  | 'images'
  | 'rich_buttons'
  | 'architect_schedule'
  | 'system_roles';

export const PROMPT_CATEGORY_OPTIONS: Array<{
  value: PromptCategoryKey;
  label: string;
  hint: string;
}> = [
  { value: 'all', label: 'Все разделы промптов', hint: 'Сценарии, нейроплан, посты, карусели и системные роли' },
  {
    value: 'neuroplan_posts',
    label: 'Нейроплан, посты и медиа',
    hint: 'Нейроплан 15 дней, редактор постов, анализ стиля, карусели, отзывы, автоответчик'
  },
  { value: 'topics', label: 'Темы и рерайт сценариев', hint: 'Генераторы тем с историей, быстрые идеи и рерайт' },
  { value: 'text_beauty', label: 'Текст поста и оформление', hint: 'Генерация текста v2/Rich и красивое оформление' },
  { value: 'images', label: 'Промпты и генерация картинок', hint: 'Промпты 621/784/787/791 и серии изображений' },
  { value: 'rich_buttons', label: 'Части Rich и инлайн-кнопки', hint: 'Разбивка статей, медиа частей и умные кнопки' },
  { value: 'architect_schedule', label: 'Иирка-архитектор и расписание', hint: 'Сборка графа сценариев и ИИ-парсер расписания' },
  { value: 'system_roles', label: 'Системные роли ИИ и модерация', hint: 'Чат-ассистенты, модераторы, 4U-заголовки, SMM-планер' }
];

const NODE_LABELS: Record<string, string> = {
  neuroplan: 'Нейроплан на 15 дней',
  author_style: 'Анализ авторского стиля',
  ai_carousel: 'Каскадная карусель слайдов',
  post_editor: 'Ручной редактор постов',
  ai_review_reply: 'Ответ ИИ на отзыв',
  social_autoresponder: 'Автоответчик в переписке',
  promo_folder_cover: 'Обложка папки взаимного пиара',
  ai_generate_topic: 'Тема с анализом истории',
  ai_generate_topic_fast: 'Быстрая тема / идея',
  ai_generate_text: 'Генератор текста поста',
  ai_generate_image_prompt: 'Промпт для картинки',
  ai_generate_image: 'Генерация изображения',
  rich_split_parts: 'Разбивка Rich на части',
  rich_part_image: 'Картинка части Rich',
  rich_part_slideshow: 'Слайдшоу части Rich',
  rich_part_collage: 'Коллаж части Rich',
  format_beauty_post: 'Красивое оформление поста',
  format_inline_buttons: 'Умные инлайн-кнопки',
  ai_rewrite: 'Рерайт и уникализация',
  scenario_architect: 'Иирка-архитектор сценариев',
  trigger_schedule: 'ИИ-парсер расписания'
};

export function getNodeHumanTitle(nodeType: string): string {
  return NODE_LABELS[nodeType] || nodeType;
}

export function getPromptCategoryByNodeType(nodeType: string): PromptCategoryKey {
  if (
    nodeType === 'neuroplan' ||
    nodeType === 'author_style' ||
    nodeType === 'ai_carousel' ||
    nodeType === 'post_editor' ||
    nodeType === 'ai_review_reply' ||
    nodeType === 'social_autoresponder' ||
    nodeType === 'promo_folder_cover'
  ) {
    return 'neuroplan_posts';
  }
  if (nodeType === 'ai_generate_topic' || nodeType === 'ai_generate_topic_fast' || nodeType === 'ai_rewrite') {
    return 'topics';
  }
  if (nodeType === 'ai_generate_text' || nodeType === 'format_beauty_post') {
    return 'text_beauty';
  }
  if (nodeType === 'ai_generate_image_prompt' || nodeType === 'ai_generate_image') {
    return 'images';
  }
  if (
    nodeType === 'rich_split_parts' ||
    nodeType === 'rich_part_image' ||
    nodeType === 'rich_part_slideshow' ||
    nodeType === 'rich_part_collage' ||
    nodeType === 'format_inline_buttons'
  ) {
    return 'rich_buttons';
  }
  if (nodeType === 'scenario_architect' || nodeType === 'trigger_schedule') {
    return 'architect_schedule';
  }
  return 'neuroplan_posts';
}

export function extractVariableTokens(variablesHint: string): string[] {
  const raw = String(variablesHint || '').trim();
  if (!raw) return [];
  const matches = raw.match(/\{\{[a-zA-Z0-9_.]+\}\}/g) || [];
  return Array.from(new Set(matches));
}

export const SCENARIO_NODE_TYPE_OPTIONS: Array<{ value: string; label: string }> = Object.entries(
  NODE_LABELS
).map(([value, label]) => ({
  value,
  label: `${label} (${value})`
}));
