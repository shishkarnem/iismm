import React, { useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { MiniAudioField } from '../MiniAudioField';

export interface AutoGrowVoiceTextareaProps {
  label?: string;
  value: string;
  onChange: (nextValue: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minRows?: number;
  maxLength?: number;
  disabled?: boolean;
  showClearButton?: boolean;
  voiceButtonText?: string;
  headerExtra?: React.ReactNode;
  className?: string;
  textareaClassName?: string;
  id?: string;
}

export const AutoGrowVoiceTextarea: React.FC<AutoGrowVoiceTextareaProps> = ({
  label,
  value,
  onChange,
  onBlur,
  placeholder = '',
  minRows = 2,
  maxLength,
  disabled = false,
  showClearButton = false,
  voiceButtonText = 'Голос',
  headerExtra,
  className = '',
  textareaClassName = '',
  id
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const manualMinHeightRef = useRef<number>(0);
  const isAdjustingRef = useRef<boolean>(false);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    isAdjustingRef.current = true;
    const baseMinPx = Math.max(2, minRows) * 24 + 20;
    const targetFloor = Math.max(baseMinPx, manualMinHeightRef.current);
    el.style.height = 'auto';
    const nextHeight = Math.max(targetFloor, el.scrollHeight + 2);
    el.style.height = `${nextHeight}px`;
    requestAnimationFrame(() => {
      isAdjustingRef.current = false;
    });
  };

  useLayoutEffect(() => {
    adjustHeight();
  }, [value, minRows]);

  const handleMouseUp = () => {
    const el = textareaRef.current;
    if (!el || isAdjustingRef.current) return;
    const currentPx = el.getBoundingClientRect().height;
    const baseMinPx = Math.max(2, minRows) * 24 + 20;
    if (currentPx > baseMinPx + 4) {
      manualMinHeightRef.current = Math.round(currentPx);
    }
  };

  return (
    <div className={`space-y-1.5 min-w-0 ${className}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
        {label ? (
          <label
            htmlFor={id}
            className="text-[14px] font-bold text-slate-900 leading-snug break-words min-w-0 flex-1"
          >
            {label}
          </label>
        ) : (
          <span className="flex-1" />
        )}

        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {headerExtra}

          <MiniAudioField
            currentValue={value}
            disabled={disabled}
            size="sm"
            buttonText={voiceButtonText}
            onTranscript={(combinedText) => {
              onChange(combinedText);
            }}
          />

          {showClearButton && value && !disabled && (
            <button
              type="button"
              onClick={() => {
                manualMinHeightRef.current = 0;
                onChange('');
              }}
              title="Очистить поле"
              aria-label="Очистить поле"
              className="min-w-[34px] min-h-[34px] px-2 rounded-xl bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 border border-pink-300 text-slate-700 hover:text-rose-700 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <textarea
        ref={textareaRef}
        id={id}
        rows={Math.max(2, minRows)}
        maxLength={maxLength}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleMouseUp}
        placeholder={placeholder}
        className={`w-full min-w-0 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border border-pink-300 text-slate-900 text-[14px] leading-relaxed font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-400 resize-y overflow-y-auto ${textareaClassName}`}
      />
    </div>
  );
};

export default AutoGrowVoiceTextarea;
