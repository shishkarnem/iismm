/**
 * Centralized Database Facade for ProTalk Cloud PostgreSQL (iismm2).
 * Refactored into clean domain modules, preserving 100% backward compatibility.
 */
import { getSyncPgDB } from './db/postgres';
import { User } from './domains/users/userTypes';
import { UserDomain } from './domains/users/userDomain';
import {
  Prompt,
  Publication,
  DayRequest,
  PublicationLog,
  detectMessageFormat
} from './domains/posts/postTypes';
import { PostDomain, getDefaultChannelIdentifier } from './domains/posts/postDomain';
import { PromptDomain } from './domains/posts/promptDomain';
import { Channel } from './domains/channels/channelTypes';
import { ChannelDomain } from './domains/channels/channelDomain';
import {
  Scenario,
  ScenarioStep,
  ScenarioLog,
  InlineButton
} from './domains/scenarios/scenarioTypes';
import { ScenarioDomain } from './domains/scenarios/scenarioDomain';
import { getScenarioHelpDocs } from './domains/scenarios/scenarioDocs';
import {
  Settings,
  PostTemplate,
  MediaFile,
  SystemPrompt
} from './domains/settings/settingsTypes';
import { SettingsDomain } from './domains/settings/settingsDomain';
import { MediaFilesDomain } from './domains/settings/mediaFilesDomain';
import { SystemPromptsDomain } from './domains/settings/systemPromptsDomain';

export type {
  User,
  Prompt,
  Publication,
  DayRequest,
  PublicationLog,
  Channel,
  Scenario,
  ScenarioStep,
  ScenarioLog,
  InlineButton,
  Settings,
  PostTemplate,
  MediaFile,
  SystemPrompt
};

export {
  detectMessageFormat,
  getDefaultChannelIdentifier
};

export interface DatabaseSchema {
  users: User[];
  prompts: Prompt[];
  publications: Publication[];
  dayRequests: DayRequest[];
  publicationLogs: PublicationLog[];
  settings: Settings;
  channels: Channel[];
  templates: PostTemplate[];
  scenarios: Scenario[];
  scenarioLogs: ScenarioLog[];
  files?: MediaFile[];
}

export class DB {
  public static load(): DatabaseSchema {
    return {
      users: UserDomain.getUsers(),
      prompts: PromptDomain.getPrompts(),
      publications: PostDomain.getPublications(),
      dayRequests: PostDomain.getDayRequests(),
      publicationLogs: PromptDomain.getLogs(),
      settings: SettingsDomain.getSettings(),
      channels: ChannelDomain.getChannels(),
      templates: SystemPromptsDomain.getTemplates(),
      scenarios: ScenarioDomain.getScenarios(),
      scenarioLogs: ScenarioDomain.getScenarioLogs(),
      files: MediaFilesDomain.getFiles()
    };
  }

  public static save(data: DatabaseSchema): void {
    if (data.users) UserDomain.setCachedUsers(data.users);
    if (data.dayRequests) PostDomain.setCachedDayRequests(data.dayRequests);
    if (data.publications) PostDomain.setCachedPublications(data.publications);
    if (data.channels) ChannelDomain.setCachedChannels(data.channels);
    if (data.settings) SettingsDomain.setCachedSettings(data.settings);
    if (data.scenarios) ScenarioDomain.setCachedScenarios(data.scenarios);
    if (data.files) MediaFilesDomain.setCachedFiles(data.files);
  }

  // Users Domain
  static getUsers(): User[] {
    return UserDomain.getUsers();
  }

  static getUserByEmail(email: string): User | undefined {
    return UserDomain.getUserByEmail(email);
  }

  static getUserByTelegramId(telegramId: number): User | undefined {
    return UserDomain.getUserByTelegramId(telegramId);
  }

  static getUserById(id: string): User | undefined {
    return UserDomain.getUserById(id);
  }

  static addUser(user: User, options?: { skipPgInsert?: boolean }): void {
    UserDomain.addUser(user, options);
  }

  static updateUser(id: string, updated: Partial<User>): User {
    return UserDomain.updateUser(id, updated);
  }

  static deleteUser(id: string): void {
    UserDomain.deleteUser(id);
  }

  // DayRequests and Posts Domain
  static getDayRequests(userId?: string): DayRequest[] {
    return PostDomain.getDayRequests(userId);
  }

  static getDayRequestById(id: string, userId?: string): DayRequest | undefined {
    return PostDomain.getDayRequestById(id, userId);
  }

  static buildPgPostRow(newReq: DayRequest): Record<string, any> {
    return PostDomain.buildPgPostRow(newReq);
  }

  static addDayRequest(req: any, options?: { skipPgInsert?: boolean }): DayRequest {
    return PostDomain.addDayRequest(req, options);
  }

  static async addDayRequestAsync(req: any): Promise<DayRequest> {
    return PostDomain.addDayRequestAsync(req);
  }

  static updateDayRequest(id: string, updated: Partial<DayRequest>): DayRequest {
    return PostDomain.updateDayRequest(id, updated);
  }

  static async updateDayRequestAsync(id: string, updated: Partial<DayRequest>): Promise<DayRequest> {
    return PostDomain.updateDayRequestAsync(id, updated);
  }

  static deleteDayRequest(id: string): void {
    PostDomain.deleteDayRequest(id);
  }

  static deletePostOrPublication(id: string): void {
    PostDomain.deletePostOrPublication(id);
  }

  static deleteManyPosts(ids: string[]): number {
    return PostDomain.deleteManyPosts(ids);
  }

  static ensureUniquePostTitle(candidateTitle: string, excludeId?: string): string {
    return PostDomain.ensureUniquePostTitle(candidateTitle, excludeId);
  }

  static deduplicateExistingPostTitles(): void {
    PostDomain.deduplicateExistingPostTitles();
  }

  // Prompts Domain
  static getPrompts(): Prompt[] {
    return PromptDomain.getPrompts();
  }

  static addPrompt(prompt: Omit<Prompt, 'id' | 'createdAt'>): Prompt {
    return PromptDomain.addPrompt(prompt);
  }

  static updatePrompt(id: string, updated: Partial<Prompt>): Prompt {
    return PromptDomain.updatePrompt(id, updated);
  }

  static deletePrompt(id: string): void {
    PromptDomain.deletePrompt(id);
  }

  // Publications Domain
  static getPublications(userId?: string): Publication[] {
    return PostDomain.getPublications(userId);
  }

  static addPublication(pub: any): Publication {
    return PostDomain.addPublication(pub);
  }

  static updatePublication(id: string, updated: Partial<Publication>): Publication | null {
    return PostDomain.updatePublication(id, updated);
  }

  static deletePublication(id: string, userId?: string): void {
    PostDomain.deletePublication(id, userId);
  }

  // Settings Domain
  static getSettings(): Settings {
    return SettingsDomain.getSettings();
  }

  static updateSettings(updated: Partial<Settings>): Settings {
    return SettingsDomain.updateSettings(updated);
  }

  // Publication Logs Domain
  static getLogs(): PublicationLog[] {
    return PromptDomain.getLogs();
  }

  static addLog(log: Omit<PublicationLog, 'id' | 'timestamp'>): PublicationLog {
    return PromptDomain.addLog(log);
  }

  static deletePublicationLog(id: string): void {
    PromptDomain.deletePublicationLog(id);
  }

  // Channels Domain
  static getChannels(userId?: string): Channel[] {
    return ChannelDomain.getChannels(userId);
  }

  static addChannel(channel: Omit<Channel, 'id'>): Channel {
    return ChannelDomain.addChannel(channel);
  }

  static updateChannel(id: string, updated: Partial<Channel>): Channel {
    return ChannelDomain.updateChannel(id, updated);
  }

  static deleteChannel(id: string): void {
    ChannelDomain.deleteChannel(id);
  }

  // Templates Domain
  static getTemplates(): PostTemplate[] {
    return SystemPromptsDomain.getTemplates();
  }

  static addTemplate(template: Omit<PostTemplate, 'id' | 'createdAt'>): PostTemplate {
    return SystemPromptsDomain.addTemplate(template);
  }

  static deleteTemplate(id: string): void {
    SystemPromptsDomain.deleteTemplate(id);
  }

  // Scenarios Domain
  static getScenarios(userId?: string): Scenario[] {
    return ScenarioDomain.getScenarios(userId);
  }

  static isScenarioNameTaken(name: string, excludeId?: string): boolean {
    return ScenarioDomain.isScenarioNameTaken(name, excludeId);
  }

  static addScenario(scenario: Omit<Scenario, 'id' | 'createdAt'> & { id?: string }): Scenario {
    return ScenarioDomain.addScenario(scenario);
  }

  static updateScenario(id: string, updated: Partial<Scenario>): Scenario {
    return ScenarioDomain.updateScenario(id, updated);
  }

  static deleteScenario(id: string): void {
    ScenarioDomain.deleteScenario(id);
  }

  static getScenarioHelpDocs(): Record<
    string,
    { title: string; description: string; tips?: string[] }
  > {
    return getScenarioHelpDocs();
  }

  static getScenarioLogs(): ScenarioLog[] {
    return ScenarioDomain.getScenarioLogs();
  }

  static addScenarioLog(log: Omit<ScenarioLog, 'id' | 'runAt'>): ScenarioLog {
    return ScenarioDomain.addScenarioLog(log);
  }

  static deleteScenarioLog(id: string): void {
    ScenarioDomain.deleteScenarioLog(id);
  }

  // Media Files Domain
  static getFiles(userId?: string): MediaFile[] {
    return MediaFilesDomain.getFiles(userId);
  }

  static getFileByShortKey(key: string): MediaFile | undefined {
    return MediaFilesDomain.getFileByShortKey(key);
  }

  static addFile(file: Omit<MediaFile, 'id' | 'createdAt'> & { id?: string }): MediaFile {
    return MediaFilesDomain.addFile(file);
  }

  static deleteFile(id: string): void {
    MediaFilesDomain.deleteFile(id);
  }

  // Database Gateway
  static getSyncPgDB() {
    return getSyncPgDB();
  }

  static getSyncDatabase() {
    return getSyncPgDB();
  }

  // System Prompts Domain
  static getSystemPrompts(): SystemPrompt[] {
    return SystemPromptsDomain.getSystemPrompts();
  }

  static getSystemPromptByKey(key: string): SystemPrompt | undefined {
    return SystemPromptsDomain.getSystemPromptByKey(key);
  }

  static updateSystemPrompt(
    idOrKey: string,
    promptText: string,
    title?: string
  ): SystemPrompt | undefined {
    return SystemPromptsDomain.updateSystemPrompt(idOrKey, promptText, title);
  }
}
