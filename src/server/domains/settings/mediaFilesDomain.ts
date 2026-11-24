import { MediaFile } from './settingsTypes';
import { fetchAllFilesFromPg, insertRow, deleteRow } from '../../db/postgres';

let filesCache: MediaFile[] = [];

export class MediaFilesDomain {
  public static getCachedFiles(): MediaFile[] {
    return filesCache;
  }

  public static setCachedFiles(files: MediaFile[]): void {
    filesCache = files;
  }

  public static getFiles(userId?: string): MediaFile[] {
    const pgRows = fetchAllFilesFromPg();
    if (pgRows && pgRows.length > 0) {
      let files: MediaFile[] = pgRows.map((row) => ({
        id: String(row.id || ''),
        userId: row.user_id ? String(row.user_id) : undefined,
        originalName: row.original_name || row.name || '',
        name: row.name || '',
        fullUrl: row.full_url || '',
        shortKey: row.short_key || '',
        shortUrl: row.short_url || '',
        fileType: (row.file_type || 'file') as any,
        mimeType: row.mime_type || '',
        fileSize: row.file_size ? Number(row.file_size) : 0,
        sizeFormatted: row.size_formatted || '',
        width: row.width ? Number(row.width) : undefined,
        height: row.height ? Number(row.height) : undefined,
        aspectRatio: row.aspect_ratio ? Number(row.aspect_ratio) : undefined,
        createdAt: row.created_at || new Date().toISOString()
      }));

      filesCache = files;

      if (userId) {
        files = files.filter((f) => !f.userId || String(f.userId) === String(userId));
      }
      return files;
    }

    let files = filesCache;
    if (userId) {
      files = files.filter((f) => !f.userId || String(f.userId) === String(userId));
    }
    return files;
  }

  public static getFileByShortKey(key: string): MediaFile | undefined {
    const files = this.getFiles();
    const cleanKey = String(key || '').trim();
    return files.find(
      (f) => f.shortKey === cleanKey || f.id === cleanKey || f.fullUrl.includes(cleanKey)
    );
  }

  public static addFile(
    file: Omit<MediaFile, 'id' | 'createdAt'> & { id?: string }
  ): MediaFile {
    const newFile: MediaFile = {
      ...file,
      id: file.id || 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString()
    };
    filesCache.unshift(newFile);

    void insertRow('files', {
      id: newFile.id,
      user_id: newFile.userId || '',
      original_name: newFile.originalName,
      name: newFile.name,
      full_url: newFile.fullUrl,
      short_key: newFile.shortKey,
      short_url: newFile.shortUrl,
      file_type: newFile.fileType,
      mime_type: newFile.mimeType || '',
      file_size: newFile.fileSize || 0,
      size_formatted: newFile.sizeFormatted || '',
      width: newFile.width || 0,
      height: newFile.height || 0,
      aspect_ratio: newFile.aspectRatio || 1,
      created_at: newFile.createdAt
    }).catch(() => null);

    return newFile;
  }

  public static deleteFile(id: string): void {
    const cleanId = String(id || '').trim();
    filesCache = filesCache.filter((f) => f.id !== cleanId && f.shortKey !== cleanId);
    void deleteRow('files', cleanId).catch(() => null);
  }
}
