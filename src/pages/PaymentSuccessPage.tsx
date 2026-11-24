import React, { useEffect, useState } from 'react';
import { CheckCircle2, Sparkles, ArrowRight, FileText, Scale } from 'lucide-react';
import { useAppVersion } from '../components/footer/useAppVersion';

interface PaymentSuccessPageProps {
  onNavigate?: (path: string) => void;
}

export default function PaymentSuccessPage({ onNavigate }: PaymentSuccessPageProps) {
  const appVersion = useAppVersion();
  const [details, setDetails] = useState<{
    invId?: string;
    outSum?: string;
    domain?: string;
    tariffName?: string | null;
    iirkyQuantity?: number;
    verified?: boolean;
  }>({});

  useEffect(() => {
    try {
      const search = window.location.search;
      const urlParams = new URLSearchParams(search);
      const initialInv = urlParams.get('InvId') || urlParams.get('inv_id') || urlParams.get('orderId') || undefined;
      const initialSum = urlParams.get('OutSum') || urlParams.get('amount') || undefined;
      setDetails({ invId: initialInv, outSum: initialSum });

      if (search) {
        fetch(`/api/payments/robokassa/verify-success${search}`)
          .then((r) => r.json())
          .then((data) => {
            if (data && data.success) {
              setDetails((prev) => ({
                ...prev,
                invId: data.invId || prev.invId,
                outSum: data.outSum || prev.outSum,
                domain: data.domain,
                tariffName: data.tariffName,
                iirkyQuantity: data.iirkyQuantity,
                verified: data.verified
              }));
            }
          })
          .catch(() => null);
      }
    } catch {}
  }, []);

  const handleNavigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new Event('popstate'));
    }
  };

  return (
    <div className="min-h-screen py-10 px-3 sm:px-6 lg:px-8 text-slate-900 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-sm flex items-center justify-center">
      <div className="max-w-xl w-full space-y-6 text-center">
        <div className="bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md rounded-3xl p-6 sm:p-10 border-2 border-pink-300 shadow-xl space-y-6 text-left">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 flex items-center justify-center shadow-md">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div className="text-[14px] font-bold text-pink-700">
              Платежный шлюз Робокасса · Успешная оплата
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 to-orange-500 bg-clip-text text-transparent tracking-tight">
              Оплата успешно завершена!
            </h1>
            <p className="text-[14px] sm:text-base text-slate-800 font-medium leading-relaxed">
              Ваш платеж подтвержден платежной системой Робокасса. {details.tariffName ? `Подписка на тариф «${details.tariffName}» активирована.` : 'Виртуальные единицы ИИрки зачислены на ваш баланс.'}
            </p>
          </div>

          <div className="p-4 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 rounded-2xl border border-pink-300 space-y-2.5 text-[14px]">
            {details.outSum && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-700 font-medium">Сумма оплаты:</span>
                <span className="font-mono font-bold text-slate-900 text-base">{details.outSum} ₽</span>
              </div>
            )}
            {details.invId && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-700 font-medium">Номер счета:</span>
                <span className="font-mono font-bold text-slate-900">#{details.invId}</span>
              </div>
            )}
            {details.domain && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-700 font-medium">Магазин:</span>
                <span className="font-mono font-bold text-slate-900">{details.domain}</span>
              </div>
            )}
            <div className="flex justify-between items-center gap-2 border-t border-pink-300/60 pt-2">
              <span className="text-slate-700 font-medium">Статус:</span>
              <span className="font-bold text-pink-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-pink-600 shrink-0" />
                <span>Исполнено</span>
              </span>
            </div>
            <div className="flex justify-between items-center gap-2 border-t border-pink-300/60 pt-2">
              <span className="text-slate-700 font-medium">Кассовый чек 54-ФЗ:</span>
              <span className="text-[14px] text-slate-900 font-semibold text-right">Направлен на ваш e-mail</span>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={() => handleNavigate('/tarif')}
              className="w-full py-3.5 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white font-bold text-[14px] rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <span>Перейти в личный кабинет к тарифам</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleNavigate('/oferta')}
                className="py-2.5 px-3 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white font-bold text-[14px] rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>Договор оферты</span>
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('/oferta?doc=agreement')}
                className="py-2.5 px-3 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white font-bold text-[14px] rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Scale className="w-4 h-4 shrink-0" />
                <span>Пользовательское соглашение</span>
              </button>
            </div>
          </div>
        </div>

        <div className="text-[14px] text-slate-800 font-medium">
          © 2026 ИИSMM {appVersion}. · ООО «РентРоп» (ИНН 7726477438)
        </div>
      </div>
    </div>
  );
}
