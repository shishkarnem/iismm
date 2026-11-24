import { User } from './userTypes';
import {
  fetchAllUsersFromPg,
  insertRow,
  updateRow,
  deleteRow,
  normalizeUserId
} from '../../db/postgres';

let userCache: User[] = [];

export class UserDomain {
  public static getCachedUsers(): User[] {
    return userCache;
  }

  public static setCachedUsers(users: User[]): void {
    userCache = users;
  }

  public static getUsers(): User[] {
    const pgRows = fetchAllUsersFromPg();
    if (pgRows && pgRows.length > 0) {
      const users: User[] = pgRows.map((row) => {
        const telegramId = row.telegram_id ? Number(row.telegram_id) : undefined;
        let id = String(row.id || '').trim();
        if (!id && telegramId) {
          id = String(telegramId);
        }
        const email = row.email || undefined;
        const passwordHash = row.password_hash || undefined;
        const role = row.role || 'user';
        const userAvatar = row.user_avatar || (row as any).userAvatar || undefined;
        const finalPhoto = userAvatar || row.photo_url || '';

        return {
          id,
          email,
          passwordHash,
          role,
          telegramId,
          firstName: row.first_name || '',
          lastName: row.last_name || '',
          username: row.username || '',
          photoUrl: finalPhoto,
          avatarUrl: finalPhoto,
          userAvatar,
          user_avatar: userAvatar,
          bio: row.bio || '',
          status: (row.status as any) || 'Активный',
          tariff: row.tariff || 'Старт',
          balance: row.balance !== undefined && row.balance !== null ? Number(row.balance) : 0,
          referredBy: row.referred_by
            ? (isNaN(Number(row.referred_by)) ? String(row.referred_by) : Number(row.referred_by))
            : undefined,
          referralRewardBalance: Math.max(
            row.referral_reward_balance !== undefined && row.referral_reward_balance !== null
              ? Number(row.referral_reward_balance)
              : 0,
            (row as any).balance_ref !== undefined && (row as any).balance_ref !== null
              ? Number((row as any).balance_ref)
              : 0
          ),
          createdAt: row.created_at || new Date().toISOString()
        };
      });

      userCache = users;
      return users;
    }

    return userCache;
  }

  public static getUserByEmail(email: string): User | undefined {
    return this.getUsers().find((u) => u.email && u.email.toLowerCase() === email.toLowerCase());
  }

  public static getUserByTelegramId(telegramId: number): User | undefined {
    return this.getUsers().find((u) => u.telegramId === telegramId);
  }

  public static getUserById(id: string): User | undefined {
    const cleanId = String(id || '').trim();
    return this.getUsers().find((u) => u.id === cleanId);
  }

  public static addUser(user: User, options?: { skipPgInsert?: boolean }): void {
    if (!user.id || user.id.length !== 11 || !/^\d{11}$/.test(user.id)) {
      user.id = String(Math.floor(10000000000 + Math.random() * 90000000000));
    }
    const users = this.getUsers();
    const existingIndex = users.findIndex(
      (u) => u.id === user.id || (user.telegramId && u.telegramId === user.telegramId)
    );
    if (existingIndex !== -1) {
      users[existingIndex] = { ...users[existingIndex], ...user };
    } else {
      users.push(user);
    }
    userCache = users;

    if (!options?.skipPgInsert) {
      void insertRow('users', {
        id: user.id,
        email: user.email,
        password_hash: user.passwordHash,
        role: user.role,
        tariff: (user as any).tariff || 'Старт',
        telegram_id: user.telegramId,
        first_name: user.firstName,
        last_name: user.lastName,
        username: user.username,
        photo_url: user.photoUrl,
        referred_by: user.referredBy ?? null,
        referral_reward_balance: user.referralRewardBalance ?? 0,
        balance: user.balance !== undefined ? user.balance : 0,
        created_at: user.createdAt || new Date().toISOString()
      }).catch(() => null);
    }
  }

  public static updateUser(id: string, updated: Partial<User>): User {
    const users = this.getUsers();
    const canonicalId = normalizeUserId(id);
    const targetTg =
      updated.telegramId ||
      (!isNaN(Number(id)) && Number(id) < 10000000000 ? Number(id) : undefined);
    const index = users.findIndex(
      (u) =>
        u.id === id ||
        u.id === canonicalId ||
        (targetTg !== undefined && u.telegramId === targetTg) ||
        (!isNaN(Number(id)) && String(u.telegramId) === id)
    );
    let updatedUser: User;
    if (index !== -1) {
      users[index] = { ...users[index], ...updated };
      updatedUser = users[index];
    } else {
      updatedUser = {
        id: canonicalId,
        role: updated.role || 'editor',
        createdAt: new Date().toISOString(),
        ...updated
      };
      users.push(updatedUser);
    }
    userCache = users;

    const sqlRow: Record<string, any> = {};
    if (updatedUser.email !== undefined) sqlRow.email = updatedUser.email;
    if (updatedUser.passwordHash !== undefined) sqlRow.password_hash = updatedUser.passwordHash;
    if (updatedUser.role !== undefined) sqlRow.role = updatedUser.role;
    if (updatedUser.telegramId !== undefined) sqlRow.telegram_id = updatedUser.telegramId;
    if (updatedUser.firstName !== undefined) sqlRow.first_name = updatedUser.firstName;
    if (updatedUser.lastName !== undefined) sqlRow.last_name = updatedUser.lastName;
    if (updatedUser.username !== undefined) sqlRow.username = updatedUser.username;
    if (updatedUser.photoUrl !== undefined) sqlRow.photo_url = updatedUser.photoUrl;
    if (updatedUser.userAvatar !== undefined || (updatedUser as any).user_avatar !== undefined) {
      sqlRow.user_avatar = updatedUser.userAvatar || (updatedUser as any).user_avatar;
    }
    if (updatedUser.balance !== undefined) sqlRow.balance = updatedUser.balance;
    if (updatedUser.referredBy !== undefined) sqlRow.referred_by = updatedUser.referredBy;
    if (updatedUser.referralRewardBalance !== undefined) {
      sqlRow.referral_reward_balance = updatedUser.referralRewardBalance;
    }
    if (updatedUser.timezone !== undefined) sqlRow.timezone = updatedUser.timezone;

    void updateRow('users', updatedUser.id, sqlRow).catch(() => null);

    return updatedUser;
  }

  public static deleteUser(id: string): void {
    const users = this.getUsers().filter((u) => u.id !== id);
    userCache = users;
    void deleteRow('users', id).catch(() => null);
  }
}
