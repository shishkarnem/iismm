export interface Settings {
  telegramBotToken: string;
  channelId: string;
  backupChannelId: string;
  autoPostSchedule: boolean;
  autoPostTime: string;
  theme: string;
  protalkBotId?: string;
  protalkBotToken?: string;
  moderationLogUrl?: string;
  moderationEnabled?: boolean;
  costImageNoTextIirky?: number;
  costImageWithTextIirky?: number;
  costImage621Iirky?: number;
  costImage784Iirky?: number;
  costImage787Iirky?: number;
  costImage791Iirky?: number;
  function621Id?: number;
  function784Id?: number;
  function784Resolution?: string;
  function787Id?: number;
  function787AiModel?: string;
  function787Size?: string;
  function787Quality?: string;
  function787OutputFormat?: string;
  function787ResponseFormat?: string;
  function787Background?: string;
  function787Mode?: string;
  function791Id?: number;
  costPerTokenRub?: number;
  robokassa?: {
    merchantLogin: string;
    pass1: string;
    pass2: string;
    isTest: boolean;
  };
}

export interface PostTemplate {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  type?: string;
  [key: string]: any;
}

export interface MediaFile {
  id: string;
  userId?: string;
  originalName: string;
  name: string;
  fullUrl: string;
  shortKey: string;
  shortUrl: string;
  fileType: 'image' | 'video' | 'audio' | 'document' | 'file';
  mimeType: string;
  fileSize: number;
  sizeFormatted: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  createdAt: string;
}

export interface SystemPrompt {
  id: string;
  scenarioKey: string;
  title: string;
  promptText: string;
  description: string;
  createdAt: string;
}
