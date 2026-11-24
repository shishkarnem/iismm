import React from 'react';
import { Calculator, Check, RefreshCw, Sparkles, X } from 'lucide-react';

export interface CustomTariffFormState {
  name: string;
  price_rub: number;
  monthly_iirky: number;
  duration_days: number;
  duration_text: string;
  sub: string;
  target_user_id: string;
  featuresText: string;
}

export interface AssignTariffFormState {
  tariffName: string;
  durationDays: number;
  addMonthlyIirky: number;
}

interface UserTariffBalanceModalsProps {
  isBalanceModalOpen: boolean;
  onCloseBalanceModal: () => void;
  balanceUser: any;
  balanceAdjustAmount: string;
  setBalanceAdjustAmount: (val: string) => void;
  balanceAdjustType: string;
  setBalanceAdjustType: (val: string) => void;
  balanceAdjustComment: string;
  setBalanceAdjustComment: (val: string) => void;
  balanceAdjustSubmitting: boolean;
  onSaveBalanceAdjust: (e: React.FormEvent) => void;

  isCustomTariffModalOpen: boolean;
  onCloseCustomTariffModal: () => void;
  customTariffForm: CustomTariffFormState;
  setCustomTariffForm: React.Dispatch<React.SetStateAction<CustomTariffFormState>>;
  customTariffSubmitting: boolean;
  onSaveCustomTariff: (e: React.FormEvent) => void;

  isAssignTariffModalOpen: boolean;
  onCloseAssignTariffModal: () => void;
  assignTariffUser: any;
  assignTariffForm: AssignTariffFormState;
  setAssignTariffForm: React.Dispatch<React.SetStateAction<AssignTariffFormState>>;
  assignTariffSubmitting: boolean;
  onAssignTariffToUser: (e: React.FormEvent) => void;
}

export const UserTariffBalanceModals: React.FC<UserTariffBalanceModalsProps> = ({
  isBalanceModalOpen,
  onCloseBalanceModal,
  balanceUser,
  balanceAdjustAmount,
  setBalanceAdjustAmount,
  balanceAdjustType,
  setBalanceAdjustType,
  balanceAdjustComment,
  setBalanceAdjustComment,
  balanceAdjustSubmitting,
  onSaveBalanceAdjust,
  isCustomTariffModalOpen,
  onCloseCustomTariffModal,
  customTariffForm,
  setCustomTariffForm,
  customTariffSubmitting,
  onSaveCustomTariff,
  isAssignTariffModalOpen,
  onCloseAssignTariffModal,
  assignTariffUser,
  assignTariffForm,
  setAssignTariffForm,
  assignTariffSubmitting,
  onAssignTariffToUser
}) => {
  return (
    <>
      {/* Modal: Admin Balance Adjust Calculator */}
      {isBalanceModalOpen && balanceUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md bg-gradient-to-r from-sky-200/35 via-pink-200/35 via-orange-200/35 via-pink-200/35 to-sky-200/35">
          <div className="w-full max-w-lg rounded-3xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-2xl">
            <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xl p-5 sm:p-6 space-y-4 text-left">
              <div className="flex items-center justify-between border-b border-pink-300/70 pb-3 gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white rounded-xl shrink-0">
                    <Calculator size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                      Калькулятор изменения баланса
                    </h3>
                    <p className="text-[14px] text-slate-700 truncate">
                      Пользователь:{' '}
                      <strong className="text-slate-900">
                        {balanceUser.name || balanceUser.first_name || balanceUser.username || balanceUser.id}
                      </strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onCloseBalanceModal}
                  className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white cursor-pointer shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl border border-pink-300/70 bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80">
                <div className="text-center p-2 rounded-xl border border-pink-200">
                  <span className="text-[14px] text-slate-700 block">Баланс (Иирки)</span>
                  <span className="text-[16px] font-extrabold text-pink-700 font-mono">
                    {(balanceUser.balance ?? 0).toLocaleString('ru-RU')}
                  </span>
                </div>
                <div className="text-center p-2 rounded-xl border border-sky-200">
                  <span className="text-[14px] text-slate-700 block">Бонусный остаток</span>
                  <span className="text-[16px] font-extrabold text-sky-700 font-mono">
                    {(balanceUser.balance_free ?? 0).toLocaleString('ru-RU')}
                  </span>
                </div>
              </div>

              <form onSubmit={onSaveBalanceAdjust} className="space-y-4">
                <div>
                  <label className="block text-[14px] font-bold text-slate-800 mb-1">
                    Сумма изменения (+ для начисления, - для списания):
                  </label>
                  <input
                    type="number"
                    required
                    value={balanceAdjustAmount}
                    onChange={(e) => setBalanceAdjustAmount(e.target.value)}
                    placeholder="+500 или -200"
                    className="w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 px-3.5 py-2 text-[15px] font-mono font-bold text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[14px] font-bold text-slate-800 mb-1">Тип баланса:</label>
                  <select
                    value={balanceAdjustType}
                    onChange={(e) => setBalanceAdjustType(e.target.value)}
                    className="w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 px-3.5 py-2 text-[14px] font-bold text-slate-900 focus:outline-none cursor-pointer"
                  >
                    <option value="admin">Корректировка администратором (balance_admin)</option>
                    <option value="pay">Пополнение / оплата (balance_pay)</option>
                    <option value="start">Стартовый бонус (balance_start)</option>
                    <option value="ref">Партнерские реферальные (balance_ref)</option>
                    <option value="tarif">Тарифное начисление (balance_tarif)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[14px] font-bold text-slate-800 mb-1">
                    Причина изменения (комментарий для журнала транзакций):
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={balanceAdjustComment}
                    onChange={(e) => setBalanceAdjustComment(e.target.value)}
                    placeholder="Например: бонус за участие в тестировании..."
                    className="w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-3 text-[14px] text-slate-900 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-pink-300/70">
                  <button
                    type="button"
                    onClick={onCloseBalanceModal}
                    className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold opacity-85 hover:opacity-100 cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={balanceAdjustSubmitting}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-bold flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-60"
                  >
                    {balanceAdjustSubmitting ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
                    <span>Применить корректировку</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Custom Tariff */}
      {isCustomTariffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md bg-gradient-to-r from-sky-200/35 via-pink-200/35 via-orange-200/35 via-pink-200/35 to-sky-200/35">
          <div className="w-full max-w-lg rounded-3xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xl p-5 sm:p-6 space-y-4 overflow-hidden flex flex-col flex-1 text-left">
              <div className="flex items-center justify-between border-b border-pink-300/70 pb-3 shrink-0 gap-2">
                <h3 className="text-[16px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent flex items-center gap-2">
                  <Sparkles size={18} className="text-pink-600 shrink-0" />
                  <span>Создание индивидуального тарифа</span>
                </h3>
                <button
                  type="button"
                  onClick={onCloseCustomTariffModal}
                  className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white cursor-pointer shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={onSaveCustomTariff} className="space-y-4 overflow-y-auto pr-1 flex-1">
                <div>
                  <label className="block text-[14px] font-bold text-slate-800 mb-1">Название тарифа:</label>
                  <input
                    type="text"
                    required
                    value={customTariffForm.name}
                    onChange={(e) => setCustomTariffForm({ ...customTariffForm, name: e.target.value })}
                    className="w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 px-3.5 py-2 text-[14px] font-bold text-slate-900 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[14px] font-bold text-slate-800 mb-1">Стоимость (руб):</label>
                    <input
                      type="number"
                      min="0"
                      value={customTariffForm.price_rub}
                      onChange={(e) =>
                        setCustomTariffForm({ ...customTariffForm, price_rub: Number(e.target.value) || 0 })
                      }
                      className="w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 px-3.5 py-2 text-[14px] font-mono font-bold text-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[14px] font-bold text-slate-800 mb-1">Иирок в месяц:</label>
                    <input
                      type="number"
                      min="0"
                      value={customTariffForm.monthly_iirky}
                      onChange={(e) =>
                        setCustomTariffForm({ ...customTariffForm, monthly_iirky: Number(e.target.value) || 0 })
                      }
                      className="w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 px-3.5 py-2 text-[14px] font-mono font-bold text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[14px] font-bold text-slate-800 mb-1">Срок действия (дней):</label>
                    <input
                      type="number"
                      min="1"
                      value={customTariffForm.duration_days}
                      onChange={(e) => {
                        const days = Number(e.target.value) || 30;
                        setCustomTariffForm({
                          ...customTariffForm,
                          duration_days: days,
                          duration_text: `${days} дней`
                        });
                      }}
                      className="w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 px-3.5 py-2 text-[14px] font-mono font-bold text-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[14px] font-bold text-slate-800 mb-1">
                      Привязка к пользователю:
                    </label>
                    <input
                      type="text"
                      value={customTariffForm.target_user_id}
                      onChange={(e) => setCustomTariffForm({ ...customTariffForm, target_user_id: e.target.value })}
                      placeholder="Пусто — для всех"
                      className="w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 px-3.5 py-2 text-[14px] font-mono text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[14px] font-bold text-slate-800 mb-1">Краткое описание:</label>
                  <input
                    type="text"
                    value={customTariffForm.sub}
                    onChange={(e) => setCustomTariffForm({ ...customTariffForm, sub: e.target.value })}
                    className="w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 px-3.5 py-2 text-[14px] text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[14px] font-bold text-slate-800 mb-1">
                    Возможности тарифа (каждая с новой строки):
                  </label>
                  <textarea
                    rows={4}
                    value={customTariffForm.featuresText}
                    onChange={(e) => setCustomTariffForm({ ...customTariffForm, featuresText: e.target.value })}
                    className="w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-3 text-[14px] text-slate-900 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-pink-300/70 shrink-0">
                  <button
                    type="button"
                    onClick={onCloseCustomTariffModal}
                    className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold opacity-85 hover:opacity-100 cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={customTariffSubmitting}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-bold flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-60"
                  >
                    {customTariffSubmitting ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
                    <span>Сохранить тариф</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Assign Tariff to User */}
      {isAssignTariffModalOpen && assignTariffUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md bg-gradient-to-r from-sky-200/35 via-pink-200/35 via-orange-200/35 via-pink-200/35 to-sky-200/35">
          <div className="w-full max-w-md rounded-3xl p-[1.5px] bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-2xl">
            <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xl p-5 sm:p-6 space-y-4 text-left">
              <div className="flex items-center justify-between border-b border-pink-300/70 pb-3 gap-2">
                <h3 className="text-[16px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent flex items-center gap-2">
                  <Sparkles size={18} className="text-pink-600 shrink-0" />
                  <span>Назначение тарифа</span>
                </h3>
                <button
                  type="button"
                  onClick={onCloseAssignTariffModal}
                  className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white cursor-pointer shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-3 rounded-2xl border border-pink-300/70 bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 space-y-1 text-[14px]">
                <div className="font-bold text-slate-900">
                  Пользователь:{' '}
                  <span className="text-pink-700">
                    {assignTariffUser.name || assignTariffUser.username || `#${assignTariffUser.id}`}
                  </span>
                </div>
                <div className="text-slate-700">
                  Текущий тариф: <strong className="text-slate-900">{assignTariffUser.tariff || 'Старт'}</strong>
                </div>
              </div>

              <form onSubmit={onAssignTariffToUser} className="space-y-4">
                <div>
                  <label className="block text-[14px] font-bold text-slate-800 mb-1">Выберите тариф:</label>
                  <input
                    type="text"
                    required
                    value={assignTariffForm.tariffName}
                    onChange={(e) => setAssignTariffForm({ ...assignTariffForm, tariffName: e.target.value })}
                    className="w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 px-3.5 py-2 text-[14px] font-bold text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[14px] font-bold text-slate-800 mb-1">Срок действия (в днях):</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={assignTariffForm.durationDays}
                    onChange={(e) =>
                      setAssignTariffForm({ ...assignTariffForm, durationDays: Number(e.target.value) || 30 })
                    }
                    className="w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 px-3.5 py-2 text-[14px] font-mono font-bold text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[14px] font-bold text-slate-800 mb-1">
                    Начислить Иирок сразу (balance_tarif):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={assignTariffForm.addMonthlyIirky}
                    onChange={(e) =>
                      setAssignTariffForm({ ...assignTariffForm, addMonthlyIirky: Number(e.target.value) || 0 })
                    }
                    className="w-full rounded-xl border border-pink-300 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 px-3.5 py-2 text-[14px] font-mono font-bold text-slate-900 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-pink-300/70">
                  <button
                    type="button"
                    onClick={onCloseAssignTariffModal}
                    className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold opacity-85 hover:opacity-100 cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={assignTariffSubmitting}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-bold flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-60"
                  >
                    {assignTariffSubmitting ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
                    <span>Применить тариф</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
