import React, { useState, useEffect } from 'react';
import {
  Users,
  RefreshCw,
  CheckCircle2,
  Shield,
  UserCheck,
  UserX
} from 'lucide-react';
import { PostgresTableManager } from './PostgresTableManager';
import { UserAccount } from '../types';
import { TelegramUsersSyncModal, TelegramSyncStats } from './admin/TelegramUsersSyncModal';

interface SuperadminPanelProps {
  currentUser: UserAccount;
  onUpdateCurrentUser: (updated: UserAccount) => void;
  allChannelsCount: number;
}

export default function SuperadminPanel({
  currentUser: _currentUser,
  onUpdateCurrentUser: _onUpdateCurrentUser,
  allChannelsCount: _allChannelsCount
}: SuperadminPanelProps) {
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [parseMessage, setParseMessage] = useState<string | null>(null);
  const [userStats, setUserStats] = useState({ total: 262, active: 199, blocked: 63, deleted: 0 });
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchUserStats = async () => {
    try {
      const res = await fetch('/api/db/table/users');
      if (res.ok) {
        const data = await res.json();
        const rows = data.rows || [];
        const total = rows.length;
        const active = rows.filter((r: any) => r.status === 'Активный').length;
        const blocked = rows.filter((r: any) => r.status === 'Блок').length;
        const deleted = rows.filter((r: any) => r.status === 'Удален').length;
        setUserStats({ total, active, blocked, deleted });
      }
    } catch (e) {
      console.error('Failed to fetch user stats:', e);
    }
  };

  useEffect(() => {
    fetchUserStats();
  }, [refreshKey]);

  const handleSyncComplete = (stats: TelegramSyncStats) => {
    setUserStats({
      total: stats.total,
      active: stats.active,
      blocked: stats.blocked,
      deleted: stats.deleted
    });
    setParseMessage(
      `Каскадная проверка завершена: всего ${stats.total}, активных — ${stats.active}, заблокировали — ${stats.blocked}, удалены — ${stats.deleted}, полных фото в галерее — ${stats.fullGalleryPhotos ?? 0}.`
    );
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6 text-left min-w-0">
      {/* Top Banner: Stats & TG Cascading Re-parser Button */}
      <div className="bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-md p-4 sm:p-6 rounded-3xl border border-pink-300 shadow-md min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 flex items-center justify-center text-white shadow-md shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[18px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent break-words">
                База данных пользователей (PostgreSQL ProTalk)
              </h2>
              <p className="text-[14px] font-medium text-slate-700 break-words">
                Полный реестр пользователей с пакетной проверкой статусов Telegram и полных ссылок фото
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSyncModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 hover:opacity-95 text-white font-extrabold text-[14px] shadow-md transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className="w-4 h-4 shrink-0" />
            <span>Обновить пользователей Telegram</span>
          </button>
        </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md border border-pink-300 flex items-center justify-between shadow-xs min-w-0">
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-sky-800">Всего в базе</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{userStats.total}</div>
            </div>
            <Users className="w-6 h-6 text-sky-600 shrink-0" />
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 to-orange-100/80 backdrop-blur-md border border-pink-300 flex items-center justify-between shadow-xs min-w-0">
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-pink-800">Активные</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{userStats.active}</div>
            </div>
            <UserCheck className="w-6 h-6 text-pink-600 shrink-0" />
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-100/80 via-orange-100/80 to-pink-100/80 backdrop-blur-md border border-pink-300 flex items-center justify-between shadow-xs min-w-0">
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-orange-800">Заблокировали</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{userStats.blocked}</div>
            </div>
            <UserX className="w-6 h-6 text-orange-600 shrink-0" />
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md border border-pink-300 flex items-center justify-between shadow-xs min-w-0">
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-pink-800">Администраторы</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">1</div>
            </div>
            <Shield className="w-6 h-6 text-pink-600 shrink-0" />
          </div>
        </div>

        {parseMessage && (
          <div className="mt-4 p-3.5 rounded-2xl bg-white/85 text-slate-900 border border-pink-300 text-[14px] font-bold flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-pink-600 shrink-0" />
            <span className="break-words">{parseMessage}</span>
          </div>
        )}
      </div>

      {/* Main Table Inspector for users */}
      <div className="bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 backdrop-blur-md p-4 sm:p-6 rounded-3xl border border-pink-300 shadow-md min-w-0">
        <PostgresTableManager key={refreshKey} initialTable="users" />
      </div>

      <TelegramUsersSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncComplete={handleSyncComplete}
      />
    </div>
  );
}
