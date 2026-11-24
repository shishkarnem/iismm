import React, { useEffect, useRef, useState } from 'react';
import {
  Database,
  Plus,
  RefreshCw,
  Table as TableIcon
} from 'lucide-react';
import { GradientSelect } from './ui-kit/GradientDropdown';
import { fetchCurrentAppVersion } from './footer/useAppVersion';
import { PostgresBackupCenterPanel } from './database/PostgresBackupCenterPanel';
import { TableRowEditorModals } from './database/TableRowEditorModals';
import {
  AssignTariffFormState,
  CustomTariffFormState,
  UserTariffBalanceModals
} from './database/UserTariffBalanceModals';
import {
  downloadFileViaFetch,
  getHumanTableLabel,
  getTableRowPk,
  parseCsvRfc4180Client
} from './database/jsonRestoreRunner';
import { PostgresSqlConsole } from './database/console/PostgresSqlConsole';
import { PostgresTableGridCard } from './database/console/PostgresTableGridCard';

const CORE_TABLES = [
  'users',
  'app_settings',
  'system_configs',
  'robokassa_invoices',
  'tarifs',
  'transactions',
  'notifications',
  'posts',
  'teams',
  'team_reports',
  'sceneries',
  'telegram_bot',
  'protalk_settings',
  'prompts',
  'scenario_block_prompts',
  'system_prompts',
  'channels',
  'logs',
  'cron',
  'file_storage',
  'file_folders',
  'file_folder_relations',
  'chat_messages'
];

const BALANCE_COLUMNS = [
  'balance',
  'balance_free',
  'balance_pay',
  'balance_start',
  'balance_ref',
  'balance_tarif',
  'balance_admin',
  'balance_cost',
  'balance_time'
];

const IDENTITY_TABLES = new Set(['file_folders', 'file_storage']);

export interface PostgresTableManagerProps {
  initialTable?: string;
  triggerToast?: (type: 'success' | 'error', message: string) => void;
  key?: any;
}

export function PostgresTableManager({
  initialTable = 'users',
  triggerToast = (type, msg) => console.log(type, msg)
}: Partial<PostgresTableManagerProps>) {
  const [selectedTable, setSelectedTable] = useState<string>(initialTable);

  useEffect(() => {
    if (initialTable) {
      setSelectedTable(initialTable);
    }
  }, [initialTable]);

  const [tablesInfo, setTablesInfo] = useState<Array<{ tableName: string; rowCount: number }>>([]);
  const [tableData, setTableData] = useState<{ columns: string[]; rows: any[] }>({
    columns: [],
    rows: []
  });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // PostgreSql Console
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM users LIMIT 20');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  // Row Editor Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    mode: 'single' | 'bulk';
    id?: string;
    count?: number;
  } | null>(null);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  // Balance & Tariff Modals
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [balanceUser, setBalanceUser] = useState<any>(null);
  const [balanceAdjustAmount, setBalanceAdjustAmount] = useState<string>('100');
  const [balanceAdjustType, setBalanceAdjustType] = useState<string>('admin');
  const [balanceAdjustComment, setBalanceAdjustComment] = useState<string>('');
  const [balanceAdjustSubmitting, setBalanceAdjustSubmitting] = useState(false);

  const [isCustomTariffModalOpen, setIsCustomTariffModalOpen] = useState(false);
  const [customTariffForm, setCustomTariffForm] = useState<CustomTariffFormState>({
    name: 'Космос Индивидуальный',
    price_rub: 15000,
    monthly_iirky: 15000,
    duration_days: 30,
    duration_text: '30 дней',
    sub: 'Индивидуальная разработка под ключ',
    target_user_id: '',
    featuresText:
      'Любой объем Иирок под задачи\nРазработка брендбука и стратегии\nИндивидуальный контент-план под ключ\nКастомная разработка'
  });
  const [customTariffSubmitting, setCustomTariffSubmitting] = useState(false);

  const [isAssignTariffModalOpen, setIsAssignTariffModalOpen] = useState(false);
  const [assignTariffUser, setAssignTariffUser] = useState<any>(null);
  const [assignTariffForm, setAssignTariffForm] = useState<AssignTariffFormState>({
    tariffName: 'Космос',
    durationDays: 30,
    addMonthlyIirky: 0
  });
  const [assignTariffSubmitting, setAssignTariffSubmitting] = useState(false);

  const [isSyncingReferrals, setIsSyncingReferrals] = useState(false);
  const [isSyncingDb, setIsSyncingDb] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Csv Import States
  const [isCsvImportModalOpen, setIsCsvImportModalOpen] = useState(false);
  const [csvImportText, setCsvImportText] = useState('');
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [csvParsedPreview, setCsvParsedPreview] = useState<{
    headers: string[];
    rows: Record<string, any>[];
  } | null>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  const fetchTablesInfo = async () => {
    try {
      const res = await fetch('/api/db/tables', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tables)) setTablesInfo(data.tables);
      }
    } catch (e) {
      console.error('Error fetching tables info:', e);
    }
  };

  const fetchTableRows = async (table: string, options?: { silent?: boolean }) => {
    if (!table) return;
    if (!options?.silent) setLoading(true);
    try {
      const res = await fetch(`/api/db/table/${encodeURIComponent(table)}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setTableData({ columns: data.columns || [], rows: data.rows || [] });
      }
    } catch (e) {
      console.warn('Error fetching table rows:', e);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTablesInfo();
    fetchTableRows(selectedTable);
    setSelectedRowIds([]);
    setSqlQuery(`SELECT * FROM "${selectedTable}" LIMIT 20`);
  }, [selectedTable]);

  // Real-time background synchronization with ProTalk PG (paused during editing/loading)
  useEffect(() => {
    const anyModalOpen =
      isAddModalOpen ||
      isEditModalOpen ||
      isCsvImportModalOpen ||
      isBalanceModalOpen ||
      isCustomTariffModalOpen ||
      isAssignTariffModalOpen ||
      Boolean(deleteConfirmState?.isOpen);

    if (anyModalOpen || loading || submitting || bulkDeleting || isSyncingDb) return;

    const interval = window.setInterval(() => {
      fetchTablesInfo();
      fetchTableRows(selectedTable, { silent: true });
      fetchCurrentAppVersion(true);
    }, 15000);

    return () => window.clearInterval(interval);
  }, [
    selectedTable,
    isAddModalOpen,
    isEditModalOpen,
    isCsvImportModalOpen,
    isBalanceModalOpen,
    isCustomTariffModalOpen,
    isAssignTariffModalOpen,
    deleteConfirmState,
    loading,
    submitting,
    bulkDeleting,
    isSyncingDb
  ]);

  const handleFullDbSync = async () => {
    if (isSyncingDb) return;
    setIsSyncingDb(true);
    try {
      const res = await fetch('/api/db/sync', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        if (Array.isArray(data.tables)) setTablesInfo(data.tables);
        await Promise.all([fetchTableRows(selectedTable), fetchCurrentAppVersion(true)]);
        triggerToast('success', 'База и версия сборки синхронизированы с ProTalk PostgreSql');
      } else {
        triggerToast('error', data.error || 'Ошибка синхронизации с базой ProTalk');
      }
    } catch (e: any) {
      triggerToast('error', 'Ошибка сети при синхронизации: ' + (e?.message || ''));
    } finally {
      setIsSyncingDb(false);
    }
  };

  const handleDownloadTableCsv = async () => {
    if (isExportingCsv) return;
    setIsExportingCsv(true);
    try {
      const { filename } = await downloadFileViaFetch(
        `/api/admin/db/export/csv/${encodeURIComponent(selectedTable)}`,
        `${selectedTable}.csv`
      );
      triggerToast('success', `Таблица выгружена в «${filename}»`);
    } catch (err: any) {
      triggerToast('error', err?.message || `Ошибка выгрузки ${selectedTable} в .csv`);
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleSyncReferrals = async () => {
    setIsSyncingReferrals(true);
    try {
      const res = await fetch('/api/admin/sync-referrals', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast('success', data.message || `Синхронизировано ${data.addedCount} реферальных начислений`);
        fetchTableRows(selectedTable);
        fetchTablesInfo();
      } else {
        triggerToast('error', data.error || 'Ошибка синхронизации рефералов');
      }
    } catch (e: any) {
      triggerToast('error', 'Сетевая ошибка: ' + e.message);
    } finally {
      setIsSyncingReferrals(false);
    }
  };

  const handleSaveCustomTariff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTariffForm.name.trim()) {
      triggerToast('error', 'Название тарифа обязательно');
      return;
    }
    setCustomTariffSubmitting(true);
    try {
      const featuresArray = customTariffForm.featuresText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((title) => ({ title, desc: '' }));

      const res = await fetch('/api/admin/tariffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customTariffForm.name.trim(),
          price_rub: Number(customTariffForm.price_rub) || 0,
          monthly_iirky: Number(customTariffForm.monthly_iirky) || 0,
          duration_days: Number(customTariffForm.duration_days) || 30,
          duration_text: customTariffForm.duration_text.trim() || `${customTariffForm.duration_days} дней`,
          sub: customTariffForm.sub.trim() || 'Индивидуальный тариф',
          target_user_id: customTariffForm.target_user_id.trim() || null,
          features: featuresArray,
          is_custom: 1
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast('success', `Индивидуальный тариф «${customTariffForm.name}» сохранен`);
        setIsCustomTariffModalOpen(false);
        fetchTableRows(selectedTable);
        fetchTablesInfo();
      } else {
        triggerToast('error', data.error || 'Ошибка создания тарифа');
      }
    } catch (e: any) {
      triggerToast('error', 'Сетевая ошибка: ' + e.message);
    } finally {
      setCustomTariffSubmitting(false);
    }
  };

  const handleAssignTariffToUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTariffUser) return;
    setAssignTariffSubmitting(true);
    try {
      const res = await fetch('/api/admin/users/assign-tariff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: assignTariffUser.id,
          tariffName: assignTariffForm.tariffName.trim(),
          durationDays: Number(assignTariffForm.durationDays) || 30,
          addMonthlyIirky: Number(assignTariffForm.addMonthlyIirky) || 0
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast('success', `Тариф «${assignTariffForm.tariffName}» назначен пользователю #${assignTariffUser.id}`);
        setIsAssignTariffModalOpen(false);
        fetchTableRows('users');
        fetchTablesInfo();
      } else {
        triggerToast('error', data.error || 'Ошибка назначения тарифа');
      }
    } catch (e: any) {
      triggerToast('error', 'Сетевая ошибка: ' + e.message);
    } finally {
      setAssignTariffSubmitting(false);
    }
  };

  const handleExecuteSql = async () => {
    if (!sqlQuery.trim()) return;
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);
    try {
      const res = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sqlQuery })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setQueryResult(data);
        triggerToast('success', 'Запрос PostgreSql успешно выполнен');
        fetchTablesInfo();
        fetchTableRows(selectedTable);
      } else {
        setQueryError(data.error || 'Ошибка выполнения запроса');
        triggerToast('error', data.error || 'Ошибка выполнения запроса');
      }
    } catch {
      setQueryError('Сетевая ошибка выполнения запроса');
      triggerToast('error', 'Сетевая ошибка');
    } finally {
      setQueryLoading(false);
    }
  };

  const filteredRows = tableData.rows.filter((row) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(row).some((val) => String(val ?? '').toLowerCase().includes(term));
  });

  const handleToggleRow = (rowId: string) => {
    setSelectedRowIds((prev) =>
      prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRowIds(filteredRows.map((r, idx) => getTableRowPk(r, selectedTable, idx)));
    } else {
      setSelectedRowIds([]);
    }
  };

  const executeConfirmedDelete = async () => {
    if (!deleteConfirmState) return;
    if (deleteConfirmState.mode === 'bulk') {
      if (selectedRowIds.length === 0) {
        setDeleteConfirmState(null);
        return;
      }
      setBulkDeleting(true);
      try {
        const res = await fetch(`/api/db/table/${encodeURIComponent(selectedTable)}/bulk-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedRowIds })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          triggerToast('success', `Удалено записей: ${data.count || selectedRowIds.length}`);
          setSelectedRowIds([]);
          fetchTablesInfo();
          fetchTableRows(selectedTable);
          if (selectedTable === 'app_settings') fetchCurrentAppVersion(true);
        } else {
          triggerToast('error', data.error || 'Ошибка при массовом удалении');
        }
      } catch {
        triggerToast('error', 'Сетевая ошибка при массовом удалении');
      } finally {
        setBulkDeleting(false);
        setDeleteConfirmState(null);
      }
    } else if (deleteConfirmState.mode === 'single' && deleteConfirmState.id) {
      const id = deleteConfirmState.id;
      setDeletingRowId(id);
      try {
        const res = await fetch(
          `/api/db/table/${encodeURIComponent(selectedTable)}/${encodeURIComponent(id)}`,
          { method: 'DELETE' }
        );
        const data = await res.json();
        if (res.ok && data.success) {
          triggerToast('success', `Запись #${id} удалена`);
          setSelectedRowIds((prev) => prev.filter((item) => item !== id));
          if (editingRow && getTableRowPk(editingRow, selectedTable) === id) {
            setIsEditModalOpen(false);
            setEditingRow(null);
          }
          fetchTablesInfo();
          fetchTableRows(selectedTable);
          if (selectedTable === 'app_settings') fetchCurrentAppVersion(true);
        } else {
          triggerToast('error', data.error || 'Ошибка удаления записи');
        }
      } catch {
        triggerToast('error', 'Сетевая ошибка при удалении');
      } finally {
        setDeletingRowId(null);
        setDeleteConfirmState(null);
      }
    }
  };

  const handleOpenAddModal = () => {
    const emptyRow: Record<string, any> = {};
    tableData.columns.forEach((col) => {
      if (IDENTITY_TABLES.has(selectedTable) && col === 'id') return;
      if (col === 'id') {
        emptyRow[col] = `${selectedTable.slice(0, 3)}_${Date.now()}`;
      } else if (col === 'created_at' || col === 'createdAt' || col === 'updated_at') {
        emptyRow[col] = new Date().toISOString();
      } else if (col === 'role') {
        emptyRow[col] = 'user';
      } else if (col === 'tariff') {
        emptyRow[col] = 'Старт';
      } else if (col === 'status') {
        emptyRow[col] = 'Активный';
      } else if (col.startsWith('balance')) {
        emptyRow[col] = 0;
      } else {
        emptyRow[col] = '';
      }
    });
    setFormData(emptyRow);
    setIsAddModalOpen(true);
  };

  const handleSaveBalanceAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceUser) return;
    const num = parseInt(balanceAdjustAmount, 10);
    if (isNaN(num) || num === 0) {
      triggerToast('error', 'Укажите корректную сумму изменения (не 0)');
      return;
    }
    if (!balanceAdjustComment.trim()) {
      triggerToast('error', 'Укажите причину корректировки баланса');
      return;
    }

    setBalanceAdjustSubmitting(true);
    try {
      const res = await fetch('/api/admin/user-balance-adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: balanceUser.id,
          amount: num,
          balanceType: balanceAdjustType,
          comment: balanceAdjustComment.trim(),
          description: `Корректировка администратором: ${num > 0 ? '+' : ''}${num} Иирок (${balanceAdjustComment.trim()})`
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast('success', data.message || 'Баланс скорректирован');
        setIsBalanceModalOpen(false);
        fetchTableRows('users');
        fetchTablesInfo();
      } else {
        triggerToast('error', data.error || 'Ошибка корректировки баланса');
      }
    } catch (err: any) {
      triggerToast('error', 'Сетевая ошибка: ' + err.message);
    } finally {
      setBalanceAdjustSubmitting(false);
    }
  };

  const handleSaveEditRow = async (e: React.FormEvent) => {
    e.preventDefault();
    const rowPk = getTableRowPk(editingRow, selectedTable);
    if (!editingRow || !rowPk) return;
    setSubmitting(true);
    try {
      const cleanData = { ...formData };
      if (selectedTable === 'users') {
        BALANCE_COLUMNS.forEach((col) => {
          if (editingRow[col] !== undefined) cleanData[col] = editingRow[col];
        });
      }
      const res = await fetch(
        `/api/db/table/${encodeURIComponent(selectedTable)}/${encodeURIComponent(rowPk)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanData)
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast('success', `Запись #${rowPk} обновлена в PostgreSql`);
        setIsEditModalOpen(false);
        fetchTableRows(selectedTable);
        if (selectedTable === 'app_settings') fetchCurrentAppVersion(true);
      } else {
        triggerToast('error', data.error || 'Ошибка сохранения изменений');
      }
    } catch {
      triggerToast('error', 'Сетевая ошибка при сохранении');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAddRow = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...formData };
      if (IDENTITY_TABLES.has(selectedTable)) {
        delete payload.id;
      }
      const res = await fetch(`/api/db/table/${encodeURIComponent(selectedTable)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast('success', `Новая строка добавлена в таблицу «${selectedTable}»`);
        setIsAddModalOpen(false);
        fetchTablesInfo();
        fetchTableRows(selectedTable);
        if (selectedTable === 'app_settings') fetchCurrentAppVersion(true);
      } else {
        triggerToast('error', data.error || 'Ошибка добавления строки');
      }
    } catch {
      triggerToast('error', 'Сетевая ошибка при добавлении');
    } finally {
      setSubmitting(false);
    }
  };

  const parseCsvData = (text: string) => {
    setCsvParsedPreview(parseCsvRfc4180Client(text));
  };

  const handleCsvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      setCsvImportText(content);
      parseCsvData(content);
      setIsCsvImportModalOpen(true);
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const handleExecuteCsvImport = async () => {
    if (!csvParsedPreview || csvParsedPreview.rows.length === 0) {
      triggerToast('error', 'Нет распознанных данных для импорта');
      return;
    }
    setIsImportingCsv(true);
    try {
      const res = await fetch('/api/admin/db/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: selectedTable,
          rows: csvParsedPreview.rows
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast(
          'success',
          `Импортировано ${data.importedCount || csvParsedPreview.rows.length} строк в таблицу «${selectedTable}»`
        );
        setIsCsvImportModalOpen(false);
        setCsvImportText('');
        setCsvParsedPreview(null);
        fetchTablesInfo();
        fetchTableRows(selectedTable);
      } else {
        triggerToast('error', data.error || 'Ошибка импорта данных');
      }
    } catch (err: any) {
      triggerToast('error', 'Сетевая ошибка: ' + err.message);
    } finally {
      setIsImportingCsv(false);
    }
  };

  const displayTables = Array.from(new Set([...CORE_TABLES, ...tablesInfo.map((t) => t.tableName)]));
  const tableSelectOptions = displayTables.map((tbl) => {
    const info = tablesInfo.find((t) => t.tableName === tbl);
    return {
      value: tbl,
      label: `${tbl} — ${getHumanTableLabel(tbl)}`,
      sublabel: `Записей в облачной базе: ${info ? info.rowCount : '...'}`
    };
  });

  return (
    <div className="space-y-6 text-left min-w-0">
      <input
        type="file"
        ref={csvFileInputRef}
        onChange={handleCsvFileSelect}
        accept=".csv,text/csv"
        className="hidden"
      />

      {/* Multi-Format PostgreSQL ProTalk Backup & Restore Center */}
      <PostgresBackupCenterPanel
        selectedTable={selectedTable}
        onAfterRestore={() => {
          fetchTablesInfo();
          fetchTableRows(selectedTable);
          fetchCurrentAppVersion(true);
        }}
        onSyncReferrals={handleSyncReferrals}
        isSyncingReferrals={isSyncingReferrals}
        onOpenCustomTariff={() => setIsCustomTariffModalOpen(true)}
        triggerToast={triggerToast}
      />

      {/* PostgreSQL Tables Selector */}
      <div className="rounded-3xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-md min-w-0">
        <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md p-4 sm:p-6 space-y-4 min-w-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-pink-300/60 pb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 rounded-2xl text-white shadow-sm shrink-0">
                <Database size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[16px] sm:text-[18px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent break-words">
                    Инспектор облачных таблиц PostgreSql ProTalk
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold">
                    {displayTables.length} таблиц
                  </span>
                </div>
                <p className="text-[14px] text-slate-700 font-medium mt-0.5 break-words">
                  Прямое чтение, редактирование и аудит базы данных iismm2 (db.pro-talk.ru)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleFullDbSync}
                disabled={isSyncingDb}
                className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
              >
                <RefreshCw size={15} className={isSyncingDb || loading ? 'animate-spin' : ''} />
                <span>{isSyncingDb ? 'Синхронизация...' : 'Синхронизация'}</span>
              </button>
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus size={16} />
                <span>Создать строку</span>
              </button>
            </div>
          </div>

          {/* Mobile Vertical Dropdown Selector (Zero Horizontal Scroll) */}
          <div className="lg:hidden">
            <GradientSelect
              label="Выберите таблицу PostgreSql"
              value={selectedTable}
              onChange={setSelectedTable}
              options={tableSelectOptions}
              searchable={true}
              searchPlaceholder="Поиск таблицы по имени..."
              buttonVariant="vivid"
            />
          </div>

          {/* Desktop Grid Selector */}
          <div className="hidden lg:grid lg:grid-cols-5 xl:grid-cols-6 gap-2.5 pt-1 max-h-72 overflow-y-auto pr-1">
            {displayTables.map((tableName) => {
              const info = tablesInfo.find((t) => t.tableName === tableName);
              const isSelected = selectedTable === tableName;
              return (
                <button
                  key={tableName}
                  type="button"
                  onClick={() => setSelectedTable(tableName)}
                  className={`flex flex-col p-3 rounded-2xl border text-left transition-all cursor-pointer min-w-0 ${
                    isSelected
                      ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 border-pink-400 text-white shadow-sm font-bold'
                      : 'bg-gradient-to-r from-sky-50/75 via-pink-50/75 via-orange-50/75 via-pink-50/75 to-sky-50/75 border-pink-300/70 text-slate-800 hover:border-pink-400'
                  }`}
                >
                  <div className="flex justify-between items-center w-full gap-1 min-w-0">
                    <span className="font-mono text-[14px] font-bold truncate">{tableName}</span>
                    <TableIcon size={14} className={isSelected ? 'text-white shrink-0' : 'text-pink-600 shrink-0'} />
                  </div>
                  <span className={`text-[14px] font-mono mt-1 ${isSelected ? 'text-white/95' : 'text-slate-700'}`}>
                    Записей: <strong>{info ? info.rowCount : '...'}</strong>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Table Viewer Card */}
      <PostgresTableGridCard
        selectedTable={selectedTable}
        columns={tableData.columns}
        totalRowsCount={tableData.rows.length}
        filteredRows={filteredRows}
        loading={loading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedRowIds={selectedRowIds}
        onSelectAll={handleSelectAll}
        onToggleRow={handleToggleRow}
        bulkDeleting={bulkDeleting}
        deletingRowId={deletingRowId}
        onRequestBulkDelete={() =>
          setDeleteConfirmState({
            isOpen: true,
            mode: 'bulk',
            count: selectedRowIds.length
          })
        }
        onRequestSingleDelete={(id) =>
          setDeleteConfirmState({ isOpen: true, mode: 'single', id })
        }
        onExportCsv={handleDownloadTableCsv}
        isExportingCsv={isExportingCsv}
        onOpenCsvImport={() => setIsCsvImportModalOpen(true)}
        onOpenBalanceAdjust={(row) => {
          setBalanceUser(row);
          setBalanceAdjustAmount('100');
          setBalanceAdjustType('admin');
          setBalanceAdjustComment('');
          setIsBalanceModalOpen(true);
        }}
        onOpenAssignTariff={(row) => {
          setAssignTariffUser(row);
          setAssignTariffForm({
            tariffName: row.tariff || 'Космос',
            durationDays: 30,
            addMonthlyIirky: 0
          });
          setIsAssignTariffModalOpen(true);
        }}
        onOpenEditRow={(row) => {
          setEditingRow(row);
          setFormData({ ...row });
          setIsEditModalOpen(true);
        }}
      />

      {/* PostgreSQL Direct Query Console */}
      <PostgresSqlConsole
        sqlQuery={sqlQuery}
        onChangeSqlQuery={setSqlQuery}
        onExecuteSql={handleExecuteSql}
        queryLoading={queryLoading}
        queryError={queryError}
        queryResult={queryResult}
      />

      {/* Extracted Modals */}
      <TableRowEditorModals
        selectedTable={selectedTable}
        columns={tableData.columns}
        balanceColumns={BALANCE_COLUMNS}
        isAddModalOpen={isAddModalOpen}
        onCloseAddModal={() => setIsAddModalOpen(false)}
        onSaveAddRow={handleSaveAddRow}
        isEditModalOpen={isEditModalOpen}
        onCloseEditModal={() => setIsEditModalOpen(false)}
        onSaveEditRow={handleSaveEditRow}
        editingRow={editingRow}
        formData={formData}
        setFormData={setFormData}
        submitting={submitting}
        onRequestDeleteSingle={(id) =>
          setDeleteConfirmState({ isOpen: true, mode: 'single', id })
        }
        deleteConfirmState={deleteConfirmState}
        onCloseDeleteConfirm={() => setDeleteConfirmState(null)}
        onConfirmDelete={executeConfirmedDelete}
        deletingRowId={deletingRowId}
        bulkDeleting={bulkDeleting}
        selectedRowIdsCount={selectedRowIds.length}
        isCsvImportModalOpen={isCsvImportModalOpen}
        onCloseCsvModal={() => setIsCsvImportModalOpen(false)}
        csvImportText={csvImportText}
        onCsvTextChange={(val) => {
          setCsvImportText(val);
          parseCsvData(val);
        }}
        csvParsedPreview={csvParsedPreview}
        onPickCsvFile={() => csvFileInputRef.current?.click()}
        onExecuteCsvImport={handleExecuteCsvImport}
        isImportingCsv={isImportingCsv}
      />

      <UserTariffBalanceModals
        isBalanceModalOpen={isBalanceModalOpen}
        onCloseBalanceModal={() => setIsBalanceModalOpen(false)}
        balanceUser={balanceUser}
        balanceAdjustAmount={balanceAdjustAmount}
        setBalanceAdjustAmount={setBalanceAdjustAmount}
        balanceAdjustType={balanceAdjustType}
        setBalanceAdjustType={setBalanceAdjustType}
        balanceAdjustComment={balanceAdjustComment}
        setBalanceAdjustComment={setBalanceAdjustComment}
        balanceAdjustSubmitting={balanceAdjustSubmitting}
        onSaveBalanceAdjust={handleSaveBalanceAdjust}
        isCustomTariffModalOpen={isCustomTariffModalOpen}
        onCloseCustomTariffModal={() => setIsCustomTariffModalOpen(false)}
        customTariffForm={customTariffForm}
        setCustomTariffForm={setCustomTariffForm}
        customTariffSubmitting={customTariffSubmitting}
        onSaveCustomTariff={handleSaveCustomTariff}
        isAssignTariffModalOpen={isAssignTariffModalOpen}
        onCloseAssignTariffModal={() => setIsAssignTariffModalOpen(false)}
        assignTariffUser={assignTariffUser}
        assignTariffForm={assignTariffForm}
        setAssignTariffForm={setAssignTariffForm}
        assignTariffSubmitting={assignTariffSubmitting}
        onAssignTariffToUser={handleAssignTariffToUser}
      />
    </div>
  );
}

export default PostgresTableManager;

