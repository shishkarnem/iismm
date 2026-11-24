import React, { useState } from 'react';
import { Copy, Check, Database } from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { NeuralSphere } from '../NeuralSphere';
import { ConsultantUiMessage } from './useAiConsultant';

interface ConsultantMessageBubbleProps {
  message: ConsultantUiMessage;
  onQuickImagePreview?: (url: string) => void;
}

function formatMessageTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export const ConsultantMessageBubble: React.FC<ConsultantMessageBubbleProps> = ({
  message,
  onQuickImagePreview
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.sender === 'user';

  const handleCopy = () => {
    if (!message.text) return;
    navigator.clipboard.writeText(message.text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className={`w-full flex items-end gap-2 min-w-0 ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {!isUser && (
        <div className="shrink-0 mb-1 hidden sm:flex items-center justify-center">
          <NeuralSphere size={34} glow={true} />
        </div>
      )}

      {/* Gradient border wrapper — strictly only message bubbles and input field carry gradient */}
      <div
        className={`max-w-[92%] sm:max-w-[85%] min-w-0 p-[1.5px] rounded-3xl shadow-sm bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 ${
          isUser ? 'rounded-br-lg' : 'rounded-bl-lg'
        }`}
      >
        <div
          className={`px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-[22.5px] backdrop-blur-md text-slate-900 text-[14px] leading-relaxed break-words overflow-hidden ${
            isUser
              ? 'rounded-br-[6.5px] bg-gradient-to-r from-sky-200/88 via-pink-200/88 via-orange-100/88 via-pink-200/88 to-sky-200/88'
              : 'rounded-bl-[6.5px] bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90'
          }`}
        >
          {/* Optional database source badge on assistant messages */}
          {!isUser && message.dbSummary && (
            <div className="flex items-center gap-1.5 mb-1.5 text-[14px] font-bold bg-gradient-to-r from-sky-600 via-pink-600 to-orange-600 bg-clip-text text-transparent">
              <Database className="w-3.5 h-3.5 text-pink-500 shrink-0" />
              <span className="truncate">{message.dbSummary}</span>
            </div>
          )}

          {/* Attached images grid (copied from chats) */}
          {Array.isArray(message.images) && message.images.length > 0 && (
            <div
              className={`mb-2 grid gap-1.5 ${
                message.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
              }`}
            >
              {message.images.map((imgUrl, idx) => (
                <button
                  key={`${imgUrl}_${idx}`}
                  type="button"
                  onClick={() => onQuickImagePreview && onQuickImagePreview(imgUrl)}
                  className="relative rounded-2xl overflow-hidden border border-pink-300/80 cursor-pointer block w-full max-h-48"
                >
                  <img
                    src={imgUrl}
                    alt="Вложение"
                    className="w-full h-full max-h-48 object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Message text capped at 10 lines max, then transparent scrollbar */}
          <div className="max-h-[210px] overflow-y-auto consultant-transparent-scroll pr-1.5 text-[14px] text-slate-900 font-medium leading-[21px] break-words [overflow-wrap:anywhere]">
            <MarkdownRenderer content={message.text} />
          </div>

          {/* Footer metadata & copy action */}
          <div className="mt-1.5 pt-1 border-t border-pink-300/40 flex items-center justify-between gap-3">
            <span className="text-[14px] text-slate-600 font-medium select-none">
              {formatMessageTime(message.createdAt)}
            </span>

            <button
              type="button"
              onClick={handleCopy}
              title="Скопировать текст сообщения"
              className="inline-flex items-center gap-1 text-[14px] font-semibold text-pink-700 hover:text-orange-600 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-pink-600 shrink-0" />
                  <span>Скопировано</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                  <span>Копировать</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
