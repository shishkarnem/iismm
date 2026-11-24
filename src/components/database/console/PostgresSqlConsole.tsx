import React from 'react';
import { Check, Code, RefreshCw, X } from 'lucide-react';

interface PostgresSqlConsoleProps {
  sqlQuery: string;
  onChangeSqlQuery: (value: string) => void;
  onExecuteSql: () => void;
  queryLoading: boolean;
  queryError: string | null;
  queryResult: any | null;
}

export function PostgresSqlConsole({
  sqlQuery,
  onChangeSqlQuery,
  onExecuteSql,
  queryLoading,
  queryError,
  queryResult
}: PostgresSqlConsoleProps) {
  return (
    <div className="rounded-3xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-md min-w-0">
      <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md p-4 sm:p-6 space-y-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-pink-300/60 pb-3">
          <div className="flex items-center gap-2">
            <Code className="text-pink-600 shrink-0" size={18} />
            <span className="text-[15px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
              Консоль прямых запросов PostgreSql ProTalk (iismm2)
            </span>
          </div>
          <span className="text-[14px] text-slate-700 font-mono font-semibold">
            Выборка, добавление, обновление и удаление
          </span>
        </div>

        <div className="space-y-3">
          <textarea
            value={sqlQuery}
            onChange={(e) => onChangeSqlQuery(e.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-3.5 font-mono text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
            placeholder="SELECT * FROM users WHERE role = 'admin'"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onExecuteSql}
              disabled={queryLoading}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white font-bold text-[14px] flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
            >
              {queryLoading ? <RefreshCw className="animate-spin" size={15} /> : <Code size={15} />}
              <span>Выполнить запрос</span>
            </button>
          </div>
        </div>

        {queryError && (
          <div className="rounded-2xl border border-orange-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-100/85 via-pink-50/85 to-sky-50/85 p-3 font-mono text-[14px] text-orange-800 flex items-start gap-2">
            <X size={16} className="shrink-0 mt-0.5 text-orange-600" />
            <span className="break-words">{queryError}</span>
          </div>
        )}

        {queryResult && (
          <div className="space-y-2 rounded-2xl border border-pink-300/70 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-4 font-mono text-[14px]">
            <div className="flex items-center gap-1.5 text-slate-900 font-bold mb-2">
              <Check size={16} className="text-pink-600" />
              <span>Результат выполнения запроса:</span>
            </div>
            {queryResult.rows ? (
              <div className="overflow-x-auto max-h-60 border border-pink-200 rounded-xl">
                <table className="w-full text-left text-[14px] border-collapse">
                  <thead className="bg-sky-100/80 text-slate-900 font-bold">
                    <tr>
                      {queryResult.columns?.map((col: string, idx: number) => (
                        <th key={idx} className="p-2 border-b border-pink-200">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.rows.map((r: any, idx: number) => (
                      <tr key={idx} className="border-b border-pink-100 hover:bg-pink-100/40">
                        {queryResult.columns?.map((col: string, cIdx: number) => (
                          <td key={cIdx} className="p-2 max-w-xs truncate text-slate-900">
                            {typeof r[col] === 'object' && r[col] !== null
                              ? JSON.stringify(r[col])
                              : String(r[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-800 break-words">{JSON.stringify(queryResult)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
