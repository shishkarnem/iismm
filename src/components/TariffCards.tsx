import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, Sparkles, Check, X, ShieldCheck } from 'lucide-react';
import { TariffRecord } from '../types';
import { usePricingConfig } from '../hooks/usePricingConfig';
import { formatIirkyWord } from '../shared/pricingConfig';

export interface TariffPlan {
  id?: string;
  name: string;
  price: string;
  sub: string;
  continuation?: string;
  amountRub: number;
  monthlyIirky?: number;
  features: { title: string; desc: string }[];
}

export function formatExpiryDate(val: string | number | Date | undefined | null): string {
  if (!val) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.toLowerCase() === 'invalid date' || trimmed.toLowerCase() === 'бессрочно') {
      return '';
    }
    // If already in DD.MM.YYYY format
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
      return trimmed;
    }
    // Try standard date parsing
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    // Fallback: check if DD/MM/YYYY or DD-MM-YYYY
    const parts = trimmed.split(/[./-]/);
    if (parts.length === 3) {
      if (parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}`;
      }
    }
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  }
  return '';
}

export const DEFAULT_TARIFF_PLANS: TariffPlan[] = [
  {
    id: 'start',
    name: "Старт",
    price: "0 ИИрок",
    sub: "Старт без вложений",
    amountRub: 0,
    monthlyIirky: 300,
    features: [
      {
        title: "Безлимитно постов и каналов без ИИ",
        desc: "Полный безлимит по количеству каналов и постов при ручной публикации или автопланировании отложенных постов в календарь."
      },
      {
        title: "300 ИИрок каждый месяц бесплатно",
        desc: "Хватит на 190 рерайтов через ИИ или 30 постов с ИИ бесплатно (на каждый день для канала)!"
      },
      {
        title: "Умные ИИ-сценарии автопостинга 24/7",
        desc: "Автономные цепочки: регулярный выбор темы ➔ генерация текста с форматированием Markdown V2 и Rich➔ подбор обложки ➔ постановка в календарь."
      },
      {
        title: "Участие в папках и подборах",
        desc: "Автоматическое участие ваших Telegram-каналов в тематических папках и подборках взаимного пиара для роста подписчиков."
      },
      {
        title: "Докупка ИИрок в любой момент",
        desc: "Если вам требуются дополнительные нейро-тексты или генерации картинок, докупайте ИИрки в любом удобном объеме без смены тарифа."
      },
      {
        title: "Конструктор Markdown V2 & Rich",
        desc: "Визуальный редактор Telegram-постов со спойлерами, форматированием текста, ссылками и красивыми цветными кнопками."
      },
      {
        title: "Бесплатный генератор картинок с облаком",
        desc: "Генерация и бесплатное хранение фото, а также хранение любых файлов с сохранением оригинального качества."
      },
      {
        title: "Интерактивный календарь постов",
        desc: "Удобный планировщик публикаций с наглядной сеткой выходов на месяц и автоотправкой постов точно в срок."
      }
    ]
  },
  {
    id: 'razgon',
    name: "Разгон",
    price: "990 ИИрок / мес",
    sub: "Хватит на несколько каналов или несколько ежедневных постов",
    continuation: "Все возможности тарифа Старт, плюс:",
    amountRub: 990,
    monthlyIirky: 990,
    features: [
      {
        title: "990 ИИрок на баланс каждый месяц",
        desc: "Пакет 990 ИИрок в месяц (1 рубль = 1 ИИрка) — хватит на несколько каналов или несколько ежедневных ИИ-постов и нейро-обложек."
      },
      {
        title: "Настраиваемые стили",
        desc: "Генерация уникального контента в фирменном стиле вашего бренда."
      },
      {
        title: "Нейроплан",
        desc: "Генерация 15 постов наперед по указанной теме"
      },
      {
        title: "Память прошлых постов и серийность",
        desc: "Нейросеть помнит прошлые публикации, исключает дубли и предлагает логическое продолжение рубрик."
      },
      {
        title: "Значок радужного сердца в профиле",
        desc: "Выделенная иконка радужного сердечка над аватаром профиля для всех пользователей тарифов выше Старта."
      }
    ]
  },
  {
    id: 'otryv',
    name: "Отрыв",
    price: "4,900 ИИрок / мес",
    sub: "Хватит на десяток каналов",
    continuation: "Все возможности тарифа Разгон, плюс:",
    amountRub: 4900,
    monthlyIirky: 4900,
    features: [
      {
        title: "4,900 ИИрок на баланс каждый месяц",
        desc: "Мощный баланс 4,900 ИИрок в месяц (1 рубль = 1 ИИрка) — хватит на ведение десятка каналов с автопилотом, сценариями и иллюстрациями."
      },
      {
        title: "Генератор Сценариев ИИрка",
        desc: "Автоматическое составление сценариев для любых постов"
      },
      {
        title: "Мультиплеер (командный доступ)",
        desc: "Совместная работа нескольких SMM-специалистов и контент-мейкеров в одном рабочем кабинете."
      },
      {
        title: "Продвижение постов в соцсети ИИрки",
        desc: "Приоритетное размещение и вывод публикаций в топ Ленты социальной сети платформы."
      }
    ]
  },
  {
    id: 'cosmos',
    name: "Космос",
    price: "Индивидуально",
    sub: "Индивидуальная разработка под ключ",
    continuation: "Все возможности тарифа Отрыв, плюс:",
    amountRub: 0,
    monthlyIirky: 0,
    features: [
      {
        title: "Любой объем ИИрок под задачи",
        desc: "Персональный баланс ИИрок под масштабы вашего бизнеса с приоритетным выделенным GPU сервером."
      },
      {
        title: "Разработка брендбука и SMM-стратегии",
        desc: "Глубокая проработка позиционирования бренда, ИИ стиля и дизайна контента экспертами платформы."
      },
      {
        title: "Индивидуальный контент-план под ключ",
        desc: "Составление стратегии продвижения и материалов персональной командой редакторов."
      },
      {
        title: "Кастомная ИИ-разработка",
        desc: "Индивидуальное создание ИИ-агентов, парсеров, специализированных Telegram-ботов и ведение внешних систем."
      },
      {
        title: "Интеграции с любыми соцсетями",
        desc: "Специфические связки и автокросспостинг в любые внешние платформы и корпоративные CRM."
      }
    ]
  }
];

interface TariffCardsProps {
  onAction?: (planName: string, priceText: string, amountRub: number, actionType?: 'connect' | 'contact', periodMonths?: number, discountPercent?: number) => void;
  buttonText?: string;
  userTariff?: string;
  userTariffExpiresAt?: string | null;
  userId?: string;
}

export type TariffPeriodMonths = 1 | 3 | 6 | 12;

export const TARIFF_PERIODS: Array<{ months: TariffPeriodMonths; label: string; discount: number; tag?: string }> = [
  { months: 1, label: '1 месяц', discount: 0 },
  { months: 3, label: '3 месяца', discount: 10, tag: '-10%' },
  { months: 6, label: '6 месяцев', discount: 15, tag: '-15%' },
  { months: 12, label: '12 месяцев', discount: 20, tag: '-20%' },
];

export default function TariffCards({ onAction, buttonText = "Подключить", userTariff, userTariffExpiresAt, userId }: TariffCardsProps) {
  const { pricing } = usePricingConfig(userId);
  const [plans, setPlans] = useState<(TariffPlan & { discount3m?: number; discount6m?: number; discount12m?: number })[]>(DEFAULT_TARIFF_PLANS);
  const [selectedPeriod, setSelectedPeriod] = useState<TariffPeriodMonths>(1);
  const [selectedFeature, setSelectedFeature] = useState<{ title: string; desc: string; planName: string } | null>(null);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [currentFeatureLimit, setCurrentFeatureLimit] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadTariffs = useCallback(() => {
    const url = userId ? `/api/tariffs?userId=${encodeURIComponent(userId)}` : '/api/tariffs';
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.tariffs) && data.tariffs.length > 0) {
          const formatted = data.tariffs.map((t: any) => ({
            id: t.id,
            name: t.name,
            price: t.price_iirky || (t.price_rub > 0 ? `${Number(t.price_rub).toLocaleString('ru-RU')} ИИрок / мес` : '0 ИИрок'),
            sub: t.sub || '',
            continuation: t.continuation || (t.id === 'razgon' ? 'Все возможности тарифа Старт, плюс:' : t.id === 'otryv' ? 'Все возможности тарифа Разгон, плюс:' : t.id === 'cosmos' ? 'Все возможности тарифа Отрыв, плюс:' : undefined),
            amountRub: Number(t.price_rub) || 0,
            monthlyIirky: Number(t.monthly_iirky) || Number(t.price_rub) || 0,
            discount3m: t.discount_3m !== undefined ? Number(t.discount_3m) : 10,
            discount6m: t.discount_6m !== undefined ? Number(t.discount_6m) : 15,
            discount12m: t.discount_12m !== undefined ? Number(t.discount_12m) : 20,
            features: Array.isArray(t.features) ? t.features : typeof t.features === 'string' ? JSON.parse(t.features || '[]') : []
          }));
          if (formatted.length > 0) {
            setPlans(formatted);
          }
        }
      })
      .catch(e => console.warn('Использование базовых тарифов:', e));
  }, [userId]);

  // Load dynamic tariffs from PostgreSQL API and refresh when admin updates pricing/tariffs
  useEffect(() => {
    loadTariffs();
    if (typeof window !== 'undefined') {
      const handler = () => loadTariffs();
      window.addEventListener('iismm-pricing-updated', handler);
      return () => window.removeEventListener('iismm-pricing-updated', handler);
    }
    return undefined;
  }, [loadTariffs]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setHasStarted(true);
        observer.disconnect();
      }
    }, { threshold: 0.1 });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasStarted) return;

    let timer: NodeJS.Timeout;
    
    const step = () => {
      const currentCard = plans[activeCardIdx];
      if (!currentCard) return;

      if (currentFeatureLimit < currentCard.features.length) {
        setCurrentFeatureLimit(prev => prev + 1);
      } else {
        if (activeCardIdx < plans.length - 1) {
          setActiveCardIdx(prev => prev + 1);
          setCurrentFeatureLimit(0);
        }
      }
    };

    timer = setTimeout(step, 80);
    return () => clearTimeout(timer);
  }, [activeCardIdx, currentFeatureLimit, hasStarted, plans]);

  const cleanUserTariff = (userTariff || '').toLowerCase();

  const currentPeriodConfig = TARIFF_PERIODS.find(p => p.months === selectedPeriod) || TARIFF_PERIODS[0];

  const getPlanDiscount = (plan: TariffPlan & { discount3m?: number; discount6m?: number; discount12m?: number }) => {
    if (selectedPeriod === 3) return plan.discount3m ?? currentPeriodConfig.discount;
    if (selectedPeriod === 6) return plan.discount6m ?? currentPeriodConfig.discount;
    if (selectedPeriod === 12) return plan.discount12m ?? currentPeriodConfig.discount;
    return 0;
  };

  const calculatePlanPrice = (plan: TariffPlan & { discount3m?: number; discount6m?: number; discount12m?: number }) => {
    const planDiscount = getPlanDiscount(plan);
    if (plan.name.toLowerCase().includes('космос')) {
      return {
        displayPrice: 'Индивидуально',
        totalPrice: 0,
        perMonthPrice: 0,
        savings: 0,
        discountPercent: 0,
        subNote: 'По персональной заявке'
      };
    }

    if (plan.amountRub === 0) {
      return {
        displayPrice: '0 ИИрок',
        totalPrice: 0,
        perMonthPrice: 0,
        savings: 0,
        discountPercent: 0,
        subNote: 'Бессрочно'
      };
    }

    const baseMonthly = plan.amountRub;
    const totalWithoutDiscount = baseMonthly * selectedPeriod;
    const totalPrice = Math.round(totalWithoutDiscount * (1 - planDiscount / 100));
    const perMonthPrice = Math.round(totalPrice / selectedPeriod);
    const savings = totalWithoutDiscount - totalPrice;

    return {
      displayPrice: selectedPeriod === 1 
        ? `${totalPrice.toLocaleString('ru-RU')} ИИрок / мес` 
        : `${totalPrice.toLocaleString('ru-RU')} ИИрок`,
      totalPrice,
      perMonthPrice,
      savings,
      discountPercent: planDiscount,
      subNote: selectedPeriod === 1 
        ? 'Списание каждый месяц' 
        : `${perMonthPrice.toLocaleString('ru-RU')} ИИрок / мес (за ${selectedPeriod} мес.)`
    };
  };

  const referencePaidPlan = plans.find((p) => p.amountRub > 0);
  const dynamicPeriods = TARIFF_PERIODS.map((period) => {
    let disc = period.discount;
    if (referencePaidPlan) {
      if (period.months === 3 && referencePaidPlan.discount3m !== undefined) disc = referencePaidPlan.discount3m;
      if (period.months === 6 && referencePaidPlan.discount6m !== undefined) disc = referencePaidPlan.discount6m;
      if (period.months === 12 && referencePaidPlan.discount12m !== undefined) disc = referencePaidPlan.discount12m;
    }
    return {
      ...period,
      discount: disc,
      tag: disc > 0 ? `-${disc}%` : undefined
    };
  });

  return (
    <div ref={containerRef} className="space-y-6 w-full relative text-left">
      {/* Period selector with discounts */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-2xl mx-auto px-0 sm:px-2 w-full">
        <div className="p-1.5 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 border border-pink-300 shadow-sm grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-1.5 w-full">
          {dynamicPeriods.map((period) => {
            const isSelected = selectedPeriod === period.months;
            return (
              <button
                key={period.months}
                type="button"
                onClick={() => setSelectedPeriod(period.months)}
                className={`flex-1 min-w-0 py-2.5 px-3 rounded-xl font-bold text-[14px] transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 relative ${
                  isSelected
                    ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-md scale-[1.01]'
                    : 'bg-white/75 hover:bg-white/90 text-slate-800 border border-pink-200/80 shadow-2xs'
                }`}
              >
                <span>{period.label}</span>
                {period.tag && (
                  <span className={`px-1.5 py-0.5 rounded-lg text-[14px] font-extrabold ${
                    isSelected ? 'bg-white text-pink-600 shadow-2xs' : 'bg-pink-100 text-pink-700'
                  }`}>
                    {period.tag}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {pricing.topup.iirkyPerRub !== 1 && (
          <div className="text-[14px] font-bold text-slate-800 bg-white/75 border border-pink-200 px-3 py-1.5 rounded-xl shrink-0">
            Курс: 1 ₽ = {pricing.topup.iirkyPerRub} {formatIirkyWord(pricing.topup.iirkyPerRub)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 max-w-7xl w-full mx-auto items-stretch px-0 sm:px-4 min-h-[500px]">
        {plans.map((plan, idx) => {
          const isCardVisible = idx <= activeCardIdx;
          if (!isCardVisible) return null;

          const visibleFeaturesCount = idx < activeCardIdx ? plan.features.length : currentFeatureLimit;
          const planNameLower = plan.name.toLowerCase();
          const isCurrentPlanActive = 
            (planNameLower.includes('старт') && (cleanUserTariff === 'free' || cleanUserTariff === 'start' || cleanUserTariff === 'старт' || !cleanUserTariff)) ||
            (planNameLower.includes('разгон') && (cleanUserTariff === 'pro' || cleanUserTariff === 'razgon' || cleanUserTariff === 'разгон')) ||
            (planNameLower.includes('отрыв') && (cleanUserTariff === 'vip' || cleanUserTariff === 'otryv' || cleanUserTariff === 'отрыв')) ||
            (planNameLower.includes('космос') && (cleanUserTariff === 'cosmos' || cleanUserTariff === 'kosmos' || cleanUserTariff === 'космос'));

          const priceCalc = calculatePlanPrice(plan);

          return (
            <motion.div 
              key={plan.id || idx} 
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className={`bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md rounded-3xl p-3 sm:p-4 border flex flex-col justify-between space-y-2.5 relative transition-all duration-300 hover:scale-[1.01] shadow-md min-w-0 ${
                isCurrentPlanActive 
                  ? 'border-pink-500 ring-2 ring-pink-400/40' 
                  : 'border-pink-300'
              }`}
            >
              <div className="space-y-2 min-w-0">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-base sm:text-lg font-bold bg-gradient-to-r from-sky-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
                      {plan.name}
                    </h3>
                    {isCurrentPlanActive && (
                      <div className="flex flex-col items-end shrink-0">
                        <span className="px-2.5 py-0.5 bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white text-[14px] font-bold rounded-full shadow-xs">
                          Текущий
                        </span>
                        {formatExpiryDate(userTariffExpiresAt) ? (
                          <span className="text-[14px] font-bold text-pink-700 mt-0.5">
                            до {formatExpiryDate(userTariffExpiresAt)}
                          </span>
                        ) : (
                          planNameLower.includes('старт') && (
                            <span className="text-[14px] font-bold text-slate-700 mt-0.5">
                              Бессрочно
                            </span>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-sky-600 via-pink-600 to-orange-600 bg-clip-text text-transparent mt-0.5">
                    {priceCalc.displayPrice}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-[14px] text-slate-800 font-bold bg-white/70 px-2.5 py-0.5 rounded-lg border border-pink-200">
                      {priceCalc.subNote}
                    </span>
                    {priceCalc.savings > 0 && (
                      <span className="text-[14px] font-bold text-pink-700 bg-pink-100/80 px-2.5 py-0.5 rounded-lg border border-pink-300">
                        Экономия {priceCalc.savings.toLocaleString('ru-RU')} ИИрок
                      </span>
                    )}
                  </div>

                  <p className="text-[14px] text-slate-800 font-medium mt-1.5 leading-snug break-words">{plan.sub}</p>
                </div>

                {plan.continuation && (
                  <div className="text-[14px] font-bold text-pink-700 bg-white/60 px-2.5 py-1 rounded-lg border border-pink-200 text-left break-words">
                    {plan.continuation}
                  </div>
                )}

                <ul className="space-y-1 text-[14px] text-slate-800 font-medium pt-1.5 border-t border-pink-200/80">
                  {plan.features.slice(0, visibleFeaturesCount).map((feat, fIdx) => (
                    <motion.li 
                      key={fIdx} 
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 350, damping: 25 }}
                      onClick={() => setSelectedFeature({ title: feat.title, desc: feat.desc, planName: plan.name })}
                      className="flex items-start justify-between gap-1.5 leading-snug cursor-pointer py-1 px-1.5 rounded-lg hover:bg-white/85 hover:shadow-xs transition-all group border border-transparent hover:border-pink-200 min-w-0"
                      title="Нажмите для просмотра подробностей"
                    >
                      <div className="flex items-start gap-1.5 min-w-0">
                        <span className="text-pink-500 shrink-0 select-none mt-0.5 text-[14px]">✦</span>
                        <span className="text-slate-900 font-medium group-hover:text-pink-700 transition-colors text-left break-words">{feat.title}</span>
                      </div>
                      <Info className="w-4 h-4 text-slate-500 group-hover:text-pink-500 shrink-0 mt-0.5 opacity-80 group-hover:opacity-100 transition-opacity" />
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              {planNameLower.includes('космос') ? (
                <button 
                  onClick={() => onAction && onAction(plan.name, priceCalc.displayPrice, priceCalc.totalPrice, 'contact', selectedPeriod, priceCalc.discountPercent)} 
                  className="w-full py-2.5 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] rounded-2xl shadow-md transition-all duration-200 hover:opacity-95 cursor-pointer active:scale-98 mt-2 flex items-center justify-center gap-2"
                >
                  <span>Связаться</span>
                  <Sparkles className="w-4 h-4 text-white" />
                </button>
              ) : (
                <button 
                  onClick={() => onAction && onAction(plan.name, priceCalc.displayPrice, priceCalc.totalPrice, 'connect', selectedPeriod, priceCalc.discountPercent)} 
                  className="w-full py-2.5 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] rounded-2xl shadow-md transition-all duration-200 hover:opacity-95 cursor-pointer active:scale-98 mt-2 flex items-center justify-center gap-2"
                >
                  <span>{isCurrentPlanActive && !planNameLower.includes('старт') ? 'Продлить' : buttonText} {priceCalc.discountPercent > 0 ? `(-${priceCalc.discountPercent}%)` : ''}</span>
                  <Sparkles className="w-4 h-4 text-white" />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Feature details modal */}
      <AnimatePresence>
        {selectedFeature && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-br from-sky-200/45 via-pink-200/45 to-orange-200/45 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-xl rounded-3xl p-6 max-w-md w-full border border-pink-300 shadow-2xl space-y-4 text-left"
            >
              <div className="flex justify-between items-center border-b border-pink-200 pb-2.5">
                <span className="text-[14px] font-bold bg-gradient-to-r from-sky-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
                  Тариф {selectedFeature.planName}
                </span>
                <button 
                  onClick={() => setSelectedFeature(null)} 
                  className="text-slate-600 hover:text-slate-900 p-1.5 rounded-full bg-white/80 border border-pink-200 cursor-pointer"
                  title="Закрыть"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h4 className="font-bold text-base text-slate-900 leading-snug break-words">{selectedFeature.title}</h4>
              <p className="text-[14px] text-slate-800 font-medium leading-relaxed bg-white/70 p-3.5 rounded-2xl border border-pink-200 break-words">{selectedFeature.desc}</p>
              <button 
                onClick={() => setSelectedFeature(null)}
                className="w-full py-2.5 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white font-bold text-[14px] rounded-2xl shadow-md cursor-pointer transition-all"
              >
                Понятно
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
