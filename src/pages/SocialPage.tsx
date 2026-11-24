import React, { useState, useEffect } from 'react';
import IirkySocialNetwork from '../components/IirkySocialNetwork';
import ProfileHeader from '../components/ProfileHeader';
import { UserAccount } from '../types';
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from '../constants/proTalkStorage';

interface SocialPageProps {
  user: UserAccount;
  onUpdateUser: (updated: UserAccount) => void;
  currentPath?: string;
  onLogout?: () => void;
  onAvatarFileUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function SocialPage({ 
  user, 
  onUpdateUser, 
  currentPath = '/social',
  onLogout,
  onAvatarFileUpload
}: SocialPageProps) {
  const [targetUser, setTargetUser] = useState<UserAccount>(user);

  // Extract userId from path if present (e.g. /social/16926299042 vs /social/feed)
  const pathParts = currentPath.split('/').filter(Boolean);
  const secondPart = pathParts[1] || '';
  const isKnownSubTab = ['feed', 'feeds', 'messages', 'users', 'deals', 'coauthors', 'saved', 'ratings'].includes(secondPart);
  const targetId = (!isKnownSubTab && secondPart) ? secondPart : null;

  // If user visits /social/feeds, gracefully redirect to /social/feed
  useEffect(() => {
    if (currentPath === '/social/feeds' || currentPath.startsWith('/social/feeds/')) {
      window.history.replaceState(null, '', '/social/feed?tab=subscriptions');
      window.dispatchEvent(new Event('popstate'));
    }
    if (currentPath === '/social/saved' || currentPath.startsWith('/social/saved/')) {
      window.history.replaceState(null, '', '/folders');
      window.dispatchEvent(new Event('popstate'));
    }
  }, [currentPath]);

  useEffect(() => {
    if (!targetId || targetId === user.id || targetId === String(user.telegramId)) {
      setTargetUser(user);
      return;
    }

    fetch(`/api/users/${targetId}`)
      .then(res => res.json())
      .then(data => {
        if (data && (data.id || data.telegramId || data.success)) {
          const u = data.user || data;
          setTargetUser({
            id: String(u.id || targetId),
            telegramId: u.telegramId || (isNaN(Number(targetId)) ? undefined : Number(targetId)),
            name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || `Пользователь ${targetId}`,
            firstName: u.firstName || u.name,
            lastName: u.lastName || '',
            username: u.username || u.telegramUsername,
            telegramUsername: u.telegramUsername || (u.username ? `@${u.username}` : undefined),
            avatarUrl: normalizeProTalkMediaUrl(u.userAvatar || u.photoUrl || u.avatarUrl) || BRAND_ASSETS.heartAvatar,
            photoUrl: normalizeProTalkMediaUrl(u.photoUrl || u.avatarUrl) || BRAND_ASSETS.heartAvatar,
            role: u.role || 'user',
            tariff: u.tariff || 'Старт',
            iirky: u.balance || u.iirky || 300,
            createdAt: u.createdAt || u.created_at
          });
        }
      })
      .catch(() => {
        setTargetUser({
          id: targetId,
          telegramId: isNaN(Number(targetId)) ? undefined : Number(targetId),
          name: `Пользователь ${targetId}`,
          role: 'user',
          tariff: 'Старт',
          iirky: 300
        });
      });
  }, [targetId, user]);

  const isOwnProfile = !targetId || targetId === user.id || targetId === String(user.telegramId);

  return (
    <div className="space-y-6">
      <ProfileHeader 
        user={targetUser}
        currentUser={user}
        isSocialPage={true}
        isOwnProfile={isOwnProfile}
        onLogout={onLogout}
        onAvatarFileUpload={onAvatarFileUpload}
        academySectionSlug="social-chats"
      />
      <IirkySocialNetwork 
        user={targetUser} 
        currentUser={user} 
        onUpdateUser={onUpdateUser} 
        currentPath={currentPath} 
      />
    </div>
  );
}
