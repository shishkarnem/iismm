import React, { useRef } from 'react';
import {
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { ChatGlobalTextToolbar } from './ChatGlobalTextToolbar';
import { MiniAudioField } from './MiniAudioField';

export interface TelegramPostTextEditorProps {
  text: string;
  onChange: (newText: string) => void;
  formatMode: 'v2' | 'rich';
  onFormatModeChange: (newMode: 'v2' | 'rich') => void;
  label?: string;
  placeholder?: string;
  minRows?: number;
  onAIEnhance?: () => void;
  isEnhancing?: boolean;
  showModeSwitch?: boolean;
  showAiButton?: boolean;
  aiButtonText?: string;
  helperText?: string;
  onSelectionChange?: (selectedText: string, range?: { start: number; end: number }) => void;
}

export const TelegramPostTextEditor: React.FC<TelegramPostTextEditorProps> = ({
  text,
  onChange,
  formatMode,
  onFormatModeChange,
  label = 'Текст поста',
  placeholder = 'Напишите текст поста... Выделите текст для форматирования или используйте голосовой ввод',
  minRows = 6,
  onAIEnhance,
  isEnhancing = false,
  showModeSwitch = true,
  showAiButton = true,
  aiButtonText = 'ИИ улучшение (1 ИИрка)',
  helperText,
  onSelectionChange
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Telegram limits: 900 chars for V2 (with photo caption), 32000 chars for extended Rich mode
  const maxLimit = formatMode === 'v2' ? 900 : 32000;
  const isOverLimit = text.length > maxLimit;

  return (
    <div className="space-y-2">
      {/* Top Header Row: Label, Format Switch, Voice & AI Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-[14px] font-bold text-slate-800">
            {label}
          </label>
          <span className="text-[14px] text-slate-500 hidden sm:inline">
            (выделите текст для форматирования)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Voice dictation via MiniAudioField */}
          <MiniAudioField
            onTranscript={(newTranscribed) => onChange(newTranscribed)}
            currentValue={text}
            buttonText="Голос"
            title="Наговорить текст голосом"
            size="sm"
          />

          {/* AI Enhance Button */}
          {showAiButton && onAIEnhance && (
            <button
              type="button"
              onClick={onAIEnhance}
              disabled={isEnhancing}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white font-bold text-[14px] shadow-2xs hover:opacity-95 transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isEnhancing ? 'animate-spin' : ''}`} />
              <span>{isEnhancing ? 'Улучшаю...' : aiButtonText}</span>
            </button>
          )}

          {/* Format mode switcher: V2 vs Rich */}
          {showModeSwitch && (
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/80 border border-pink-200/90 shadow-2xs">
              <button
                type="button"
                onClick={() => onFormatModeChange('v2')}
                className={`px-3 py-1 rounded-xl font-bold text-[14px] transition-all cursor-pointer ${
                  formatMode === 'v2'
                    ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-pink-50/50'
                }`}
              >
                V2 (до 900)
              </button>
              <button
                type="button"
                onClick={() => onFormatModeChange('rich')}
                className={`px-3 py-1 rounded-xl font-bold text-[14px] transition-all cursor-pointer ${
                  formatMode === 'rich'
                    ? 'bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-pink-50/50'
                }`}
              >
                Rich (до 32 000)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Textarea Area with Selection Floating Toolbar */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onSelect={(e) => {
            const el = e.currentTarget;
            const start = el.selectionStart ?? 0;
            const end = el.selectionEnd ?? 0;
            if (start !== end) {
              const sel = el.value.substring(Math.min(start, end), Math.max(start, end)).trim();
              onSelectionChange?.(sel, { start, end });
            } else {
              onSelectionChange?.('', { start, end });
            }
          }}
          onMouseUp={(e) => {
            const el = e.currentTarget;
            const start = el.selectionStart ?? 0;
            const end = el.selectionEnd ?? 0;
            if (start !== end) {
              const sel = el.value.substring(Math.min(start, end), Math.max(start, end)).trim();
              onSelectionChange?.(sel, { start, end });
            } else {
              onSelectionChange?.('', { start, end });
            }
          }}
          onClick={(e) => {
            const el = e.currentTarget;
            const start = el.selectionStart ?? 0;
            const end = el.selectionEnd ?? 0;
            if (start !== end) {
              const sel = el.value.substring(Math.min(start, end), Math.max(start, end)).trim();
              onSelectionChange?.(sel, { start, end });
            } else {
              onSelectionChange?.('', { start, end });
            }
          }}
          onKeyUp={(e) => {
            const el = e.currentTarget;
            const start = el.selectionStart ?? 0;
            const end = el.selectionEnd ?? 0;
            if (start !== end) {
              const sel = el.value.substring(Math.min(start, end), Math.max(start, end)).trim();
              onSelectionChange?.(sel, { start, end });
            } else {
              onSelectionChange?.('', { start, end });
            }
          }}
          placeholder={placeholder}
          rows={minRows}
          className={`w-full p-4 rounded-2xl bg-white/90 border ${
            isOverLimit ? 'border-rose-400 focus:border-rose-500' : 'border-pink-200/90 focus:border-pink-400'
          } text-slate-900 text-[14px] leading-relaxed placeholder:text-slate-400 focus:outline-none transition-all resize-y shadow-2xs`}
        />

        {/* Global Floating Text Toolbar for Text Selection (Same as in Chat) */}
        <ChatGlobalTextToolbar
          inputRef={textareaRef}
          inputText={text}
          onInputTextChange={onChange}
          formatMode={formatMode}
        />
      </div>

      {/* Bottom Status Row: Character Counter and Warnings */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[14px]">
        <div className="text-slate-600">
          {helperText || (
            formatMode === 'v2'
              ? 'Формат V2: лимит 900 символов (подходит для подписи к фото в Telegram)'
              : 'Формат Rich: лимит 32 000 символов (поддерживает длинный текст и встроенные фото)'
          )}
        </div>

        <div className="flex items-center gap-2">
          {isOverLimit && (
            <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Превышен лимит на {text.length - maxLimit} симв.!</span>
            </span>
          )}
          <span
            className={`font-mono font-bold px-2 py-0.5 rounded-lg ${
              isOverLimit
                ? 'bg-rose-100 text-rose-700 border border-rose-300'
                : 'bg-white/80 text-slate-700 border border-pink-200'
            }`}
          >
            {text.length} / {maxLimit}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TelegramPostTextEditor;
