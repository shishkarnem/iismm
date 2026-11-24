import React from 'react';
import {
  Check,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  User as UserIcon,
  X
} from 'lucide-react';
import { getTableRowPk } from './jsonRestoreRunner';

interface TableRowEditorModalsProps {
  selectedTable: string;
  columns: string[];
  balanceColumns: string[];
  isAddModalOpen: boolean;
  onCloseAddModal: () => void;
  onSaveAddRow: (e: React.FormEvent) => void;
  isEditModalOpen: boolean;
  onCloseEditModal: () => void;
  onSaveEditRow: (e: React.FormEvent) => void;
  editingRow: any;
  formData: Record<string, any>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  submitting: boolean;
  onRequestDeleteSingle: (id: string) => void;
  deleteConfirmState: { isOpen: boolean; mode: 'single' | 'bulk'; id?: string; count?: number } | null;
  onCloseDeleteConfirm: () => void;
  onConfirmDelete: () => void;
  deletingRowId: string | null;
  bulkDeleting: boolean;
  selectedRowIdsCount: number;
  isCsvImportModalOpen: boolean;
  onCloseCsvModal: () => void;
  csvImportText: string;
  onCsvTextChange: (val: string) => void;
  csvParsedPreview: { headers: string[]; rows: Record<string, any>[] } | null;
  onPickCsvFile: () => void;
  onExecuteCsvImport: () => void;
  isImportingCsv: boolean;
}

const IDENTITY_TABLES = new Set(['file_folders', 'file_storage']);

export const TableRowEditorModals: React.FC<TableRowEditorModalsProps> = ({
  selectedTable,
  columns,
  balanceColumns,
  isAddModalOpen,
  onCloseAddModal,
  onSaveAddRow,
  isEditModalOpen,
  onCloseEditModal,
  onSaveEditRow,
  editingRow,
  formData,
  setFormData,
  submitting,
  onRequestDeleteSingle,
  deleteConfirmState,
  onCloseDeleteConfirm,
  onConfirmDelete,
  deletingRowId,
  bulkDeleting,
  selectedRowIdsCount,
  isCsvImportModalOpen,
  onCloseCsvModal,
  csvImportText,
  onCsvTextChange,
  csvParsedPreview,
  onPickCsvFile,
  onExecuteCsvImport,
  isImportingCsv
}) => {
  const photoUrlValue =
    formData['photo_url'] ||
    formData['photoUrl'] ||
    formData['photo'] ||
    formData['avatar_url'] ||
    formData['avatarUrl'];

  return (
    <>
      {/* Modal: Add Row */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md bg-gradient-to-r from-sky-200/35 via-pink-200/35 via-orange-200/35 via-pink-200/35 to-sky-200/35">
          <div className="w-full max-w-2xl rounded-3xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xl p-4 sm:p-6 space-y-4 overflow-hidden flex flex-col flex-1 text-left">
              <div className="flex items-center justify-between border-b border-pink-300/70 pb-3 shrink-0 gap-2">
                <h3 className="text-[16px] sm:text-[18px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent flex items-center gap-2 break-words">
                  <Plus size={18} className="text-pink-600 shrink-0" />
                  <span>Добавить новую строку в «{selectedTable}»</span>
                </h3>
                <button
                  type="button"
                  onClick={onCloseAddModal}
                  className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white cursor-pointer shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={onSaveAddRow} className="space-y-4 overflow-y-auto pr-1 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {columns
                    .filter((col) => !(IDENTITY_TABLES.has(selectedTable) && col === 'id'))
                    .map((col) => (
                      <div key={col} className="min-w-0">
                        <label className="block text-[14px] font-mono font-bold text-slate-800 mb-1 break-all">
                          {col}
                        </label>
                        <input
                          type="text"
                          value={formData[col] ?? ''}
                          onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                          className="w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 px-3 py-2 text-[14px] text-slate-900 font-mono focus:outline-none focus:border-pink-500"
                        />
                      </div>
                    ))}
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-pink-300/70 shrink-0">
                  <button
                    type="button"
                    onClick={onCloseAddModal}
                    className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold transition-all cursor-pointer opacity-85 hover:opacity-100"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-bold flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-60"
                  >
                    {submitting ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
                    <span>Сохранить строку</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Row */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md bg-gradient-to-r from-sky-200/35 via-pink-200/35 via-orange-200/35 via-pink-200/35 to-sky-200/35">
          <div className="w-full max-w-2xl rounded-3xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xl p-4 sm:p-6 space-y-4 overflow-hidden flex flex-col flex-1 text-left">
              <div className="flex items-center justify-between border-b border-pink-300/70 pb-3 shrink-0 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  {photoUrlValue ? (
                    <img
                      src={photoUrlValue}
                      alt="Аватар"
                      className="w-11 h-11 rounded-full object-cover border-2 border-pink-400 shadow-xs shrink-0"
                    />
                  ) : (
                    <div className="p-2.5 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white rounded-2xl shadow-xs shrink-0">
                      <UserIcon size={18} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-[16px] sm:text-[18px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent truncate">
                      {selectedTable === 'users'
                        ? 'Редактирование пользователя'
                        : `Редактор записи #${getTableRowPk(editingRow, selectedTable)}`}
                    </h3>
                    <p className="text-[14px] font-semibold text-slate-700 truncate">
                      {selectedTable === 'users'
                        ? `Идентификатор: ${editingRow?.id || ''} · ${editingRow?.telegram_id || editingRow?.username || '—'}`
                        : `Таблица «${selectedTable}»`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onCloseEditModal}
                  className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white cursor-pointer shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={onSaveEditRow} className="space-y-4 overflow-y-auto pr-1 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {columns.map((col) => {
                    const isPhotoCol =
                      col === 'photo_url' || col === 'photoUrl' || col === 'photo' || col === 'avatar_url';
                    const isTariff = col === 'tariff';
                    const isRole = col === 'role';
                    const isStatus = col === 'status';
                    const isBalanceField = selectedTable === 'users' && balanceColumns.includes(col);

                    const isPkCol =
                      col === 'id' ||
                      (selectedTable === 'app_settings' && col === 'setting_key') ||
                      (selectedTable === 'user_onboarding_tour' && col === 'user_id') ||
                      (selectedTable === 'file_folder_relations' && (col === 'file_id' || col === 'folder_id'));

                    return (
                      <div key={col} className={isPhotoCol ? 'sm:col-span-2 min-w-0' : 'min-w-0'}>
                        <label className="block text-[14px] font-mono font-bold text-slate-800 mb-1 break-all">
                          {col} {isPkCol && '(первичный ключ)'}
                          {isBalanceField && (
                            <span className="text-pink-700 font-bold ml-1">(через калькулятор)</span>
                          )}
                        </label>
                        {isTariff ? (
                          <select
                            value={formData[col] ?? 'Старт'}
                            onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                            className="w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 px-3 py-2 text-[14px] text-slate-900 font-bold focus:outline-none cursor-pointer"
                          >
                            <option value="Старт">Старт</option>
                            <option value="Разгон">Разгон</option>
                            <option value="Отрыв">Отрыв</option>
                            <option value="Космос">Космос</option>
                          </select>
                        ) : isRole ? (
                          <select
                            value={formData[col] ?? 'user'}
                            onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                            className="w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 px-3 py-2 text-[14px] text-slate-900 font-bold focus:outline-none cursor-pointer"
                          >
                            <option value="user">Пользователь</option>
                            <option value="editor">Редактор</option>
                            <option value="admin">Администратор</option>
                          </select>
                        ) : isStatus ? (
                          <select
                            value={formData[col] ?? 'Активный'}
                            onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                            className="w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 px-3 py-2 text-[14px] text-slate-900 font-bold focus:outline-none cursor-pointer"
                          >
                            <option value="Активный">Активный</option>
                            <option value="Заблокирован">Заблокирован</option>
                            <option value="Ожидает">Ожидает</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            disabled={isPkCol || isBalanceField}
                            value={formData[col] ?? ''}
                            onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                            className={`w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 px-3 py-2 text-[14px] font-mono focus:outline-none ${
                              isPkCol || isBalanceField
                                ? 'text-slate-500 cursor-not-allowed opacity-75'
                                : 'text-slate-900 focus:border-pink-500'
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-pink-300/70 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const idToDelete = getTableRowPk(editingRow, selectedTable);
                      if (idToDelete) onRequestDeleteSingle(idToDelete);
                    }}
                    className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 size={15} />
                    <span>Удалить запись</span>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={onCloseEditModal}
                      className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold opacity-85 hover:opacity-100 cursor-pointer"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-bold flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-60"
                    >
                      {submitting ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
                      <span>Сохранить изменения</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal: CSV Import */}
      {isCsvImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md bg-gradient-to-r from-sky-200/35 via-pink-200/35 via-orange-200/35 via-pink-200/35 to-sky-200/35">
          <div className="w-full max-w-2xl rounded-3xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xl p-4 sm:p-6 space-y-4 overflow-hidden flex flex-col flex-1 text-left">
              <div className="flex items-center justify-between border-b border-pink-300/70 pb-3 shrink-0 gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[16px] sm:text-[18px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent break-words">
                      Импорт данных из файла таблиц (.csv)
                    </h3>
                    <p className="text-[14px] text-slate-700 font-medium break-words">
                      Целевая таблица PostgreSql: <span className="font-mono font-bold text-pink-700">{selectedTable}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onCloseCsvModal}
                  className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white cursor-pointer shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-pink-300/70 bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 p-3.5">
                  <div className="text-[14px] text-slate-800 min-w-0">
                    <p className="font-bold text-slate-900">Загрузить готовый файл .csv</p>
                    <p className="text-[14px] text-slate-700">Автоматическое распознавание разделителей и заголовков</p>
                  </div>
                  <button
                    type="button"
                    onClick={onPickCsvFile}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Upload size={15} />
                    <span>Выбрать файл .csv</span>
                  </button>
                </div>

                <div>
                  <label className="block text-[14px] font-bold text-slate-800 mb-1">
                    Или вставьте строки с разделителями напрямую:
                  </label>
                  <textarea
                    rows={5}
                    value={csvImportText}
                    onChange={(e) => onCsvTextChange(e.target.value)}
                    placeholder={`id,name,role,status\nuser_1,Иван Иванов,admin,active`}
                    className="w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-3 text-[14px] font-mono text-slate-900 focus:outline-none focus:border-pink-500"
                  />
                </div>

                {csvParsedPreview && (
                  <div className="rounded-2xl border border-pink-300/70 bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 p-4 text-[14px]">
                    <span className="font-bold text-slate-900">
                      Распознано строк: <strong className="text-pink-700">{csvParsedPreview.rows.length}</strong> · Столбцов: {csvParsedPreview.headers.length}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-pink-300/70 shrink-0">
                <button
                  type="button"
                  onClick={onCloseCsvModal}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold opacity-85 hover:opacity-100 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={onExecuteCsvImport}
                  disabled={isImportingCsv || !csvParsedPreview || csvParsedPreview.rows.length === 0}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-bold flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isImportingCsv ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
                  <span>Импортировать в PostgreSql</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {deleteConfirmState?.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 backdrop-blur-md bg-gradient-to-r from-sky-200/35 via-pink-200/35 via-orange-200/35 via-pink-200/35 to-sky-200/35">
          <div className="w-full max-w-md rounded-3xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-2xl">
            <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xl p-5 sm:p-6 space-y-4 text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white rounded-2xl shrink-0">
                    <Trash2 size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                      Подтверждение удаления
                    </h3>
                    <p className="text-[14px] text-pink-700 font-bold truncate">
                      Таблица «{selectedTable}»
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onCloseDeleteConfirm}
                  className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white cursor-pointer shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-[14px] text-slate-800 leading-relaxed break-words">
                {deleteConfirmState.mode === 'bulk'
                  ? `Вы действительно хотите удалить выбранные записи (${deleteConfirmState.count || selectedRowIdsCount} шт.) из облачной таблицы «${selectedTable}»?`
                  : `Вы действительно хотите удалить запись #${deleteConfirmState.id} из облачной таблицы «${selectedTable}»?`}
              </p>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onCloseDeleteConfirm}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold opacity-85 hover:opacity-100 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={deletingRowId !== null || bulkDeleting}
                  onClick={onConfirmDelete}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-bold flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-60"
                >
                  {deletingRowId !== null || bulkDeleting ? (
                    <RefreshCw className="animate-spin" size={15} />
                  ) : (
                    <Trash2 size={15} />
                  )}
                  <span>Удалить</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
