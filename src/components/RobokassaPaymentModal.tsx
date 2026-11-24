import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, Settings, ShieldCheck, FileText, Scale, Lock, FileCheck2, Loader2 } from 'lucide-react';
import { UserAccount } from '../types';
import { redirectToRobokassaPayment, RECURRING_CONSENT_LABEL } from '../utils/payment/robokassaRedirect';
import OfertaModalContent, { LegalDocSectionType } from './OfertaModalContent';
import { usePricingConfig } from '../hooks/usePricingConfig';
import { computeTopupIirkyAmount, formatIirkyWord } from '../shared/pricingConfig';

interface RobokassaPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAccount;
  onUpdateUser?: (updated: UserAccount) => void;
  initialPlanName?: string;
  initialAmountRub?: number;
  initialPaymentType?: 'tariff' | 'topup';
  initialPeriodMonths?: number;
}

export default function RobokassaPaymentModal({
  isOpen,
  onClose,
  user,
  initialPlanName = 'Разгон',
  initialAmountRub = 990,
  initialPaymentType = 'tariff',
  initialPeriodMonths = 1
}: RobokassaPaymentModalProps) {
  const [activeTab, setActiveTab] = useState<'pay' | 'settings'>('pay');
  const [paymentMode, setPaymentMode] = useState<'tariff' | 'topup'>(initialPaymentType);
  const [selectedPlan, setSelectedPlan] = useState(initialPlanName);
  const [periodMonths, setPeriodMonths] = useState<number>(initialPeriodMonths || 1);
  const [customAmount, setCustomAmount] = useState<number>(initialAmountRub || 990);
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState('');
  const [legalDocModal, setLegalDocModal] = useState<LegalDocSectionType | null>(null);

  // Domain-aware system_configs states
  const [detectedDomain, setDetectedDomain] = useState<string>('iismm.online');
  const [selectedConfigDomain, setSelectedConfigDomain] = useState<'iismm.online' | 'iismm.ru'>('iismm.online');
  const [allConfigs, setAllConfigs] = useState<any[]>([]);
  const [merchantLogin, setMerchantLogin] = useState('');
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [successUrl, setSuccessUrl] = useState('');
  const [failUrl, setFailUrl] = useState('');
  const [isTestMode, setIsTestMode] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  const isAdmin =
    user.role === 'admin' ||
    user.role === 'superadmin' ||
    user.email === 'shishkarnem@gmail.com' ||
    user.id === '169262990' ||
    user.id === '16926299042' ||
    user.telegramId === 169262990;

  const { pricing, tariffs } = usePricingConfig(String(user.id || user.telegramId || ''));

  const getTariffMonthlyRub = (planName: string): number => {
    const clean = planName.toLowerCase();
    const matched = Array.isArray(tariffs)
      ? tariffs.find((t: any) => String(t.name || '').toLowerCase().includes(clean) || String(t.id || '').toLowerCase() === (clean.includes('отрыв') ? 'otryv' : 'razgon'))
      : null;
    if (matched && Number(matched.price_rub) > 0) {
      return Number(matched.price_rub);
    }
    return clean.includes('отрыв') ? 4900 : 990;
  };

  useEffect(() => {
    const cleanPlan = (initialPlanName || 'Разгон').trim();
    const normPlan =
      cleanPlan.toLowerCase().includes('отрыв')
        ? 'Отрыв'
        : cleanPlan.toLowerCase().includes('космос')
        ? 'Космос'
        : 'Разгон';
    setSelectedPlan(normPlan);
    setPaymentMode(initialPaymentType);
    setPeriodMonths(initialPeriodMonths || 1);
    if (initialAmountRub && initialAmountRub >= 10) {
      setCustomAmount(initialAmountRub);
    } else {
      setCustomAmount(getTariffMonthlyRub(normPlan));
    }
  }, [initialPlanName, initialAmountRub, initialPaymentType, initialPeriodMonths, tariffs]);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const applyDomainForm = (cfg: any) => {
    if (!cfg) return;
    setMerchantLogin(cfg.merchantLogin || cfg.domain || '');
    setResultUrl(cfg.resultUrl || '');
    setSuccessUrl(cfg.successUrl || '');
    setFailUrl(cfg.failUrl || '');
    setIsTestMode(Boolean(cfg.isTest));
    setPass1(cfg.pass1Set ? '********' : '');
    setPass2(cfg.pass2Set ? '********' : '');
  };

  const fetchConfig = async (domainOverride?: string) => {
    try {
      const hostParam = domainOverride || (typeof window !== 'undefined' ? window.location.hostname : '');
      const res = await fetch(`/api/payments/robokassa/config?domain=${encodeURIComponent(hostParam)}`);
      const data = await res.json();
      if (data.success) {
        if (data.detectedDomain) {
          setDetectedDomain(data.detectedDomain);
          if (!domainOverride && (data.detectedDomain === 'iismm.online' || data.detectedDomain === 'iismm.ru')) {
            setSelectedConfigDomain(data.detectedDomain);
          }
        }
        if (Array.isArray(data.configs)) {
          setAllConfigs(data.configs);
          const targetDom = domainOverride || data.detectedDomain || 'iismm.online';
          const matched = data.configs.find((c: any) => c.domain === targetDom) || data.config;
          applyDomainForm(matched);
        } else if (data.config) {
          applyDomainForm(data.config);
        }
      }
    } catch (err) {
      console.error('Error fetching Robokassa config:', err);
    }
  };

  const handleDomainSelectChange = (dom: 'iismm.online' | 'iismm.ru') => {
    setSelectedConfigDomain(dom);
    setSettingsMsg('');
    const found = allConfigs.find((c: any) => c.domain === dom);
    if (found) {
      applyDomainForm(found);
    } else {
      fetchConfig(dom);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    setSettingsMsg('');
    try {
      const res = await fetch('/api/payments/robokassa/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: selectedConfigDomain,
          merchantLogin,
          pass1,
          pass2,
          resultUrl,
          successUrl,
          failUrl,
          isTest: isTestMode
        })
      });
      const data = await res.json();
      if (data.success) {
        setSettingsMsg(`Настройки магазина ${selectedConfigDomain} сохранены в таблице system_configs.`);
        await fetchConfig(selectedConfigDomain);
      } else {
        setSettingsMsg(data.error || 'Ошибка при сохранении настроек');
      }
    } catch {
      setSettingsMsg('Ошибка подключения к серверу');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleDirectPay = async () => {
    if (!customAmount || customAmount < 10) {
      setPaymentMsg('Минимальная сумма оплаты составляет 10 ₽.');
      return;
    }
    setPaymentLoading(true);
    setPaymentMsg('');
    try {
      await redirectToRobokassaPayment({
        amountRub: customAmount,
        userId: String(user.id || user.telegramId || '16926299042'),
        email: user.email || undefined,
        tariffName: paymentMode === 'tariff' ? selectedPlan : '',
        periodMonths: paymentMode === 'tariff' ? periodMonths : 1,
        paymentType: paymentMode,
        recurring: paymentMode === 'tariff' && periodMonths === 1 && isRecurring,
        recurringConsentAccepted: paymentMode === 'tariff' && periodMonths === 1 && isRecurring,
        consentText: RECURRING_CONSENT_LABEL
      });
    } catch (err: any) {
      setPaymentMsg(err.message || 'Ошибка перенаправления в платежный шлюз Робокассы');
      setPaymentLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gradient-to-br from-sky-200/45 via-pink-200/45 to-orange-200/45 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-xl rounded-3xl p-5 sm:p-6 max-w-lg w-full border-2 border-pink-300 shadow-2xl space-y-4 text-left max-h-[92vh] overflow-y-auto my-auto"
        >
          {/* Header */}
          <div className="flex justify-between items-center gap-3 border-b border-pink-300/80 pb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2.5 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 rounded-2xl text-white shrink-0 shadow-xs">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-[16px] bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent leading-snug">
                  Прямая оплата в Робокассе
                </h3>
                <p className="text-[14px] text-slate-700 font-medium truncate">
                  Магазин домена: {detectedDomain}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] flex items-center justify-center cursor-pointer shrink-0 shadow-xs"
            >
              ✕
            </button>
          </div>

          {/* Mobile-safe Tab Switcher (only show settings tab for admins) */}
          {isAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 rounded-2xl border border-pink-300 bg-gradient-to-r from-sky-100/70 via-pink-100/70 via-orange-100/70 via-pink-100/70 to-sky-100/70">
              <button
                type="button"
                onClick={() => setActiveTab('pay')}
                className={`py-2 px-3 rounded-xl text-[14px] font-bold transition-all cursor-pointer ${
                  activeTab === 'pay'
                    ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-xs'
                    : 'text-slate-800 hover:opacity-90'
                }`}
              >
                Оплата тарифа и ИИрок
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`py-2 px-3 rounded-xl text-[14px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'settings'
                    ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-xs'
                    : 'text-slate-800 hover:opacity-90'
                }`}
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span>Магазины в БД (2 домена)</span>
              </button>
            </div>
          )}

          {/* TAB 1: DIRECT PAYMENT */}
          {activeTab === 'pay' && (
            <div className="space-y-4 text-[14px]">
              {/* Mode selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('tariff');
                    setCustomAmount(getTariffMonthlyRub(selectedPlan));
                  }}
                  className={`py-2.5 px-3 rounded-2xl text-[14px] font-bold border transition-all cursor-pointer ${
                    paymentMode === 'tariff'
                      ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-pink-400 shadow-xs'
                      : 'bg-gradient-to-r from-sky-100/70 via-pink-100/70 via-orange-100/70 via-pink-100/70 to-sky-100/70 text-slate-900 border-pink-300'
                  }`}
                >
                  Подписка на тариф (НДС 5%)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('topup')}
                  className={`py-2.5 px-3 rounded-2xl text-[14px] font-bold border transition-all cursor-pointer ${
                    paymentMode === 'topup'
                      ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-pink-400 shadow-xs'
                      : 'bg-gradient-to-r from-sky-100/70 via-pink-100/70 via-orange-100/70 via-pink-100/70 to-sky-100/70 text-slate-900 border-pink-300'
                  }`}
                >
                  Пополнение ИИрок (без НДС)
                </button>
              </div>

              <div className="p-4 rounded-2xl border border-pink-300 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-3">
                {paymentMode === 'tariff' ? (
                  <>
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <span className="font-bold text-slate-800">Выбранный тариф:</span>
                      <div className="flex gap-2">
                        {(['Разгон', 'Отрыв'] as const).map((plan) => (
                          <button
                            key={plan}
                            type="button"
                            onClick={() => {
                              setSelectedPlan(plan);
                              setCustomAmount(getTariffMonthlyRub(plan));
                            }}
                            className={`px-3 py-1 rounded-xl text-[14px] font-bold border cursor-pointer ${
                              selectedPlan === plan
                                ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-pink-400'
                                : 'bg-white/75 text-slate-900 border-pink-300'
                            }`}
                          >
                            {plan}
                          </button>
                        ))}
                      </div>
                    </div>

                    {periodMonths === 1 && (
                      <div className="space-y-2 pt-1">
                        <div className="text-[14px] text-slate-800 font-medium leading-snug">
                          Периодичность при автопродлении: <strong>{customAmount.toLocaleString('ru-RU')} ₽ каждые 30 календарных дней</strong> (без скрытых платежей, отмена в 1 клик в разделе «Тарифы»). Прием рекуррентных оплат по иностранной карте не доступен.
                        </div>
                        <label className="flex items-start gap-2.5 p-3 rounded-xl border border-pink-400 bg-gradient-to-r from-sky-50/80 via-pink-50/80 to-orange-50/80 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isRecurring}
                            onChange={(e) => setIsRecurring(e.target.checked)}
                            className="mt-1 w-4 h-4 accent-pink-600 rounded cursor-pointer shrink-0"
                          />
                          <span className="text-[14px] text-slate-900 font-bold leading-snug">
                            Я согласен на автоматические списания согласно{' '}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setLegalDocModal('oferta');
                              }}
                              className="text-pink-700 underline cursor-pointer"
                            >
                              условиям оферты
                            </button>
                          </span>
                        </label>
                      </div>
                    )}

                    <div className="pt-2 border-t border-pink-200/80 text-[14px] text-slate-800 space-y-1">
                      <div>
                        Позиция чека 54-фз:{' '}
                        <strong>
                          {periodMonths === 1
                            ? `Ежемесячная подписка на тариф «${selectedPlan}» сервиса ИИSMM`
                            : `Подписка на тариф «${selectedPlan}» сервиса ИИSMM`}
                        </strong>
                      </div>
                      <div>Налогообложение: налог 5% (ООО «РентРоп», без скрытых комиссий)</div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2.5">
                    <label className="text-[14px] font-bold text-slate-800 block">
                      Сумма пополнения ИИрок (1 ₽ = {pricing.topup.iirkyPerRub} {formatIirkyWord(pricing.topup.iirkyPerRub)}):
                    </label>
                    {Array.isArray(pricing.topup.topupPresetsRub) && pricing.topup.topupPresetsRub.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {pricing.topup.topupPresetsRub.map((presetRub) => (
                          <button
                            key={presetRub}
                            type="button"
                            onClick={() => setCustomAmount(presetRub)}
                            className={`px-2.5 py-1 rounded-xl text-[14px] font-mono font-bold border cursor-pointer ${
                              customAmount === presetRub
                                ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-pink-400'
                                : 'bg-white/80 text-slate-800 border-pink-300'
                            }`}
                          >
                            {presetRub.toLocaleString('ru-RU')} ₽
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="number"
                        min={10}
                        value={customAmount}
                        onChange={(e) => setCustomAmount(Math.max(10, Number(e.target.value)))}
                        className="flex-1 bg-white/85 border border-pink-300 px-3.5 py-2.5 rounded-xl font-mono text-[15px] font-extrabold text-slate-900 focus:ring-2 focus:ring-pink-400 focus:outline-none"
                      />
                      <div className="px-3.5 py-2.5 rounded-xl border border-pink-300 bg-white/75 text-pink-700 font-mono text-[14px] font-extrabold flex items-center justify-center shrink-0">
                        = {computeTopupIirkyAmount(customAmount, pricing).toLocaleString('ru-RU')} ИИрок
                      </div>
                    </div>
                    <p className="text-[14px] text-slate-800">
                      Позиция чека 54-ФЗ: <strong>Виртуальные единицы ИИрки</strong> ({computeTopupIirkyAmount(customAmount, pricing).toLocaleString('ru-RU')} шт., без НДС).
                    </p>
                  </div>
                )}
              </div>

              {paymentMsg && (
                <div className="p-3 rounded-2xl border border-pink-300 bg-gradient-to-r from-sky-100/80 via-pink-100/80 to-orange-100/80 text-slate-900 text-[14px] font-semibold">
                  {paymentMsg}
                </div>
              )}

              {/* All 4 Legal Documents */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLegalDocModal('oferta')}
                  className="py-2.5 px-3 rounded-2xl text-white text-[14px] font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer text-center"
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span>Публичная оферта</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLegalDocModal('privacy')}
                  className="py-2.5 px-3 rounded-2xl text-white text-[14px] font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer text-center"
                >
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Политика конфиденциальности</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLegalDocModal('agreement')}
                  className="py-2.5 px-3 rounded-2xl text-white text-[14px] font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer text-center"
                >
                  <Scale className="w-4 h-4 shrink-0" />
                  <span>Пользовательское соглашение</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLegalDocModal('consent')}
                  className="py-2.5 px-3 rounded-2xl text-white text-[14px] font-bold bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer text-center"
                >
                  <FileCheck2 className="w-4 h-4 shrink-0" />
                  <span>Согласие на обработку данных</span>
                </button>
              </div>

              {/* Direct Robokassa Redirect Action */}
              <button
                type="button"
                onClick={handleDirectPay}
                disabled={paymentLoading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white font-extrabold text-[15px] rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {paymentLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                    <span>Перенаправление в Робокассу...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 shrink-0" />
                    <span>Перейти к оплате {customAmount.toLocaleString('ru-RU')} ₽ в Робокассе</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: ADMIN SETTINGS FOR 2 ROBOKASSA MERCHANTS IN system_configs */}
          {activeTab === 'settings' && isAdmin && (
            <form onSubmit={handleSaveSettings} className="space-y-3.5 text-[14px] font-semibold">
              <div className="p-3.5 rounded-2xl border border-pink-300 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 text-slate-900 space-y-2">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-pink-600 shrink-0" />
                  <span>Таблица system_configs (2 отдельных кабинета Робокассы)</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {(['iismm.online', 'iismm.ru'] as const).map((dom) => (
                    <button
                      key={dom}
                      type="button"
                      onClick={() => handleDomainSelectChange(dom)}
                      className={`py-2 px-3 rounded-xl text-[14px] font-bold border cursor-pointer ${
                        selectedConfigDomain === dom
                          ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-pink-400'
                          : 'bg-white/80 text-slate-900 border-pink-300'
                      }`}
                    >
                      Магазин {dom}
                    </button>
                  ))}
                </div>
              </div>

              {settingsMsg && (
                <div className="p-3 rounded-2xl border border-pink-300 bg-white/85 text-slate-900 text-[14px] font-semibold">
                  {settingsMsg}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[14px] text-slate-800 font-bold block">Идентификатор магазина (MerchantLogin)</label>
                <input
                  type="text"
                  value={merchantLogin}
                  onChange={(e) => setMerchantLogin(e.target.value)}
                  className="w-full bg-white/85 border border-pink-300 p-2.5 rounded-xl font-mono text-[14px] text-slate-900 focus:ring-2 focus:ring-pink-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[14px] text-slate-800 font-bold block">Пароль #1 (Pass1)</label>
                  <input
                    type="password"
                    value={pass1}
                    onChange={(e) => setPass1(e.target.value)}
                    className="w-full bg-white/85 border border-pink-300 p-2.5 rounded-xl font-mono text-[14px] text-slate-900 focus:ring-2 focus:ring-pink-400 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[14px] text-slate-800 font-bold block">Пароль #2 (Pass2)</label>
                  <input
                    type="password"
                    value={pass2}
                    onChange={(e) => setPass2(e.target.value)}
                    className="w-full bg-white/85 border border-pink-300 p-2.5 rounded-xl font-mono text-[14px] text-slate-900 focus:ring-2 focus:ring-pink-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[14px] text-slate-800 font-bold block">Result URL (POST)</label>
                <input
                  type="text"
                  value={resultUrl}
                  onChange={(e) => setResultUrl(e.target.value)}
                  className="w-full bg-white/85 border border-pink-300 p-2.5 rounded-xl font-mono text-[14px] text-slate-900 focus:ring-2 focus:ring-pink-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-robokassa-test-mode"
                  checked={isTestMode}
                  onChange={(e) => setIsTestMode(e.target.checked)}
                  className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
                />
                <label htmlFor="chk-robokassa-test-mode" className="text-[14px] text-slate-800 font-bold cursor-pointer select-none">
                  Тестовый режим Робокассы (по умолчанию выключен — боевой режим)
                </label>
              </div>

              <button
                type="submit"
                disabled={settingsLoading}
                className="w-full py-3 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white font-extrabold text-[14px] rounded-2xl shadow-md cursor-pointer disabled:opacity-50"
              >
                {settingsLoading ? 'Сохранение в базу данных...' : `Сохранить настройки ${selectedConfigDomain} в БД`}
              </button>
            </form>
          )}
        </motion.div>

        {/* Nested Legal Document Viewer Modal */}
        {legalDocModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-gradient-to-br from-sky-200/50 via-pink-200/50 to-orange-200/50 backdrop-blur-md">
            <div className="bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xl rounded-3xl p-5 sm:p-6 max-w-3xl w-full border-2 border-pink-300 shadow-2xl space-y-4 text-left max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center gap-3 border-b border-pink-300 pb-3">
                <h4 className="font-extrabold text-[16px] bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent">
                  Правовые документы сервиса ИИSMM
                </h4>
                <button
                  type="button"
                  onClick={() => setLegalDocModal(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] cursor-pointer"
                >
                  Закрыть
                </button>
              </div>
              <div className="max-h-[68vh] overflow-y-auto pr-1">
                <OfertaModalContent initialSection={legalDocModal} />
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
