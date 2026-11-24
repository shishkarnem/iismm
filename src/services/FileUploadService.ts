import { formatAbsoluteUrl } from '../utils/urlUtils';
import {
    PROTALK_TGF_UPLOAD_TOKEN,
    PROTALK_TGF_UPLOAD_URL,
    normalizeProTalkMediaUrl
} from '../constants/proTalkStorage';

const UPLOAD_URL = PROTALK_TGF_UPLOAD_URL;
const STORAGE_KEY = "protalk_upload_token";
const FILES_MAP_KEY = "protalk_files_map";
export const DEFAULT_TOKEN = PROTALK_TGF_UPLOAD_TOKEN;
const DEPRECATED_TOKENS = new Set([
    "b2VcU3NrVVttYlh3GHM_AEQ4eA8yDR4FGREODwsaLyUqQjpTEA8HGzMdFB8aORQYaG9dWGpkVQRvAXM"
]);

export interface UploadProgressInfo {
    stage: 'uploading' | 'saving_gallery' | 'done';
    percent: number;
    secondsElapsed?: number;
    estimatedSecondsLeft?: number;
    loadedBytes?: number;
    totalBytes?: number;
    batchIndex?: number;
    batchTotal?: number;
    currentFileName?: string;
}

export interface UploadFileOptions {
    folderIds?: (number | string)[];
    convertVoiceOgg?: boolean;
}

export type UploadProgressCallback = (progress: UploadProgressInfo) => void;

interface FileMap {
    [key: string]: string; // key -> полный URL
}

export class FileUploadService {
    private token: string;

    constructor(token?: string) {
        this.token = token || this.getToken();
    }

    // Получение токена из настроек
    private getToken(): string {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const trimmed = saved.trim();
                if (DEPRECATED_TOKENS.has(trimmed)) {
                    localStorage.setItem(STORAGE_KEY, DEFAULT_TOKEN);
                    return DEFAULT_TOKEN;
                }
                return trimmed;
            }
        }
        // Токен по умолчанию
        return DEFAULT_TOKEN;
    }

    // Установка токена
    public setToken(token: string): void {
        this.token = token;
        if (typeof window !== 'undefined') {
            localStorage.getItem(STORAGE_KEY);
            localStorage.setItem(STORAGE_KEY, token);
        }
    }

    // Загрузка по URL через серверный API
    async uploadFromUrl(url: string): Promise<string> {
        try {
            const proxyRes = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, token: this.token })
            });
            const proxyData = await proxyRes.json();
            if (proxyRes.ok && (proxyData.url || proxyData.originalUrl || proxyData.shortUrl)) {
                return normalizeProTalkMediaUrl(proxyData.url || proxyData.originalUrl || proxyData.shortUrl);
            }
            throw new Error(proxyData.error || 'Failed to upload from URL');
        } catch (err) {
            // Direct fallback to ProTalk TGF if server API fails
            const response = await fetch(UPLOAD_URL, {
                method: "POST",
                headers: {
                    "X-Upload-Token": this.token,
                    "X-Preserve-Alpha": "true"
                },
                body: new URLSearchParams({ url })
            });
            if (!response.ok) {
                throw new Error(`Upload by URL failed with status ${response.status}`);
            }
            const data = await response.json();
            const fullOriginalUrl = normalizeProTalkMediaUrl(data.url);

            // Register in backend DB while preserving full original URL
            try {
                await fetch('/api/files/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ original_url: fullOriginalUrl })
                });
            } catch (e) {}

            return fullOriginalUrl;
        }
    }

    // Загрузка из File через серверный API с трекингом прогресса и таймером сохранения в галерею
    async uploadFromFileWithProgress(
        file: File, 
        optionsOrFolderIds?: (number | string)[] | UploadFileOptions,
        onProgress?: UploadProgressCallback
    ): Promise<{ url: string; proxyUrl?: string; fileKey?: string; file?: any }> {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("token", this.token);
            
            let folderIds: (number | string)[] | undefined;
            let convertVoiceOgg = false;

            if (Array.isArray(optionsOrFolderIds)) {
                folderIds = optionsOrFolderIds;
            } else if (optionsOrFolderIds && typeof optionsOrFolderIds === 'object') {
                folderIds = optionsOrFolderIds.folderIds;
                convertVoiceOgg = !!optionsOrFolderIds.convertVoiceOgg;
            }

            if (folderIds && folderIds.length > 0) {
                folderIds.forEach(id => formData.append("folderIds", String(id)));
            }
            if (convertVoiceOgg) {
                formData.append("convertVoiceOgg", "true");
            }

            const xhr = new XMLHttpRequest();
            let timerInterval: any = null;
            let gallerySeconds = 0;

            const cleanupTimer = () => {
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }
            };

            // Progress tracking for file bytes upload
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && onProgress) {
                    const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
                    onProgress({
                        stage: 'uploading',
                        percent,
                        loadedBytes: event.loaded,
                        totalBytes: event.total
                    });
                }
            };

            // When upload bytes are 100% transferred, start the gallery saving waiting timer
            xhr.upload.onload = () => {
                if (onProgress) {
                    onProgress({
                        stage: 'saving_gallery',
                        percent: 100,
                        secondsElapsed: 0,
                        estimatedSecondsLeft: 2
                    });

                    const startTime = Date.now();
                    timerInterval = setInterval(() => {
                        gallerySeconds = Math.round((Date.now() - startTime) / 100) / 10;
                        onProgress({
                            stage: 'saving_gallery',
                            percent: 100,
                            secondsElapsed: gallerySeconds,
                            estimatedSecondsLeft: Math.max(0, Math.round((2.5 - gallerySeconds) * 10) / 10)
                        });
                    }, 100);
                }
            };

            const performFallbackUpload = async () => {
                cleanupTimer();
                try {
                    if (onProgress) {
                        onProgress({
                            stage: 'uploading',
                            percent: 50,
                            loadedBytes: Math.round(file.size / 2),
                            totalBytes: file.size
                        });
                    }

                    const fallbackFormData = new FormData();
                    fallbackFormData.append("file", file);
                    fallbackFormData.append("token", this.token);
                    if (folderIds && folderIds.length > 0) {
                        folderIds.forEach(id => fallbackFormData.append("folderIds", String(id)));
                    }
                    if (convertVoiceOgg) {
                        fallbackFormData.append("convertVoiceOgg", "true");
                    }

                    const proxyRes = await fetch('/api/upload', {
                        method: 'POST',
                        body: fallbackFormData
                    });

                    if (proxyRes.ok) {
                        const proxyData = await proxyRes.json();
                        if (proxyData && (proxyData.url || proxyData.proxyUrl || proxyData.shortUrl)) {
                            if (onProgress) {
                                onProgress({
                                    stage: 'done',
                                    percent: 100,
                                    secondsElapsed: gallerySeconds
                                });
                            }
                            const rawUrl = normalizeProTalkMediaUrl(proxyData.url || proxyData.originalUrl || proxyData.shortUrl || proxyData.proxyUrl);
                            resolve({
                                url: formatAbsoluteUrl(rawUrl),
                                proxyUrl: formatAbsoluteUrl(rawUrl),
                                fileKey: proxyData.fileKey,
                                file: proxyData.file
                            });
                            return;
                        }
                    }

                    // Direct upload to https://file.pro-talk.ru/tgf with X-Upload-Token & X-Preserve-Alpha: true
                    const directFormData = new FormData();
                    directFormData.append("file", file, file.name);

                    const directResponse = await fetch(UPLOAD_URL, {
                        method: "POST",
                        headers: {
                            "X-Upload-Token": this.token,
                            "X-Preserve-Alpha": "true"
                        },
                        body: directFormData
                    });

                    if (directResponse.ok) {
                        const rawText = await directResponse.text();
                        let d: any = {};
                        try {
                            d = JSON.parse(rawText);
                        } catch {
                            const trimmed = rawText.trim().replace(/^["']|["']$/g, '');
                            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                                d = { url: trimmed, key: trimmed.split('/').pop() || '' };
                            }
                        }
                        const finalUrl = normalizeProTalkMediaUrl(d.url || d.link);
                        if (finalUrl) {
                            try {
                                const regRes = await fetch('/api/files/register', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        original_url: finalUrl,
                                        name: file.name,
                                        file_size: file.size,
                                        mime_type: file.type || 'image/png',
                                        folder_ids: folderIds
                                    })
                                });
                                const regData = await regRes.json();
                                if (regData.file) {
                                    if (onProgress) onProgress({ stage: 'done', percent: 100 });
                                    const regResolvedUrl = formatAbsoluteUrl(finalUrl);
                                    resolve({
                                        url: regResolvedUrl,
                                        proxyUrl: regResolvedUrl,
                                        fileKey: regData.file.file_key,
                                        file: regData.file
                                    });
                                    return;
                                }
                            } catch {}

                            if (onProgress) onProgress({ stage: 'done', percent: 100 });
                            resolve({ url: formatAbsoluteUrl(finalUrl), proxyUrl: formatAbsoluteUrl(finalUrl), fileKey: d.key });
                            return;
                        }
                    }

                    reject(new Error('Сетевая ошибка при загрузке файла. Пожалуйста, повторите попытку.'));
                } catch (fallbackErr: any) {
                    reject(fallbackErr || new Error('Сетевая ошибка при загрузке файла'));
                }
            };

            xhr.onload = async () => {
                cleanupTimer();
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const proxyData = JSON.parse(xhr.responseText);
                        if (proxyData && (proxyData.url || proxyData.proxyUrl || proxyData.shortUrl)) {
                            if (onProgress) {
                                onProgress({
                                    stage: 'done',
                                    percent: 100,
                                    secondsElapsed: gallerySeconds
                                });
                            }
                            const rawUrl = normalizeProTalkMediaUrl(proxyData.url || proxyData.originalUrl || proxyData.shortUrl || proxyData.proxyUrl);
                            resolve({
                                url: formatAbsoluteUrl(rawUrl),
                                proxyUrl: formatAbsoluteUrl(rawUrl),
                                fileKey: proxyData.fileKey,
                                file: proxyData.file
                            });
                            return;
                        }
                    } catch (e) {}
                }

                // If XHR failed or returned error status, try fallback instead of hard failing
                performFallbackUpload();
            };

            xhr.onerror = () => {
                performFallbackUpload();
            };

            xhr.ontimeout = () => {
                performFallbackUpload();
            };

            xhr.onabort = () => {
                cleanupTimer();
                reject(new Error('Загрузка была прервана'));
            };

            xhr.timeout = 45000;
            xhr.open('POST', '/api/upload', true);
            xhr.send(formData);
        });
    }

    // Загрузка из File через серверный API
    async uploadFromFile(file: File, optionsOrFolderIds?: (number | string)[] | UploadFileOptions, onProgress?: UploadProgressCallback): Promise<{ url: string; proxyUrl?: string; fileKey?: string; file?: any }> {
        if (onProgress) {
            return this.uploadFromFileWithProgress(file, optionsOrFolderIds, onProgress);
        }

        let folderIds: (number | string)[] | undefined;
        let convertVoiceOgg = false;

        if (Array.isArray(optionsOrFolderIds)) {
            folderIds = optionsOrFolderIds;
        } else if (optionsOrFolderIds && typeof optionsOrFolderIds === 'object') {
            folderIds = optionsOrFolderIds.folderIds;
            convertVoiceOgg = !!optionsOrFolderIds.convertVoiceOgg;
        }

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("token", this.token);

            if (folderIds && folderIds.length > 0) {
                folderIds.forEach(id => formData.append("folderIds", String(id)));
            }
            if (convertVoiceOgg) {
                formData.append("convertVoiceOgg", "true");
            }

            const proxyRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const proxyData = await proxyRes.json();
            if (proxyRes.ok && (proxyData.url || proxyData.originalUrl || proxyData.proxyUrl || proxyData.shortUrl)) {
                const finalUploadUrl = formatAbsoluteUrl(proxyData.url || proxyData.originalUrl || proxyData.shortUrl || proxyData.proxyUrl);
                return {
                    url: finalUploadUrl,
                    proxyUrl: finalUploadUrl,
                    fileKey: proxyData.fileKey,
                    file: proxyData.file
                };
            }
            throw new Error(proxyData.error || 'Failed to upload file');
        } catch (err) {
            // Direct fallback to https://file.pro-talk.ru/tgf with X-Upload-Token & X-Preserve-Alpha: true
            const formData = new FormData();
            formData.append("file", file, file.name);

            const response = await fetch(UPLOAD_URL, {
                method: "POST",
                headers: {
                    "X-Upload-Token": this.token,
                    "X-Preserve-Alpha": "true"
                },
                body: formData
            });
            if (!response.ok) {
                throw new Error(`Upload file failed with status ${response.status}`);
            }
            const rawText = await response.text();
            let data: any = {};
            try {
                data = JSON.parse(rawText);
            } catch (e) {
                const trimmed = rawText.trim().replace(/^["']|["']$/g, '');
                if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                    data = { url: trimmed, key: trimmed.split('/').pop() || '' };
                } else {
                    throw new Error(`Upload file failed: ${rawText}`);
                }
            }

            const fullOriginalUrl = normalizeProTalkMediaUrl(data.url || data.link);

            // Register in backend DB while preserving full original URL
            try {
                const regRes = await fetch('/api/files/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        original_url: fullOriginalUrl,
                        name: file.name,
                        file_size: file.size,
                        mime_type: file.type || 'image/png',
                        folder_ids: folderIds
                    })
                });
                const regData = await regRes.json();
                if (regData.file) {
                    return {
                        url: fullOriginalUrl,
                        proxyUrl: fullOriginalUrl,
                        fileKey: regData.file.file_key,
                        file: regData.file
                    };
                }
            } catch (e) {}

            return { url: fullOriginalUrl, proxyUrl: fullOriginalUrl };
        }
    }

    // Загрузка из Blob
    async uploadFromBlob(blob: Blob, filename: string): Promise<string> {
        const file = new File([blob], filename);
        const res = await this.uploadFromFile(file);
        return typeof res === 'string' ? res : res.url;
    }

    // Загрузка из base64
    async uploadFromBase64(base64: string, filename: string): Promise<string> {
        const response = await fetch(base64);
        const blob = await response.blob();
        return this.uploadFromBlob(blob, filename);
    }

    // Получение карты файлов
    private getFileMap(): FileMap {
        if (typeof window === 'undefined') return {};
        const saved = localStorage.getItem(FILES_MAP_KEY);
        return saved ? JSON.parse(saved) : {};
    }

    // Сохранение карты файлов
    private saveFileMap(map: FileMap): void {
        if (typeof window !== 'undefined') {
            localStorage.setItem(FILES_MAP_KEY, JSON.stringify(map));
        }
    }

    // Добавление файла в карту
    addFile(key: string, url: string): void {
        const map = this.getFileMap();
        map[key] = url;
        this.saveFileMap(map);
    }

    // Получение URL по ключу
    getFileUrl(key: string): string | null {
        const map = this.getFileMap();
        return map[key] || null;
    }

    // Удаление файла из карты
    removeFile(key: string): void {
        const map = this.getFileMap();
        delete map[key];
        this.saveFileMap(map);
    }

    // Получение всех файлов
    getAllFiles(): FileMap {
        return this.getFileMap();
    }

    // Очистка карты
    clearFiles(): void {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(FILES_MAP_KEY);
        }
    }

    // Генерация уникального ключа
    generateKey(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Загрузка и сохранение в карту
    async uploadAndStore(file: File | string, customKey?: string, onProgress?: UploadProgressCallback, options?: UploadFileOptions): Promise<{ key: string; url: string }> {
        let url: string;
        
        if (typeof file === 'string') {
            // Это URL
            url = await this.uploadFromUrl(file);
            if (onProgress) onProgress({ stage: 'done', percent: 100 });
        } else {
            // Это File
            const res = await this.uploadFromFile(file, options, onProgress);
            url = typeof res === 'string' ? res : res.url;
        }

        const key = customKey || this.generateKey();
        const absoluteUrl = formatAbsoluteUrl(url);
        this.addFile(key, absoluteUrl);

        return { key, url: absoluteUrl };
    }

    // Конвертация любого аудиофайла или аудио URL в Telegram Voice OGG Opus формат
    async convertAudioToOgg(
        fileOrUrl: File | string,
        folderIds?: (number | string)[],
        onProgress?: UploadProgressCallback
    ): Promise<{ url: string; proxyUrl?: string; fileKey?: string; name: string }> {
        if (onProgress) {
            onProgress({ stage: 'uploading', percent: 50 });
        }

        const formData = new FormData();
        formData.append("token", this.token);
        if (folderIds && folderIds.length > 0) {
            folderIds.forEach(id => formData.append("folderIds", String(id)));
        }

        if (typeof fileOrUrl === 'string') {
            formData.append("audioUrl", fileOrUrl);
        } else {
            formData.append("file", fileOrUrl);
        }

        if (onProgress) {
            onProgress({ stage: 'saving_gallery', percent: 90, secondsElapsed: 0.5 });
        }

        const res = await fetch('/api/convert-audio-to-ogg', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        if (!res.ok || !data.url) {
            throw new Error(data.error || 'Ошибка конвертации аудио в формат OGG');
        }

        if (onProgress) {
            onProgress({ stage: 'done', percent: 100 });
        }

        const fullOriginalUrl = normalizeProTalkMediaUrl(data.url || data.originalUrl || data.shortUrl || data.proxyUrl);
        return {
            url: fullOriginalUrl,
            proxyUrl: fullOriginalUrl,
            fileKey: data.fileKey,
            name: data.name || 'voice.ogg'
        };
    }

    // Замена ключей на URL в тексте
    replaceKeysWithUrls(text: string): string {
        const map = this.getFileMap();
        let result = text;
        
        for (const [key, url] of Object.entries(map)) {
            // Заменяем {{key}} на полный URL
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), url);
        }
        
        return result;
    }

    // Замена URL на ключи в тексте
    replaceUrlsWithKeys(text: string): string {
        const map = this.getFileMap();
        let result = text;
        
        for (const [key, url] of Object.entries(map)) {
            result = result.replace(new RegExp(url, 'g'), `{{${key}}}`);
        }
        
        return result;
    }
}

// Синглтон
let uploadService: FileUploadService | null = null;

export function getUploadService(): FileUploadService {
    if (!uploadService) {
        uploadService = new FileUploadService();
    }
    return uploadService;
}
