import React, { useEffect, useState } from 'react';
import { Coins, RefreshCw, RotateCcw, Save, ShieldCheck, Loader2 } from 'lucide-react';
import {
  DEFAULT_PRICING_CONFIG,
  PricingConfig,
  sanitizePricingConfig
} from '../../../shared/pricingConfig';
import { notifyPricingConfigUpdated } from '../../../hooks/usePricingConfig';
import { NeurosphereLoader } from '../../loaders/NeurosphereLoader';
import { AdminPricingAiSections } from './AdminPricingAiSections';
import { AdminPricingTariffsSection, AdminTariffItem } from './AdminPricingTariffsSection';

interface AdminPricingPanelProps {
  triggerToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const AdminPricingPanel: React.FC<AdminPricingPanelProps> = ({ triggerToast }) => {
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG);
  const [tariffs, setTariffs] = useState<AdminTariffItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    if (triggerToast) {
      triggerToast(type, text);
    }
  };

  const fetchAdminPricing = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/pricing');
      const data = await res.json();
      if (data?.success) {
        if (data.pricing) {
          setPricing(sanitizePricingConfig(data.pricing));
        }
        if (Array.isArray(data.tariffs)) {
          setTariffs(data.tariffs);
        }
      }
    } catch {
      showNotice('error', 'Не удалось загрузить настройки цен из базы данных.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminPricing();
  }, []);

  const handleSaveAllPricing = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricing })
      });
      const data = await res.json();
      if (data?.success && data.pricing) {
        const clean = sanitizePricingConfig(data.pricing);
        setPricing(clean);
        notifyPricingConfigUpdated(clean, tariffs);
        showNotice(
          'success',
          data.message || 'Новые цены в ИИрках и курс сохранены и применены ко всем расчётам.'
        );
      } else {
        showNotice('error', data?.error || 'Ошибка сохранения цен.');
      }
    } catch {
      showNotice('error', 'Ошибка сети при сохранении цен.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setPricing(DEFAULT_PRICING_CONFIG);
    showNotice('success', 'Значения сброшены к базовым в форме. Нажмите «Сохранить все цены», чтобы применить.');
  };

  const handleSaveTariff = async (tariff: AdminTariffItem) => {
    try {
      const res = await fetch(`/api/admin/tariffs/${encodeURIComponent(tariff.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tariff)
      });
      const data = await res.json();
      if (data?.success && data.tariff) {
        setTariffs((prev) => {
          const next = prev.map((item) => (item.id === data.tariff.id ? data.tariff : item));
          notifyPricingConfigUpdated(pricing, next);
          return next;
        });
        showNotice('success', `Тариф «${data.tariff.name}» обновлен в базе данных.`);
      } else {
        showNotice('error', data?.error || 'Ошибка обновления тарифа.');
      }
    } catch {
      showNotice('error', 'Ошибка сети при сохранении тарифа.');
    }
  };

  const handleCreateTariff = async (payload: Partial<AdminTariffItem>) => {
    try {
      const res = await fetch('/api/admin/tariffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data?.success && data.tariff) {
        await fetchAdminPricing();
        notifyPricingConfigUpdated(pricing);
        showNotice('success', `Новый тариф «${data.tariff.name}» добавлен.`);
      } else {
        showNotice('error', data?.error || 'Ошибка создания тарифа.');
      }
    } catch {
      showNotice('error', 'Ошибка сети при создании тарифа.');
    }
  };

  if (isLoading) {
    return <NeurosphereLoader variant="inline" label="Загрузка прайс-листа и тарифов из базы..." />;
  }

  return (
    <div className="space-y-5 text-left">
      {/* Header & Controls */}
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm">
        <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md p-4 sm:p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-xs shrink-0">
                <Coins size={22} />
              </div>
              <div className="space-y-1">
                <h2 className="text-[18px] sm:text-[20px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                  Управление ценами, курсом и стоимостью в ИИрках
                </h2>
                <p className="text-[14px] text-slate-800 font-medium leading-relaxed">
                  Все цены сохраняются в PostgreSQL и мгновенно обновляются на сайте, в генераторах, сценариях и кассе Робокассы.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={fetchAdminPricing}
                className="px-3.5 py-2.5 rounded-xl bg-white/85 border border-pink-300 text-slate-800 font-bold text-[14px] flex items-center gap-1.5 cursor-pointer hover:bg-white"
              >
                <RefreshCw size={16} />
                <span>Обновить</span>
              </button>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-3.5 py-2.5 rounded-xl bg-white/85 border border-pink-300 text-slate-800 font-bold text-[14px] flex items-center gap-1.5 cursor-pointer hover:bg-white"
              >
                <RotateCcw size={16} />
                <span>По умолчанию</span>
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveAllPricing}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>{isSaving ? 'Сохранение...' : 'Сохранить все цены'}</span>
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 to-orange-50/85 border border-pink-300/80 flex items-start gap-2.5">
            <ShieldCheck size={18} className="text-pink-600 shrink-0 mt-0.5" />
            <div className="text-[14px] text-slate-800 font-medium leading-snug">
              <strong>Защита истории продаж:</strong> старые чеки Робокассы, прошлые транзакции пользователей и уже начисленные балансы ИИрок остаются без изменений — новая стоимость применяется только к будущим операциям.
            </div>
          </div>

          {feedback && (
            <div
              className={`p-3.5 rounded-2xl border text-[14px] font-bold ${
                feedback.type === 'error'
                  ? 'bg-rose-50/90 border-rose-300 text-rose-800'
                  : 'bg-sky-50/90 border-sky-300 text-sky-900'
              }`}
            >
              {feedback.text}
            </div>
          )}
        </div>
      </div>

      {/* AI Services, Scenarios, Promo, Topup */}
      <AdminPricingAiSections pricing={pricing} onChange={setPricing} />

      {/* Bottom Save Bar */}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSaveAllPricing}
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[15px] shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
          <span>{isSaving ? 'Сохранение прайс-листа...' : 'Сохранить все цены в базу данных'}</span>
        </button>
      </div>

      {/* Tariffs Table Editor */}
      <AdminPricingTariffsSection
        tariffs={tariffs}
        onSaveTariff={handleSaveTariff}
        onCreateTariff={handleCreateTariff}
      />
    </div>
  );
};
