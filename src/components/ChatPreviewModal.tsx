import React from 'react';
import { X, Eye, SendHorizontal } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { RichPreviewRenderer } from './PostTelegramEditor';
import { BRAND_ASSETS, normalizeProTalkMediaUrl } from '../constants/proTalkStorage';

interface ChatPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: () => void;
  formatMode: 'v2' | 'rich';
  text: string;
  attachedImages?: string[];
  mediaFile?: { url: string; type: string; name?: string; size?: string } | null;
  replyingTo?: { text: string; senderName?: string } | null;
  currentUser?: any;
}

export const ChatPreviewModal: React.FC<ChatPreviewModalProps> = ({
  isOpen,
  onClose,
  onSend,
  formatMode,
  text,
  attachedImages = [],
  mediaFile,
  replyingTo,
  currentUser
}) => {
  if (!isOpen) return null;

  const senderName = currentUser?.name || currentUser?.first_name || 'Вы';
  const senderAvatar =
    normalizeProTalkMediaUrl(currentUser?.avatar || currentUser?.avatarUrl || currentUser?.photo_url) ||
    BRAND_ASSETS.heartAvatar;
  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div 
      className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-sky-950/20 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-r from-sky-100/95 via-pink-100/95 via-orange-100/95 via-pink-100/95 to-sky-100/95 backdrop-blur-md rounded-3xl border-2 border-pink-400 p-4 sm:p-6 shadow-2xl max-w-xl w-full flex flex-col max-h-[90vh] overflow-hidden text-left animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-pink-200 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-2xs">
              <Eye size={18} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">
                Предпросмотр сообщения
              </h3>
              <span className="text-[14px] text-pink-600 font-semibold">
                Режим: {formatMode === 'rich' ? 'Rich' : 'Markdown V2'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-500 hover:text-pink-600 hover:bg-pink-100/60 transition-colors cursor-pointer"
            title="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        {/* Preview Chat Message Simulation */}
        <div className="my-4 overflow-y-auto pr-1 flex-1 min-h-32 space-y-3">
          <div className="text-[14px] text-slate-600 font-medium px-1">
            Так ваше сообщение будет выглядеть в чате:
          </div>

          <div className="max-w-[90%] sm:max-w-[85%] ml-auto">
            {/* Sender header */}
            <div className="flex items-center justify-end gap-1.5 mb-1 pr-1">
              <span className="text-[14px] font-bold text-slate-800">{senderName}</span>
              <img 
                src={senderAvatar} 
                alt={senderName} 
                className="w-5 h-5 rounded-full object-cover border border-pink-300 shadow-2xs shrink-0" 
              />
            </div>

            {/* Bubble */}
            <div className="p-3 sm:p-4 rounded-2xl rounded-tr-none bg-gradient-to-r from-pink-500 via-orange-400 to-pink-500 text-white shadow-md text-left break-words">
              {/* Replying quote if any */}
              {replyingTo && (
                <div className="mb-2 p-2 rounded-xl bg-white/20 border-l-4 border-white text-[14px] leading-snug text-white max-w-full">
                  <span className="text-white font-medium line-clamp-1 block text-[14px]">
                    {(replyingTo.text || '').split('\n')[0].trim() || 'Сообщение'}
                  </span>
                </div>
              )}

              {/* Media attached */}
              {mediaFile?.url && (
                <div className="mb-2 rounded-xl overflow-hidden border border-white/30 bg-black/10">
                  {mediaFile.type === 'video' ? (
                    <video src={mediaFile.url} controls className="w-full max-h-48 object-cover rounded-xl" />
                  ) : mediaFile.type === 'audio' ? (
                    <audio src={mediaFile.url} controls className="w-full p-2" />
                  ) : (
                    <img src={mediaFile.url} alt="Вложение" className="w-full max-h-56 object-cover rounded-xl" />
                  )}
                </div>
              )}

              {/* Images attached */}
              {attachedImages && attachedImages.length > 0 && (
                <div className={`mb-2 grid gap-1 rounded-xl overflow-hidden border border-white/20 ${attachedImages.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {attachedImages.map((img, idx) => (
                    <img key={idx} src={img} alt={`Прикрепленное фото ${idx + 1}`} className="w-full max-h-48 object-cover" />
                  ))}
                </div>
              )}

              {/* Formatted Text */}
              <div className="text-[14px] leading-relaxed chat-message-text text-white">
                {text ? (
                  formatMode === 'rich' ? (
                    <RichPreviewRenderer postText={text} />
                  ) : (
                    <MarkdownRenderer content={text} format="v2" isCompact />
                  )
                ) : (
                  <span className="italic opacity-80">Текст сообщения отсутствует</span>
                )}
              </div>

              {/* Timestamp footer */}
              <div className="text-[12px] opacity-85 text-right mt-1.5 font-mono font-bold flex items-center justify-end gap-1">
                <span>{currentTime}</span>
                <span className="font-bold">✓✓</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-pink-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="text-[14px] text-slate-500 font-medium">
            Формат сообщения: <strong className="text-pink-600 font-bold">{formatMode === 'rich' ? 'Rich' : 'Markdown V2'}</strong>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-2xl text-[14px] font-bold border-2 border-pink-300 text-slate-700 bg-white/80 hover:bg-pink-50 transition-all cursor-pointer"
            >
              Закрыть
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onSend();
              }}
              disabled={!text.trim() && attachedImages.length === 0 && !mediaFile}
              className="w-full sm:w-auto px-5 py-2 rounded-2xl text-[14px] font-bold bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 text-white shadow-md hover:opacity-95 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <SendHorizontal size={16} />
              <span>Отправить сообщение</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPreviewModal;
