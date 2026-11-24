import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldAlert, Sparkles, X, AlertTriangle } from 'lucide-react';

export interface ModerationAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  type?: 'comment' | 'review' | 'general';
}

export const ModerationAlertModal: React.FC<ModerationAlertModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'general'
}) => {
  if (!isOpen) return null;

  const defaultTitle = type === 'review'
    ? 'Отзыв отклонен модерацией нейросети'
    : type === 'comment'
      ? 'Комментарий отклонен модерацией нейросети'
      : 'Публикация отклонена нейросетью';

  const defaultMessage = type === 'review'
    ? 'Нейросеть (Функция 763) отклонила отзыв: обнаружены признаки спама, сторонней рекламы, ссылок или недопустимых выражений.'
    : type === 'comment'
      ? 'Нейросеть (Функция 763) отклонила комментарий: обнаружены недопустимые выражения, токсичность или нарушение правил сообщества.'
      : 'Нейросеть отклонила текст: обнаружены нарушения правил платформы.';

  const displayTitle = title || defaultTitle;
  const displayMessage = message || defaultMessage;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-sky-900/10 backdrop-blur-xs overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md rounded-3xl p-5 sm:p-6 bg-gradient-to-r from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 backdrop-blur-md border-2 border-pink-400 shadow-2xl overflow-hidden text-left"
        >
          {/* Top colored accent line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/70 hover:bg-white text-slate-500 hover:text-slate-800 transition-colors border border-pink-200 cursor-pointer shadow-2xs"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header with icon */}
          <div className="flex items-center gap-3 mb-4 pr-7">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 p-0.5 shrink-0 shadow-md">
              <div className="w-full h-full bg-white/90 rounded-[14px] flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-pink-500" />
              </div>
            </div>
            <div>
              <span className="text-[14px] font-bold text-pink-600 block">
                Контроль ИИ-модерации
              </span>
              <h3 className="font-extrabold text-[16px] sm:text-[17px] leading-snug bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 bg-clip-text text-transparent">
                {displayTitle}
              </h3>
            </div>
          </div>

          {/* Main content block with light gradient and transparency */}
          <div className="space-y-3">
            <div className="rounded-2xl p-4 bg-gradient-to-r from-sky-50/80 via-pink-50/80 via-orange-50/80 via-pink-50/80 to-sky-50/80 border border-pink-200/90 shadow-2xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <p className="text-[14px] font-medium text-slate-800 leading-relaxed">
                  {displayMessage}
                </p>
              </div>

              <div className="pt-2 border-t border-pink-200/60 flex items-center gap-2 text-slate-600 text-[14px]">
                <Sparkles className="w-4 h-4 text-pink-500 shrink-0" />
                <span>
                  Пожалуйста, скорректируйте текст и отправьте снова.
                </span>
              </div>
            </div>

            {/* Recommendations block */}
            <div className="rounded-2xl p-3.5 bg-white/70 border border-pink-200/80 text-slate-700 space-y-1.5 text-[14px]">
              <span className="font-bold text-slate-900 block">
                Правила публикации:
              </span>
              <ul className="space-y-1 list-disc list-inside text-slate-700">
                <li>Без ненормативной лексики и оскорблений</li>
                <li>Без спама, рекламных ссылок и контактов</li>
                <li>Соблюдение взаимного уважения и этики</li>
              </ul>
            </div>
          </div>

          {/* Action button */}
          <div className="mt-5">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white font-bold text-[14px] shadow-md hover:opacity-95 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2 border border-white/40"
            >
              <span>Понятно, исправить текст</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ModerationAlertModal;
