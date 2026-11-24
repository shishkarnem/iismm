import React, { useState } from 'react';
import { Check, Coins, Edit2, RefreshCw, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import { User } from '../../types';
import { GradientSelect } from '../ui-kit/GradientDropdown';
import { GradientModalShell, ResponsiveActionBtn } from '../ui-kit/ResponsiveActionBtn';
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from '../../constants/proTalkStorage';

interface AdminUsersTabProps {
  users: User[];
  usersLoading: boolean;
  currentUserEmail: string;
  onRefreshUsers: () => Promise<void>;
  triggerToast: (type: 'success' | 'error', message: string) => void;
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  users,
  usersLoading,
  currentUserEmail,
  onRefreshUsers,
  triggerToast
}) => {
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('editor');
  const [newTelegramId, setNewTelegramId] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newBalance, setNewBalance] = useState('500');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('editor');
  const [editTelegramId, setEditTelegramId] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editBalance, setEditBalance] = useState('500');

  const [userPendingDelete, setUserPendingDelete] = useState<{ id: string; displayName: string } | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const roleOptions = [
    { value: 'editor', label: 'Редактор (editor)' },
    { value: 'admin', label: 'Администратор (admin)' }
  ];

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail && !newTelegramId) {
      triggerToast('error', 'Укажите электронную почту или идентификатор в Телеграме.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail || undefined,
          password: newPassword || undefined,
          role: newRole,
          telegramId: newTelegramId ? parseInt(newTelegramId, 10) : undefined,
          firstName: newFirstName || undefined,
          lastName: newLastName || undefined,
          username: newUsername || undefined,
          photoUrl: newPhotoUrl || undefined,
          balance: newBalance ? parseInt(newBalance, 10) : 500
        })
      });

      if (res.ok) {
        triggerToast('success', 'Новый профиль успешно зарегистрирован');
        setShowAddForm(false);
        setNewEmail('');
        setNewPassword('');
        setNewRole('editor');
        setNewTelegramId('');
        setNewFirstName('');
        setNewLastName('');
        setNewUsername('');
        setNewPhotoUrl('');
        setNewBalance('500');
        await onRefreshUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        triggerToast('error', err.error || 'Ошибка добавления пользователя');
      }
    } catch {
      triggerToast('error', 'Сеть недоступна при создании пользователя.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (id: string) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: editEmail || undefined,
          password: editPassword || undefined,
          role: editRole,
          telegramId: editTelegramId ? parseInt(editTelegramId, 10) : undefined,
          firstName: editFirstName || undefined,
          lastName: editLastName || undefined,
          username: editUsername || undefined,
          photoUrl: editPhotoUrl || undefined,
          balance: editBalance ? parseInt(editBalance, 10) : 500
        })
      });

      if (res.ok) {
        triggerToast('success', 'Данные пользователя обновлены в базе');
        setEditingUser(null);
        await onRefreshUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        triggerToast('error', err.error || 'Ошибка при обновлении.');
      }
    } catch {
      triggerToast('error', 'Ошибка сети.');
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!userPendingDelete) return;
    setIsDeletingUser(true);
    try {
      const res = await fetch(`/api/users/${userPendingDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        triggerToast('success', `Пользователь ${userPendingDelete.displayName} удален.`);
        setUserPendingDelete(null);
        await onRefreshUsers();
      } else {
        triggerToast('error', 'Не удалось удалить пользователя.');
      }
    } catch {
      triggerToast('error', 'Ошибка сети.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = userSearchTerm.toLowerCase();
    const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    const username = (u.username || '').toLowerCase();
    const tgId = String(u.telegramId || '');
    return name.includes(term) || email.includes(term) || username.includes(term) || tgId.includes(term);
  });

  return (
    <div className="space-y-5 min-w-0">
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm">
        <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md p-4 sm:p-6 space-y-5 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-pink-300/70 pb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Users size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[16px] sm:text-[18px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent break-words">
                  Управление пользователями и балансами
                </h3>
                <p className="text-[14px] text-slate-700 font-medium break-words">
                  Профили, роли доступа и начисление Иирок
                </p>
              </div>
            </div>

            <ResponsiveActionBtn
              icon={showAddForm ? <X size={16} /> : <UserPlus size={16} />}
              label={showAddForm ? 'Скрыть форму' : 'Добавить пользователя'}
              onClick={() => setShowAddForm((prev) => !prev)}
              variant="vivid"
            />
          </div>

          {showAddForm && (
            <form
              onSubmit={handleCreateUser}
              className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400"
            >
              <div className="rounded-[14.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 p-4 sm:p-5 space-y-4">
                <h4 className="text-[15px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                  Регистрация нового профиля
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">Электронная почта</label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-[14px] text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">Пароль</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-[14px] text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <GradientSelect
                      label="Роль доступа"
                      value={newRole}
                      onChange={setNewRole}
                      options={roleOptions}
                    />
                  </div>

                  <div>
                    <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">Идентификатор в Телеграме</label>
                    <input
                      type="number"
                      value={newTelegramId}
                      onChange={(e) => setNewTelegramId(e.target.value)}
                      placeholder="169262990"
                      className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-[14px] text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">Имя</label>
                    <input
                      type="text"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      placeholder="Александр"
                      className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-[14px] text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">Фамилия</label>
                    <input
                      type="text"
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                      placeholder="Власов"
                      className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-[14px] text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">Имя пользователя (@)</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="alex_sav"
                      className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-[14px] text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">Стартовый баланс Иирок</label>
                    <input
                      type="number"
                      value={newBalance}
                      onChange={(e) => setNewBalance(e.target.value)}
                      className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-[14px] font-bold text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">Ссылка на аватар</label>
                    <input
                      type="url"
                      value={newPhotoUrl}
                      onChange={(e) => setNewPhotoUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-white/85 border border-pink-300 rounded-xl px-3 py-2 text-[14px] text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <ResponsiveActionBtn
                    type="submit"
                    icon={<UserPlus size={16} />}
                    label={isSubmitting ? 'Создание...' : 'Зарегистрировать в базу'}
                    disabled={isSubmitting}
                    variant="vivid"
                    alwaysShowLabel={true}
                  />
                </div>
              </div>
            </form>
          )}

          {/* Поиск */}
          <div className="max-w-md p-[1.5px] rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
            <div className="flex items-center gap-2 rounded-[10.5px] bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 px-3.5 py-2">
              <Search size={16} className="text-pink-600 shrink-0" />
              <input
                type="text"
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                placeholder="Поиск по имени, почте или идентификатору..."
                className="w-full bg-transparent border-none text-[14px] text-slate-900 focus:outline-none placeholder-slate-500"
              />
            </div>
          </div>

          {/* Таблица пользователей */}
          <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 overflow-hidden">
            <div className="rounded-[14.5px] bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 overflow-x-auto">
              {usersLoading ? (
                <div className="p-8 text-center text-slate-700 text-[14px] flex items-center justify-center gap-2">
                  <RefreshCw className="animate-spin text-pink-600" size={18} />
                  <span>Загрузка пользователей...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-slate-700 text-[14px]">Пользователи не найдены</div>
              ) : (
                <table className="w-full text-left text-[14px] border-collapse">
                  <thead className="bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 border-b border-pink-300/70 text-slate-800 font-bold">
                    <tr>
                      <th className="p-3.5">Профиль</th>
                      <th className="p-3.5">Телеграм</th>
                      <th className="p-3.5">Баланс</th>
                      <th className="p-3.5">Роль</th>
                      <th className="p-3.5">Почта</th>
                      <th className="p-3.5">Дата</th>
                      <th className="p-3.5 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pink-200/70">
                    {filteredUsers.map((user) => {
                      const isEditing = editingUser?.id === user.id;
                      const displayName =
                        [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Пользователь';
                      const isCurrentUser = user.email === currentUserEmail;

                      return (
                        <tr key={user.id} className="hover:bg-white/60 text-slate-800">
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              <img
                                src={normalizeProTalkMediaUrl(user.photoUrl) || BRAND_ASSETS.heartAvatar}
                                alt="Аватар"
                                className="w-9 h-9 rounded-full border border-pink-300 object-cover bg-white/80 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                              <div>
                                {isEditing ? (
                                  <div className="grid grid-cols-2 gap-1.5 max-w-[200px]">
                                    <input
                                      type="text"
                                      value={editFirstName}
                                      onChange={(e) => setEditFirstName(e.target.value)}
                                      placeholder="Имя"
                                      className="bg-white/90 border border-pink-300 rounded-lg px-2 py-1 text-[14px] text-slate-900"
                                    />
                                    <input
                                      type="text"
                                      value={editLastName}
                                      onChange={(e) => setEditLastName(e.target.value)}
                                      placeholder="Фамилия"
                                      className="bg-white/90 border border-pink-300 rounded-lg px-2 py-1 text-[14px] text-slate-900"
                                    />
                                  </div>
                                ) : (
                                  <span className="font-bold text-slate-900 text-[14px] block">{displayName}</span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5">
                            {isEditing ? (
                              <div className="space-y-1.5 max-w-[160px]">
                                <input
                                  type="number"
                                  value={editTelegramId}
                                  onChange={(e) => setEditTelegramId(e.target.value)}
                                  placeholder="Номер"
                                  className="bg-white/90 border border-pink-300 rounded-lg px-2 py-1 text-[14px] text-slate-900 block w-full"
                                />
                                <input
                                  type="text"
                                  value={editUsername}
                                  onChange={(e) => setEditUsername(e.target.value)}
                                  placeholder="Никнейм"
                                  className="bg-white/90 border border-pink-300 rounded-lg px-2 py-1 text-[14px] text-slate-900 block w-full"
                                />
                              </div>
                            ) : (
                              <div className="text-[14px] space-y-0.5">
                                {user.telegramId ? (
                                  <>
                                    <div className="font-semibold text-slate-800">{user.telegramId}</div>
                                    {user.username && <div className="text-sky-700 font-medium">@{user.username}</div>}
                                  </>
                                ) : (
                                  <span className="text-slate-500">Не привязан</span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="p-3.5">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editBalance}
                                onChange={(e) => setEditBalance(e.target.value)}
                                className="bg-white/90 border border-pink-300 rounded-lg px-2 py-1 text-[14px] font-bold text-slate-900 w-24"
                              />
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <Coins size={16} className="text-orange-500 shrink-0" />
                                <span className="font-bold text-slate-900">{user.balance ?? 500}</span>
                                <span className="text-slate-600">Иирок</span>
                              </div>
                            )}
                          </td>

                          <td className="p-3.5">
                            {isEditing ? (
                              <GradientSelect
                                value={editRole}
                                onChange={setEditRole}
                                options={roleOptions}
                                compact={true}
                              />
                            ) : (
                              <span className="text-[14px] font-semibold text-pink-700">
                                {user.role === 'admin' ? 'Администратор' : 'Редактор'}
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 max-w-[180px] truncate">
                            {isEditing ? (
                              <div className="space-y-1.5 max-w-[170px]">
                                <input
                                  type="email"
                                  value={editEmail}
                                  onChange={(e) => setEditEmail(e.target.value)}
                                  placeholder="Почта"
                                  className="bg-white/90 border border-pink-300 rounded-lg px-2 py-1 text-[14px] text-slate-900 block w-full"
                                />
                                <input
                                  type="password"
                                  value={editPassword}
                                  onChange={(e) => setEditPassword(e.target.value)}
                                  placeholder="Новый пароль"
                                  className="bg-white/90 border border-pink-300 rounded-lg px-2 py-1 text-[14px] text-slate-900 block w-full"
                                />
                              </div>
                            ) : (
                              <div className="text-[14px] text-slate-700 truncate">
                                {user.email || 'Вход через бота'}
                              </div>
                            )}
                          </td>

                          <td className="p-3.5 text-slate-700 text-[14px]">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU') : '—'}
                          </td>

                          <td className="p-3.5 text-right">
                            <div className="flex justify-end gap-1.5">
                              {isEditing ? (
                                <>
                                  <ResponsiveActionBtn
                                    icon={<Check size={16} />}
                                    label="Сохранить"
                                    showLabelFrom="never"
                                    onClick={() => handleUpdateUser(user.id)}
                                    variant="vivid"
                                  />
                                  <ResponsiveActionBtn
                                    icon={<X size={16} />}
                                    label="Отмена"
                                    showLabelFrom="never"
                                    onClick={() => setEditingUser(null)}
                                    variant="outline"
                                  />
                                </>
                              ) : (
                                <>
                                  <ResponsiveActionBtn
                                    icon={<Edit2 size={16} />}
                                    label="Изменить"
                                    showLabelFrom="never"
                                    onClick={() => {
                                      setEditingUser(user);
                                      setEditEmail(user.email || '');
                                      setEditRole(user.role);
                                      setEditPassword('');
                                      setEditTelegramId(user.telegramId ? String(user.telegramId) : '');
                                      setEditFirstName(user.firstName || '');
                                      setEditLastName(user.lastName || '');
                                      setEditUsername(user.username || '');
                                      setEditPhotoUrl(user.photoUrl || '');
                                      setEditBalance(String(user.balance ?? 500));
                                    }}
                                    variant="outline"
                                  />
                                  <ResponsiveActionBtn
                                    icon={<Trash2 size={16} />}
                                    label="Удалить"
                                    showLabelFrom="never"
                                    disabled={isCurrentUser}
                                    title={isCurrentUser ? 'Нельзя удалить текущий аккаунт' : 'Удалить пользователя'}
                                    onClick={() => setUserPendingDelete({ id: user.id, displayName })}
                                    variant="danger"
                                  />
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      <GradientModalShell
        open={Boolean(userPendingDelete)}
        onClose={() => setUserPendingDelete(null)}
        title="Удаление пользователя"
        maxWidthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <ResponsiveActionBtn
              icon={<X size={16} />}
              label="Отмена"
              onClick={() => setUserPendingDelete(null)}
              variant="outline"
              alwaysShowLabel={true}
            />
            <ResponsiveActionBtn
              icon={<Trash2 size={16} />}
              label={isDeletingUser ? 'Удаление...' : 'Удалить'}
              disabled={isDeletingUser}
              onClick={handleConfirmDeleteUser}
              variant="danger"
              alwaysShowLabel={true}
            />
          </div>
        }
      >
        <p className="text-[14px] text-slate-800 font-medium leading-relaxed">
          Вы действительно хотите безвозвратно удалить профиль «{userPendingDelete?.displayName}» из базы данных?
        </p>
      </GradientModalShell>
    </div>
  );
};
