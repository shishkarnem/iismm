import { Channel } from './channelTypes';
import {
  cleanupUnownedDefaultChannelsInPosts,
  getUserAllowedChannelsFromDb
} from '../../channels/userAllowedChannels';
import { insertRow, updateRow, deleteRow, normalizeUserId } from '../../db/postgres';

let channelsCache: Channel[] = [];

export class ChannelDomain {
  public static getCachedChannels(): Channel[] {
    return channelsCache;
  }

  public static setCachedChannels(channels: Channel[]): void {
    channelsCache = channels;
  }

  public static getChannels(userId?: string): Channel[] {
    cleanupUnownedDefaultChannelsInPosts();
    if (userId && String(userId).trim()) {
      return getUserAllowedChannelsFromDb(userId) as Channel[];
    }
    return getUserAllowedChannelsFromDb() as Channel[];
  }

  public static addChannel(channel: Omit<Channel, 'id'>): Channel {
    const canonicalUserId = normalizeUserId(channel.userId);
    const newChannel: Channel = {
      name: channel.name || '',
      username: channel.username || '',
      isActive: channel.isActive !== undefined ? channel.isActive : true,
      ...channel,
      userId: canonicalUserId,
      id: 'ch_' + Math.random().toString(36).substring(2, 11)
    };
    channelsCache.push(newChannel);

    void insertRow('channels', {
      id: newChannel.id,
      user_id: canonicalUserId,
      name: newChannel.name,
      username: newChannel.username,
      telegram_id: newChannel.telegramId || '',
      is_active: newChannel.isActive ? 1 : 0,
      subscribers_count: newChannel.subscribersCount || 0,
      invite_link: newChannel.inviteLink || '',
      description: newChannel.description || '',
      photo_url: newChannel.photoUrl || ''
    }).catch(() => null);

    return newChannel;
  }

  public static updateChannel(id: string, updated: Partial<Channel>): Channel {
    const index = channelsCache.findIndex((c) => c.id === id);
    if (index !== -1) {
      if (updated.userId) {
        updated.userId = normalizeUserId(updated.userId);
      }
      channelsCache[index] = { ...channelsCache[index], ...updated };

      const ch = channelsCache[index];
      const canonicalUserId = normalizeUserId(ch.userId);
      void updateRow('channels', id, {
        user_id: canonicalUserId,
        name: ch.name,
        username: ch.username,
        telegram_id: ch.telegramId || '',
        is_active: ch.isActive ? 1 : 0,
        subscribers_count: ch.subscribersCount || 0,
        invite_link: ch.inviteLink || '',
        description: ch.description || '',
        photo_url: ch.photoUrl || ''
      }).catch(() => null);

      return channelsCache[index];
    }
    throw new Error('Channel not found');
  }

  public static deleteChannel(id: string): void {
    channelsCache = channelsCache.filter((c) => c.id !== id);
    void deleteRow('channels', id).catch(() => null);
  }
}
