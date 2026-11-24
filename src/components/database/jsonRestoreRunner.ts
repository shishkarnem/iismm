export interface JsonRestoreTableItem {
  table: string;
  label: string;
  totalRows: number;
  loadedRows: number;
  state: 'pending' | 'loading' | 'done';
}

export type JsonRestoreStatus =
  | 'reading'
  | 'parsing'
  | 'uploading'
  | 'finalizing'
  | 'completed'
  | 'error';

export interface JsonRestoreProgressState {
  isOpen: boolean;
  status: JsonRestoreStatus;
  fileName: string;
  fileSizeLabel: string;
  targetPercent: number;
  stageTitle: string;
  currentDetail: string;
  processedTables: number;
  totalTables: number;
  processedRows: number;
  totalRows: number;
  items: JsonRestoreTableItem[];
  errorMessage?: string;
}

const TABLE_LABELS: Record<string, string> = {
  users: 'Пользователи и балансы',
  app_settings: 'Версия сборки и общие параметры сайта',
  system_configs: 'Системные настройки и домены оплаты',
  robokassa_invoices: 'Счета и платежи Робокассы',
  recurring_consents: 'Согласия на автопродление подписок',
  tarifs: 'Тарифные планы кабинета',
  tariffs: 'Базовые тарифы',
  transactions: 'Финансовые транзакции и начисления',
  notifications: 'Уведомления пользователей',
  posts: 'Посты, статьи блога и очереди',
  post_comments: 'Комментарии к публикациям',
  post_reactions: 'Реакции к публикациям',
  post_shares: 'Репосты публикаций',
  teams: 'Команды соавторов',
  team_reports: 'Обращения по командам',
  sceneries: 'Автоматические сценарии',
  scenario_instructions: 'Инструкции сценариев',
  telegram_bot: 'Настройки бота Телеграм',
  telegram_bot_config: 'Прокси и конфигурация бота',
  bot_settings: 'Параметры основного бота',
  protalk_settings: 'Настройки нейросетей и модерации',
  prompts: 'Пользовательские шаблоны и промпты',
  system_prompts: 'Системные инструкции нейросетей',
  channels: 'Подключенные каналы и группы',
  logs: 'Журнал событий и модерации',
  cron: 'Расписание фоновых задач',
  files: 'Медиафайлы галереи',
  file_storage: 'Хранилище файлов и ссылок',
  file_folders: 'Папки медиафайлов',
  file_folder_relations: 'Связи файлов и папок',
  chat_messages: 'Сообщения чатов соцсети',
  user_chats: 'Личные диалоги пользователей',
  group_chats: 'Групповые чаты сообщества',
  user_subscriptions: 'Подписки на авторов',
  user_auto_responders: 'Автоответчики в чатах',
  landing_reviews: 'Отзывы и ответы на главной странице',
  academy_articles: 'Уроки и база знаний академии',
  promo_folders: 'Папки взаимного продвижения',
  promo_selections: 'Подборки каналов',
  ai_agents: 'Карточки ассистентов'
};

export function getHumanTableLabel(table: string): string {
  return TABLE_LABELS[table] || `Таблица «${table}»`;
}

export function formatBytesRu(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 б';
  if (bytes < 1024) return `${bytes} б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} кб`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} мб`;
}

function readFileWithProgress(
  file: File,
  onReadProgress: (ratio: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        onReadProgress(Math.min(1, ev.loaded / ev.total));
      }
    };
    reader.onload = () => {
      onReadProgress(1);
      resolve(String(reader.result || ''));
    };
    reader.onerror = () => {
      reject(new Error('Не удалось прочитать выбранный файл'));
    };
    reader.readAsText(file, 'utf-8');
  });
}

const pauseFrame = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Universal multi-format PostgreSQL ProTalk (iismm2) restore runner.
 * Supports .sql, .sql.gz, .json, .json.gz, .ndjson/.jsonl, and .csv backups.
 */
export async function runMultiFormatDatabaseRestore(
  file: File,
  onUpdate: (state: JsonRestoreProgressState) => void,
  options?: { mode?: 'merge' | 'replace'; targetTable?: string }
): Promise<{ importedTables: number; importedRows: number }> {
  const lowerName = file.name.toLowerCase();
  const isPlainJson = lowerName.endsWith('.json') && !lowerName.endsWith('.json.gz');

  if (isPlainJson && options?.mode !== 'replace') {
    return runJsonDatabaseRestore(file, onUpdate);
  }

  const fileSizeLabel = formatBytesRu(file.size);
  let currentState: JsonRestoreProgressState = {
    isOpen: true,
    status: 'uploading',
    fileName: file.name,
    fileSizeLabel,
    targetPercent: 18,
    stageTitle: 'Передача резервной копии в PostgreSql ProTalk',
    currentDetail: `Загрузка файла «${file.name}» (${fileSizeLabel}) на сервер iismm2...`,
    processedTables: 0,
    totalTables: 0,
    processedRows: 0,
    totalRows: 0,
    items: []
  };
  onUpdate({ ...currentState });

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', file.name);
    formData.append('mode', options?.mode || 'merge');
    if (options?.targetTable) {
      formData.append('targetTable', options.targetTable);
    }

    currentState = {
      ...currentState,
      status: 'uploading',
      targetPercent: 58,
      stageTitle: 'Восстановление таблиц PostgreSql ProTalk (iismm2)',
      currentDetail: 'Распаковка архива, транзакционная запись строк и синхронизация кэша...'
    };
    onUpdate({ ...currentState });

    const res = await fetch('/api/admin/db/restore-file', {
      method: 'POST',
      body: formData
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || 'Ошибка восстановления из файла резервной копии');
    }

    const perTable: Record<string, number> = data.perTable || {};
    const items: JsonRestoreTableItem[] = Object.entries(perTable).map(([tbl, cnt]) => ({
      table: tbl,
      label: getHumanTableLabel(tbl),
      totalRows: Number(cnt || 0),
      loadedRows: Number(cnt || 0),
      state: 'done'
    }));

    const restoredTables = Number(data.restoredTables || items.length || 0);
    const restoredRows = Number(data.restoredRows || 0);
    const errorsList: string[] = Array.isArray(data.errors) ? data.errors : [];

    if (restoredRows === 0 && errorsList.length > 0) {
      throw new Error(errorsList[0]);
    }

    const detailSuffix = errorsList.length > 0 ? ` · Предупреждений: ${errorsList.length}` : '';

    currentState = {
      ...currentState,
      status: 'completed',
      targetPercent: 100,
      stageTitle: 'База PostgreSql ProTalk успешно восстановлена',
      currentDetail: `Формат: ${data.format || 'auto'} · Таблиц: ${restoredTables} · Записей: ${restoredRows.toLocaleString('ru-RU')}${detailSuffix}`,
      processedTables: restoredTables,
      totalTables: restoredTables,
      processedRows: restoredRows,
      totalRows: restoredRows,
      items
    };
    onUpdate({ ...currentState });

    return {
      importedTables: restoredTables,
      importedRows: restoredRows
    };
  } catch (err: any) {
    currentState = {
      ...currentState,
      status: 'error',
      stageTitle: 'Ошибка восстановления базы PostgreSql',
      errorMessage: err?.message || 'Произошла ошибка при импорте резервной копии'
    };
    onUpdate({ ...currentState });
    throw err;
  }
}

export async function runJsonDatabaseRestore(
  file: File,
  onUpdate: (state: JsonRestoreProgressState) => void
): Promise<{ importedTables: number; importedRows: number }> {
  const fileSizeLabel = formatBytesRu(file.size);

  let currentState: JsonRestoreProgressState = {
    isOpen: true,
    status: 'reading',
    fileName: file.name,
    fileSizeLabel,
    targetPercent: 2,
    stageTitle: 'Чтение файла резервной копии',
    currentDetail: `Открытие файла «${file.name}» (${fileSizeLabel})...`,
    processedTables: 0,
    totalTables: 0,
    processedRows: 0,
    totalRows: 0,
    items: []
  };
  onUpdate({ ...currentState });

  try {
    const rawText = await readFileWithProgress(file, (ratio) => {
      currentState = {
        ...currentState,
        status: 'reading',
        targetPercent: Math.max(2, Math.round(ratio * 10)),
        currentDetail: `Чтение содержимого файла (${Math.round(ratio * 100)}%)...`
      };
      onUpdate({ ...currentState });
    });

    await pauseFrame(100);

    currentState = {
      ...currentState,
      status: 'parsing',
      targetPercent: 14,
      stageTitle: 'Проверка структуры резервной копии',
      currentDetail: 'Разбор таблиц и подсчет записей для восстановления...'
    };
    onUpdate({ ...currentState });

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error('Выбранный файл содержит некорректный формат json');
    }

    const rawTablesObj =
      parsed && typeof parsed === 'object' && parsed.tables && typeof parsed.tables === 'object'
        ? parsed.tables
        : parsed;

    if (!rawTablesObj || typeof rawTablesObj !== 'object' || Array.isArray(rawTablesObj)) {
      throw new Error('В файле не найдена структура таблиц базы данных');
    }

    const reservedKeys = new Set(['meta', 'version', 'exportedAt', 'skipSave', 'finalize', 'tables', 'database', 'engine']);
    const tableEntries: Array<{ table: string; rows: any[] }> = [];

    for (const [key, val] of Object.entries(rawTablesObj)) {
      if (reservedKeys.has(key)) continue;
      if (Array.isArray(val) && val.length > 0) {
        tableEntries.push({ table: key, rows: val });
      }
    }

    if (tableEntries.length === 0) {
      throw new Error('В выбранном файле нет заполненных таблиц для восстановления');
    }

    const items: JsonRestoreTableItem[] = tableEntries.map((entry) => ({
      table: entry.table,
      label: getHumanTableLabel(entry.table),
      totalRows: entry.rows.length,
      loadedRows: 0,
      state: 'pending'
    }));

    const totalTables = tableEntries.length;
    const totalRows = tableEntries.reduce((acc, t) => acc + t.rows.length, 0);

    currentState = {
      ...currentState,
      status: 'uploading',
      targetPercent: 18,
      stageTitle: 'Загрузка таблиц в облачную базу PostgreSql ProTalk',
      currentDetail: `Подготовлено таблиц: ${totalTables}, всего записей: ${totalRows.toLocaleString('ru-RU')}`,
      totalTables,
      totalRows,
      items: items.map((it) => ({ ...it }))
    };
    onUpdate({ ...currentState });
    await pauseFrame(100);

    const CHUNK_SIZE = 250;
    let processedRows = 0;
    let processedTables = 0;
    let totalImportedRowsFromServer = 0;

    for (let tIdx = 0; tIdx < tableEntries.length; tIdx++) {
      const { table, rows } = tableEntries[tIdx];
      const itemLabel = getHumanTableLabel(table);
      const totalChunks = Math.max(1, Math.ceil(rows.length / CHUNK_SIZE));

      items[tIdx] = { ...items[tIdx], state: 'loading' };

      for (let cIdx = 0; cIdx < totalChunks; cIdx++) {
        const chunk = rows.slice(cIdx * CHUNK_SIZE, (cIdx + 1) * CHUNK_SIZE);
        const batchSuffix =
          totalChunks > 1 ? ` · пакет ${cIdx + 1} из ${totalChunks}` : '';

        const progressRatio = totalRows > 0 ? processedRows / totalRows : tIdx / totalTables;
        const computedPercent = Math.min(92, Math.max(18, Math.round(18 + progressRatio * 74)));

        currentState = {
          ...currentState,
          status: 'uploading',
          targetPercent: computedPercent,
          stageTitle: 'Восстановление таблиц PostgreSql ProTalk (iismm2)',
          currentDetail: `Загружается: ${itemLabel} (${table})${batchSuffix} — ${chunk.length} зап.`,
          processedTables,
          processedRows,
          items: items.map((it) => ({ ...it }))
        };
        onUpdate({ ...currentState });

        const res = await fetch('/api/admin/db/import/json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tables: { [table]: chunk },
            skipSave: true
          })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `Ошибка при загрузке таблицы «${table}»`);
        }

        processedRows += chunk.length;
        totalImportedRowsFromServer += Number(data.importedRows || chunk.length);
        items[tIdx] = {
          ...items[tIdx],
          loadedRows: Math.min(rows.length, items[tIdx].loadedRows + chunk.length)
        };

        const afterRatio = totalRows > 0 ? processedRows / totalRows : (tIdx + 1) / totalTables;
        currentState = {
          ...currentState,
          targetPercent: Math.min(93, Math.max(19, Math.round(18 + afterRatio * 75))),
          processedRows,
          items: items.map((it) => ({ ...it }))
        };
        onUpdate({ ...currentState });
        await pauseFrame(50);
      }

      items[tIdx] = { ...items[tIdx], loadedRows: rows.length, state: 'done' };
      processedTables = tIdx + 1;

      currentState = {
        ...currentState,
        processedTables,
        items: items.map((it) => ({ ...it }))
      };
      onUpdate({ ...currentState });
    }

    currentState = {
      ...currentState,
      status: 'finalizing',
      targetPercent: 97,
      stageTitle: 'Фиксация базы PostgreSql ProTalk на сервере',
      currentDetail: 'Синхронизация облачных таблиц iismm2 и проверка целостности расписаний...'
    };
    onUpdate({ ...currentState });

    const finalRes = await fetch('/api/admin/db/import/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finalize: true })
    });
    const finalData = await finalRes.json().catch(() => ({}));
    if (!finalRes.ok) {
      throw new Error(finalData.error || 'Не удалось зафиксировать базу PostgreSql');
    }

    await pauseFrame(120);

    currentState = {
      ...currentState,
      status: 'completed',
      targetPercent: 100,
      stageTitle: 'База данных успешно восстановлена',
      currentDetail: `Восстановлено таблиц: ${processedTables} · Загружено записей: ${totalImportedRowsFromServer.toLocaleString('ru-RU')}`,
      processedTables,
      processedRows: totalRows,
      items: items.map((it) => ({ ...it, state: 'done', loadedRows: it.totalRows }))
    };
    onUpdate({ ...currentState });

    return {
      importedTables: processedTables,
      importedRows: totalImportedRowsFromServer
    };
  } catch (err: any) {
    currentState = {
      ...currentState,
      status: 'error',
      stageTitle: 'Ошибка восстановления базы данных',
      errorMessage: err?.message || 'Произошла непредвиденная ошибка при импорте файла'
    };
    onUpdate({ ...currentState });
    throw err;
  }
}

export function getTableRowPk(row: Record<string, any> | null | undefined, tableName: string, fallbackIdx?: number): string {
  if (!row || typeof row !== 'object') {
    return fallbackIdx !== undefined ? `row_${fallbackIdx}` : '';
  }
  if (tableName === 'app_settings' && row.setting_key !== undefined && row.setting_key !== null) {
    return String(row.setting_key);
  }
  if (tableName === 'user_onboarding_tour' && row.user_id !== undefined && row.user_id !== null) {
    return String(row.user_id);
  }
  if (tableName === 'file_folder_relations' && row.file_id !== undefined && row.folder_id !== undefined) {
    return `${row.file_id}::${row.folder_id}`;
  }
  if (row.id !== undefined && row.id !== null) {
    return String(row.id);
  }
  const firstKey = Object.keys(row)[0];
  if (firstKey && row[firstKey] !== undefined && row[firstKey] !== null) {
    return String(row[firstKey]);
  }
  return fallbackIdx !== undefined ? `row_${fallbackIdx}` : '';
}

export function parseCsvRfc4180Client(rawText: string): { headers: string[]; rows: Record<string, any>[] } | null {
  try {
    const clean = String(rawText || '').replace(/^\uFEFF/, '');
    if (!clean.trim()) return null;

    const firstLine = clean.split(/\r?\n/)[0] || '';
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semiCount > commaCount ? ';' : ',';

    const matrix: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i];
      if (inQuotes) {
        if (ch === '"' && clean[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          currentCell += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (ch === '\r') {
        if (clean[i + 1] === '\n') i++;
        currentRow.push(currentCell);
        matrix.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else if (ch === '\n') {
        currentRow.push(currentCell);
        matrix.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += ch;
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell);
      matrix.push(currentRow);
    }

    const nonEmpty = matrix.filter((r) => r.some((cell) => cell.trim() !== ''));
    if (nonEmpty.length === 0) return null;

    const headers = nonEmpty[0].map((h) => h.trim());
    const rows: Record<string, any>[] = [];
    for (let i = 1; i < nonEmpty.length; i++) {
      const cells = nonEmpty[i];
      const rowObj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        if (!h) return;
        rowObj[h] = cells[idx] !== undefined ? cells[idx] : '';
      });
      rows.push(rowObj);
    }
    return { headers, rows };
  } catch {
    return null;
  }
}

export async function downloadFileViaFetch(
  url: string,
  fallbackFilename: string
): Promise<{ filename: string; size: number }> {
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  const contentType = String(res.headers.get('content-type') || '').toLowerCase();

  if (!res.ok) {
    const errJson = await res.json().catch(() => null);
    throw new Error(errJson?.error || `Ошибка сервера при скачивании (HTTP ${res.status})`);
  }

  if (contentType.includes('text/html')) {
    throw new Error('Сервер вернул HTML-страницу вместо файла выгрузки');
  }

  let filename = fallbackFilename;
  const disp = res.headers.get('content-disposition') || '';
  const utf8Match = disp.match(/filename\*=UTF-8''([^;\n]+)/i);
  const stdMatch = disp.match(/filename="?([^";\n]+)"?/i);
  if (utf8Match?.[1]) {
    try {
      filename = decodeURIComponent(utf8Match[1].trim());
    } catch {
      filename = utf8Match[1].trim();
    }
  } else if (stdMatch?.[1]) {
    filename = stdMatch[1].trim();
  }

  const blob = await res.blob();
  if (!blob || blob.size === 0) {
    throw new Error('Получен пустой файл от сервера');
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);

  return { filename, size: blob.size };
}
