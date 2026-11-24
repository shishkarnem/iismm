import React, { useState, useRef } from 'react';
import { Mic, Loader2, Volume2 } from 'lucide-react';
import VoiceRecorderModal from './VoiceRecorderModal';

export interface MiniAudioFieldProps {
  onTranscript: (text: string) => void;
  currentValue?: string;
  disabled?: boolean;
  className?: string;
  buttonText?: string;
  title?: string;
  size?: 'sm' | 'md';
}

export const MiniAudioField: React.FC<MiniAudioFieldProps> = ({
  onTranscript,
  currentValue = '',
  disabled = false,
  className = '',
  buttonText = 'Голос',
  title = 'Голосовой ввод и распознавание речи',
  size = 'md'
}) => {
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [isLiveListening, setIsLiveListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  // Handle transcribed audio from ProTalk VoiceRecorderModal
  const handleVoiceProcessed = (result: { url: string; text: string }) => {
    const recognizedText = (result.text || '').trim();
    if (recognizedText) {
      const separator = currentValue && currentValue.trim()
        ? (currentValue.endsWith('.') || currentValue.endsWith('!') || currentValue.endsWith('?') ? ' ' : '. ')
        : '';
      const combined = currentValue ? `${currentValue.trim()}${separator}${recognizedText}` : recognizedText;
      onTranscript(combined);
    }
  };

  // Quick live browser speech recognition (ru-RU)
  const toggleBrowserSpeechRecognition = () => {
    if (isLiveListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsLiveListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsVoiceModalOpen(true);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ru-RU';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsLiveListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          handleVoiceProcessed({ url: '', text: transcript });
        }
      };

      recognition.onerror = () => {
        setIsLiveListening(false);
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
    <>
      <button
        type="button"
        onClick={toggleBrowserSpeechRecognition}
        disabled={disabled}
        title={isLiveListening ? 'Остановить запись речи' : title}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl transition-all cursor-pointer font-bold text-[14px] shadow-2xs active:scale-95 border border-white/50 ${
          isLiveListening
            ? 'bg-gradient-to-r from-pink-500 via-orange-500 to-pink-500 text-white animate-pulse'
            : 'bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white hover:opacity-95'
        } ${size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5'} ${className}`}
      >
        {isLiveListening ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span className="text-[14px] font-bold">Слушаю...</span>
          </>
        ) : (
          <>
            <Mic className="w-4 h-4 shrink-0" />
            {buttonText && <span className="text-[14px] font-bold">{buttonText}</span>}
          </>
        )}
      </button>

      {/* Fallback & Advanced AI Voice Recorder Modal */}
      <VoiceRecorderModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onVoiceProcessed={handleVoiceProcessed}
        activeFriendName="ИИ Ассистент"
      />
    </>
  );
};

export default MiniAudioField;
