import React from 'react';
import {
  Calculator,
  Download,
  Edit2,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Sparkles,
  Table as TableIcon,
  Trash2
} from 'lucide-react';
import { getTableRowPk } from '../jsonRestoreRunner';

interface PostgresTableGridCardProps {
  selectedTable: string;
  columns: string[];
  totalRowsCount: number;
  filteredRows: Record<string, any>[];
  loading: boolean;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  selectedRowIds: string[];
  onSelectAll: (checked: boolean) => void;
  onToggleRow: (rowId: string) => void;
  bulkDeleting: boolean;
  deletingRowId: string | null;
  onRequestBulkDelete: () => void;
  onRequestSingleDelete: (rowId: string) => void;
  onExportCsv: () => void;
  isExportingCsv: boolean;
  onOpenCsvImport: () => void;
  onOpenBalanceAdjust: (row: any) => void;
  onOpenAssignTariff: (row: any) => void;
  onOpenEditRow: (row: any) => void;
}

export const PostgresTableGridCard: React.FC<PostgresTableGridCardProps> = ({
  selectedTable,
  columns,
  totalRowsCount,
  filteredRows,
  loading,
  searchTerm,
  onSearchChange,
  selectedRowIds,
  onSelectAll,
  onToggleRow,
  bulkDeleting,
  deletingRowId,
  onRequestBulkDelete,
  onRequestSingleDelete,
  onExportCsv,
  isExportingCsv,
  onOpenCsvImport,
  onOpenBalanceAdjust,
  onOpenAssignTariff,
  onOpenEditRow
}) => {
  return (
    <div className="rounded-3xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-md min-w-0">
      <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md p-4 sm:p-6 space-y-4 min-w-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-pink-300/60 pb-4">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <TableIcon className="text-pink-600 shrink-0" size={18} />
            <span className="text-[15px] font-bold text-slate-900 font-mono break-all">
              Таблица: {selectedTable}
            </span>
            <span className="text-[14px] text-slate-700 font-mono font-semibold">
              ({filteredRows.length} из {totalRowsCount} строк)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            {selectedRowIds.length > 0 && (
              <button
                type="button"
                onClick={onRequestBulkDelete}
                disabled={bulkDeleting}
                className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {bulkDeleting ? <RefreshCw className="animate-spin" size={15} /> : <Trash2 size={15} />}
                <span>Удалить выбранные ({selectedRowIds.length})</span>
              </button>
            )}

            <div className="relative w-full sm:w-64 min-w-0">
              <Search size={16} className="absolute left-3 top-2.5 text-pink-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Поиск по столбцам..."
                className="w-full rounded-2xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 pl-9 pr-3 py-2 text-[14px] text-slate-900 placeholder-slate-500 focus:outline-none focus:border-pink-500"
              />
            </div>

            <button
              type="button"
              onClick={onExportCsv}
              disabled={isExportingCsv}
              className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
            >
              {isExportingCsv ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
              <span>Экспорт .csv</span>
            </button>

            <button
              type="button"
              onClick={onOpenCsvImport}
              className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileSpreadsheet size={15} />
              <span>Импорт .csv</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-pink-300/70 rounded-2xl bg-gradient-to-r from-sky-50/75 via-pink-50/75 via-orange-50/75 via-pink-50/75 to-sky-50/75 max-h-[500px]">
          {loading ? (
            <div className="py-12 text-center text-slate-800 text-[14px] font-bold flex items-center justify-center gap-2">
              <RefreshCw className="animate-spin text-pink-600" size={18} />
              <span>Загрузка данных из PostgreSql ProTalk...</span>
            </div>
          ) : filteredRows.length > 0 ? (
            <table className="w-full text-left text-[14px] border-collapse">
              <thead className="bg-gradient-to-r from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 text-slate-900 font-bold sticky top-0 border-b border-pink-300 z-10">
                <tr>
                  <th className="p-3 border-r border-pink-200 text-center w-10">
                    <input
                      type="checkbox"
                      checked={filteredRows.length > 0 && selectedRowIds.length === filteredRows.length}
                      onChange={(e) => onSelectAll(e.target.checked)}
                      className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
                    />
                  </th>
                  <th className="p-3 border-r border-pink-200 font-mono text-center w-28">Действия</th>
                  {columns.map((col) => (
                    <th key={col} className="p-3 border-r border-pink-200 font-mono whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-200/60">
                {filteredRows.map((row, rIdx) => {
                  const rowId = getTableRowPk(row, selectedTable, rIdx);
                  const isRowSelected = selectedRowIds.includes(rowId);
                  return (
                    <tr
                      key={rowId}
                      className={`transition-colors ${
                        isRowSelected ? 'bg-pink-200/45' : 'hover:bg-pink-100/45'
                      }`}
                    >
                      <td className="p-2.5 border-r border-pink-200 text-center w-10">
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={() => onToggleRow(rowId)}
                          className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
                        />
                      </td>
                      <td className="p-2.5 border-r border-pink-200 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {selectedTable === 'users' && (
                            <>
                              <button
                                type="button"
                                onClick={() => onOpenBalanceAdjust(row)}
                                className="p-1.5 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 text-white rounded-xl cursor-pointer"
                                title="Калькулятор корректировки баланса"
                              >
                                <Calculator size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenAssignTariff(row)}
                                className="p-1.5 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 text-white rounded-xl cursor-pointer"
                                title="Назначить тариф"
                              >
                                <Sparkles size={15} />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenEditRow(row)}
                            className="p-1.5 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 text-white rounded-xl cursor-pointer"
                            title="Редактировать запись"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRequestSingleDelete(rowId)}
                            disabled={deletingRowId === rowId}
                            className="p-1.5 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 text-white rounded-xl cursor-pointer"
                            title="Удалить запись"
                          >
                            {deletingRowId === rowId ? (
                              <RefreshCw className="animate-spin" size={15} />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </div>
                      </td>
                      {columns.map((col) => (
                        <td
                          key={col}
                          className="p-2.5 border-r border-pink-200/50 font-mono text-slate-900 max-w-xs truncate"
                        >
                          {typeof row[col] === 'object' && row[col] !== null
                            ? JSON.stringify(row[col])
                            : String(row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-slate-700 text-[14px] font-bold">
              В таблице «{selectedTable}» нет записей по заданному фильтру.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
