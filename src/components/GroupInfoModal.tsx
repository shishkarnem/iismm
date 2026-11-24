import React, { useState, useEffect, useRef } from 'react';
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from '../constants/proTalkStorage';
import { 
  X, 
  Users, 
  Shield, 
  UserMinus, 
  UserPlus, 
  LogOut, 
  Check, 
  AlertCircle, 
  Sparkles, 
  Upload, 
  Crown, 
  Camera, 
  Search,
  CheckSquare,
  Square
} from 'lucide-react';
import { UserAccount } from '../types';
import { useFileUpload } from '../hooks/useFileUpload';

interface GroupMember {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  isAdmin?: boolean;
}

interface GroupDetails {
  id: string;
  title: string;
  description?: string;
  avatarUrl?: string;
  creatorId: string;
  members: GroupMember[];
  admins: GroupMember[];
  isAdmin: boolean;
  memberCount: number;
}

interface SubscribedUser {
  targetId: string;
  targetName: string;
  targetUsername?: string;
  targetAvatar?: string;
}

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  currentUser: UserAccount;
  onGroupUpdated?: (updated: any) => void;
  onLeftGroup?: (groupId: string) => void;
}

export default function GroupInfoModal({
  isOpen,
  onClose,
  groupId,
  currentUser,
  onGroupUpdated,
  onLeftGroup
}: GroupInfoModalProps) {
  const [loading, setLoading] = useState(false);
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Admin editable fields
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  
  // Member management states
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubscribedUser[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [selectedNewMemberIds, setSelectedNewMemberIds] = useState<string[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading: isUploadingAvatar } = useFileUpload();

  const currentUserId = String(currentUser.id || currentUser.telegramId || '16926299042');

  const fetchGroup = async () => {
    if (!groupId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/user/chats/group/${encodeURIComponent(groupId)}?userId=${encodeURIComponent(currentUserId)}`);
      const data = await res.json();
      if (data.success && data.group) {
        setGroup(data.group);
        setEditTitle(data.group.title || '');
        setEditDescription(data.group.description || '');
        setEditAvatarUrl(data.group.avatarUrl || '');
      } else {
        setErrorMsg(data.error || 'Не удалось загрузить информацию о группе');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Ошибка загрузки группы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchGroup();
      setShowAddMemberModal(false);
      setSelectedNewMemberIds([]);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, groupId]);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await upload(file);
      if (res && res.url) {
        setEditAvatarUrl(res.url);
      }
    } catch (err: any) {
      setErrorMsg('Не удалось загрузить аватар: ' + (err.message || 'ошибка сети'));
    }
  };

  const handleSaveInfo = async () => {
    if (!editTitle.trim()) {
      setErrorMsg('Название группы не может быть пустым');
      return;
    }
    setIsSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/user/chats/group/${encodeURIComponent(groupId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUserId,
          title: editTitle.trim(),
          description: editDescription.trim(),
          avatarUrl: editAvatarUrl.trim()
        })
      });
      const data = await res.json();
      if (data.success && data.group) {
        setGroup(data.group);
        setSuccessMsg('Информация о группе успешно сохранена');
        setTimeout(() => setSuccessMsg(''), 3000);
        if (onGroupUpdated) onGroupUpdated(data.group);
      } else {
        setErrorMsg(data.error || 'Не удалось обновить группу');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Ошибка обновления группы');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAdmin = async (targetUserId: string, currentIsAdmin: boolean) => {
    if (!group) return;
    setIsSaving(true);
    setErrorMsg('');
    try {
      let nextAdmins: string[];
      if (currentIsAdmin) {
        nextAdmins = group.admins.map(a => a.id).filter(id => id !== targetUserId);
      } else {
        nextAdmins = [...group.admins.map(a => a.id), targetUserId];
      }
      const res = await fetch(`/api/user/chats/group/${encodeURIComponent(groupId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUserId,
          admins: nextAdmins
        })
      });
      const data = await res.json();
      if (data.success && data.group) {
        setGroup(data.group);
        setSuccessMsg('Роли участников обновлены');
        setTimeout(() => setSuccessMsg(''), 3000);
        if (onGroupUpdated) onGroupUpdated(data.group);
      } else {
        setErrorMsg(data.error || 'Не удалось изменить статус администратора');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Ошибка изменения роли');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!group) return;
    if (!window.confirm('Удалить этого участника из группы?')) return;
    setIsSaving(true);
    setErrorMsg('');
    try {
      const nextMembers = group.members.map(m => m.id).filter(id => id !== targetUserId);
      const nextAdmins = group.admins.map(a => a.id).filter(id => id !== targetUserId);
      const res = await fetch(`/api/user/chats/group/${encodeURIComponent(groupId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUserId,
          members: nextMembers,
          admins: nextAdmins
        })
      });
      const data = await res.json();
      if (data.success && data.group) {
        setGroup(data.group);
        setSuccessMsg('Участник удален из группы');
        setTimeout(() => setSuccessMsg(''), 3000);
        if (onGroupUpdated) onGroupUpdated(data.group);
      } else {
        setErrorMsg(data.error || 'Не удалось удалить участника');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Ошибка удаления участника');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAddMembers = async () => {
    setShowAddMemberModal(true);
    setLoadingSubs(true);
    try {
      const res = await fetch(`/api/subscriptions?followerId=${encodeURIComponent(currentUserId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.subscriptions)) {
        // Filter out existing members
        const existingIds = new Set(group?.members?.map(m => m.id) || []);
        const available = data.subscriptions.filter((s: SubscribedUser) => !existingIds.has(s.targetId));
        setSubscriptions(available);
      }
    } catch (e) {
      console.error('Failed to load contacts:', e);
    } finally {
      setLoadingSubs(false);
    }
  };

  const handleConfirmAddMembers = async () => {
    if (!group || selectedNewMemberIds.length === 0) return;
    setAddingMembers(true);
    setErrorMsg('');
    try {
      const currentIds = group.members.map(m => m.id);
      const updatedMembers = Array.from(new Set([...currentIds, ...selectedNewMemberIds]));
      const res = await fetch(`/api/user/chats/group/${encodeURIComponent(groupId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUserId,
          members: updatedMembers
        })
      });
      const data = await res.json();
      if (data.success && data.group) {
        setGroup(data.group);
        setShowAddMemberModal(false);
        setSelectedNewMemberIds([]);
        setSuccessMsg('Участники успешно добавлены в группу');
        setTimeout(() => setSuccessMsg(''), 3000);
        if (onGroupUpdated) onGroupUpdated(data.group);
      } else {
        setErrorMsg(data.error || 'Не удалось добавить участников');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Ошибка при добавлении участников');
    } finally {
      setAddingMembers(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm('Вы действительно хотите покинуть эту группу?')) return;
    setIsLeaving(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/user/chats/group/${encodeURIComponent(groupId)}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUserId })
      });
      const data = await res.json();
      if (data.success) {
        if (onLeftGroup) onLeftGroup(groupId);
        onClose();
      } else {
        setErrorMsg(data.error || 'Не удалось выйти из группы');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Ошибка выхода из группы');
    } finally {
      setIsLeaving(false);
    }
  };

  if (!isOpen) return null;

  const memberList = group?.members || [];
  const adminList = group?.admins || [];
  const memberCount = memberList.length;
  const adminCount = adminList.length;
  const isAdmin = Boolean(group?.isAdmin);
  const isCreator = group ? String(group.creatorId) === currentUserId : false;

  const filteredMembers = memberList.filter(m => {
    const q = memberSearchQuery.toLowerCase();
    return (m.name || '').toLowerCase().includes(q) || (m.username || '').toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/30 backdrop-blur-xs text-left animate-fade-in">
      <div className="w-full max-w-xl bg-gradient-to-r from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 backdrop-blur-md rounded-3xl p-5 sm:p-6 border-2 border-pink-300 shadow-2xl relative max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-pink-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white shadow-xs">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {isAdmin ? 'Редактирование группы' : 'Информация о группе'}
              </h3>
              <p className="text-[14px] text-slate-600 font-medium">
                {group ? `${memberCount} участников • ${adminCount} администраторов` : 'Загрузка...'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/80 hover:bg-white text-slate-600 hover:text-pink-600 border border-pink-200 transition-colors cursor-pointer shadow-xs"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-pink-100/90 border border-pink-300 text-pink-800 text-[14px] font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-pink-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-sky-100/90 border border-sky-300 text-sky-900 text-[14px] font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-sky-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-600 text-[14px] font-medium">
              Загрузка сведений о группе...
            </div>
          ) : group ? (
            <>
              {/* Group Avatar & Info Editor (Same as Create Group Modal) */}
              <div className="p-4 rounded-2xl bg-white/80 border border-pink-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  {/* Avatar with Camera Overlay */}
                  <div className="relative group shrink-0">
                    <img
                      src={normalizeProTalkMediaUrl(editAvatarUrl || group.avatarUrl) || BRAND_ASSETS.logo}
                      alt="Group Avatar"
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-pink-300 shadow-xs bg-white"
                    />
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingAvatar}
                          className="absolute inset-0 bg-slate-900/40 rounded-2xl flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Изменить фото группы"
                        >
                          <Camera className="w-6 h-6 mb-1" />
                          <span className="text-[11px] font-bold">Изменить</span>
                        </button>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleAvatarFileChange}
                          accept="image/*"
                          className="hidden"
                        />
                      </>
                    )}
                  </div>

                  {/* Title & Description Inputs */}
                  <div className="flex-1 w-full space-y-3">
                    <div>
                      <label className="block text-[14px] font-bold text-slate-800 mb-1">
                        Название группы {isAdmin && <span className="text-pink-500">*</span>}
                      </label>
                      {isAdmin ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="Введите название группы"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-pink-200 focus:border-pink-400 focus:outline-none text-[14px] text-slate-800 font-semibold shadow-xs"
                        />
                      ) : (
                        <div className="text-base font-bold text-slate-900">{group.title}</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[14px] font-bold text-slate-800 mb-1">
                        Описание группы
                      </label>
                      {isAdmin ? (
                        <textarea
                          rows={2}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Правила или описание группы"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-pink-200 focus:border-pink-400 focus:outline-none text-[14px] text-slate-800 shadow-xs"
                        />
                      ) : (
                        <div className="text-[14px] text-slate-600">
                          {group.description || 'Описание не указано'}
                        </div>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleSaveInfo}
                          disabled={isSaving}
                          className="px-4 py-2 bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 hover:opacity-95 text-white font-bold rounded-xl text-[14px] shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          <span>{isSaving ? 'Сохранение...' : 'Сохранить изменения'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Members and Admins Management Section */}
              <div className="p-4 rounded-2xl bg-white/80 border border-pink-200 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-[14px] font-bold text-slate-900">
                      Участники и администраторы ({memberCount})
                    </h4>
                    <p className="text-[14px] text-slate-500">
                      Управление ролями и составом чата
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleOpenAddMembers}
                      className="px-3 py-1.5 bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white font-bold rounded-xl text-[14px] shadow-xs hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Добавить участников</span>
                    </button>
                  )}
                </div>

                {/* Member search bar */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Поиск по участникам..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-pink-200 text-[14px] focus:outline-none focus:border-pink-400"
                  />
                </div>

                {/* Members List */}
                <div className="divide-y divide-pink-100 max-h-60 overflow-y-auto pr-1">
                  {filteredMembers.map((member) => {
                    const isMemberAdmin = group.admins.some(a => a.id === member.id);
                    const isMemberCreator = String(member.id) === String(group.creatorId);
                    const isSelf = String(member.id) === currentUserId;

                    return (
                      <div key={member.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={normalizeProTalkMediaUrl(member.avatar) || BRAND_ASSETS.logo}
                            alt={member.name}
                            className="w-9 h-9 rounded-xl object-cover border border-pink-200 shrink-0 bg-white"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[14px] font-bold text-slate-800 truncate">
                                {member.name}
                              </span>
                              {isMemberCreator ? (
                                <span className="px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-700 text-[11px] font-bold flex items-center gap-0.5 border border-orange-200">
                                  <Crown className="w-3 h-3 text-orange-500" />
                                  <span>Создатель</span>
                                </span>
                              ) : isMemberAdmin ? (
                                <span className="px-1.5 py-0.5 rounded-md bg-pink-100 text-pink-700 text-[11px] font-bold flex items-center gap-0.5 border border-pink-200">
                                  <Shield className="w-3 h-3 text-pink-500" />
                                  <span>Админ</span>
                                </span>
                              ) : null}
                            </div>
                            {member.username && (
                              <p className="text-[12px] text-slate-500 truncate">
                                {member.username}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Admin Action Buttons */}
                        {isAdmin && !isMemberCreator && !isSelf && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Toggle Admin button */}
                            <button
                              type="button"
                              onClick={() => handleToggleAdmin(member.id, isMemberAdmin)}
                              disabled={isSaving}
                              className={`p-1.5 rounded-xl border text-[13px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                isMemberAdmin
                                  ? 'bg-pink-100 text-pink-700 border-pink-300 hover:bg-pink-200'
                                  : 'bg-white text-slate-700 border-pink-200 hover:bg-pink-50'
                              }`}
                              title={isMemberAdmin ? 'Снять права администратора' : 'Назначить администратором'}
                            >
                              <Crown className="w-4 h-4 text-pink-500" />
                              <span className="hidden sm:inline">
                                {isMemberAdmin ? 'Снять админа' : 'Сделать админом'}
                              </span>
                            </button>

                            {/* Remove Member button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member.id)}
                              disabled={isSaving}
                              className="p-1.5 rounded-xl bg-white hover:bg-pink-100 text-slate-500 hover:text-pink-600 border border-pink-200 transition-colors cursor-pointer"
                              title="Удалить из группы"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {filteredMembers.length === 0 && (
                    <div className="py-4 text-center text-[14px] text-slate-500">
                      Участники не найдены
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-pink-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleLeaveGroup}
            disabled={isLeaving}
            className="px-3 py-2 rounded-xl text-[14px] font-bold text-pink-700 hover:bg-pink-100/70 border border-pink-300 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4 text-pink-600" />
            <span>Выйти из группы</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[14px] font-bold text-slate-700 bg-white/80 hover:bg-white border border-pink-200 transition-all cursor-pointer"
          >
            Закрыть
          </button>
        </div>

        {/* Add Members Sub-Modal */}
        {showAddMemberModal && (
          <div className="absolute inset-0 z-20 bg-slate-900/40 backdrop-blur-xs rounded-3xl p-5 flex flex-col justify-between animate-fade-in">
            <div className="bg-gradient-to-r from-sky-100 via-pink-100 via-orange-100 to-sky-100 rounded-2xl p-4 border border-pink-300 shadow-xl flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-pink-200 shrink-0">
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-pink-600" />
                  <span>Добавить участников из контактов</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="p-1 rounded-lg hover:bg-white text-slate-500 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-3 flex-1 overflow-y-auto divide-y divide-pink-100">
                {loadingSubs ? (
                  <div className="py-8 text-center text-[14px] text-slate-500">
                    Загрузка ваших подписок...
                  </div>
                ) : subscriptions.length === 0 ? (
                  <div className="py-8 text-center text-[14px] text-slate-500">
                    Все ваши контакты уже добавлены в эту группу.
                  </div>
                ) : (
                  subscriptions.map((sub) => {
                    const isSelected = selectedNewMemberIds.includes(sub.targetId);
                    return (
                      <div
                        key={sub.targetId}
                        onClick={() => {
                          setSelectedNewMemberIds(prev =>
                            prev.includes(sub.targetId)
                              ? prev.filter(id => id !== sub.targetId)
                              : [...prev, sub.targetId]
                          );
                        }}
                        className="py-2.5 px-2 flex items-center justify-between hover:bg-white/60 rounded-xl cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={normalizeProTalkMediaUrl(sub.targetAvatar) || BRAND_ASSETS.logo}
                            alt={sub.targetName}
                            className="w-9 h-9 rounded-xl object-cover border border-pink-200 bg-white"
                          />
                          <div>
                            <p className="text-[14px] font-bold text-slate-800">{sub.targetName}</p>
                            {sub.targetUsername && (
                              <p className="text-[12px] text-slate-500">{sub.targetUsername}</p>
                            )}
                          </div>
                        </div>

                        <div className="text-pink-600">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pt-3 border-t border-pink-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-3 py-1.5 rounded-xl text-[14px] font-bold text-slate-600 bg-white/80 hover:bg-white cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAddMembers}
                  disabled={addingMembers || selectedNewMemberIds.length === 0}
                  className="px-4 py-1.5 rounded-xl text-[14px] font-bold text-white bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 shadow-xs hover:opacity-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Добавить выбранных ({selectedNewMemberIds.length})</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
