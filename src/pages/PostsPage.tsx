import React from 'react';
import PostMaker from '../components/PostMaker';
import ChannelList from '../components/ChannelList';
import CrosspostingHub from '../components/CrosspostingHub';
import { CampaignPost, SocialChannel } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Radio, Share2, Sparkles } from 'lucide-react';
import { GradientSelect } from '../components/ui-kit/GradientDropdown';

interface CombinedPostsPageProps {
  onPublishPost: (post: Omit<CampaignPost, 'id' | 'clicks' | 'views'>) => void;
  onDeletePost: (id: string) => void;
  onUpdatePost: (post: CampaignPost) => void;
  savedPosts: CampaignPost[];
  connectedChannels: SocialChannel[];
  tokens: number;
  onDeductTokens: (amount: number) => void;

  channels: SocialChannel[];
  onAddChannel: (channel: Omit<SocialChannel, 'id' | 'subscribers' | 'isPremium' | 'status'>) => boolean | string;
  onRemoveChannel: (id: string) => void;
  tariff: 'free' | 'pro' | 'vip';
  userBalance: number;
  onDeductBalanceRub?: (amount: number) => void;
  onBuySlot: (slotsCount: number) => void;

  currentPath: string;
  onNavigate: (path: string) => void;
}

export default function PostsPage({
  onPublishPost,
  onDeletePost,
  onUpdatePost,
  savedPosts,
  connectedChannels,
  tokens,
  onDeductTokens,
  channels,
  onAddChannel,
  onRemoveChannel,
  tariff,
  userBalance,
  onDeductBalanceRub,
  onBuySlot,
  currentPath,
  onNavigate
}: CombinedPostsPageProps) {
  const getTabFromPath = (path: string): 'channels' | 'crosspost' | 'redactor' | 'autogenerator' | 'rewright' => {
    if (path.includes('/crosspost')) return 'crosspost';
    if (path.includes('/redactor')) return 'redactor';
    if (path.includes('/autogenerator')) return 'autogenerator';
    if (path.includes('/rewright')) return 'rewright';
    return 'channels';
  };

  const activeTab = getTabFromPath(currentPath);

  const switchTab = (tab: 'channels' | 'crosspost' | 'redactor' | 'autogenerator' | 'rewright') => {
    onNavigate(`/posts/${tab}`);
  };

  let simulatedChannelPath = '/channels';
  const cleanPath = currentPath.replace('169262990', '');
  if (cleanPath.includes('/posts/channels/')) {
    simulatedChannelPath = cleanPath.substring(cleanPath.indexOf('/posts/channels/')).replace('/posts/channels/', '/channels/');
  } else if (cleanPath.includes('/posts/id')) {
    simulatedChannelPath = cleanPath.substring(cleanPath.indexOf('/posts/id')).replace('/posts/', '/channels/');
  } else if (
    cleanPath.includes('/posts/telegram') ||
    cleanPath.includes('/posts/vk') ||
    cleanPath.includes('/posts/max') ||
    cleanPath.includes('/posts/instagram') ||
    cleanPath.includes('/posts/facebook') ||
    cleanPath.includes('/posts/x') ||
    cleanPath.includes('/posts/tiktok') ||
    cleanPath.includes('/posts/pinterest') ||
    cleanPath.includes('/posts/linkedin') ||
    cleanPath.includes('/posts/discord') ||
    cleanPath.includes('/posts/ok') ||
    cleanPath.includes('/posts/tenchat') ||
    cleanPath.includes('/posts/dzen') ||
    cleanPath.includes('/posts/setka')
  ) {
    const platformSegment = cleanPath.split('/posts/').pop() || '';
    simulatedChannelPath = `/channels/${platformSegment}`;
  }

  const handleAdaptedNavigate = (path: string) => {
    let target = path;
    if (path.startsWith('/channels/')) {
      target = path.replace('/channels/', '/posts/channels/');
    } else if (path === '/channels') {
      target = '/posts/channels';
    }
    onNavigate(target);
  };

  const tabItems = [
    { key: 'channels', label: 'Каналы', icon: <Radio className="w-4 h-4" /> },
    { key: 'crosspost', label: 'Кросспостинг', icon: <Share2 className="w-4 h-4" /> },
    { key: 'redactor', label: 'Редактор', icon: <FileText className="w-4 h-4" /> },
    { key: 'autogenerator', label: 'Автогенератор', icon: <Sparkles className="w-4 h-4" /> },
    { key: 'rewright', label: 'Нейрорерайтер', icon: <Sparkles className="w-4 h-4" /> }
  ] as const;

  return (
    <div className="space-y-6 min-w-0">
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm">
        <div className="rounded-[22.5px] flex flex-col lg:flex-row justify-between items-start lg:items-center p-4 sm:p-5 bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="text-[18px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent flex items-center gap-2 break-words">
              {activeTab === 'channels' ? (
                <Radio className="w-5 h-5 text-pink-600 shrink-0" />
              ) : activeTab === 'crosspost' ? (
                <Share2 className="w-5 h-5 text-pink-600 shrink-0" />
              ) : activeTab === 'redactor' ? (
                <FileText className="w-5 h-5 text-pink-600 shrink-0" />
              ) : (
                <Sparkles className="w-5 h-5 text-pink-600 shrink-0" />
              )}
              <span>
                {activeTab === 'channels'
                  ? 'Мои каналы и лимиты'
                  : activeTab === 'crosspost'
                  ? 'Центр кросспостинга'
                  : activeTab === 'redactor'
                  ? 'Ручной редактор публикаций'
                  : activeTab === 'autogenerator'
                  ? 'Автогенератор публикаций'
                  : 'Рерайт в стиле автора'}
              </span>
            </h2>
            <p className="text-[14px] text-slate-700 leading-snug font-medium break-words">
              {activeTab === 'channels'
                ? 'Управление площадками, расширение слотов и аналитика охватов'
                : activeTab === 'crosspost'
                ? 'Адаптация единого поста под форматы социальных площадок в один клик'
                : activeTab === 'redactor'
                ? 'Создавайте публикации вручную с поддержкой медиафайлов и инлайн-кнопок'
                : activeTab === 'autogenerator'
                ? 'Сгенерируйте готовый к публикации контент с помощью нейросети'
                : 'Превратите любой текст или внешнюю ссылку в уникальный авторский пост'}
            </p>
          </div>

          <div className="w-full lg:hidden">
            <GradientSelect
              value={activeTab}
              onChange={(val) => switchTab(val as any)}
              options={tabItems.map((t) => ({ value: t.key, label: t.label, icon: t.icon }))}
              buttonVariant="vivid"
            />
          </div>

          <div className="hidden lg:flex flex-wrap gap-1.5 p-1.5 bg-white/75 rounded-2xl shrink-0 border border-pink-300/70">
            {tabItems.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  id={`tab-select-${item.key}-mode`}
                  key={item.key}
                  onClick={() => switchTab(item.key)}
                  className={`px-3.5 py-2 text-[14px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shadow-sm'
                      : 'text-slate-800 hover:bg-white/80'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.18 }}
        >
          {['redactor', 'autogenerator', 'rewright'].includes(activeTab) ? (
            <PostMaker
              onPublishPost={onPublishPost}
              onDeletePost={onDeletePost}
              onUpdatePost={onUpdatePost}
              savedPosts={savedPosts}
              connectedChannels={connectedChannels}
              tokens={tokens}
              onDeductTokens={onDeductTokens}
              onAddChannel={onAddChannel}
              activeMode={activeTab === 'redactor' ? 'write' : activeTab === 'autogenerator' ? 'ai' : 'rewrite'}
              onModeChange={(mode) => {
                const sub = mode === 'write' ? 'redactor' : mode === 'ai' ? 'autogenerator' : 'rewright';
                onNavigate(`/posts/${sub}`);
              }}
            />
          ) : activeTab === 'crosspost' ? (
            <CrosspostingHub
              onPublishPost={onPublishPost}
              savedPosts={savedPosts}
              connectedChannels={channels.filter((c) => c.status === 'connected')}
              tokens={tokens}
              onDeductTokens={onDeductTokens}
              userBalance={userBalance}
              onDeductBalanceRub={onDeductBalanceRub}
            />
          ) : (
            <ChannelList
              channels={channels}
              onAddChannel={onAddChannel}
              onRemoveChannel={onRemoveChannel}
              tariff={tariff}
              userBalance={userBalance}
              onBuySlot={onBuySlot}
              currentPath={simulatedChannelPath}
              onNavigate={handleAdaptedNavigate}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
