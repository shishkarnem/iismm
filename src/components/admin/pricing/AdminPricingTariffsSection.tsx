import React, { useState } from 'react';
import { Crown, Save, Plus, Loader2 } from 'lucide-react';

export interface AdminTariffItem {
  id: string;
  name: string;
  price_iirky: string;
  price_rub: number;
  sub: string;
  continuation?: string;
  monthly_iirky: number;
  features: any[];
  is_active: number;
  sort_order: number;
  duration_days: number;
  duration_text?: string;
  discount_3m?: number;
  discount_6m?: number;
  discount_12m?: number;
  target_user_id?: string | null;
  is_custom?: number;
}

interface AdminPricingTariffsSectionProps {
  tariffs: AdminTariffItem[];
  onSaveTariff: (tariff: AdminTariffItem) => Promise<void>;
  onCreateTariff: (tariff: Partial<AdminTariffItem>) => Promise<void>;
}

export const AdminPricingTariffsSection: React.FC<AdminPricingTariffsSectionProps> = ({
  tariffs,
  onSaveTariff,
  onCreateTariff
}) => {
  const [drafts, setDrafts] = useState<Record<string, AdminTariffItem>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPriceRub, setNewPriceRub] = useState(1990);
  const [newMonthlyIirky, setNewMonthlyIirky] = useState(1990);
  const [newSub, setNewSub] = useState('Специальный тарифный план');

  const getDraft = (t: AdminTariffItem): AdminTariffItem => drafts[t.id] || t;

  const updateDraft = (t: AdminTariffItem, patch: Partial<AdminTariffItem>) => {
    const cur = getDraft(t);
    setDrafts((prev) => ({ ...prev, [t.id]: { ...cur, ...patch } }));
  };

  const handleSaveOne = async (t: AdminTariffItem) => {
    setSavingId(t.id);
    try {
      const merged = getDraft(t);
      await onSaveTariff(merged);
    } finally {
      setSavingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSavingId('__new__');
    try {
      await onCreateTariff({
        name: newName.trim(),
        price_rub: Number(newPriceRub) || 0,
        monthly_iirky: Number(newMonthlyIirky) || 0,
        price_iirky: newPriceRub > 0 ? `${newPriceRub.toLocaleString('ru-RU')} ИИрок / мес` : 'Индивидуально',
        sub: newSub.trim() || 'Индивидуальный тариф',
        is_active: 1,
        is_custom: 0,
        sort_order: tariffs.length + 1,
        duration_days: 30,
        discount_3m: 10,
        discount_6m: 15,
        discount_12m: 20
      });
      setNewName('');
      setShowNewForm(false);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-xs">
      <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pink-300/70 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0">
              <Crown size={18} />
            </div>
            <div>
              <h3 className="text-[16px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                Тарифные планы и скидки (таблица tarifs)
              </h3>
              <p className="text-[14px] text-slate-700 font-medium">
                Изменения тарифов действуют только для новых подключений и продлений — прежние оплаты сохраняются без изменений
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowNewForm((p) => !p)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <Plus size={16} />
            <span>{showNewForm ? 'Скрыть форму' : 'Добавить тариф'}</span>
          </button>
        </div>

        {showNewForm && (
          <form
            onSubmit={handleCreate}
            className="p-4 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 to-orange-50/85 border border-pink-300 space-y-3"
          >
            <div className="text-[15px] font-bold text-slate-900">Новый тариф в каталоге</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[14px] font-bold text-slate-800 block">Название</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Например: Профи"
                  className="w-full px-3 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] font-semibold text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[14px] font-bold text-slate-800 block">Цена в месяц (₽ / ИИрок)</label>
                <input
                  type="number"
                  min={0}
                  value={newPriceRub}
                  onChange={(e) => setNewPriceRub(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] font-mono font-bold text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[14px] font-bold text-slate-800 block">Начисляемо ИИрок в месяц</label>
                <input
                  type="number"
                  min={0}
                  value={newMonthlyIirky}
                  onChange={(e) => setNewMonthlyIirky(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] font-mono font-bold text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[14px] font-bold text-slate-800 block">Подзаголовок</label>
                <input
                  type="text"
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] font-medium text-slate-900"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingId === '__new__'}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] shadow-xs cursor-pointer disabled:opacity-50"
            >
              {savingId === '__new__' ? 'Создание...' : 'Создать тариф в базе'}
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tariffs.map((t) => {
            const d = getDraft(t);
            const isSaving = savingId === t.id;
            return (
              <div
                key={t.id}
                className="p-4 rounded-2xl bg-gradient-to-r from-sky-50/75 via-pink-50/75 via-orange-50/75 via-pink-50/75 to-sky-50/75 border border-pink-300/80 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-pink-200/80 pb-2">
                  <div className="min-w-0">
                    <span className="text-[16px] font-extrabold text-slate-900">{d.name}</span>
                    <span className="ml-2 text-[14px] font-mono text-slate-600">({t.id})</span>
                  </div>
                  <label className="flex items-center gap-2 text-[14px] font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Number(d.is_active ?? 1) === 1}
                      onChange={(e) => updateDraft(t, { is_active: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 accent-pink-600 rounded cursor-pointer"
                    />
                    <span>Показывать пользователям</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[14px] font-bold text-slate-800 block">Название</label>
                    <input
                      type="text"
                      value={d.name}
                      onChange={(e) => updateDraft(t, { name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white/85 border border-pink-300 text-[14px] font-semibold text-slate-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[14px] font-bold text-slate-800 block">Текст цены на карточке</label>
                    <input
                      type="text"
                      value={d.price_iirky || ''}
                      onChange={(e) => updateDraft(t, { price_iirky: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white/85 border border-pink-300 text-[14px] font-semibold text-slate-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[14px] font-bold text-slate-800 block">Цена в месяц (₽)</label>
                    <input
                      type="number"
                      min={0}
                      value={Number(d.price_rub ?? 0)}
                      onChange={(e) => {
                        const rub = Math.max(0, Number(e.target.value) || 0);
                        updateDraft(t, {
                          price_rub: rub,
                          price_iirky: rub > 0 ? `${rub.toLocaleString('ru-RU')} ИИрок / мес` : d.price_iirky
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white/85 border border-pink-300 text-[14px] font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[14px] font-bold text-slate-800 block">Ежемесячный пакет (ИИрок)</label>
                    <input
                      type="number"
                      min={0}
                      value={Number(d.monthly_iirky ?? 0)}
                      onChange={(e) => updateDraft(t, { monthly_iirky: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-full px-3 py-2 rounded-xl bg-white/85 border border-pink-300 text-[14px] font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[14px] font-bold text-slate-800 block">Скидка 3 мес (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={Number(d.discount_3m ?? 10)}
                      onChange={(e) => updateDraft(t, { discount_3m: Math.max(0, Math.min(90, Number(e.target.value) || 0)) })}
                      className="w-full px-2.5 py-2 rounded-xl bg-white/85 border border-pink-300 text-[14px] font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[14px] font-bold text-slate-800 block">Скидка 6 мес (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={Number(d.discount_6m ?? 15)}
                      onChange={(e) => updateDraft(t, { discount_6m: Math.max(0, Math.min(90, Number(e.target.value) || 0)) })}
                      className="w-full px-2.5 py-2 rounded-xl bg-white/85 border border-pink-300 text-[14px] font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[14px] font-bold text-slate-800 block">Скидка 12 мес (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={Number(d.discount_12m ?? 20)}
                      onChange={(e) => updateDraft(t, { discount_12m: Math.max(0, Math.min(90, Number(e.target.value) || 0)) })}
                      className="w-full px-2.5 py-2 rounded-xl bg-white/85 border border-pink-300 text-[14px] font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[14px] font-bold text-slate-800 block">Описание карточки</label>
                    <input
                      type="text"
                      value={d.sub || ''}
                      onChange={(e) => updateDraft(t, { sub: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white/85 border border-pink-300 text-[14px] text-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[14px] font-bold text-slate-800 block">Дней периода</label>
                      <input
                        type="number"
                        min={1}
                        value={Number(d.duration_days ?? 30)}
                        onChange={(e) => updateDraft(t, { duration_days: Math.max(1, Number(e.target.value) || 30) })}
                        className="w-full px-2.5 py-2 rounded-xl bg-white/85 border border-pink-300 text-[14px] font-mono font-bold text-slate-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[14px] font-bold text-slate-800 block">Порядок</label>
                      <input
                        type="number"
                        value={Number(d.sort_order ?? 10)}
                        onChange={(e) => updateDraft(t, { sort_order: Number(e.target.value) || 0 })}
                        className="w-full px-2.5 py-2 rounded-xl bg-white/85 border border-pink-300 text-[14px] font-mono font-bold text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveOne(t)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{isSaving ? 'Сохранение тарифа...' : `Сохранить тариф «${d.name}»`}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
