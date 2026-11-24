import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Star,
  Sparkles,
  ShieldCheck,
  MessageSquareReply,
  RefreshCw,
  X
} from 'lucide-react';
import GradientAudioPlayer from '../GradientAudioPlayer';

export interface LandingReviewCardItem {
  id?: string;
  name: string;
  rating: number;
  text: string;
  role?: string;
  avatar?: string;
  audio_url?: string;
  audioUrl?: string;
  created_at?: string;
  date?: string;
  ai_reply?: string | null;
  ai_replied_at?: string | null;
  admin_reply?: string | null;
  admin_replied_at?: string | null;
}

interface Reviews3DCarouselProps {
  reviews: LandingReviewCardItem[];
  onAddReviewClick: () => void;
  isAdmin?: boolean;
  adminUserId?: string;
  onReviewUpdated?: (updated: LandingReviewCardItem) => void;
}

export function formatReviewDateRu(dateStr?: string): string {
  if (!dateStr) return '19 октября 2026';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function TypewrittenQuote({ text, isActive }: { text: string; isActive: boolean }) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    if (!isActive) {
      setDisplayed(text);
      return;
    }
    setDisplayed('');
    let index = 0;
    const interval = setInterval(() => {
      index += 2;
      setDisplayed(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(interval);
      }
    }, 12);
    return () => clearInterval(interval);
  }, [text, isActive]);

  return <span>{displayed}</span>;
}

function ActionStars({ rating, isActive }: { rating: number; isActive: boolean }) {
  const [filledCount, setFilledCount] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setFilledCount(rating);
      return;
    }
    setFilledCount(0);
    let current = 0;
    const interval = setInterval(() => {
      current++;
      setFilledCount(current);
      if (current >= rating) {
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [rating, isActive]);

  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, rIdx) => {
        const isFilled = rIdx < filledCount;
        return (
          <motion.div
            key={rIdx}
            animate={isFilled && isActive ? { scale: [1, 1.25, 1] } : { scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <Star
              className={`w-4 h-4 shrink-0 transition-colors duration-300 ${
                isFilled ? 'text-orange-500 fill-orange-400' : 'text-pink-200 fill-white/60'
              }`}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

export default function Reviews3DCarousel({
  reviews,
  onAddReviewClick,
  isAdmin = false,
  adminUserId = '',
  onReviewUpdated
}: Reviews3DCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  const [radius, setRadius] = useState(430);
  const [isMobile, setIsMobile] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Admin reply modal states
  const [editingReview, setEditingReview] = useState<LandingReviewCardItem | null>(null);
  const [adminReplyDraft, setAdminReplyDraft] = useState('');
  const [aiReplyDraft, setAiReplyDraft] = useState('');
  const [savingReply, setSavingReply] = useState(false);
  const [regeneratingAi, setRegeneratingAi] = useState(false);
  const [replyError, setReplyError] = useState('');

  useEffect(() => {
    if (activeIndex >= reviews.length && reviews.length > 0) {
      setActiveIndex(0);
    }
  }, [reviews.length, activeIndex]);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setIsMobile(w < 520);
      if (w < 485) {
        setRadius(190);
      } else if (w < 768) {
        setRadius(270);
      } else if (w < 1024) {
        setRadius(350);
      } else {
        setRadius(430);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let intervalId: number;
    const AUTO_PLAY_DURATION = 11000;
    const PROGRESS_STEP_MS = 40;

    if (isPlaying && !editingReview && reviews.length > 1) {
      const startTime = Date.now();
      intervalId = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min((elapsed / AUTO_PLAY_DURATION) * 100, 100);
        setProgress(pct);

        if (pct >= 100) {
          setActiveIndex((prev) => (prev + 1) % reviews.length);
          setProgress(0);
        }
      }, PROGRESS_STEP_MS);
    } else {
      setProgress(0);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying, activeIndex, reviews.length, editingReview]);

  const handleNext = () => {
    if (reviews.length === 0) return;
    setActiveIndex((prev) => (prev + 1) % reviews.length);
  };

  const handlePrev = () => {
    if (reviews.length === 0) return;
    setActiveIndex((prev) => (prev === 0 ? reviews.length - 1 : prev - 1));
  };

  const swipeStartX = useRef<number | null>(null);
  const swipeEndX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeEndX.current = e.touches[0].clientX;
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    swipeEndX.current = e.touches[0].clientX;
    if (swipeStartX.current !== null) {
      setDragOffset(e.touches[0].clientX - swipeStartX.current);
    }
  };

  const handleTouchEnd = () => {
    if (swipeStartX.current === null || swipeEndX.current === null) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }
    const diff = swipeStartX.current - swipeEndX.current;
    if (diff > 50) handleNext();
    else if (diff < -50) handlePrev();
    swipeStartX.current = null;
    swipeEndX.current = null;
    setIsDragging(false);
    setDragOffset(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    swipeStartX.current = e.clientX;
    swipeEndX.current = e.clientX;
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (swipeStartX.current !== null) {
      swipeEndX.current = e.clientX;
      setDragOffset(e.clientX - swipeStartX.current);
    }
  };

  const handleMouseUp = () => {
    if (swipeStartX.current === null || swipeEndX.current === null) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }
    const diff = swipeStartX.current - swipeEndX.current;
    if (diff > 50) handleNext();
    else if (diff < -50) handlePrev();
    swipeStartX.current = null;
    swipeEndX.current = null;
    setIsDragging(false);
    setDragOffset(0);
  };

  const openReplyEditor = (rev: LandingReviewCardItem) => {
    setEditingReview(rev);
    setAdminReplyDraft(rev.admin_reply || '');
    setAiReplyDraft(rev.ai_reply || '');
    setReplyError('');
  };

  const handleSaveAdminReply = async (regenerateAi = false) => {
    if (!editingReview?.id) return;
    if (regenerateAi) setRegeneratingAi(true);
    else setSavingReply(true);
    setReplyError('');

    try {
      const res = await fetch(`/api/landing/reviews/${encodeURIComponent(editingReview.id)}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminUserId ? { 'x-user-id': adminUserId } : {})
        },
        body: JSON.stringify({
          adminReply: adminReplyDraft,
          aiReply: regenerateAi ? undefined : aiReplyDraft,
          regenerateAi
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setReplyError(data.error || 'Не удалось сохранить ответ на отзыв');
        return;
      }
      if (data.review) {
        setEditingReview(data.review);
        setAdminReplyDraft(data.review.admin_reply || '');
        setAiReplyDraft(data.review.ai_reply || '');
        if (onReviewUpdated) onReviewUpdated(data.review);
      }
      if (!regenerateAi) {
        setEditingReview(null);
      }
    } catch {
      setReplyError('Ошибка соединения с сервером');
    } finally {
      setSavingReply(false);
      setRegeneratingAi(false);
    }
  };

  const angleStep = 360 / Math.max(reviews.length, 1);

  return (
    <div
      className="relative w-full py-6 select-none overflow-visible flex flex-col items-center cursor-grab active:cursor-grabbing px-[2%] sm:px-0"
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Left Navigation Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handlePrev();
        }}
        className="absolute left-0 sm:left-[2%] lg:left-[6%] top-[210px] z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white hover:opacity-95 active:scale-95 transition-all shadow-md flex items-center justify-center cursor-pointer select-none border border-pink-300"
        aria-label="Предыдущий отзыв"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Right Navigation Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleNext();
        }}
        className="absolute right-0 sm:right-[2%] lg:right-[6%] top-[210px] z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white hover:opacity-95 active:scale-95 transition-all shadow-md flex items-center justify-center cursor-pointer select-none border border-pink-300"
        aria-label="Следующий отзыв"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* 3D Orbit Stage */}
      <div
        className="relative overflow-visible flex items-center justify-center w-[94%] max-w-[400px] sm:max-w-[430px] h-[495px] sm:h-[480px]"
        style={{ perspective: '1650px' }}
      >
        <div
          className="absolute inset-0 transition-transform duration-700"
          style={{
            transformStyle: 'preserve-3d',
            transform: `translateZ(-${radius}px) rotateY(${-activeIndex * angleStep}deg)`,
            width: '100%',
            height: '100%'
          }}
        >
          {reviews.map((rev, idx) => {
            const isActive = idx === activeIndex;
            const angle = idx * angleStep;
            const diff = Math.min(
              Math.abs(idx - activeIndex),
              reviews.length - Math.abs(idx - activeIndex)
            );

            let cardOpacity = 0;
            let scaleVal = 0.82;
            let pointerEventsStyle: 'auto' | 'none' = 'none';

            if (diff === 0) {
              cardOpacity = 1;
              scaleVal = 1.0;
              pointerEventsStyle = 'auto';
            } else if (diff === 1 || reviews.length === 2) {
              cardOpacity = isMobile ? 0.14 : 0.38;
              scaleVal = isMobile ? 0.68 : 0.85;
              pointerEventsStyle = 'auto';
            } else if (diff === 2) {
              cardOpacity = 0.05;
              scaleVal = 0.72;
            }

            const dragX = isActive ? dragOffset * 0.45 : 0;
            const dragRotate = isActive ? dragOffset * 0.02 : 0;
            const transitionStyle =
              isActive && isDragging
                ? 'opacity 0.4s ease'
                : 'transform 0.55s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.45s ease';

            const handleCardClick = (e: React.MouseEvent) => {
              if (!isActive && (diff === 1 || reviews.length === 2)) {
                e.stopPropagation();
                setActiveIndex(idx);
              }
            };

            return (
              <div
                key={rev.id || idx}
                onClick={handleCardClick}
                className="absolute inset-0 w-full h-full overflow-visible select-none"
                style={{
                  transform: `rotateY(${angle}deg) translateZ(${isActive ? radius : radius - 140}px) scale(${scaleVal}) translateX(${dragX}px) rotate(${dragRotate}deg)`,
                  backfaceVisibility: 'hidden',
                  opacity: cardOpacity,
                  visibility: diff > 1 ? 'hidden' : 'visible',
                  pointerEvents: pointerEventsStyle,
                  zIndex: isActive ? 41 : diff === 1 ? 21 : 11,
                  transition: transitionStyle
                }}
              >
                <div className="h-full rounded-3xl p-[1.5px] bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-xl">
                  <div className="h-full rounded-[22.5px] bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-xl p-4 sm:p-5 flex flex-col justify-between gap-2.5 text-left min-w-0 overflow-hidden">
                    {/* Top Row: Stars + Autoplay Button */}
                    <div className="flex justify-between items-center gap-2 shrink-0">
                      <ActionStars rating={rev.rating || 5} isActive={isActive} />

                      {isActive ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsPlaying(!isPlaying);
                          }}
                          className="relative overflow-hidden px-3 py-1 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 rounded-xl text-[14px] font-bold text-white shadow-2xs cursor-pointer transition-all pointer-events-auto"
                        >
                          {isPlaying && (
                            <div
                              className="absolute left-0 top-0 bottom-0 bg-white/25 pointer-events-none"
                              style={{ width: `${progress}%`, transition: 'width 40ms linear' }}
                            />
                          )}
                          <span className="relative z-10 flex items-center gap-1.5">
                            {isPlaying ? (
                              <>
                                <Pause className="w-3.5 h-3.5 text-white fill-white shrink-0" />
                                <span>Пауза</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 text-white fill-white shrink-0" />
                                <span>Пуск</span>
                              </>
                            )}
                          </span>
                        </button>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white text-[14px] font-bold">
                          Отзыв
                        </span>
                      )}
                    </div>

                    {/* Author + Date */}
                    <div className="flex items-start justify-between gap-2 border-b border-pink-300/70 pb-2 shrink-0 min-w-0">
                      <div className="min-w-0">
                        <h5 className="font-extrabold text-slate-900 text-[15px] leading-snug break-words">
                          {rev.name}
                        </h5>
                        <span className="text-[14px] text-slate-700 font-medium block">
                          {formatReviewDateRu(rev.created_at || rev.date)}
                        </span>
                      </div>
                      {isAdmin && isActive && rev.id && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openReplyEditor(rev);
                          }}
                          className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                        >
                          <MessageSquareReply className="w-3.5 h-3.5 shrink-0" />
                          <span>Ответить</span>
                        </button>
                      )}
                    </div>

                    {/* Scrollable Review + AI Reply + Admin Reply Content */}
                    <div
                      className="flex-1 overflow-y-auto pr-1 space-y-2.5 scrollbar-thin min-w-0 pointer-events-auto"
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      <div className="text-slate-900 font-semibold text-[14px] leading-relaxed italic break-words">
                        «<TypewrittenQuote text={rev.text} isActive={isActive} />»
                      </div>

                      {(rev.audio_url || rev.audioUrl) && (
                        <div className="pt-1 w-full">
                          <GradientAudioPlayer
                            src={(rev.audio_url || rev.audioUrl) as string}
                            title="Голосовой отзыв"
                            compact
                            showWaveform={false}
                          />
                        </div>
                      )}

                      {/* Automatic AI Reply */}
                      {rev.ai_reply && (
                        <div className="rounded-2xl p-3 border border-sky-300 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 space-y-1">
                          <div className="flex items-center gap-1.5 font-extrabold text-[14px] bg-gradient-to-r from-sky-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
                            <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
                            <span>Ответ ИИ-ассистента платформы</span>
                          </div>
                          <p className="text-[14px] text-slate-800 font-medium leading-snug break-words">
                            {rev.ai_reply}
                          </p>
                        </div>
                      )}

                      {/* Official Admin Reply */}
                      {rev.admin_reply && (
                        <div className="rounded-2xl p-3 border border-pink-400 bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 space-y-1">
                          <div className="flex items-center gap-1.5 font-extrabold text-[14px] bg-gradient-to-r from-pink-600 via-orange-500 to-sky-600 bg-clip-text text-transparent">
                            <ShieldCheck className="w-4 h-4 text-pink-600 shrink-0" />
                            <span>Ответ администратора ИИSMM</span>
                          </div>
                          <p className="text-[14px] text-slate-900 font-medium leading-snug break-words">
                            {rev.admin_reply}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Slide Dot Indicators */}
      <div className="flex flex-wrap justify-center items-center gap-2 mt-5 pb-1">
        {reviews.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveIndex(idx)}
            className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
              idx === activeIndex
                ? 'w-7 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-2xs'
                : 'w-2.5 bg-pink-200 hover:bg-pink-300'
            }`}
            aria-label={`Перейти к отзыву ${idx + 1}`}
          />
        ))}
      </div>

      {/* Leave Review Button */}
      <button
        type="button"
        onClick={onAddReviewClick}
        className="mt-5 px-7 py-3 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-extrabold rounded-2xl shadow-md border border-pink-300 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
      >
        Оставить отзыв ✍️
      </button>

      {/* Admin Reply Editor Modal */}
      <AnimatePresence>
        {editingReview && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-[2vw] py-3 sm:p-4 bg-gradient-to-br from-sky-200/45 via-pink-200/45 to-orange-200/45 backdrop-blur-md cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="w-full max-w-lg rounded-3xl p-5 sm:p-6 border-2 border-pink-400 bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 backdrop-blur-xl shadow-2xl space-y-4 text-left max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between gap-2 border-b border-pink-300 pb-3">
                <h4 className="font-extrabold text-[16px] bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent">
                  Ответы на отзыв ({editingReview.name})
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingReview(null)}
                  className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl border border-pink-300 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 text-[14px] text-slate-800 italic">
                «{editingReview.text}»
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-[14px] font-bold text-slate-900">
                    Ответ ИИ-ассистента:
                  </label>
                  <button
                    type="button"
                    disabled={regeneratingAi}
                    onClick={() => handleSaveAdminReply(true)}
                    className="px-3 py-1 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${regeneratingAi ? 'animate-spin' : ''}`} />
                    <span>{regeneratingAi ? 'Генерация...' : 'Сгенерировать заново'}</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={aiReplyDraft}
                  onChange={(e) => setAiReplyDraft(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-pink-300 bg-white/80 text-[14px] text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-pink-400"
                  placeholder="Текст автоматического ответа от ИИ..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[14px] font-bold text-slate-900 block">
                  Ответ администратора платформы:
                </label>
                <textarea
                  rows={3}
                  value={adminReplyDraft}
                  onChange={(e) => setAdminReplyDraft(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-pink-300 bg-white/80 text-[14px] text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-pink-400"
                  placeholder="Напишите официальный ответ от администратора..."
                />
              </div>

              {replyError && (
                <div className="p-3 rounded-2xl border border-pink-400 bg-gradient-to-r from-sky-100/80 via-pink-100/80 to-orange-100/80 text-slate-900 text-[14px] font-bold">
                  {replyError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingReview(null)}
                  className="flex-1 py-2.5 px-4 rounded-2xl border border-pink-300 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 text-slate-900 font-bold text-[14px] cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={savingReply}
                  onClick={() => handleSaveAdminReply(false)}
                  className="flex-1 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-extrabold text-[14px] cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {savingReply ? 'Сохранение...' : 'Сохранить ответы'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
