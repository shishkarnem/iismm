export interface InlineButton {
  id: string;
  text: string;
  type: 'callback' | 'url' | 'webapp';
  url?: string;
  callbackData?: string;
  style?: 'default' | 'primary' | 'success' | 'danger';
}

export interface ScenarioStep {
  id: string;
  stepNumber: number; // 1 to 6
  type:
    | 'analyze_history'
    | 'generate_text'
    | 'generate_image_prompt'
    | 'generate_image'
    | 'format_post'
    | 'schedule_post';
  title: string;
  description: string;
  enabled: boolean;
  config: {
    memoryCount?: number;
    topic?: string;
    requestTemplate?: string;
    imageStylePrompt?: string;
    messageFormat?: 'v2' | 'rich';
    channel?: string;
    channels?: string[];
    autoPublish?: boolean;
    [key: string]: any;
  };
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  isActive?: boolean;
  enabled?: boolean;
  steps: ScenarioStep[];
  cronSchedule?: {
    enabled: boolean;
    time: string; // HH:mm
    daysOfWeek: string[]; // ['mon', 'tue', ...]
    interval?: 'daily' | 'weekdays' | 'custom';
  };
  schedule?: any;
  targetChannels?: string[];
  messageFormat?: any;
  category?: string;
  lastStatus?: string;
  createdAt: string;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'failed' | 'running';
  lastRunError?: string;
  triggerSchedule?: {
    enabled: boolean;
    interval?: string;
    time?: string;
    daysOfWeek?: string[];
  };
  totalRuns?: number;
  successfulRuns?: number;
  userId?: string;
  testResults?: Record<string, any>;
  costImageIirky?: number;
  costTextIirky?: number;
  balanceIirky?: number;
  autoRechargeEnabled?: boolean;
  [key: string]: any;
}

export interface ScenarioLog {
  id: string;
  scenarioId: string;
  scenarioName: string;
  runAt: string;
  status: 'success' | 'failed' | 'partial';
  error?: string;
  details?: any;
  generatedText?: string;
  generatedImageUrl?: string;
  publishedPostId?: string;
  executedSteps: {
    stepNumber: number;
    stepType: string;
    status: 'success' | 'failed' | 'skipped';
    outputSummary?: string;
    durationMs?: number;
  }[];
  [key: string]: any;
}
