import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Play, Pause, Check } from 'lucide-react';
import { InteractiveFeatureSimulator, FeatureSimulatorType } from './InteractiveFeatureSimulator';

interface FeatureItem {
  id: number;
  type: FeatureSimulatorType;
  title: string;
  shortTitle: string;
  badge: string;
  desc: string;
  bullets: string[];
}

const FEATURES_LIST: FeatureItem[] = [
  {
    id: 1,
    type: 'posts_v2',
    title: '1. ИИ-Посты V2 & Rich с картинками и форматированием до 36 000 символов',
    shortTitle: 'ИИ-Посты V2 & Rich',
    badge: 'Бесплатно',
    desc: 'Создавайте и публикуйте посты полностью бесплатно: от компактных публикаций V2 со спойлерами и цитатами до больших статей в формате Rich объемом до 36 000 символов с иллюстрациями внутри текста, кнопками и подписью.',
    bullets: [
      'Тексты Rich с картинками до 36 000 символов',
      'Красивое форматирование V2, спойлеры и цитаты',
      'Кнопки со ссылками, подпись и голосовой ввод',
      'Создание и публикация постов — бесплатно'
    ]
  },
  {
    id: 2,
    type: 'scenarios',
    title: '2. Многошаговые ИИ-Сценарии автопостинга в форматах V2 и Rich',
    shortTitle: 'ИИ-Сценарии',
    badge: 'Автопилот 24/7',
    desc: 'Настраивайте умные цепочки автоматизации: выбор темы, написание текста с разбивкой на блоки, генерация промптов и каскада горизонтальных картинок, добавление кнопок со ссылками, стандартной подписи и автоотправка в канал.',
    bullets: [
      'Гибкая цепочка шагов от темы до публикации',
      'Каскадная генерация текста и иллюстраций к блокам',
      'Автоподстановка кнопок и стандартной подписи',
      'Автономный выпуск постов в V2 и Rich по расписанию'
    ]
  },
  {
    id: 3,
    type: 'ai_images',
    title: '3. Генерация ИИ-Картинок и бесплатная облачная галерея',
    shortTitle: 'ИИ-Картинки',
    badge: 'Можно бесплатно',
    desc: 'Генерируйте яркие иллюстрации и обложки по текстовому или голосовому промпту — на платформе доступна бесплатная генерация ИИ-картинок, а также продвинутые нейромодели с сохранением в облачную галерею без потери качества.',
    bullets: [
      'Генерация ИИ-картинок доступна бесплатно',
      'Горизонтальные, квадратные и вертикальные форматы',
      'Бесплатное хранение файлов в облачной галерее',
      'Мгновенная вставка в посты, статьи Rich и сценарии'
    ]
  },
  {
    id: 4,
    type: 'neuroplan',
    title: '4. Умный Нейроплан контента для системного ведения каналов',
    shortTitle: 'Нейроплан',
    badge: 'Стратегия ИИ',
    desc: 'Формируйте продуманный контент-план на неделю или месяц вперед под тематику вашего канала: нейросеть составит расписание рубрик и тем, которые сразу можно превратить в готовые посты или передать в сценарии.',
    bullets: [
      'Генерация сетки актуальных тем под вашу нишу',
      'Продуманная структура рубрик и прогревов',
      'Голосовой и текстовый ввод пожеланий к плану',
      'Быстрый запуск выбранных тем в посты и календарь'
    ]
  },
  {
    id: 5,
    type: 'folders_selections',
    title: '5. Папки и Подборки каналов для бесплатного взаимного пиара',
    shortTitle: 'Папки и Подборки',
    badge: 'Бесплатно',
    desc: 'Объединяйтесь с другими авторами в тематические папки и подборки совершенно бесплатно: обменивайтесь живой целевой аудиторией, публикуйте общие подборки в 1 клик и растите без рекламного бюджета.',
    bullets: [
      'Создание папок и участие в подборках — бесплатно',
      'Удобный подбор каналов по тематике и охвату',
      'Автоматическая сборка поста со ссылками участников',
      'Честный взаимный пиар и рост живых подписчиков'
    ]
  },
  {
    id: 6,
    type: 'memory_styles',
    title: '6. Память опубликованных постов и фирменные Стили автора',
    shortTitle: 'Память & Стили',
    badge: 'Контекст и почерк',
    desc: 'Платформа запоминает историю вышедших публикаций вашего канала, исключая повторы тем, и сохраняет ваши индивидуальные стили написания для точной генерации и рерайта под авторскую подачу.',
    bullets: [
      'Память прошлых тем и защита от самоповторов',
      'Сохранение авторских стилей и тональности бренда',
      'Рерайт новостей и текстов под ваш почерк',
      'Единая концепция канала в ручных и автопостах'
    ]
  },
  {
    id: 7,
    type: 'social',
    title: '7. Бесплатная Соц.Сеть авторов и живые чаты с модерацией',
    shortTitle: 'Соц.Сеть',
    badge: 'Бесплатно',
    desc: 'Публикуйте материалы в общей ленте сообщества, находите партнеров в каталоге авторов и общайтесь в личных и групповых чатах с голосовыми сообщениями и автоматической защитой от спама.',
    bullets: [
      'Лента публикаций, лайки и репосты — бесплатно',
      'Личные и групповые чаты с голосом и медиа',
      'Круглосуточная нейро-модерация без спама',
      'Поиск партнеров для коллабораций и взаимопиара'
    ]
  },
  {
    id: 8,
    type: 'academy',
    title: '8. Бесплатная Академия и умный ИИ-консультант по платформе',
    shortTitle: 'Академия',
    badge: 'Бесплатно',
    desc: 'Изучайте пошаговые практические руководства по всем модулям бесплатно, а встроенный ИИ-консультант с голосовым и текстовым вводом владеет полной информацией из базы знаний и мгновенно отвечает на вопросы.',
    bullets: [
      'Все обучающие материалы Академии — бесплатно',
      'ИИ-консультант, владеющий актуальной базой знаний',
      'Вопросы консультанту голосом или текстом на сайте',
      'Наглядные инструкции по V2, Rich, сценариям и папкам'
    ]
  },
  {
    id: 9,
    type: 'calendar',
    title: '9. Бесплатный Календарь и расписание отложенных постов',
    shortTitle: 'Календарь',
    badge: 'Бесплатно',
    desc: 'Планируйте выход публикаций на дни, недели и месяцы вперед полностью бесплатно: визуальная сетка календаря показывает все слоты по каналам и отправляет посты точно в назначенную минуту.',
    bullets: [
      'Планирование и автопостинг по времени — бесплатно',
      'Наглядная сетка расписания по всем каналам',
      'Быстрое редактирование даты, текста и вложений',
      'Надежная автоматическая отправка минута в минуту'
    ]
  },
  {
    id: 10,
    type: 'blog',
    title: '10. Бесплатный Блог с публикацией всех постов и SEO-продвижением',
    shortTitle: 'Блог',
    badge: 'Бесплатно',
    desc: 'Любой ваш пост может быть бесплатно опубликован в открытом Блоге: все публикации получают собственные страницы, индексируются поисковыми системами и продвигаются по SEO для привлечения читателей.',
    bullets: [
      'Публикация любого вашего поста в Блоге — бесплатно',
      'Все посты открыто публикуются и продвигаются по SEO',
      'Автоматическая индексация статей в поисковиках',
      'Дополнительный органический трафик в ваши каналы'
    ]
  }
];

export default function FeaturesCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    let intervalId: number | undefined;
    const AUTO_PLAY_DURATION = 12000;
    const PROGRESS_STEP_MS = 40;

    if (isPlaying) {
      const startTime = Date.now();
      intervalId = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min((elapsed / AUTO_PLAY_DURATION) * 100, 100);
        setProgress(pct);

        if (pct >= 100) {
          setSlideDirection('right');
          setActiveIndex((prev) => (prev + 1) % FEATURES_LIST.length);
          setProgress(0);
        }
      }, PROGRESS_STEP_MS);
    } else {
      setProgress(0);
    }

    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [isPlaying, activeIndex]);

  const handleNext = () => {
    setSlideDirection('right');
    setActiveIndex((prev) => (prev + 1) % FEATURES_LIST.length);
  };

  const handlePrev = () => {
    setSlideDirection('left');
    setActiveIndex((prev) => (prev - 1 + FEATURES_LIST.length) % FEATURES_LIST.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const diff = touchStartXRef.current - endX;
    if (Math.abs(diff) > 45) {
      if (diff > 0) handleNext();
      else handlePrev();
    }
    touchStartXRef.current = null;
  };

  const currentFeature = FEATURES_LIST[activeIndex];

  return (
    <div className="w-full max-w-7xl mx-auto px-0 sm:px-4 py-3 sm:py-4 space-y-4 sm:space-y-6 min-w-0">
      {/* Overall progress bar across all 10 capabilities */}
      <div className="w-full bg-white/75 border border-pink-300/80 h-2 rounded-full overflow-hidden relative shadow-2xs">
        <motion.div
          className="h-full bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400"
          animate={{ width: `${((activeIndex + 1) / FEATURES_LIST.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* 10 Interactive Navigation Tabs: 2 columns on mobile (no horizontal scroll), 5 columns on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5 min-w-0">
        {FEATURES_LIST.map((feat, idx) => {
          const isActive = idx === activeIndex;
          return (
            <button
              key={feat.id}
              type="button"
              onClick={() => {
                setSlideDirection(idx >= activeIndex ? 'right' : 'left');
                setActiveIndex(idx);
              }}
              className={`min-w-0 p-[1.5px] rounded-2xl transition-all cursor-pointer shadow-2xs ${
                isActive
                  ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-md scale-[1.01]'
                  : 'bg-gradient-to-r from-sky-300/80 via-pink-400/80 via-orange-300/80 via-pink-400/80 to-sky-300/80 hover:opacity-95'
              }`}
            >
              <span
                className={`w-full h-full min-h-[44px] px-2.5 py-2 rounded-[14.5px] text-[14px] leading-tight text-center flex items-center justify-center break-words whitespace-normal transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white font-extrabold'
                    : 'bg-gradient-to-r from-sky-100/88 via-pink-100/88 via-orange-100/88 via-pink-100/88 to-sky-100/88 backdrop-blur-md text-slate-800 font-bold hover:from-sky-100/95 hover:via-pink-100/95 hover:to-sky-100/95'
                }`}
              >
                {feat.shortTitle}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Showcase Card with vivid gradient border and translucent sky-pink-orange-pink-sky interior */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="w-full min-w-0 p-[1.5px] rounded-3xl shadow-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400"
      >
        <div className="relative overflow-hidden rounded-[22.5px] bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-xl px-[2vw] py-5 sm:p-8 w-full min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentFeature.id}
              initial={{ opacity: 0, x: slideDirection === 'right' ? 36 : -36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: slideDirection === 'right' ? -36 : 36 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-center min-w-0"
            >
              {/* Left Description Column */}
              <div className="lg:col-span-7 space-y-4 text-left min-w-0">
                <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                  <span className="px-3.5 py-1 rounded-full text-[14px] font-bold text-white shadow-2xs bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
                    {currentFeature.badge}
                  </span>
                  <span className="text-[14px] font-bold text-slate-700">
                    Возможность {activeIndex + 1} из {FEATURES_LIST.length}
                  </span>
                </div>

                <h3 className="text-[19px] sm:text-2xl font-extrabold leading-snug bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent break-words">
                  {currentFeature.title}
                </h3>

                <p className="text-slate-800 text-[14px] sm:text-[15px] leading-relaxed font-medium break-words">
                  {currentFeature.desc}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 min-w-0">
                  {currentFeature.bullets.map((bullet, bIdx) => (
                    <div
                      key={bIdx}
                      className="flex items-start gap-2 px-3 py-2.5 rounded-2xl border border-pink-300/80 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 backdrop-blur-md text-[14px] font-bold text-slate-900 min-w-0 shadow-2xs"
                    >
                      <Check className="w-4 h-4 text-pink-600 shrink-0 mt-0.5" />
                      <span className="break-words leading-snug">{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Interactive Simulator Column */}
              <div className="lg:col-span-5 w-full min-w-0">
                <InteractiveFeatureSimulator type={currentFeature.type} />
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Bottom Carousel Controls: Prev / Play-Pause / Next */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-between gap-2.5 pt-5 sm:pt-6 border-t border-pink-300/60 mt-5 sm:mt-6 min-w-0">
            <button
              type="button"
              onClick={handlePrev}
              className="order-1 px-4 py-2.5 rounded-2xl shadow-md cursor-pointer transition-all duration-200 hover:opacity-95 active:scale-95 flex items-center justify-center gap-1.5 text-[14px] font-extrabold text-white bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span>Назад</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="order-3 col-span-2 sm:col-span-1 sm:order-2 px-5 py-2.5 rounded-2xl shadow-md cursor-pointer transition-all duration-200 hover:opacity-95 active:scale-95 flex items-center justify-center gap-2 text-[14px] font-extrabold text-white relative overflow-hidden bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400"
            >
              {isPlaying && (
                <div
                  className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-orange-500/75 via-pink-600/75 to-sky-500/75 transition-all duration-75 ease-linear pointer-events-none"
                  style={{ width: `${progress}%` }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {isPlaying ? <Pause className="w-4 h-4 shrink-0" /> : <Play className="w-4 h-4 shrink-0" />}
                <span>{isPlaying ? 'Пауза автотура' : 'Запустить автотур'}</span>
              </span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="order-2 sm:order-3 px-4 py-2.5 rounded-2xl shadow-md cursor-pointer transition-all duration-200 hover:opacity-95 active:scale-95 flex items-center justify-center gap-1.5 text-[14px] font-extrabold text-white bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400"
            >
              <span>Вперед</span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
