export const RECURRING_CONSENT_LABEL =
  'Я согласен на автоматические списания согласно условиям оферты';

export interface DirectRobokassaRedirectParams {
  amountRub: number;
  userId?: string;
  email?: string;
  tariffName?: string;
  periodMonths?: number;
  paymentType?: 'tariff' | 'topup';
  recurring?: boolean;
  recurringConsentAccepted?: boolean;
  consentText?: string;
}

export interface DirectRobokassaRedirectResult {
  paymentUrl: string;
  invId: number;
  domain: string;
  merchantLogin: string;
}

export async function redirectToRobokassaPayment(
  params: DirectRobokassaRedirectParams
): Promise<DirectRobokassaRedirectResult> {
  const currentHost =
    typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : '';

  const isRecurring = Boolean(params.recurring);
  const consentAccepted = Boolean(params.recurringConsentAccepted ?? params.recurring);

  if (isRecurring && !consentAccepted) {
    throw new Error(
      'Для подключения автоматических списаний отметьте согласие с условиями публичной оферты.'
    );
  }

  const ofertaUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/oferta`
      : 'https://iismm.online/oferta';

  const res = await fetch('/api/payments/robokassa/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: currentHost,
      amount: params.amountRub,
      amountRub: params.amountRub,
      tariffName: params.tariffName || '',
      planName: params.tariffName || '',
      periodMonths: params.periodMonths || 1,
      paymentType: params.paymentType,
      userId: params.userId || '16926299042',
      email: params.email || undefined,
      recurring: isRecurring,
      recurringConsentAccepted: isRecurring ? consentAccepted : false,
      consentText: params.consentText || RECURRING_CONSENT_LABEL,
      ofertaUrl
    })
  });

  const data = await res.json();
  if (!res.ok || !data.success || !data.paymentUrl) {
    throw new Error(data.error || 'Не удалось сформировать прямую ссылку на оплату в Робокассе');
  }

  // Navigate directly to Robokassa payment terminal (safe for top window & iframe without window.open)
  if (typeof window !== 'undefined') {
    try {
      if (window.top && window.top !== window) {
        window.top.location.href = data.paymentUrl;
      } else {
        window.location.href = data.paymentUrl;
      }
    } catch {
      window.location.href = data.paymentUrl;
    }
  }

  return {
    paymentUrl: data.paymentUrl,
    invId: data.invId,
    domain: data.domain,
    merchantLogin: data.merchantLogin
  };
}
