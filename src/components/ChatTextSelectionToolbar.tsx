import React from 'react';
import { ChatGlobalTextToolbar, ChatGlobalTextToolbarProps } from './ChatGlobalTextToolbar';

export interface ChatTextSelectionToolbarProps {
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  text: string;
  onTextChange: (newText: string) => void;
  formatMode: 'v2' | 'rich';
  onQuote?: (text: string) => void;
  onInsertToInput?: (text: string) => void;
}

export const ChatTextSelectionToolbar: React.FC<ChatTextSelectionToolbarProps> = ({
  inputRef,
  text,
  onTextChange,
  formatMode,
  onQuote,
  onInsertToInput
}) => {
  return (
    <ChatGlobalTextToolbar
      inputRef={inputRef}
      inputText={text}
      onInputTextChange={onTextChange}
      formatMode={formatMode}
      onQuote={onQuote}
      onInsertToInput={onInsertToInput}
    />
  );
};

export default ChatTextSelectionToolbar;
