import { useState, useEffect, useCallback } from 'react';
import {
  DEFAULT_PRICING_CONFIG,
  PricingConfig,
  sanitizePricingConfig
} from '../shared/pricingConfig';

const PRICING_EVENT = 'iismm-pricing-updated';

let sharedPricingCache: PricingConfig = DEFAULT_PRICING_CONFIG;
let sharedTariffsCache: any[] = [];
let hasFetchedInitial = false;

export function notifyPricingConfigUpdated(nextPricing?: PricingConfig, nextTariffs?: any[]): void {
  if (nextPricing) {
    sharedPricingCache = sanitizePricingConfig(nextPricing);
  }
  if (Array.isArray(nextTariffs)) {
    sharedTariffsCache = nextTariffs;
  }
  hasFetchedInitial = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PRICING_EVENT, { detail: { pricing: sharedPricingCache } }));
  }
}

export function usePricingConfig(userId?: string) {
  const [pricing, setPricing] = useState<PricingConfig>(sharedPricingCache);
  const [tariffs, setTariffs] = useState<any[]>(sharedTariffsCache);
  const [isLoading, setIsLoading] = useState<boolean>(!hasFetchedInitial);

  const refreshPricing = useCallback(async () => {
    try {
      const url = userId ? `/api/pricing?userId=${encodeURIComponent(userId)}` : '/api/pricing';
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success && data.pricing) {
        const clean = sanitizePricingConfig(data.pricing);
        sharedPricingCache = clean;
        setPricing(clean);
      }
      if (Array.isArray(data?.tariffs)) {
        sharedTariffsCache = data.tariffs;
        setTariffs(data.tariffs);
      }
      hasFetchedInitial = true;
    } catch {
      // Keep cached/default values silently on network glitch
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refreshPricing();

    const handleUpdate = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ pricing?: PricingConfig }>;
      if (customEvt?.detail?.pricing) {
        setPricing(sanitizePricingConfig(customEvt.detail.pricing));
      } else {
        setPricing(sharedPricingCache);
      }
      setTariffs(sharedTariffsCache);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(PRICING_EVENT, handleUpdate);
      return () => window.removeEventListener(PRICING_EVENT, handleUpdate);
    }
    return undefined;
  }, [refreshPricing]);

  return {
    pricing,
    tariffs,
    isLoading,
    refreshPricing
  };
}
