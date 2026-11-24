import React from 'react';
import { AlertTriangle, Check, Loader2, Trash2 } from 'lucide-react';
import { GradientModalShell, ResponsiveActionBtn } from '../../ui-kit/ResponsiveActionBtn';
import { NeurosphereLoader } from '../../loaders/NeurosphereLoader';

export const EditorDeleteConfirmModal: React.FC<{
  open: boolean;
  onClose: () => void;
  postTitle: string;
  isDeleting: boolean;
  onConfirmDelete: () => void;
}> = ({ open, onClose, postTitle, isDeleting, onConfirmDelete }) => {
  return (
    <GradientModalShell
      open={open}
      onClose={onClose}
      title="Удалить черновик публикации?"
      subtitle="Это действие нельзя отменить"
      maxWidthClass="max-w-md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <ResponsiveActionBtn
            icon={<Check size={16} />}
            label="Оставить"
            alwaysShowLabel
            variant="outline"
            onClick={onClose}
          />
          <ResponsiveActionBtn
            icon={isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            label="Удалить черновик"
            alwaysShowLabel
            variant="danger"
            disabled={isDeleting}
            onClick={onConfirmDelete}
          />
        </div>
      }
    >
      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/75 border border-pink-300/80">
        <AlertTriangle size={22} className="text-orange-600 shrink-0 mt-0.5" />
        <p className="text-[14px] text-slate-800 leading-relaxed break-words">
          Вы действительно хотите удалить публикацию{' '}
          <strong className="text-slate-950">«{postTitle || 'Без заголовка'}»</strong> из списка сохраненных постов?
        </p>
      </div>
    </GradientModalShell>
  );
};

export const EditorAiProgressOverlay: React.FC<{
  open: boolean;
  statusLabel?: string;
}> = ({ open, statusLabel = 'Нейросеть формирует публикацию и структуру поста...' }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-gradient-to-br from-sky-100/50 via-pink-100/50 via-orange-100/50 via-pink-100/50 to-sky-100/50 backdrop-blur-sm">
      <NeurosphereLoader variant="inline" label={statusLabel} />
    </div>
  );
};
