import React, { useState, useRef } from 'react';
import { Mic, Loader2, Volume2 } from 'lucide-react';
import VoiceRecorderModal from './VoiceRecorderModal';
import GradientAudioPlayer from './GradientAudioPlayer';

export interface AudioFieldProps {
  value: string;
  onChange: (value: string) => void;
  audioUrl?: string;
  onAudioChange?: (url: string) => void;
  showAudioPlayer?: boolean;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  inputClassName?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  label?: string;
  voiceFriendName?: string;
  titleVoice?: string;
  autoFocus?: boolean;
  minHeight?: string;
}

export const AudioField: React.FC<AudioFieldProps> = ({
  value,
  onChange,
  audioUrl: propAudioUrl,
  onAudioChange,
  showAudioPlayer = true,
  placeholder = 'Введите текст или нажмите микрофон для записи речи...',
  rows = 2,
  maxLength,
  disabled = false,
  required = false,
  id,
  className = '',
  inputClassName = '',
  onKeyDown,
  label,
  voiceFriendName = 'ИИ Ассистент',
  titleVoice = 'Голосовой ввод и распознавание речи',
  autoFocus = false,
  minHeight
}) => {
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isLiveListening, setIsLiveListening] = useState(false);
  const [internalAudioUrl, setInternalAudioUrl] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const effectiveAudioUrl = propAudioUrl !== undefined ? propAudioUrl : internalAudioUrl;

  // Handle voice transcribed from VoiceRecorderModal (ProTalk AI STT)
  const handleVoiceProcessed = (result: { url: string; text: string }) => {
    if (result.url) {
      setInternalAudioUrl(result.url);
      if (onAudioChange) {
        onAudioChange(result.url);
      }
    }

    const recognizedText = (result.text || '').trim();
    if (recognizedText) {
      const separator = value && value.trim() ? (value.endsWith('.') || value.endsWith('!') || value.endsWith('?') ? ' ' : '. ') : '';
      const newText = value ? `${value.trim()}${separator}${recognizedText}` : recognizedText;
      onChange(maxLength ? newText.slice(0, maxLength) : newText);
    }
    
    // Focus back to textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }, 100);
  };

  // Quick speech recognition toggle via Web Speech API if supported
  const startBrowserSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // Fallback directly to VoiceRecorderModal
      setIsVoiceModalOpen(true);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ru-RU';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsLiveListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          handleVoiceProcessed({ url: '', text: transcript });
        }
      };

      recognition.onerror = () => {
        setIsLiveListening(false);
        // Fallback to VoiceRecorderModal
        setIsVoiceModalOpen(true);
      };

      recognition.onend = () => {
        setIsLiveListening(false);
      };

      recognition.start();
    } catch (e) {
      setIsVoiceModalOpen(true);
    }
  };

  return (
    <div className={`w-full flex flex-col space-y-1.5 ${className}`}>
      {label && (
        <div className="flex justify-between items-center px-0.5">
          <label htmlFor={id} className="text-[14px] font-bold text-slate-700">
            {label}
          </label>
          {maxLength && (
            <span className="text-[14px] font-medium text-slate-500 font-mono">
              {value.length} / {maxLength}
            </span>
          )}
        </div>
      )}

      <div className="relative w-full rounded-2xl bg-white/90 backdrop-blur-xs border border-pink-200/90 focus-within:border-pink-400 focus-within:ring-2 focus-within:ring-pink-300/40 transition-all p-2 shadow-2xs flex flex-col justify-between">
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(e) => {
            const val = maxLength ? e.target.value.slice(0, maxLength) : e.target.value;
            onChange(val);
          }}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          onKeyDown={onKeyDown}
          style={minHeight ? { minHeight } : undefined}
          className={`w-full bg-transparent text-[14px] font-normal text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed pr-12 pb-1 ${inputClassName}`}
        />

        {/* Voice Recognition Control in lower right corner */}
        <div className="flex items-center justify-between pt-1 border-t border-pink-100/60 mt-1">
          <div className="flex items-center gap-1.5 text-[14px] text-slate-500">
            {isLiveListening ? (
              <span className="flex items-center gap-1 text-pink-600 font-semibold animate-pulse text-[14px]">
                <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                Слушаю вас... говорите
              </span>
            ) : (
              <span className="text-slate-500 hidden sm:inline text-[14px]">
                Можно печатать или наговорить голосом
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (isLiveListening) return;
                // Open VoiceRecorderModal which features AI speech recognition and audio upload
                setIsVoiceModalOpen(true);
              }}
              title={titleVoice}
              disabled={disabled}
              className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 border border-white/40 ${
                isLiveListening
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white animate-pulse'
                  : 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white hover:opacity-95'
              }`}
            >
              {isLiveListening ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
              <span className="text-[14px] font-bold hidden md:inline">
                Голос
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Audio Player Preview in Brand Gradient Style if Voice Recorded */}
      {showAudioPlayer && effectiveAudioUrl && (
        <div className="pt-1">
          <GradientAudioPlayer
            src={effectiveAudioUrl}
            title="Голосовая запись"
            onDelete={() => {
              setInternalAudioUrl('');
              if (onAudioChange) onAudioChange('');
            }}
          />
        </div>
      )}

      {/* Voice Recorder Modal with AI STT, Equalizer & Canvas Neural Sphere */}
      <VoiceRecorderModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onVoiceProcessed={handleVoiceProcessed}
        activeFriendName={voiceFriendName}
      />
    </div>
  );
};

export default AudioField;
