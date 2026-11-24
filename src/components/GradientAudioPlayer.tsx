import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Trash2 } from 'lucide-react';

export interface GradientAudioPlayerProps {
  src: string;
  title?: string;
  compact?: boolean;
  className?: string;
  onDelete?: () => void;
  showWaveform?: boolean;
}

export const GradientAudioPlayer: React.FC<GradientAudioPlayerProps> = ({
  src,
  title,
  compact = false,
  className = '',
  onDelete,
  showWaveform = true
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Normalize audio source URL: if it points to a proxy or remote, handle cleanly
  const cleanSrc = React.useMemo(() => {
    if (!src) return '';
    return src.trim();
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
    };
  }, [cleanSrc]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.warn('Audio playback error:', err);
        setIsPlaying(false);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = Number(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  if (!cleanSrc) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`w-full rounded-2xl p-2.5 sm:p-3 bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xs border border-pink-300/90 shadow-2xs transition-all ${className}`}
    >
      <audio ref={audioRef} src={cleanSrc} preload="metadata" />

      {/* Header if title provided */}
      {title && (
        <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
          <span className="text-[14px] font-bold text-slate-800 truncate">
            {title}
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              title="Удалить запись"
              className="p-1 rounded-lg text-slate-400 hover:text-pink-600 hover:bg-white/60 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2.5 w-full">
        {/* Play/Pause Button in Brand Gradient */}
        <button
          type="button"
          onClick={togglePlay}
          title={isPlaying ? 'Пауза' : 'Воспроизвести'}
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white shadow-2xs active:scale-95 transition-all cursor-pointer border border-white/40 bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 hover:opacity-95"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-white text-white" />
          ) : (
            <Play className="w-4 h-4 fill-white text-white ml-0.5" />
          )}
        </button>

        {/* Dynamic Waveform / Equalizer bars when playing */}
        {showWaveform && !compact && (
          <div className="hidden sm:flex items-center gap-0.5 h-6 shrink-0 px-1">
            {[35, 75, 45, 95, 60, 85, 40, 70, 50, 90, 65, 30].map((h, i) => (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-300 ${
                  isPlaying
                    ? 'bg-gradient-to-t from-sky-400 via-pink-500 to-orange-400 animate-pulse'
                    : 'bg-pink-300/70'
                }`}
                style={{
                  height: isPlaying ? `${Math.max(20, (h * (0.5 + Math.sin((currentTime * 4) + i) * 0.5)))}%` : `${h * 0.4}%`,
                  transitionDelay: `${i * 30}ms`
                }}
              />
            ))}
          </div>
        )}

        {/* Progress Slider & Timers */}
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <div className="relative w-full flex items-center group">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              disabled={duration === 0}
              aria-label="Перемотка аудио"
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-pink-200/70 accent-pink-500 relative z-10 focus:outline-none"
              style={{
                background: `linear-gradient(to right, #ec4899 0%, #f97316 ${progressPercent}%, rgba(244, 114, 182, 0.35) ${progressPercent}%, rgba(244, 114, 182, 0.35) 100%)`
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[14px] font-mono text-slate-700 font-semibold px-0.5 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume Mute Toggle */}
        <button
          type="button"
          onClick={toggleMute}
          title={isMuted ? 'Включить звук' : 'Выключить звук'}
          className="p-1.5 rounded-lg text-slate-600 hover:text-pink-600 hover:bg-white/60 transition-colors shrink-0 cursor-pointer"
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4 text-pink-500" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>

        {/* Delete option if compact or no title */}
        {!title && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            title="Удалить аудиозапись"
            className="p-1.5 rounded-lg text-slate-400 hover:text-pink-600 hover:bg-white/60 transition-colors shrink-0 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default GradientAudioPlayer;
