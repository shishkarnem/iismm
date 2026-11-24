import React, { useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { GradientSelect } from '../../ui-kit/GradientDropdown';
import { GradientModalShell, ResponsiveActionBtn } from '../../ui-kit/ResponsiveActionBtn';

interface EditorTableModalProps {
  open: boolean;
  onClose: () => void;
  onInsertTable: (markdownTable: string) => void;
}

export const EditorTableModal: React.FC<EditorTableModalProps> = ({
  open,
  onClose,
  onInsertTable
}) => {
  const [colCount, setColCount] = useState<number>(3);
  const [headers, setHeaders] = useState<string[]>(['Параметр', 'Значение', 'Комментарий']);
  const [alignments, setAlignments] = useState<('left' | 'center' | 'right')[]>(['left', 'center', 'left']);
  const [rows, setRows] = useState<string[][]>([
    ['Охват поста', '+140%', 'Рост за неделю'],
    ['Вовлеченность', '9.4%', 'Стабильный отклик']
  ]);

  const handleColCountChange = (nextCols: number) => {
    setColCount(nextCols);
    setHeaders((prev) => {
      const next = [...prev];
      while (next.length < nextCols) next.push(`Колонка ${next.length + 1}`);
      return next.slice(0, nextCols);
    });
    setAlignments((prev) => {
      const next = [...prev];
      while (next.length < nextCols) next.push('left');
      return next.slice(0, nextCols);
    });
    setRows((prev) =>
      prev.map((r) => {
        const next = [...r];
        while (next.length < nextCols) next.push('');
        return next.slice(0, nextCols);
      })
    );
  };

  const colCountOptions = Array.from({ length: 8 }, (_, idx) => {
    const n = idx + 2;
    return { value: String(n), label: `${n} колонок` };
  });

  const alignOptions = [
    { value: 'left', label: 'Слева' },
    { value: 'center', label: 'По центру' },
    { value: 'right', label: 'Справа' }
  ];

  const handleConfirm = () => {
    const headerRow = `| ${headers.map((h) => h.trim() || ' ').join(' | ')} |`;
    const delimRow = `| ${alignments
      .map((a) => (a === 'center' ? ':---:' : a === 'right' ? '---:' : ':---'))
      .join(' | ')} |`;
    const bodyRows = rows.map((r) => `| ${r.map((c) => c.trim() || ' ').join(' | ')} |`).join('\n');
    onInsertTable(`\n${headerRow}\n${delimRow}\n${bodyRows}\n`);
    onClose();
  };

  return (
    <GradientModalShell
      open={open}
      onClose={onClose}
      title="Конструктор таблицы для Rich-статьи"
      subtitle="Настройте колонки, выравнивание и строки таблицы"
      maxWidthClass="max-w-3xl"
      footer={
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <ResponsiveActionBtn
            icon={<Plus size={16} />}
            label="Добавить строку"
            variant="outline"
            onClick={() => setRows((prev) => [...prev, Array(colCount).fill('')])}
          />
          <ResponsiveActionBtn
            icon={<Check size={16} />}
            label="Вставить таблицу"
            alwaysShowLabel
            variant="vivid"
            onClick={handleConfirm}
          />
        </div>
      }
    >
      <div className="space-y-4">
        <div className="max-w-xs">
          <GradientSelect
            label="Количество колонок"
            value={String(colCount)}
            onChange={(val) => handleColCountChange(Number(val))}
            options={colCountOptions}
          />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-pink-300/80 bg-white/65 p-3 space-y-2.5">
          {/* Headers & Alignment */}
          <div
            className="grid gap-2 min-w-[420px]"
            style={{ gridTemplateColumns: `repeat(${colCount}, minmax(120px, 1fr)) 40px` }}
          >
            {headers.map((h, cIdx) => (
              <div key={cIdx} className="space-y-1.5">
                <input
                  type="text"
                  value={h}
                  onChange={(e) =>
                    setHeaders((prev) => prev.map((it, i) => (i === cIdx ? e.target.value : it)))
                  }
                  placeholder={`Заголовок ${cIdx + 1}`}
                  className="w-full px-2.5 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] font-bold text-slate-900 focus:outline-none"
                />
                <GradientSelect
                  compact
                  value={alignments[cIdx] || 'left'}
                  onChange={(val) =>
                    setAlignments((prev) =>
                      prev.map((it, i) => (i === cIdx ? (val as 'left' | 'center' | 'right') : it))
                    )
                  }
                  options={alignOptions}
                />
              </div>
            ))}
            <div />
          </div>

          {/* Data Rows */}
          {rows.map((row, rIdx) => (
            <div
              key={rIdx}
              className="grid gap-2 items-center min-w-[420px]"
              style={{ gridTemplateColumns: `repeat(${colCount}, minmax(120px, 1fr)) 40px` }}
            >
              {row.map((cell, cIdx) => (
                <input
                  key={cIdx}
                  type="text"
                  value={cell}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r, ri) =>
                        ri === rIdx ? r.map((c, ci) => (ci === cIdx ? e.target.value : c)) : r
                      )
                    )
                  }
                  placeholder="Ячейка..."
                  className="w-full px-2.5 py-2 rounded-xl bg-white/85 border border-pink-200 text-[14px] text-slate-900 focus:outline-none focus:border-pink-400"
                />
              ))}
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((_, ri) => ri !== rIdx))}
                  title="Удалить строку"
                  className="w-9 h-9 rounded-xl bg-rose-100/90 hover:bg-rose-200 text-rose-700 flex items-center justify-center cursor-pointer"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </GradientModalShell>
  );
};
