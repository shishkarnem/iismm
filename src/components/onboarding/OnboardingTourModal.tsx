import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  X,
  Check,
  Trophy,
  Compass
} from 'lucide-react';
import { Channel, DayRequest, UserAccount } from '../../types';
import {
  OnboardingStateRecord,
  OnboardingAccountInfo,
  ONBOARDING_TARIFF_CARDS
} from './onboardingTypes';
import { OnboardingStep1Account } from './OnboardingStep1Account';
import { OnboardingStep2Channel } from './OnboardingStep2Channel';
import { OnboardingStep3Post } from './OnboardingStep3Post';
import { OnboardingStep4ScenarioRunner } from '../onboarding-preview/OnboardingStep4ScenarioRunner';
import { GradientSelect } from '../ui-kit/GradientDropdown';

export interface OnboardingTourBannerProps {
  userId: string;
  channelsCount?: number;
  postsCount?: number;
  onOpenTour: () => void;
  onCompletionChange?: (completed: boolean) => void;
}

export const OnboardingTourBanner: React.FC<OnboardingTourBannerProps> = ({
  userId,
  channelsCount = 0,
  postsCount = 0,
  onOpenTour,
  onCompletionChange
}) => {
  const [tourState, setTourState] = useState<OnboardingStateRecord | null>(null);
  const [accountInfo, setAccountInfo] = useState<OnboardingAccountInfo | null>(null);
  const [hiddenLocally, setHiddenLocally] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/onboarding/state?userId=${encodeURIComponent(userId)}`, {
      headers: { 'x-user-id': userId }
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.state) {
          setTourState(d.state);
          if (d.account) setAccountInfo(d.account);
        }
      })
      .catch(() => null);
  }, [userId, channelsCount, postsCount]);

  const effectiveStep1 = Boolean(
    tourState?.step1Done || accountInfo?.hasEmail || accountInfo?.hasTelegram || userId
  );
  const effectiveStep2 = Boolean(
    tourState?.step2Done || (accountInfo?.channelsCount ?? 0) > 0 || channelsCount > 0
  );
  const effectiveStep3 = Boolean(
    tourState?.step3Done ||
      Boolean(tourState?.createdPostId) ||
      (accountInfo?.postsCount ?? 0) > 0 ||
      postsCount > 0
  );
  const effectiveStep4 = Boolean(
    tourState?.step4Done ||
      Boolean(tourState?.createdScenarioId) ||
      (accountInfo?.scenariosCount ?? 0) > 0
  );

  const doneCount = [
    effectiveStep1,
    effectiveStep2,
    effectiveStep3,
    effectiveStep4
  ].filter(Boolean).length;

  const isAllCompleted = Boolean(tourState?.tourCompleted || doneCount >= 4);

  useEffect(() => {
    if (tourState) {
      onCompletionChange?.(isAllCompleted);
    }
  }, [isAllCompleted, onCompletionChange, tourState]);

  if (hiddenLocally || !tourState || isAllCompleted || tourState.dismissed) {
    return null;
  }

  const handleDismiss = async () => {
    setHiddenLocally(true);
    try {
      await fetch('/api/onboarding/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ userId, dismissed: true })
      });
    } catch {}
  };

  return (
    <div className="mb-4 p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-xs min-w-0">
      <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-md px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-extrabold text-slate-900 break-words">
              Быстрый вводный тур за 4 шага ({doneCount} из 4 выполнено)
            </div>
            <div className="text-[14px] text-slate-700 font-medium break-words">
              Получите +300 Иирок, оформите канал, протестируйте пост и запустите автосценарий
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={onOpenTour}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{doneCount > 0 ? 'Продолжить настройку' : 'Начать за 4 шага'}</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="px-3 py-2 rounded-2xl bg-white/85 hover:bg-white border border-pink-300 text-slate-700 text-[14px] font-bold cursor-pointer"
            title="Скрыть подсказку"
          >
            Позже
          </button>
        </div>
      </div>
    </div>
  );
};

export interface OnboardingTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAccount;
  channels: Channel[];
  onAddDayRequest: (req: Omit<DayRequest, 'id'>) => Promise<DayRequest | any>;
  onNavigate: (path: string) => void;
  onSelectPostId: (id: string | null) => void;
  onRefreshAll: () => Promise<void>;
  onCompletionChange?: (completed: boolean) => void;
}

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({
  isOpen,
  onClose,
  user,
  channels,
  onAddDayRequest,
  onNavigate,
  onSelectPostId,
  onRefreshAll,
  onCompletionChange
}) => {
  const userId = user?.id || '16926299042';
  const [activeStep, setActiveStep] = useState<number>(1);
  const [stateRecord, setStateRecord] = useState<OnboardingStateRecord | null>(null);
  const [accountInfo, setAccountInfo] = useState<OnboardingAccountInfo | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [scenarioSavedId, setScenarioSavedId] = useState<string>('');

  const fetchOnboardingStatus = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/onboarding/state?userId=${encodeURIComponent(userId)}`, {
        headers: { 'x-user-id': userId }
      });
      const data = await res.json();
      if (data?.success) {
        setStateRecord(data.state);
        setAccountInfo(data.account);
        if (data.state?.selectedChannelId) {
          setSelectedChannelId(data.state.selectedChannelId);
        }
        if (data.state?.createdScenarioId) {
          setScenarioSavedId(data.state.createdScenarioId);
        }
        const s1 = Boolean(data.state?.step1Done || data.account?.hasEmail || data.account?.hasTelegram);
        const s2 = Boolean(data.state?.step2Done || (data.account?.channelsCount ?? 0) > 0 || channels.length > 0);
        const s3 = Boolean(data.state?.step3Done || data.state?.createdPostId || (data.account?.postsCount ?? 0) > 0);
        const s4 = Boolean(data.state?.step4Done || data.state?.createdScenarioId || (data.account?.scenariosCount ?? 0) > 0);
        onCompletionChange?.(Boolean(data.state?.tourCompleted || (s1 && s2 && s3 && s4)));
      }
    } catch {}
  }, [userId, channels.length, onCompletionChange]);

  useEffect(() => {
    if (isOpen) {
      fetchOnboardingStatus().then(() => {});
    }
  }, [isOpen, fetchOnboardingStatus]);

  useEffect(() => {
    if (isOpen && stateRecord && activeStep === 1 && stateRecord.currentStep > 1) {
      setActiveStep(stateRecord.currentStep);
    }
  }, [isOpen, stateRecord?.userId]);

  const persistProgress = async (patch: Partial<OnboardingStateRecord>) => {
    try {
      const res = await fetch('/api/onboarding/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ userId, ...patch })
      });
      const data = await res.json();
      if (data?.success) {
        setStateRecord(data.state);
        setAccountInfo(data.account);
        onCompletionChange?.(Boolean(data.state?.tourCompleted));
      }
    } catch {}
  };

  if (!isOpen) return null;

  const resolvedTelegramId = accountInfo?.telegramId || user?.telegramId;

  const step1Done = Boolean(
    stateRecord?.step1Done ||
      accountInfo?.hasEmail ||
      accountInfo?.hasTelegram ||
      user?.email ||
      user?.telegramId
  );
  const step2Done = Boolean(
    stateRecord?.step2Done || (accountInfo?.channelsCount ?? 0) > 0 || channels.length > 0
  );
  const step3Done = Boolean(
    stateRecord?.step3Done ||
      Boolean(stateRecord?.createdPostId) ||
      (accountInfo?.postsCount ?? 0) > 0
  );
  const step4Done = Boolean(
    stateRecord?.step4Done ||
      Boolean(stateRecord?.createdScenarioId) ||
      (accountInfo?.scenariosCount ?? 0) > 0
  );
  const allFourCompleted = step1Done && step2Done && step3Done && step4Done;

  const stepItems = [
    { num: 1, title: '1. Аккаунт и +300', done: step1Done },
    { num: 2, title: '2. Свой канал', done: step2Done },
    { num: 3, title: '3. Пост и тест', done: step3Done },
    { num: 4, title: '4. Автосценарий', done: step4Done },
    { num: 5, title: 'Возможности тарифов', done: Boolean(stateRecord?.tourCompleted || allFourCompleted) }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-gradient-to-br from-sky-200/50 via-pink-200/50 via-orange-200/50 via-pink-200/50 to-sky-200/50 backdrop-blur-sm overflow-y-auto">
      <div className="my-auto w-full max-w-4xl p-[2px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-2xl min-w-0">
        <div className="rounded-[22px] bg-gradient-to-br from-sky-100/92 via-pink-100/92 via-orange-100/92 via-pink-100/92 to-sky-100/92 backdrop-blur-xl p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-pink-300/80 pb-3.5 min-w-0">
            <div className="min-w-0">
              <h2 className="text-[18px] sm:text-[20px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent break-words">
                Мастер быстрой настройки и проверки за 4 шага
              </h2>
              <p className="text-[14px] text-slate-700 font-medium break-words">
                Настройте аккаунт, подключите и оформите канал, протестируйте пост с предпоказом и сразу запустите автосценарий
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-2xl bg-white/90 hover:bg-white border border-pink-300 text-slate-800 text-[14px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4 text-pink-600" />
              <span>Закрыть</span>
            </button>
          </div>

          {/* Mobile Step Selector (No horizontal scrolling on mobile!) */}
          <div className="sm:hidden min-w-0">
            <GradientSelect
              label="Выберите шаг вводного тура"
              value={String(activeStep)}
              onChange={(val) => setActiveStep(Number(val) || 1)}
              options={stepItems.map((s) => ({
                value: String(s.num),
                label: `${s.title}${s.done ? ' ✓' : ''}`
              }))}
            />
          </div>

          {/* Desktop 5-Column Stepper */}
          <div className="hidden sm:grid sm:grid-cols-5 gap-2 min-w-0">
            {stepItems.map((step) => {
              const isCurrent = activeStep === step.num;
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => setActiveStep(step.num)}
                  className={`p-2.5 rounded-2xl text-left text-[14px] font-extrabold transition-all cursor-pointer border flex items-center justify-between gap-1.5 min-w-0 ${
                    isCurrent
                      ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white border-pink-400 shadow-sm'
                      : 'bg-white/80 hover:bg-white text-slate-800 border-pink-300/80'
                  }`}
                >
                  <span className="truncate">{step.title}</span>
                  {step.done && (
                    <Check
                      className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-white' : 'text-pink-600'}`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Step 1 */}
          {activeStep === 1 && (
            <OnboardingStep1Account
              userId={userId}
              account={accountInfo}
              onRefreshAccount={async () => {
                await fetchOnboardingStatus();
                await onRefreshAll();
              }}
              onCompletedStep1={async () => {
                await persistProgress({ step1Done: true, currentStep: 2 });
                setActiveStep(2);
              }}
            />
          )}

          {/* Step 2 */}
          {activeStep === 2 && (
            <OnboardingStep2Channel
              userId={userId}
              telegramId={resolvedTelegramId}
              channels={channels}
              selectedChannelId={selectedChannelId}
              onSelectChannelId={(id) => setSelectedChannelId(id)}
              onRefresh={async () => {
                await onRefreshAll();
                await fetchOnboardingStatus();
              }}
              onCompletedStep2={async (chId) => {
                if (chId) setSelectedChannelId(chId);
                await persistProgress({
                  step2Done: true,
                  currentStep: 3,
                  ...(chId ? { selectedChannelId: chId } : {})
                });
                setActiveStep(3);
              }}
            />
          )}

          {/* Step 3 */}
          {activeStep === 3 && (
            <OnboardingStep3Post
              userId={userId}
              telegramId={resolvedTelegramId}
              channels={channels}
              selectedChannelId={selectedChannelId}
              onAddDayRequest={onAddDayRequest}
              onOpenPostConstructor={(postId) => {
                persistProgress({ step3Done: true, createdPostId: postId, currentStep: 4 });
                onClose();
                onSelectPostId(postId);
                onNavigate(`/posts/${postId}`);
              }}
              onCompletedStep3={async (postId) => {
                await persistProgress({
                  step3Done: true,
                  currentStep: 4,
                  ...(postId ? { createdPostId: postId } : {})
                });
                await onRefreshAll();
                setActiveStep(4);
              }}
            />
          )}

          {/* Step 4: Instant Scenario Template Creation + Live Test Run + Formatted Result Preview */}
          {activeStep === 4 && (
            <OnboardingStep4ScenarioRunner
              userId={userId}
              telegramId={resolvedTelegramId}
              channels={channels}
              selectedChannelId={selectedChannelId}
              initialScenarioId={scenarioSavedId}
              onScenarioTested={async (scenId) => {
                setScenarioSavedId(scenId);
                await persistProgress({
                  step4Done: true,
                  createdScenarioId: scenId
                });
                await onRefreshAll();
              }}
              onOpenVisualBuilder={async (scenId) => {
                setScenarioSavedId(scenId);
                await persistProgress({
                  step4Done: true,
                  currentStep: 5,
                  createdScenarioId: scenId
                });
                await onRefreshAll();
                onClose();
                onNavigate('/scenarios');
              }}
              onContinueToFinal={async (scenId) => {
                setScenarioSavedId(scenId);
                await persistProgress({
                  step4Done: true,
                  currentStep: 5,
                  createdScenarioId: scenId
                });
                await onRefreshAll();
                setActiveStep(5);
              }}
            />
          )}

          {/* Final Screen (Step 5): What Tariffs Give + CTA to /tarif */}
          {activeStep === 5 && (
            <div className="space-y-4 min-w-0">
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 border border-pink-300 space-y-2 min-w-0">
                <div className="flex items-center gap-2.5">
                  <Trophy className="w-6 h-6 text-pink-600 shrink-0" />
                  <h3 className="text-[17px] font-extrabold text-slate-900 break-words">
                    Система готова к работе! Посмотрите, какие возможности открывают тарифы
                  </h3>
                </div>
                <p className="text-[14px] text-slate-700 font-medium break-words">
                  Ваш текущий тариф: <strong>{accountInfo?.tariff || user?.tariff || 'Старт'}</strong> · Баланс:{' '}
                  <strong>{accountInfo?.balance ?? user?.balance ?? 300} Иирок</strong>. Вы уже можете вести канал, а при росте проекта подключить расширенный тариф:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 min-w-0">
                {ONBOARDING_TARIFF_CARDS.map((card) => (
                  <div
                    key={card.name}
                    className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 min-w-0"
                  >
                    <div className="h-full rounded-[22.5px] bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 p-4 flex flex-col justify-between gap-2.5 min-w-0">
                      <div className="space-y-2 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[16px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent">
                            Тариф «{card.name}»
                          </span>
                          <span className="px-2.5 py-0.5 rounded-xl bg-white/90 border border-pink-300 text-pink-700 text-[14px] font-bold">
                            {card.priceLabel}
                          </span>
                        </div>
                        <p className="text-[14px] font-bold text-slate-800 break-words">
                          {card.highlight}
                        </p>
                        <ul className="space-y-1.5 text-[14px] text-slate-700 font-medium">
                          {card.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Check className="w-4 h-4 text-pink-600 shrink-0 mt-0.5" />
                              <span className="break-words">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-pink-300/70">
                <button
                  type="button"
                  onClick={async () => {
                    await persistProgress({ tourCompleted: true, dismissed: true });
                    onClose();
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-white/90 hover:bg-white border border-pink-300 text-slate-800 text-[14px] font-extrabold cursor-pointer"
                >
                  Завершить вводный тур
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await persistProgress({ tourCompleted: true });
                    onClose();
                    onNavigate('/tarif');
                  }}
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white text-[14px] font-extrabold flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Trophy className="w-4 h-4 shrink-0" />
                  <span>Перейти на страницу тарифов</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
