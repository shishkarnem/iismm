import React from 'react';
import { Crown, Lock, Sparkles, ArrowRight, X } from 'lucide-react';
import { CanonicalTariffName, getNormalizedTariffName } from '../../utils/tariff/tariffUtils';

export interface TariffGateBannerProps {
  requiredTariff: CanonicalTariffName;
  featureTitle: string;
  featureDescription: string;
  currentTariff?: string | null;
  highlights?: string[];
  onUpgradeClick?: () => void;
  compact?: boolean;
}

export function navigateToTariffsPage(onCustomUpgrade?: () => void) {
  if (onCustomUpgrade) {
    onCustomUpgrade();
    return;
  }
  window.history.pushState({}, '', '/tarif');
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export const TariffGateBanner: React.FC<TariffGateBannerProps> = ({
  requiredTariff,
  featureTitle,
  featureDescription,
  currentTariff,
  highlights = [],
  onUpgradeClick,
  compact = false,
}) => {
  const normalizedCurrent = getNormalizedTariffName(currentTariff);

  return (
    <div className="w-full p-[2px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-lg">
      <div
        className={`w-full rounded-[22px] bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-md ${
          compact ? 'p-4 sm:p-5' : 'p-5 sm:p-8'
        } space-y-4`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 flex items-center justify-center text-white shadow-md shrink-0">
              <Crown className="w-6 h-6" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-pink-700">
                <Lock className="w-4 h-4 shrink-0 text-pink-600" />
                <span>Доступно с тарифа «{requiredTariff}»</span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-700">Ваш тариф: «{normalizedCurrent}»</span>
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent break-words">
                {featureTitle}
              </h3>
              <p className="text-[14px] sm:text-[15px] text-slate-800 leading-relaxed break-words">
                {featureDescription}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigateToTariffsPage(onUpgradeClick)}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white font-bold text-[14px] shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Подключить тариф «{requiredTariff}»</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>

        {highlights.length > 0 && (
          <div className="pt-3 border-t border-pink-300/70 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {highlights.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-[14px] text-slate-800 font-medium break-words"
              >
                <Sparkles className="w-4 h-4 text-pink-600 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export interface TariffGateModalProps extends TariffGateBannerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TariffGateModal: React.FC<TariffGateModalProps> = ({
  isOpen,
  onClose,
  requiredTariff,
  featureTitle,
  featureDescription,
  currentTariff,
  highlights = [],
  onUpgradeClick,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-gradient-to-br from-sky-200/55 via-pink-200/55 to-orange-200/55 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg p-[2px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full rounded-[22px] bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xl p-5 sm:p-7 space-y-5 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white flex items-center justify-center shadow-sm hover:opacity-90 cursor-pointer"
            title="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 pr-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 flex items-center justify-center text-white shadow-md shrink-0">
              <Crown className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-pink-700">
                Требуется тариф «{requiredTariff}»
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent break-words">
                {featureTitle}
              </h3>
            </div>
          </div>

          <p className="text-[14px] sm:text-[15px] text-slate-800 leading-relaxed break-words">
            {featureDescription}
          </p>

          {highlights.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-pink-300/70">
              {highlights.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-[14px] text-slate-800 font-medium break-words">
                  <Sparkles className="w-4 h-4 text-pink-600 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-pink-300 text-slate-800 font-semibold text-[14px] hover:opacity-90 cursor-pointer"
            >
              Позже
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigateToTariffsPage(onUpgradeClick);
              }}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white font-bold text-[14px] shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Выбрать тариф «{requiredTariff}»</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
