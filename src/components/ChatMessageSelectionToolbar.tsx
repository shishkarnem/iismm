import React from 'react';
import { ChatGlobalTextToolbar } from './ChatGlobalTextToolbar';

export interface ChatMessageSelectionToolbarProps {
  containerRef?: React.RefObject<HTMLElement | null>;
  formatMode: 'v2' | 'rich';
  onQuote: (text: string) => void;
  onInsertToInput: (text: string) => void;
}

export const ChatMessageSelectionToolbar: React.FC<ChatMessageSelectionToolbarProps> = ({
  containerRef,
  formatMode,
  onQuote,
  onInsertToInput
}) => {
  return (
    <ChatGlobalTextToolbar
      containerRef={containerRef}
      formatMode={formatMode}
      onQuote={onQuote}
      onInsertToInput={onInsertToInput}
    />
  );
};

export default ChatMessageSelectionToolbar;
