import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Send,
  Calendar,
  FileText,
  Check,
  Image as ImageIcon,
  Brain,
  Cpu,
  Users,
  GraduationCap,
  BookOpen,
  FolderHeart,
  Compass,
  Link2,
  Globe,
  Mic
} from 'lucide-react';

export type FeatureSimulatorType =
  | 'posts_v2'
  | 'scenarios'
  | 'ai_images'
  | 'neuroplan'
  | 'folders_selections'
  | 'memory_styles'
  | 'social'
  | 'academy'
  | 'calendar'
  | 'blog'
  | string;

export interface InteractiveFeatureSimulatorProps {
  type: FeatureSimulatorType;
}

const AI_SHOWCASE_IMAGE_URL =
  'https://file.pro-talk.ru/tgf/GTUpJwQ9JCkYKglyGHQMEUoWOR8tPSgeCRF8CAUkARwBQ2oFIVZVAwEvMygZEyIqDWgeChtqAXQKQhkKZz4HHwAZKRApNQQeLA8YFgdnGHEWMGMtN05yTm9kWVx2bl1SGBMkTzhDL1JEJjw_EgstGT0CNywaIC0xBGA3AAwZVgAuOy4GJH9dVHVpW19rZFYD.png';

const STEP_LABELS = ['Шаг 1', 'Шаг 2', 'Шаг 3'];

const INNER_CARD_CLASS =
  'p-3 sm:p-3.5 rounded-2xl border border-pink-300/80 bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-md space-y-2.5 min-w-0 text-left shadow-2xs';

const SUB_CHIP_CLASS =
  'px-2.5 py-1.5 rounded-xl border border-pink-300/80 bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 text-slate-900 text-[14px] font-semibold break-words min-w-0';

const VIVID_BTN_CLASS =
  'px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white text-[14px] font-bold shadow-xs inline-flex items-center gap-1.5 min-w-0';

const GRADIENT_HEADING_CLASS =
  'bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent font-extrabold text-[14px] sm:text-[15px] leading-snug break-words';

export const InteractiveFeatureSimulator: React.FC<InteractiveFeatureSimulatorProps> = ({ type }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
  }, [type]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setStep((prev) => (prev + 1) % 3);
    }, 3800);
    return () => window.clearInterval(interval);
  }, [type, step]);

  const normalizedType = (() => {
    if (type === 'markdown') return 'posts_v2';
    if (type === 'gallery') return 'ai_images';
    if (type === 'grid') return 'calendar';
    if (type === 'rewrite' || type === 'memory') return 'memory_styles';
    if (type === 'assistants') return 'neuroplan';
    return type;
  })();

  const getHeaderMeta = (): { icon: React.ReactNode; label: string; freeTag?: string } => {
    switch (normalizedType) {
      case 'posts_v2':
        return { icon: <FileText className="w-4 h-4 text-pink-500 shrink-0" />, label: 'ИИ-Посты V2 & Rich', freeTag: 'Бесплатно' };
      case 'scenarios':
        return { icon: <Cpu className="w-4 h-4 text-sky-500 shrink-0" />, label: 'ИИ-Сценарии' };
      case 'ai_images':
        return { icon: <ImageIcon className="w-4 h-4 text-orange-500 shrink-0" />, label: 'ИИ-Картинки', freeTag: 'Можно бесплатно' };
      case 'neuroplan':
        return { icon: <Compass className="w-4 h-4 text-pink-500 shrink-0" />, label: 'Нейроплан' };
      case 'folders_selections':
        return { icon: <FolderHeart className="w-4 h-4 text-orange-500 shrink-0" />, label: 'Папки и Подборки', freeTag: 'Бесплатно' };
      case 'memory_styles':
        return { icon: <Brain className="w-4 h-4 text-pink-500 shrink-0" />, label: 'Память & Стили' };
      case 'social':
        return { icon: <Users className="w-4 h-4 text-sky-500 shrink-0" />, label: 'Соц.Сеть', freeTag: 'Бесплатно' };
      case 'academy':
        return { icon: <GraduationCap className="w-4 h-4 text-pink-500 shrink-0" />, label: 'Академия', freeTag: 'Бесплатно' };
      case 'calendar':
        return { icon: <Calendar className="w-4 h-4 text-orange-500 shrink-0" />, label: 'Календарь', freeTag: 'Бесплатно' };
      case 'blog':
      default:
        return { icon: <BookOpen className="w-4 h-4 text-sky-500 shrink-0" />, label: 'Блог', freeTag: 'Бесплатно' };
    }
  };

  const renderBody = () => {
    switch (normalizedType) {
      case 'posts_v2':
        return (
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="p-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>1. Форматы V2 и Rich до 36 000 символов</div>
                <div className={SUB_CHIP_CLASS}>
                  Создавайте как лаконичные посты V2 со спойлерами, так и большие статьи Rich до{' '}
                  <strong>36 000 символов</strong> с картинками прямо внутри текста и красивым форматированием.
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className={VIVID_BTN_CLASS}>Rich до 36 000 симв.</span>
                  <span className={VIVID_BTN_CLASS}>Спойлеры и цитаты</span>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="p-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>2. Картинки в блоках, кнопки и подпись</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className={`${VIVID_BTN_CLASS} justify-center text-center`}>
                    <Link2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">Кнопки со ссылками</span>
                  </div>
                  <div className={`${VIVID_BTN_CLASS} justify-center text-center`}>
                    <Mic className="w-4 h-4 shrink-0" />
                    <span className="truncate">Голосовой ввод</span>
                  </div>
                </div>
                <p className="text-[14px] text-slate-800 font-medium break-words">
                  Вставляйте иллюстрации между абзацами, прикрепляйте инлайн-кнопки и стандартную подпись канала.
                </p>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="p-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>3. Бесплатная публикация в 1 клик</div>
                <div className={SUB_CHIP_CLASS}>
                  Создание, оформление и отправка обычных постов в свои каналы и ленту работают полностью бесплатно и без лимитов.
                </div>
                <div className={VIVID_BTN_CLASS}>
                  <Send className="w-4 h-4 shrink-0" />
                  <span>Опубликовано бесплатно</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        );

      case 'scenarios':
        return (
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="sc-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>1. Гибкая цепочка шагов сценария</div>
                <div className="space-y-1.5">
                  <div className={SUB_CHIP_CLASS}>Шаг 1: Генерация темы и текста с делением на блоки</div>
                  <div className={SUB_CHIP_CLASS}>Шаг 2: Промпты и каскад горизонтальных ИИ-картинок</div>
                  <div className={SUB_CHIP_CLASS}>Шаг 3: Кнопки, подпись и сборка в V2 или Rich</div>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="sc-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>2. Автоматическая сборка поста с медиа</div>
                <p className="text-[14px] text-slate-800 font-medium break-words">
                  Сценарий сам объединяет сгенерированный текст, иллюстрации, ссылки-кнопки и фирменную подпись в готовую публикацию.
                </p>
                <div className="w-full h-2.5 rounded-full bg-white/80 border border-pink-300 overflow-hidden">
                  <motion.div
                    initial={{ width: '15%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2.8, ease: 'easeInOut' }}
                    className="h-full bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400"
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="sc-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>3. Выпуск в каналы по расписанию 24/7</div>
                <div className={SUB_CHIP_CLASS}>
                  Настройте дни и время выхода один раз — платформа будет вести ваши каналы автономно с учетом памяти прошлых тем.
                </div>
                <div className={VIVID_BTN_CLASS}>
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Автопостинг сценария активен</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        );

      case 'ai_images':
        return (
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="img-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>1. Бесплатная и продвинутая генерация</div>
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={AI_SHOWCASE_IMAGE_URL}
                    alt="Пример ИИ-картинки"
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-pink-300 shrink-0 shadow-xs"
                  />
                  <div className="text-[14px] text-slate-800 font-medium leading-snug break-words min-w-0">
                    Опишите идею голосом или текстом, выберите пропорции и создавайте ИИ-картинки в том числе полностью бесплатно.
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className={VIVID_BTN_CLASS}>Можно бесплатно</span>
                  <span className={SUB_CHIP_CLASS}>Горизонтальные и 1:1</span>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="img-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>2. Готовая нейро-иллюстрация высокой четкости</div>
                <div className="rounded-2xl overflow-hidden border border-pink-300 bg-white/60 shadow-xs">
                  <img
                    src={AI_SHOWCASE_IMAGE_URL}
                    alt="Сгенерированная ИИ-картинка"
                    className="w-full h-36 sm:h-40 object-cover block"
                  />
                </div>
                <span className="text-[14px] text-slate-800 font-semibold block break-words">
                  Яркий визуал готов за считанные секунды для одиночных постов и каскадных сценариев.
                </span>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="img-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>3. Бесплатная облачная галерея и вставка</div>
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={AI_SHOWCASE_IMAGE_URL}
                    alt="ИИ-картинка в галерее"
                    className="w-16 h-16 rounded-2xl object-cover border border-pink-300 shrink-0 shadow-xs"
                  />
                  <div className="text-[14px] text-slate-800 font-medium leading-snug break-words min-w-0">
                    Картинка автоматически сохраняется в вашей облачной галерее без сжатия и прикрепляется к посту в 1 клик.
                  </div>
                </div>
                <div className={VIVID_BTN_CLASS}>
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Прикреплено к публикации</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        );

      case 'neuroplan':
        return (
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="np-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>1. Запрос контент-плана по вашей теме</div>
                <div className={SUB_CHIP_CLASS}>
                  Укажите тематику канала, целевую аудиторию и период — нейросеть выстроит логичную цепочку публикаций.
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="np-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>2. Готовая сетка рубрик и тем</div>
                <div className="space-y-1.5">
                  <div className={SUB_CHIP_CLASS}>Пн: Экспертный разбор • Главные тренды ниши</div>
                  <div className={SUB_CHIP_CLASS}>Ср: Практический кейс • Пошаговый результат</div>
                  <div className={SUB_CHIP_CLASS}>Пт: Вовлечение • Дискуссия с подписчиками</div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="np-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>3. Генерация постов прямо из плана</div>
                <p className="text-[14px] text-slate-800 font-medium break-words">
                  Превращайте пункты нейроплана в готовые публикации с иллюстрациями и ставьте их в расписание.
                </p>
                <div className={VIVID_BTN_CLASS}>
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Запустить темы в календарь</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        );

      case 'folders_selections':
        return (
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="fs-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>1. Бесплатное создание папки или подборки</div>
                <div className={SUB_CHIP_CLASS}>
                  Создайте тематическую папку взаимного пиара или подборку каналов и задайте условия участия бесплатно.
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="fs-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>2. Заявки авторов и автосборка поста</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className={SUB_CHIP_CLASS}>Каналы проверены и добавлены</div>
                  <div className={SUB_CHIP_CLASS}>Готова ссылка на общую папку</div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="fs-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>3. Бесплатный обмен живыми подписчиками</div>
                <div className={SUB_CHIP_CLASS}>
                  Читатели подписываются на всю подборку в 1 клик, принося новым и растущим каналам целевую аудиторию без затрат.
                </div>
                <div className={VIVID_BTN_CLASS}>
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Взаимопиар полностью бесплатный</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        );

      case 'memory_styles':
        return (
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="ms-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>1. Учет прошлых тем и постов канала</div>
                <div className={SUB_CHIP_CLASS}>
                  Система хранит память вышедших публикаций каждого канала, чтобы генерировать только свежие темы без дублей.
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="ms-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>2. Настройка фирменных стилей автора</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className={VIVID_BTN_CLASS}>Экспертный стиль</span>
                  <span className={SUB_CHIP_CLASS}>Дружелюбный</span>
                  <span className={SUB_CHIP_CLASS}>Сторителлинг</span>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="ms-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>3. Генерация и рерайт в вашей подаче</div>
                <div className={SUB_CHIP_CLASS}>
                  Каждый новый пост и рерайт сохраняет вашу лексику, структуру абзацев и привычную подачу для подписчиков.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        );

      case 'social':
        return (
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="soc-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>1. Бесплатная лента и каталог авторов</div>
                <div className={SUB_CHIP_CLASS}>
                  Делитесь постами, набирайте лайки, репосты и подписчиков внутри активного сообщества авторов бесплатно.
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="soc-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>2. Чаты с голосом и ИИ-модерацией</div>
                <div className={SUB_CHIP_CLASS}>
                  Общайтесь в личных и групповых чатах с голосовыми сообщениями, вложениями и круглосуточной защитой от спама.
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="soc-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>3. Коллаборации и органический охват</div>
                <div className={SUB_CHIP_CLASS}>
                  Находите единомышленников, договаривайтесь о совместных папках пиара и продвигайте свои проекты бесплатно.
                </div>
                <div className={VIVID_BTN_CLASS}>
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Соцсеть открыта бесплатно</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        );

      case 'academy':
        return (
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="ac-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>1. Бесплатные руководства по всем разделам</div>
                <div className={SUB_CHIP_CLASS}>
                  Подробные разборы подключения каналов, форматов V2 и Rich, многошаговых сценариев, папок и подборок.
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="ac-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>2. Умный консультант со знанием базы</div>
                <div className={SUB_CHIP_CLASS}>
                  На страницах работает ИИ-консультант с голосовым и текстовым вводом, который владеет всей информацией о платформе и базе данных.
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="ac-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>3. Мгновенные ответы по настройке и тарифам</div>
                <div className={SUB_CHIP_CLASS}>
                  Консультант находит точные данные в базе знаний и подсказывает, как быстрее настроить автоматизацию канала.
                </div>
                <div className={VIVID_BTN_CLASS}>
                  <GraduationCap className="w-4 h-4 shrink-0" />
                  <span>Академия доступна бесплатно</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        );

      case 'calendar':
        return (
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="cal-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>1. Бесплатная сетка планирования</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className={SUB_CHIP_CLASS}>Пн • 10:00</div>
                  <div className={SUB_CHIP_CLASS}>Ср • 14:30</div>
                  <div className={VIVID_BTN_CLASS}>Пт • 18:30</div>
                  <div className={SUB_CHIP_CLASS}>Вс • 12:00</div>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="cal-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>2. Контроль статусов и быстрые правки</div>
                <div className={SUB_CHIP_CLASS}>
                  Отслеживайте запланированные и вышедшие посты по всем каналам, меняйте дату, текст, кнопки или вложения в пару кликов.
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="cal-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>3. Безлимитный автопостинг по времени</div>
                <div className={SUB_CHIP_CLASS}>
                  Отложенная публикация обычных постов в календаре работает полностью бесплатно и отправляет контент точно в срок.
                </div>
                <div className={VIVID_BTN_CLASS}>
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Календарь полностью бесплатный</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        );

      case 'blog':
      default:
        return (
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="bl-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>1. Публикация любого вашего поста</div>
                <div className={SUB_CHIP_CLASS}>
                  Любой созданный вами пост или статью Rich можно бесплатно опубликовать в открытом Блоге платформы.
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="bl-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>2. Автоматическая индексация и поисковое продвижение</div>
                <div className={SUB_CHIP_CLASS}>
                  Все опубликованные посты получают собственную веб-страницу и автоматически продвигаются по SEO в поисковых системах.
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="bl-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={INNER_CARD_CLASS}
              >
                <div className={GRADIENT_HEADING_CLASS}>3. Бесплатный органический трафик из поиска</div>
                <div className={SUB_CHIP_CLASS}>
                  Читатели из поисковиков находят ваши публикации в Блоге и переходят по ссылкам и кнопкам в ваши каналы.
                </div>
                <div className={VIVID_BTN_CLASS}>
                  <Globe className="w-4 h-4 shrink-0" />
                  <span>Блог и SEO — бесплатно</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        );
    }
  };

  const meta = getHeaderMeta();

  return (
    <div className="w-full min-w-0 p-[1.5px] rounded-3xl shadow-lg bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
      <div className="w-full min-w-0 rounded-[22.5px] bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xl px-[2vw] sm:px-5 py-4 sm:py-5 space-y-3.5">
        {/* Top interactive bar: title + free badge + clickable step switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {meta.icon}
            <span className={GRADIENT_HEADING_CLASS}>{meta.label}</span>
            {meta.freeTag && (
              <span className="px-2.5 py-0.5 rounded-full text-[14px] font-bold text-white bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-2xs">
                {meta.freeTag}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {STEP_LABELS.map((lbl, idx) => {
              const active = step === idx;
              return (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => setStep(idx)}
                  className={`px-2.5 py-1 rounded-xl text-[14px] font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-xs'
                      : 'bg-white/75 text-slate-800 border border-pink-300 hover:bg-white/95'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step progress indicator */}
        <div className="w-full h-1.5 rounded-full bg-white/75 border border-pink-200/80 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400"
            animate={{ width: `${((step + 1) / 3) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Animated interactive step stage */}
        <div className="min-h-[195px] flex flex-col justify-center min-w-0">{renderBody()}</div>
      </div>
    </div>
  );
};
