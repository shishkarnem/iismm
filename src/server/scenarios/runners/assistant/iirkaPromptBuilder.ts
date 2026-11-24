import { Scenario, Channel } from '../../../../types';
import {
  combineSystemAndUserPrompt,
  getRequiredScenarioPrompt,
  renderPromptTemplate
} from '../../prompts/scenarioPromptsRepo';

export interface IirkaStepDiff {
  nodeId: string;
  nodeType: string;
  title: string;
  subtitle: string;
  status: 'added' | 'modified' | 'unchanged' | 'removed';
  cost: number;
  note?: string;
}

export interface IirkaAssistantRequest {
  mode: 'create' | 'edit';
  taskText: string;
  preferredFormat?: 'auto' | 'v2' | 'rich';
  targetChannels?: string[];
  existingScenario?: Scenario | null;
  refinementHistory?: Array<{ role: 'user' | 'assistant'; text: string }>;
  autoSave?: boolean;
  userId?: string;
}

export const IIRKA_ASSISTANT_ACTION_COST = 5;

export interface IirkaAssistantResponse {
  success: boolean;
  mode: 'create' | 'edit';
  savedToDb: boolean;
  chargedCost: number;
  newBalance?: number;
  assistantSummary: string;
  highlights: string[];
  estimatedRunCost: number;
  scenario: Scenario;
  stepDiffs: IirkaStepDiff[];
}

export function cleanNoCapsText(input: string): string {
  return String(input || '');
}

const NODES_CATALOG_DOC = `   - "trigger_schedule": запуск по расписанию. config: { cronInterval: "daily" | "weekly" | "1h" | "2h" | "4h" | "6h" | "12h", cronTime: "10:00", cronDays: [1,2,3,4,5,6,7], sleepMode: false, sleepStartTime: "23:00", sleepEndTime: "08:00" }
   - "trigger_manual": ручной запуск по кнопке. config: {}
   - "ai_generate_topic_fast": быстрая тема за 1 Иирку. config: { topicCategory: "Рубрика", topicAngle: "guide" | "case_study" | "news" | "mistakes" | "qa" | "tips", targetAudience: "", topicKeywords: "" }
   - "ai_generate_topic": тема с анализом архива за 30 дней (10 Иирок). config: { topicCategory: "Рубрика", historyDaysLimit: 30, excludeHistory: true }
   - "ai_generate_text": генератор текста поста (1 Иирка). В формате "v2" СРАЗУ включает в себя красивое оформление, макет, галочки разметки и эталонный пример без отдельного блока format_beauty_post! config: { postStyleId: "expert" | "storytelling" | "business" | "provocative" | "educational" | "minimalist" | "selling" | "humor", postStyle: "🧠 Экспертный и аналитический", styleDesc: "Живой экспертный стиль", messageFormat: "v2" | "rich", minChars: 800, maxChars: 2500 (или 900 если есть медиа в v2; или 6000..12000 для rich), userPrompt: "Подробная инструкция для текста с {{topic}}", richIncludeHeadings: true, richIncludeLists: true, richIncludeQuotes: true, includeTopicHeading: true, headingDecor: "sparkle" | "pin" | "editorial" | "clean", topicHeadingTemplate: "{{topic}}", v2LayoutPreset: "magazine_v2" | "expert_cards_v2" | "concise_digest_v2" | "story_emotion_v2", v2UseBoldAccents: true, v2UseItalicLead: true, v2UseMonospace: true, v2UseBlockquote: true, v2UseEmojiBullets: true, formatExampleV2: "", customFormatNotes: "" }
   - "ai_generate_image_prompt": генератор визуального промпта картинки (1 Иирка). config: { promptVisualStyle: "Современная редакционная иллюстрация, мягкий свет", promptSourceMode: "previous_step" | "each_rich_part", handoffMode: "summary" | "parts_stream" }
   - "ai_generate_image": генерация иллюстрации. config: { functionMode: "func_621" (5 Иирок по умолчанию, фотореализм) | "func_784" (10 Иирок, короткий заголовок) | "func_791" (15 Иирок, про-модель gpt-image-2.5-sunburst: инфографика и кириллица, aspectRatio: "auto" | "16:9" | "9:16" | "1:1" | "4:5" | "3:2"), promptMode: "auto_context", styleHint: "Чистый современный визуал", imagePrompt: "", imageCount: 1, mediaType: "photo" | "album", aspectRatio: "16:9" }
   - "rich_split_parts" (только rich): разделение текста на части. config: { partsCount: 3, splitMode: "ai_semantic" | "headings_paragraphs", keepPartHeadings: true, handoffMode: "parts_stream" }
   - "rich_part_image" (только rich): одиночная картинка к частям. config: { applyToParts: "all" | "selected", selectedPartNumbers: [1,2,3], partVisualPosition: "after_heading", functionMode: "func_621" | "func_784" | "func_791", aspectRatio: "16:9", styleHint: "Иллюстрация по смыслу главы" }
   - "rich_part_slideshow" (только rich): слайдер к частям. config: { applyToParts: "selected" | "all", selectedPartNumbers: [1], slidesPerPart: 3, partVisualPosition: "after_text", functionMode: "func_621" | "func_784" | "func_791", aspectRatio: "16:9" }
   - "rich_part_collage" (только rich): коллаж к частям. config: { applyToParts: "selected" | "all", selectedPartNumbers: [2], slidesPerPart: 3, partVisualPosition: "after_text", functionMode: "func_621" | "func_784" | "func_791", aspectRatio: "1:1" }
   - "rich_assemble_post" (только rich): сборка частей в единый Rich-пост. config: { includeMainTitle: true, partSeparator: "line", appendSignatureInAssemble: false }
   - "v2_media_attachment" (только v2): вложение медиа. config: { v2AttachmentKind: "photo" | "album" | "video" | "video_note" | "audio" | "voice" | "document", protectContent: false, captionText: "" }
   - "format_beauty_post" (ТОЛЬКО rich): красивое оформление длинной Rich-статьи по стилям конструктора и правилам Rich (1 Иирка в режиме "ai_stylist" или 0 Иирок в режиме "smart_rules"). Для v2 НЕ добавляй этот блок — оформление v2 настраивается прямо в "ai_generate_text"! config: { formattingEngine: "ai_stylist" | "smart_rules", includeTopicHeading: true, headingDecor: "sparkle" | "pin" | "editorial" | "clean", topicHeadingTemplate: "{{topic}}", postStyleId: "expert", postStyle: "🧠 Экспертный и аналитический", maxCharsRich: 8000 (до 32000), richLayoutPreset: "editorial_longread" | "step_by_step_guide" | "analytical_review" | "visual_story_rich", richUseSubheadings: true, richUseBoldItalic: true, richUseBlockquote: true, richUseChecklist: true, richUseDividers: true }
   - "format_inline_buttons": инлайн-кнопки под постом. config: { buttonsMode: "ai_from_post" | "manual", aiButtonsCount: 2, aiButtonsPerRow: 1, defaultButtonUrl: "https://t.me/IIrkiBot", aiButtonsTone: "Полезный вовлекающий призыв", inlineButtons: [[{"text": "Читать подробнее", "url": "https://t.me/IIrkiBot", "style": "primary"}]] }
   - "format_signature": шаблон и подпись. config: { signature: "Подписывайтесь на канал" }
   - "logic_filter": условие если / иначе (ветки "yes" и "no" в edges). config: { conditionLogic: "all" | "any", conditionRules: [{"id": "rule_1", "field": "has_media" | "has_text" | "text_length_gte" | "contains_keyword" | "not_contains_keyword" | "day_of_week_in" | "rich_parts_gte", "value": "true"}] }
   - "logic_delay": задержка в минутах. config: { delayMinutes: 15 }
   - "publish_post": финальный блок системной сборки (медиа, проверка лимитов v2, подпись, инлайн-кнопки), сохранения в черновики и публикации в Telegram (обязателен в конце цепочки). config: { channels: ["@SAV_AI"], channelId: "@SAV_AI", publishTimingMode: "immediate" | "draft_only" | "delay_after_start" | "same_day_time" | "offset_days_time", delayHours: 2, delayMinutesAfterStart: 0, publishTimeOfDay: "14:00", offsetDays: 1, sameDayFallback: "plus_15m" }
   - "notify_author": личное уведомление автору в Telegram. config: {}`;

const OUTPUT_SCHEMA_DOC = `Верни строго валидный json-объект без пояснений вокруг и без markdown-оберток по следующей структуре:
{
  "assistantSummary": "Дружелюбный отчет от первого лица женского рода (Иирка собрала / обновила...), 1-3 предложения",
  "highlights": [
    "Короткий пункт 1 о том, что настроено",
    "Короткий пункт 2 о расписании, формате или каналах"
  ],
  "scenario": {
    "name": "Название сценария",
    "description": "Краткое описание задачи сценария",
    "category": "Рубрика контента",
    "messageFormat": "v2",
    "targetChannels": ["@SAV_AI"],
    "nodes": [
      {
        "id": "node_1",
        "type": "trigger_schedule",
        "title": "Запуск по расписанию",
        "config": {
          "cronInterval": "daily",
          "cronTime": "10:00",
          "cronDays": [1, 2, 3, 4, 5, 6, 7]
        }
      }
    ],
    "edges": [
      {
        "id": "edge_1",
        "sourceNodeId": "node_1",
        "targetNodeId": "node_2",
        "branch": "default"
      }
    ]
  }
}`;

export async function buildIirkaPrompt(params: {
  mode: 'create' | 'edit';
  taskText: string;
  preferredFormat: 'auto' | 'v2' | 'rich';
  selectedChannels: string[];
  availableChannels: Channel[];
  existingScenario?: Scenario | null;
  existingNames: string[];
  refinementHistory?: Array<{ role: 'user' | 'assistant'; text: string }>;
}): Promise<string> {
  const {
    mode,
    taskText,
    preferredFormat,
    selectedChannels,
    availableChannels,
    existingScenario,
    existingNames,
    refinementHistory
  } = params;

  const promptRecord = await getRequiredScenarioPrompt('scenario_architect', mode);

  const channelsCatalog =
    availableChannels.length > 0
      ? availableChannels
          .map((ch: any) => {
            const id = ch.channel_id || ch.username || ch.id;
            const title = ch.title || ch.name || id;
            return `- "${title}" -> идентификатор канала: "${id}"`;
          })
          .join('\n')
      : `- Основной канал по умолчанию -> "@SAV_AI"`;

  const historyBlock =
    Array.isArray(refinementHistory) && refinementHistory.length > 0
      ? `\nПредыдущие реплики диалога доработки:\n${refinementHistory
          .slice(-6)
          .map((m) => `${m.role === 'user' ? 'Пользователь' : 'Иирка'}: ${m.text}`)
          .join('\n')}\n`
      : '';

  const existingBlock =
    mode === 'edit' && existingScenario
      ? `\nТекущий редактируемый сценарий (сохраняй id неизмененных блоков, меняй, добавляй или удаляй только то, о чем просит пользователь):
${JSON.stringify(
  {
    id: existingScenario.id,
    name: existingScenario.name,
    description: existingScenario.description,
    category: existingScenario.category,
    messageFormat: existingScenario.messageFormat,
    targetChannels: existingScenario.targetChannels,
    nodes: (existingScenario.nodes || []).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      config: n.config
    })),
    edges: existingScenario.edges || []
  },
  null,
  2
)}\n`
      : '';

  const takenNamesNote =
    existingNames.length > 0
      ? `Уже занятые названия сценариев (при создании выбери другое уникальное имя): ${existingNames
          .slice(0, 25)
          .join(', ')}.`
      : '';

  const renderedUserPrompt = renderPromptTemplate(promptRecord.user_prompt_template, {
    preferred_format: preferredFormat,
    nodes_catalog: NODES_CATALOG_DOC,
    channels_catalog: channelsCatalog,
    selected_channels: JSON.stringify(selectedChannels),
    taken_names_note: takenNamesNote,
    existing_block: existingBlock,
    history_block: historyBlock,
    task_text: taskText,
    output_schema: OUTPUT_SCHEMA_DOC
  });

  return combineSystemAndUserPrompt(promptRecord.system_prompt, renderedUserPrompt);
}
