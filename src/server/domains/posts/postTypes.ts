export interface Prompt {
  id: string;
  title: string;
  dayOfWeek: string;
  category: string;
  content: string;
  createdAt: string;
  authorId: string;
  messageFormat?: 'markdown' | 'html';
  uppercaseHeader?: boolean;
  signature?: string;
  linkPreviewEnabled?: boolean;
  attachmentType?: 'none' | 'photo' | 'document' | 'video' | 'audio';
  attachmentUrl?: string;
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
  attachmentType?: 'none' | 'photo' | 'document' | 'video' | 'audio' | 'album' | 'video_note' | 'voice';
  attachmentUrl?: string;
  attachmentUrls?: string[];
  audioFormat?: 'audio' | 'voice';
  audioTitle?: string;
  audioPerformer?: string;
  protectContent?: boolean;
  linkPreviewEnabled?: boolean;
  inlineButtons?: any;
  messageFormat?: 'v2' | 'rich' | 'markdown' | 'html';
  signature?: string;
  uppercaseHeader?: boolean;
  [key: string]: any;
}

export function detectMessageFormat(text?: string, explicitFormat?: string): 'v2' | 'rich' {
  if (explicitFormat === 'rich' || explicitFormat === 'html') return 'rich';
  if (explicitFormat === 'v2' || explicitFormat === 'markdown') {
    return 'v2';
  }
  if (!text) return 'v2';

  const hasRichTags =
    /<(?:tg-collage|tg-slideshow|details|summary|table|blockquote|tg-spoiler|tg-emoji|b|strong|i|em|u|ins|s|strike|del|pre|code|a\s+)/i.test(
      text
    );
  const hasRichMarkdown = /(?:^|\n)(?:#{1,6}\s+|-\s*\[[ xX]\]|\*\s*\[[ xX]\]|\s*>\s+)/m.test(
    text
  );

  if (hasRichTags || hasRichMarkdown) {
    return 'rich';
  }
  return 'v2';
}

export interface DayRequest {
  id: string;
  userId?: string;
  dayOfWeek?: string;
  category: string;
  requestTemplate: string;
  channel: string;
  channels?: string[];
  title?: string;
  postText?: string;
  content?: string;
  desc?: string;
  attachmentType?: 'none' | 'photo' | 'document' | 'video' | 'audio' | 'album' | 'video_note' | 'voice';
  attachmentUrl?: string;
  attachmentUrls?: string[];
  audioFormat?: 'audio' | 'voice';
  audioTitle?: string;
  audioPerformer?: string;
  protectContent?: boolean;
  linkPreviewEnabled?: boolean;
  signature?: string;
  inlineButtons?: any[];
  uniquenessMemoryCount?: number;
  triggerSchedule?: {
    enabled: boolean;
    interval?: string;
    time?: string;
    daysOfWeek?: string[];
    [key: string]: any;
  };
  messageFormat?: 'v2' | 'rich' | 'markdown' | 'html';
  uppercaseHeader?: boolean;
  publishToSocialFeed?: boolean;
  status?: string;
  createdAt?: string;
  publishedAt?: string | null;
  [key: string]: any;
}

export interface PublicationLog {
  id: string;
  timestamp: string;
  promptTitle: string;
  channel: string;
  status: boolean;
  error?: string;
  publicationId?: string;
  [key: string]: any;
}

export function buildDayRequestSqlFields(resultReq: DayRequest): Record<string, any> {
  let effectiveSchedule = resultReq.triggerSchedule ? { ...resultReq.triggerSchedule } : undefined;
  if (resultReq.publishToSocialFeed !== undefined) {
    effectiveSchedule = {
      ...(effectiveSchedule || { enabled: false }),
      publishToSocialFeed: Boolean(resultReq.publishToSocialFeed)
    };
  }

  const fields: Record<string, any> = {
    title: resultReq.title,
    category: resultReq.category,
    request_template: resultReq.requestTemplate,
    post_text: resultReq.postText !== undefined ? resultReq.postText : '',
    content: resultReq.postText !== undefined ? resultReq.postText : undefined,
    channel: resultReq.channel,
    channels: resultReq.channels ? JSON.stringify(resultReq.channels) : undefined,
    message_format: resultReq.messageFormat,
    signature: resultReq.signature,
    attachment_type: resultReq.attachmentType,
    attachment_url: resultReq.attachmentUrl,
    attachment_urls: resultReq.attachmentUrls ? JSON.stringify(resultReq.attachmentUrls) : undefined,
    audio_format: (resultReq as any).audioFormat,
    audio_title: (resultReq as any).audioTitle,
    audio_performer: (resultReq as any).audioPerformer,
    protect_content: (resultReq as any).protectContent !== undefined ? ((resultReq as any).protectContent ? 1 : 0) : undefined,
    link_preview_enabled: resultReq.linkPreviewEnabled !== undefined ? (resultReq.linkPreviewEnabled === false ? 0 : 1) : undefined,
    inline_buttons_json: resultReq.inlineButtons ? JSON.stringify(resultReq.inlineButtons) : undefined,
    status: resultReq.status,
    published_at: resultReq.publishedAt !== undefined ? resultReq.publishedAt : undefined,
    trigger_schedule: effectiveSchedule ? JSON.stringify(effectiveSchedule) : undefined
  };
  if (resultReq.userId) fields.user_id = resultReq.userId;
  return fields;
}
