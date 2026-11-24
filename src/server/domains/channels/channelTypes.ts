export interface Channel {
  id: string;
  name: string;
  username: string;
  telegramId?: string;
  isActive: boolean;
  subscribersCount?: number;
  inviteLink?: string;
  description?: string;
  photoUrl?: string;
  userId?: string;
  role?: string;
  assignedAt?: string;
  isPrivate?: boolean;
  status?: string;
  isPremium?: boolean;
  [key: string]: any;
}
