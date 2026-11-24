export type SocialNetwork =
  | 'telegram'
  | 'vk'
  | 'max'
  | 'instagram'
  | 'facebook'
  | 'pinterest'
  | 'linkedin'
  | 'discord'
  | 'x'
  | 'ok'
  | 'tenchat'
  | 'dzen'
  | 'setka'
  | 'tiktok';

export const PROMO_CATEGORIES = [
  'Бизнес и стартапы',
  'Маркетинг и PR',
  'Технологии и ИИ',
  'Новости и медиа',
  'Криптовалюта и финансы',
  'Образование и саморазвитие',
  'Психология и лайфстайл',
  'Развлечения и юмор',
  'Дизайн и творчество',
  'Экспертные блоги'
] as const;

export type PromoCategory = typeof PROMO_CATEGORIES[number];

export interface InlineButton {
  id: string;
  text: string;
  type?: 'callback' | 'url' | 'webapp' | 'copy_text' | 'web_app';
  url?: string;
  value?: string;
  callbackData?: string;
  iconEmoji?: string;
  style?: '' | 'default' | 'primary' | 'success' | 'danger';
  color?: 'blue' | 'purple' | 'pink' | 'emerald' | 'orange' | 'red';
}

export interface InlineButtonItem {
  id: string;
  text: string;
  type: 'url' | 'callback' | 'copy_text' | 'web_app' | 'webapp';
  value: string;
  url?: string;
  iconEmoji?: string;
  style?: '' | 'default' | 'primary' | 'danger' | 'success';
}

export interface InlineButtonRow {
  id: string;
  buttons: InlineButtonItem[];
}

export type ScheduleFrequency =
  | 'once'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'hours'
  | 'minutes'
  | 'interval_minutes'
  | 'interval_hours'
  | 'dayOfWeek'
  | 'exact_date';

export interface SocialChannel {
  id: string;
  name: string;
  username: string;
  platform?: SocialNetwork;
  avatarUrl?: string;
  subscribers?: number;
  subscribersCount?: number;
  category?: string;
  isPremium?: boolean;
  status?: 'connected' | 'pending';
  isActive?: boolean;
  role?: 'own' | 'donor';
  channelType?: 'channel' | 'group' | 'stories' | 'chat';
  telegramId?: string;
  inviteLink?: string;
  description?: string;
  photoUrl?: string;
  userId?: string;
}

export interface CampaignPost {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  platforms?: SocialNetwork[];
  scheduledAt?: string;
  status: 'draft' | 'scheduled' | 'published' | 'sent' | 'failed';
  inlineButtons?: InlineButton[];
  isAiGenerated?: boolean;
  rewriteReferenceChannel?: string;
  clicks?: number;
  views?: number;
  utmData?: {
    source: string;
    medium: string;
    campaign: string;
  };
}

export interface PromoBundle {
  id: string;
  title: string;
  organizerUsername: string;
  rules: string;
  entryFeeRub: number;
  channelsCount: number;
  maxChannels: number;
  status: 'draft' | 'collecting' | 'published';
  joinedChannels: string[];
  isFreeForOrganizer: boolean;
}

export interface AdListing {
  id: string;
  channelId: string;
  channelName: string;
  platform: SocialNetwork;
  priceRub: number;
  subscribersCount: number;
  avgViews: number;
  category: string;
  contactUsername: string;
  description: string;
}

export interface BulletinAd {
  id: string;
  title: string;
  content: string;
  mediaUrl?: string;
  linkUrl: string;
  postedBy: string;
  createdAt: string;
  clicks: number;
}

export interface AdOrder {
  id: string;
  title: string;
  payoutRub: number;
  platform: SocialNetwork;
  requirements: string;
  postContent: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email?: string;
  password?: string;
  passwordHash?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  telegramUsername: string;
  telegramId?: number;
  tariff?: string;
  tokens: number;
  iirky: number;
  telegramStars?: number;
  avatarUrl?: string;
  username?: string;
  photoUrl?: string;
  userAvatar?: string;
  user_avatar?: string;
  profileLink?: string;
  bio?: string;
  isPremium?: boolean;
  languageCode?: string;
  phone?: string;
  allowsWriteToPm?: boolean;
  latitude?: number;
  longitude?: number;
  referredBy?: number | string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  balance?: number;
  balance_free?: number;
  balance_pay?: number;
  balance_start?: number;
  balance_ref?: number;
  balance_tarif?: number;
  balance_admin?: number;
  balance_cost?: number;
  balance_time?: string;
  referralRewardBalance?: number;
  status?: 'Активный' | 'Блок' | 'Удален';
  timezone?: string;
  balanceRub: number;
  earningsRub: number;
  premiumUntil?: string;
  lastLogin?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface User {
  id: string;
  email?: string;
  password?: string;
  passwordHash?: string;
  role: string;
  createdAt: string;
  telegramId?: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  avatarUrl?: string;
  userAvatar?: string;
  profileLink?: string;
  bio?: string;
  isPremium?: boolean;
  languageCode?: string;
  phone?: string;
  allowsWriteToPm?: boolean;
  latitude?: number;
  longitude?: number;
  referredBy?: number | string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  balance?: number;
  balance_free?: number;
  balance_pay?: number;
  balance_start?: number;
  balance_ref?: number;
  balance_tarif?: number;
  balance_admin?: number;
  balance_cost?: number;
  balance_time?: string;
  referral_reward_balance?: number;
  status?: 'Активный' | 'Блок' | 'Удален';
  tariff?: string;
  timezone?: string;
  lastLogin?: string;
  [key: string]: any;
}

export type TransactionType = 'start' | 'pay' | 'tarif' | 'ref' | 'admin' | 'cost';

export interface TransactionRecord {
  id: string;
  user_id: string;
  type: TransactionType;
  balance_type: string;
  amount: number;
  description: string;
  comment?: string;
  status: string;
  created_at: string;
}

export interface TariffFeature {
  title: string;
  desc: string;
}

export interface TariffRecord {
  id: string;
  name: string;
  price_iirky: string;
  price_rub: number;
  sub: string;
  continuation?: string;
  monthly_iirky: number;
  features: string | TariffFeature[];
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface NotificationRecord {
  id: string;
  user_id: string;
  type: 'balance' | 'transaction' | 'social' | 'publish' | 'system';
  title: string;
  message: string;
  is_read: number;
  link?: string;
  created_at: string;
}

export interface Stats {
  postsCount: number;
  channelsCount: number;
  subscribersCount?: number;
  earningsRub?: number;
  viewsCount?: number;
  clicksCount?: number;
}

export interface Prompt {
  id: string;
  title: string;
  dayOfWeek: string;
  category: string;
  content: string;
  createdAt: string;
  authorId: string;
  messageFormat?: 'v2' | 'rich' | 'markdown' | 'html';
  uppercaseHeader?: boolean;
  signature?: string;
  linkPreviewEnabled?: boolean;
  attachmentType?: 'none' | 'photo' | 'document' | 'video' | 'audio' | 'album' | 'video_note';
  attachmentUrl?: string;
  attachmentUrls?: string[];
  [key: string]: any;
}

export interface Publication {
  id: string;
  userId?: string;
  promptId?: string;
  promptTitle: string;
  category?: string;
  text: string;
  channel: string;
  messageId?: string;
  status: boolean;
  statusType?: 'scheduled' | 'published' | 'failed' | 'cancelled' | 'draft';
  scheduledFor?: string;
  publishedAt: string;
  response?: string;
  attachmentType?: 'none' | 'photo' | 'document' | 'video' | 'audio' | 'album' | 'video_note';
  attachmentUrl?: string;
  attachmentUrls?: string[];
  inlineButtons?: InlineButton[];
  messageFormat?: 'v2' | 'rich' | 'markdown' | 'html';
  signature?: string;
  uppercaseHeader?: boolean;
  publishToSocialFeed?: boolean;
  [key: string]: any;
}

export interface DayRequest {
  id: string;
  userId?: string;
  dayOfWeek?: string;
  category?: string;
  promptText?: string;
  postTitle?: string;
  title?: string;
  published?: boolean;
  status?: any;
  scheduledTime?: string;
  targetChannel?: string;
  attachmentUrl?: string;
  attachmentUrls?: string[];
  attachmentType?: string;
  signature?: string;
  linkPreviewEnabled?: boolean;
  requestTemplate?: string;
  imagePrompt?: string;
  postText?: string;
  messageFormat?: string;
  uppercaseHeader?: boolean;
  uniquenessMemoryCount?: number;
  channels?: string[];
  channel?: string;
  audioFormat?: 'audio' | 'voice';
  inlineButtons?: any;
  triggerSchedule?: any;
  publishToSocialFeed?: boolean;
  [key: string]: any;
}

export interface PublicationLog {
  id: string;
  userId?: string;
  promptTitle: string;
  channel: string;
  time: string;
  status: 'Успешно' | 'Ошибка';
  message: string;
}

export interface Settings {
  appVersion?: string;
  telegramBotToken?: string;
  channelId?: string;
  backupChannelId?: string;
  autoPostSchedule?: boolean;
  autoPostTime?: string;
  theme?: string;
  protalkBotId?: string;
  protalkBotToken?: string;
  moderationLogUrl?: string;
  moderationEnabled?: boolean;
  costPerTokenRub?: number;
  costImageNoTextIirky?: number;
  costImageWithTextIirky?: number;
  costImage621Iirky?: number;
  costImage784Iirky?: number;
  costImage787Iirky?: number;
  costImage791Iirky?: number;
  function621Id?: number;
  function784Id?: number;
  function787Id?: number;
  function791Id?: number;
  function784Resolution?: string;
  function787AiModel?: string;
  function787Size?: string;
  function787Quality?: string;
  function787OutputFormat?: string;
  function787ResponseFormat?: string;
  function787Background?: string;
  function787Mode?: string;
  robokassa?: {
    merchantLogin: string;
    pass1: string;
    pass2: string;
    isTest: boolean;
  };
}

export interface Channel {
  id: string;
  userId?: string;
  name: string;
  username: string;
  isActive: boolean;
  subscribersCount?: number;
  inviteLink?: string;
  telegramId?: string;
  description?: string;
  photoUrl?: string;
  isPremium?: boolean;
  status?: string;
}

export interface PostTemplate {
  id: string;
  type: 'header' | 'postText' | 'signature' | 'full';
  name: string;
  category?: string;
  content: string;
  createdAt: string;
}

export type WorkflowNodeType =
  | 'trigger_schedule'              // Запуск по расписанию [Бесплатный]
  | 'trigger_manual'                // Ручной запуск [Бесплатный]
  | 'ai_generate_topic'             // Генерация темы с анализом истории 30 дней [10 Иирок]
  | 'ai_generate_topic_fast'        // Быстрый генератор темы без истории [1 Иирка]
  | 'ai_generate_text'              // Генератор текста поста (Rich / v2) [5 Иирок]
  | 'ai_generate_image_prompt'      // Генератор промпта для картинки по шагам [1 Иирка]
  | 'ai_rewrite'                    // Рерайт и уникализация [В разработке]
  | 'ai_generate_image'             // Генерация картинки через нейросеть (787 / 621 / 784)
  | 'ai_generate_image_with_text'   // Совместимость (784)
  | 'ai_generate_image_free'        // Совместимость (787)
  | 'ai_generate_image_no_text'     // Совместимость (787)
  | 'rich_split_parts'              // Разделение Rich-текста по смыслу на 1–10 частей [0 или 1 Иирка]
  | 'rich_part_image'               // Rich: одиночная картинка для части
  | 'rich_part_slideshow'           // Rich: слайдер (карусель) для части
  | 'rich_part_collage'             // Rich: коллаж для части
  | 'rich_assemble_post'            // Rich: сборка всех частей в единое сообщение [Бесплатный]
  | 'v2_media_attachment'           // v2: вставка медиа (фото, альбом, видео, кружок, аудио, голосовое, файлы)
  | 'format_media'                  // Медиа-вложения (совместимость и общие вложения)
  | 'format_beauty_post'            // Красивое оформление поста по стилю и правилам v2 / Rich
  | 'format_inline_buttons'         // Инлайн-кнопки (ручные или автогенерация за 1 Иирку)
  | 'format_signature'              // Шаблон и подпись [Бесплатный]
  | 'logic_filter'                  // Условие (если / иначе) с ветками Да / Нет [Бесплатный]
  | 'logic_delay'                   // Задержка по времени [Бесплатный]
  | 'publish_post'                  // Единый блок Публикация (черновик + динамическое время в Telegram)
  | 'publish_telegram'              // Совместимость со старыми сценариями
  | 'save_draft'                    // Совместимость со старыми сценариями
  | 'notify_author'                 // Уведомление автору [Бесплатный]
  | 'publish_crosspost';            // Кросспостинг [В разработке]

export type ScenarioInputScope = 'upstream' | 'selected_nodes' | 'full_chain';
export type ScenarioHandoffMode = 'full' | 'summary' | 'title_only' | 'structured' | 'parts_stream';
export type ScenarioPublishTimingMode =
  | 'draft_only'
  | 'immediate'
  | 'delay_after_start'
  | 'same_day_time'
  | 'offset_days_time';

export type V2ScenarioAttachmentKind =
  | 'photo'
  | 'album'
  | 'video'
  | 'video_note'
  | 'audio'
  | 'voice'
  | 'document';

export interface ScenarioRichPart {
  index: number;
  heading?: string;
  text: string;
  imagePrompt?: string;
  visualType?: 'none' | 'image' | 'slideshow' | 'collage';
  imageUrls?: string[];
  visualPosition?: 'before_heading' | 'before_text' | 'after_heading' | 'after_text';
}

export interface ScenarioConditionRule {
  id: string;
  field:
    | 'has_media'
    | 'no_media'
    | 'has_image'
    | 'has_text'
    | 'text_length_gte'
    | 'text_length_gt'
    | 'text_length_lte'
    | 'text_length_lt'
    | 'contains_keyword'
    | 'not_contains_keyword'
    | 'day_of_week_in'
    | 'day_of_week'
    | 'rich_parts_gte'
    | 'parts_count_gte';
  value?: string;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  title: string;
  subtitle?: string;
  x: number;
  y: number;
  enabled: boolean;
  cost: number;
  isUnderDevelopment?: boolean;
  config: {
    // Data handoff between steps
    inputScope?: ScenarioInputScope;
    sourceNodeIds?: string[];
    handoffMode?: ScenarioHandoffMode;

    // Trigger schedule
    cronInterval?: string;
    cronTime?: string;
    cronDays?: number[];
    cronExpression?: string;
    sleepMode?: boolean;
    sleepStartTime?: string;
    sleepEndTime?: string;

    // Topic & fast topic
    topicCategory?: string;
    topicAngle?: string;
    targetAudience?: string;
    topicKeywords?: string;
    historyDaysLimit?: number;

    // Text generation (Rich vs v2)
    postStyle?: string;
    styleDesc?: string;
    messageFormat?: 'v2' | 'rich';
    minChars?: number;
    maxChars?: number;
    uniquenessMemoryCount?: number;
    userPrompt?: string;
    linkPreviewEnabled?: boolean;
    richIncludeHeadings?: boolean;
    richIncludeQuotes?: boolean;
    richIncludeLists?: boolean;
    richIncludeTables?: boolean;
    richIncludeSpoilers?: boolean;
    richIncludeCallout?: boolean;

    // Image prompt generator (1 Iirka)
    promptSourceMode?: 'previous_step' | 'selected_steps' | 'each_rich_part' | 'per_part' | 'whole_post';
    visualStylePreset?: string;
    negativeHint?: string;

    // Rich split & part visuals & assemble
    splitMode?: 'ai_semantic' | 'headings_paragraphs';
    partsCount?: number;
    keepPartHeadings?: boolean;
    preservePartHeadings?: boolean;
    partTargetMode?: 'all' | 'selected';
    selectedPartNumbers?: number[];
    partVisualPosition?: 'before_heading' | 'before_text' | 'after_heading' | 'after_text';
    visualPosition?: 'before_heading' | 'before_text' | 'after_heading' | 'after_text';
    assembleIncludeTitle?: boolean;
    assembleHeadingLevel?: 'h1' | 'h2' | 'h3';
    assembleSeparator?: 'blank_line' | 'divider' | 'line' | 'blank' | 'none';
    assembleAttachSignature?: boolean;

    // V2 7-kind media attachments
    v2AttachmentKind?: V2ScenarioAttachmentKind;
    v2Files?: Array<{ url: string; name: string; size?: number }>;
    audioFormat?: 'audio' | 'voice';
    audioTitle?: string;
    audioPerformer?: string;
    protectContent?: boolean;
    captionText?: string;

    // Rewrite & image builder
    rewriteInstructions?: string;
    functionMode?: 'func_787' | 'func_621' | 'func_784' | 'func_791';
    promptMode?: 'auto_context' | 'custom_template';
    imagePrompt?: string;
    aspectRatio?: string;
    images_urls?: string;
    imagesUrls791?: string;
    mediaType?: 'photo' | 'album' | 'carousel' | 'slideshow' | 'collage' | V2ScenarioAttachmentKind;
    imageUrls?: string[];

    // Inline buttons (manual or AI 1 Iirka)
    buttonsMode?: 'manual' | 'ai_from_post';
    aiButtonsCount?: number;
    aiButtonsPerRow?: 1 | 2;
    aiButtonsDefaultUrl?: string;
    defaultButtonUrl?: string;
    aiButtonUrls?: string[];
    aiButtonsTone?: string;
    inlineButtons?: Array<Array<{ id?: string; text: string; url: string; style?: 'default' | 'primary' | 'danger' | 'success' }>>;

    // Signature
    signature?: string;

    // Logic filter (If / Else)
    conditionLogic?: 'and' | 'or' | 'all' | 'any';
    conditionRules?: ScenarioConditionRule[];
    filterCondition?: string;
    filterValue?: string;

    // Unified Publish block (Drafts + Dynamic Telegram Schedule)
    channelId?: string;
    channels?: string[];
    publishTimingMode?: ScenarioPublishTimingMode;
    delayHours?: number;
    delayMinutesAfterStart?: number;
    publishDelayHours?: number;
    publishDelayMinutes?: number;
    publishTimeOfDay?: string;
    publishExactTime?: string;
    offsetDays?: number;
    publishOffsetDays?: number;
    sameDayFallback?: 'plus_15m' | 'next_day';
    publishLateFallback?: 'plus_15m' | 'next_day';
    publishToSocialFeed?: boolean;
    applyUpstreamDelay?: boolean;

    delayMinutes?: number;
    telegramId?: number | string;
    [key: string]: any;
  };
  lastOutput?: any;
  lastRunStatus?: 'idle' | 'running' | 'success' | 'failed';
  lastRunError?: string;
}

export interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  branch?: 'yes' | 'no' | 'default';
  label?: string;
}

export interface ScenarioStep {
  id: string;
  stepNumber: number;
  type: 'analyze_history' | 'generate_text' | 'generate_image_prompt' | 'generate_image' | 'format_post' | 'schedule_post';
  title: string;
  description: string;
  enabled: boolean;
  config: {
    memoryCount?: number;
    topic?: string;
    requestTemplate?: string;
    imageStylePrompt?: string;
    messageFormat?: 'v2' | 'rich';
    channelId?: string;
    postTime?: string;
    signature?: string;
    inlineButtons?: InlineButton[];
    autoPublish?: boolean;
    [key: string]: any;
  };
}

export interface ScenarioNodeTestRecord {
  nodeId: string;
  nodeTitle: string;
  nodeType: string;
  output: Record<string, any>;
  cost: number;
  mode: 'single' | 'chain' | 'full';
  testedAt: string;
}

export interface ScenarioTestStepProgress {
  nodeId: string;
  nodeTitle: string;
  nodeType: string;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'error';
  stepPercent: number;
  cost?: number;
  message?: string;
}

export interface ScenarioTestProgressState {
  isRunning: boolean;
  mode: 'single' | 'chain' | 'full';
  percent: number;
  activeNodeId: string | null;
  activeNodeTitle: string;
  statusText: string;
  steps: ScenarioTestStepProgress[];
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  schedule: string;
  targetChannels: string[];
  messageFormat: 'v2' | 'rich';
  steps: ScenarioStep[];
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  workflowLayout?: 'canvas' | 'list';
  testResults?: Record<string, ScenarioNodeTestRecord>;
  lastRunAt?: string;
  nextRunAt?: string;
  lastSentAt?: string;
  lastRunSlot?: string;
  isSent?: boolean;
  runsCount?: number;
  lastStatus?: 'success' | 'failed' | 'running' | 'completed';
  lastError?: string;
  createdAt: string;
  generatedTopic?: string;
  topicCategory?: string;
  generatedText?: string;
  generatedImagePrompt?: string;
  generatedImageUrls?: string[];
  formattedPreview?: string;
  autoPublish?: boolean;
  [key: string]: any;
}

export interface ScenarioLog {
  id: string;
  scenarioId: string;
  scenarioName: string;
  runAt: string;
  executedAt?: string;
  status: 'success' | 'failed';
  generatedText?: string;
  generatedImageUrl?: string;
  details: string;
  cost: number;
}

export interface MediaFile {
  id: string;
  userId?: string;
  originalName: string;
  name: string;
  fullUrl: string;
  shortKey: string;
  shortUrl: string;
  fileType: 'photo' | 'video' | 'audio' | 'document' | 'video_note';
  mimeType?: string;
  fileSize?: number;
  sizeFormatted?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  createdAt: string;
}

export interface ProTalkResponse {
  title: string;
  content: string;
}

export interface DatabaseSchema {
  users: User[];
  prompts: Prompt[];
  publications: Publication[];
  dayRequests: DayRequest[];
  templates: PostTemplate[];
  channels: Channel[];
  settings: Settings;
  scenarios: Scenario[];
  scenarioLogs: ScenarioLog[];
  files?: MediaFile[];
}
