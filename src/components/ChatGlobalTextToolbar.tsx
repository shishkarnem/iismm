import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TelegramFloatingToolbar } from './TelegramFloatingToolbar';
import { detectStylesAtRange, ActiveSelectionStyles } from './PostTelegramEditor';
import { getTextareaCaretCoordinates } from '../utils/caretCoordinates';
import { 
  ChatLinkModal, 
  ChatQuoteModal, 
  ChatTableModal, 
  ChatFormulaModal, 
  ChatMediaModal, 
  ChatCarouselModal,
  ChatCollageModal,
  ChatEmojiTimeModal, 
  ChatAnchorModal,
  ChatModalType 
} from './ChatFormatModals';
import { EditorRichButtonModal } from './post-editor/modals/rich-constructors/EditorRichButtonModal';

export interface ChatGlobalTextToolbarProps {
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  inputText?: string;
  onInputTextChange?: (newText: string) => void;
  containerRef?: React.RefObject<HTMLElement | null>;
  formatMode: 'v2' | 'rich';
  onQuote?: (text: string) => void;
  onInsertToInput?: (text: string) => void;
}

export const ChatGlobalTextToolbar: React.FC<ChatGlobalTextToolbarProps> = ({
  inputRef,
  inputText = '',
  onInputTextChange,
  containerRef,
  formatMode,
  onQuote,
  onInsertToInput
}) => {
  const [toolbarPos, setToolbarPos] = useState<{ 
    top: number; 
    left: number; 
    arrow?: 'top' | 'bottom'; 
    arrowLeft?: number 
  } | null>(null);

  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionSource, setSelectionSource] = useState<'input' | 'message' | null>(null);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const savedModalSelectionRef = useRef<{ start: number; end: number; text: string }>({ start: 0, end: 0, text: '' });
  const [activeStyles, setActiveStyles] = useState<ActiveSelectionStyles>({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    code: false,
    code_block: false,
    spoiler: false,
    link: false,
    quote: false,
    expandable_quote: false,
    h1: false,
    h2: false,
    h3: false,
    h4: false
  });

  const [activeModal, setActiveModal] = useState<ChatModalType>(null);
  const [modalTab, setModalTab] = useState<string | undefined>(undefined);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const lastToolbarHeightRef = useRef<number>(190);
  const lastToolbarWidthRef = useRef<number>(480);
  const lastInputRangeRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const isRich = formatMode === 'rich';

  // Helper to detect if a node is inside chat messages or chat bubble
  const isChatBubbleNode = useCallback((node: Node | null): boolean => {
    if (!node) return false;
    const el = node instanceof HTMLElement ? node : node.parentElement;
    if (!el) return false;
    if (containerRef?.current && containerRef.current.contains(el)) return true;
    return Boolean(
      el.closest('[data-chat-bubble="true"]') ||
      el.closest('#chat-messages-container') ||
      el.closest('[data-chat-message-list="true"]') ||
      el.closest('.chat-message-text')
    );
  }, [containerRef]);

  // Update position from input element selection
  const updateFromInput = useCallback(() => {
    const el = inputRef?.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;

    if (start === end || Math.abs(end - start) < 1) {
      if (!activeModal && selectionSource === 'input') {
        setToolbarPos(null);
        setSelectionSource(null);
      }
      return;
    }

    const currentVal = el.value ?? inputText ?? '';
    const actualStart = Math.min(start, end);
    const actualEnd = Math.max(start, end);
    const selStr = currentVal.substring(actualStart, actualEnd);

    if (!selStr.trim()) {
      if (!activeModal && selectionSource === 'input') {
        setToolbarPos(null);
        setSelectionSource(null);
      }
      return;
    }

    setSelectedText(selStr);
    setSelectionSource('input');
    setSelectionRange({ start: actualStart, end: actualEnd });
    lastInputRangeRef.current = { start: actualStart, end: actualEnd };

    // Detect styles
    const styles = detectStylesAtRange(currentVal, actualStart, actualEnd, isRich);
    setActiveStyles(styles);

    // Compute coordinate relative to selection using caretCoordinates (never mouse click)
    const rect = el.getBoundingClientRect();
    const startCoords = getTextareaCaretCoordinates(el, actualStart);
    const endCoords = getTextareaCaretCoordinates(el, actualEnd);

    const midCaretX = (startCoords.left + endCoords.left) / 2;
    const caretY = Math.min(startCoords.top, endCoords.top);

    const targetViewportX = rect.left + midCaretX - (el.scrollLeft || 0);
    const targetViewportY = rect.top + caretY - (el.scrollTop || 0);

    if (toolbarRef.current && toolbarRef.current.offsetHeight > 60) {
      lastToolbarHeightRef.current = toolbarRef.current.offsetHeight;
    }
    if (toolbarRef.current && toolbarRef.current.offsetWidth > 100) {
      lastToolbarWidthRef.current = toolbarRef.current.offsetWidth;
    }

    const toolbarHeight = Math.max(toolbarRef.current?.offsetHeight || 0, lastToolbarHeightRef.current || 190);
    const toolbarWidth = Math.min(window.innerWidth - 20, Math.max(toolbarRef.current?.offsetWidth || 0, lastToolbarWidthRef.current || 480));
    const lineHeight = startCoords.lineHeight || 24;

    // Positioning 2 lines higher above the selection so it never obscures the selected text or input box!
    const twoLinesOffset = (lineHeight * 2) + 16;
    let top = targetViewportY - toolbarHeight - twoLinesOffset;
    let arrow: 'bottom' | 'top' = 'bottom';

    if (top < 10) {
      top = rect.bottom + 14;
      arrow = 'top';
    }

    let left = targetViewportX - toolbarWidth / 2;
    if (left < 10) left = 10;
    if (left + toolbarWidth > window.innerWidth - 10) {
      left = window.innerWidth - toolbarWidth - 10;
    }

    const arrowLeft = Math.max(20, Math.min(toolbarWidth - 20, targetViewportX - left));

    setToolbarPos({
      top,
      left,
      arrow,
      arrowLeft
    });
  }, [inputRef, inputText, isRich, activeModal, selectionSource]);

  // Update position from window/document selection (messages text)
  const updateFromWindowSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      if (
        !activeModal &&
        (selectionSource === 'message' ||
          (selectionSource === 'input' && inputRef?.current && document.activeElement !== inputRef.current))
      ) {
        setToolbarPos(null);
        setSelectionSource(null);
      }
      return;
    }

    // If active element is an input or textarea and selection is inside it, let input handler manage it
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      if (sel.anchorNode && (document.activeElement === sel.anchorNode || document.activeElement.contains(sel.anchorNode))) {
        return;
      }
    }

    const text = sel.toString().trim();
    if (!text || text.length < 1) {
      if (!activeModal && selectionSource === 'message') {
        setToolbarPos(null);
        setSelectionSource(null);
      }
      return;
    }

    // Check if selection is inside chat messages
    const anchorNode = sel.anchorNode;
    const focusNode = sel.focusNode;
    if (!isChatBubbleNode(anchorNode) && !isChatBubbleNode(focusNode)) {
      if (!activeModal && selectionSource === 'message') {
        setToolbarPos(null);
        setSelectionSource(null);
      }
      return;
    }

    try {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        if (!activeModal) setToolbarPos(null);
        return;
      }

      if (toolbarRef.current && toolbarRef.current.offsetHeight > 60) {
        lastToolbarHeightRef.current = toolbarRef.current.offsetHeight;
      }
      if (toolbarRef.current && toolbarRef.current.offsetWidth > 100) {
        lastToolbarWidthRef.current = toolbarRef.current.offsetWidth;
      }

      const toolbarHeight = Math.max(toolbarRef.current?.offsetHeight || 0, lastToolbarHeightRef.current || 190);
      const toolbarWidth = Math.min(window.innerWidth - 20, Math.max(toolbarRef.current?.offsetWidth || 0, lastToolbarWidthRef.current || 480));
      const lineHeight = rect.height || 24;
      const twoLinesOffset = (lineHeight * 2) + 16;

      const targetX = rect.left + rect.width / 2;
      let top = rect.top - toolbarHeight - twoLinesOffset;
      let arrow: 'bottom' | 'top' = 'bottom';

      if (top < 10) {
        top = rect.bottom + 14;
        arrow = 'top';
      }

      let left = targetX - toolbarWidth / 2;
      if (left < 10) left = 10;
      if (left + toolbarWidth > window.innerWidth - 10) {
        left = window.innerWidth - toolbarWidth - 10;
      }

      const arrowLeft = Math.max(20, Math.min(toolbarWidth - 20, targetX - left));

      setSelectedText(text);
      setSelectionSource('message');
      setActiveStyles(detectStylesAtRange(text, 0, text.length, isRich));
      setToolbarPos({
        top,
        left,
        arrow,
        arrowLeft
      });
    } catch (err) {
      if (!activeModal) setToolbarPos(null);
    }
  }, [isChatBubbleNode, isRich, activeModal, selectionSource]);

  // Set up event listeners on input and document
  useEffect(() => {
    const el = inputRef?.current;

    const handleInputSelect = () => {
      setTimeout(updateFromInput, 15);
    };

    const handleInputKeyUp = (e: KeyboardEvent) => {
      if (['Shift', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        setTimeout(updateFromInput, 15);
      }
    };

    if (el) {
      el.addEventListener('select', handleInputSelect);
      el.addEventListener('mouseup', handleInputSelect);
      el.addEventListener('keyup', handleInputKeyUp);
      el.addEventListener('touchend', handleInputSelect);
    }

    const handleDocumentSelectionChange = () => {
      // Small debounce
      setTimeout(() => {
        if (inputRef?.current && document.activeElement === inputRef.current) {
          updateFromInput();
        } else {
          updateFromWindowSelection();
        }
      }, 20);
    };

    document.addEventListener('selectionchange', handleDocumentSelectionChange);
    document.addEventListener('mouseup', handleDocumentSelectionChange);
    document.addEventListener('touchend', handleDocumentSelectionChange);

    return () => {
      if (el) {
        el.removeEventListener('select', handleInputSelect);
        el.removeEventListener('mouseup', handleInputSelect);
        el.removeEventListener('keyup', handleInputKeyUp);
        el.removeEventListener('touchend', handleInputSelect);
      }
      document.removeEventListener('selectionchange', handleDocumentSelectionChange);
      document.removeEventListener('mouseup', handleDocumentSelectionChange);
      document.removeEventListener('touchend', handleDocumentSelectionChange);
    };
  }, [inputRef, updateFromInput, updateFromWindowSelection]);

  // Close floating toolbar when clicking or tapping outside both the toolbar and its linked input
  useEffect(() => {
    if (!toolbarPos || activeModal) return;

    const handleOutsidePress = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (toolbarRef.current?.contains(target)) return;
      if (inputRef?.current && (inputRef.current === target || inputRef.current.contains(target))) {
        return;
      }
      setToolbarPos(null);
      setSelectionSource(null);
    };

    document.addEventListener('mousedown', handleOutsidePress, true);
    document.addEventListener('touchstart', handleOutsidePress, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsidePress, true);
      document.removeEventListener('touchstart', handleOutsidePress, true);
    };
  }, [toolbarPos, activeModal, inputRef]);

  // Format formatting transformer
  const formatTextSnippet = (sel: string, formatType: string): string => {
    if (!sel) return '';
    if (isRich) {
      switch (formatType) {
        case 'bold': return `<b>${sel}</b>`;
        case 'italic': return `<i>${sel}</i>`;
        case 'underline': return `<u>${sel}</u>`;
        case 'strike': return `<s>${sel}</s>`;
        case 'spoiler': return `<tg-spoiler>${sel}</tg-spoiler>`;
        case 'code': return `<code>${sel}</code>`;
        case 'code_block': return `<pre><code>${sel}</code></pre>`;
        case 'sup': return `<sup>${sel}</sup>`;
        case 'sub': return `<sub>${sel}</sub>`;
        case 'h1': return sel.startsWith('# ') ? sel.slice(2) : `# ${sel.replace(/^#{1,4}\s+/, '')}`;
        case 'h2': return sel.startsWith('## ') ? sel.slice(3) : `## ${sel.replace(/^#{1,4}\s+/, '')}`;
        case 'h3': return sel.startsWith('### ') ? sel.slice(4) : `### ${sel.replace(/^#{1,4}\s+/, '')}`;
        case 'h4': return sel.startsWith('#### ') ? sel.slice(5) : `#### ${sel.replace(/^#{1,4}\s+/, '')}`;
        case 'quote': return `<blockquote>${sel}</blockquote>`;
        case 'expandable_quote': return `<blockquote expandable>${sel}</blockquote>`;
        case 'bullet_list':
          return sel.split('\n').map(l => `• ${l.replace(/^[-*•]\s*/, '')}`).join('\n');
        case 'number_list':
          return sel.split('\n').map((l, i) => `${i + 1}. ${l.replace(/^\d+[\.\)]\s*/, '')}`).join('\n');
        case 'checkbox':
          return sel.split('\n').map(l => `[ ] ${l.replace(/^\[[ xX]\]\s*/, '')}`).join('\n');
        case 'checkbox_done':
          return sel.split('\n').map(l => `[x] ${l.replace(/^\[[ xX]\]\s*/, '')}`).join('\n');
        case 'details':
          return `<details>\n<summary>${sel}</summary>\nПодробный текст раскрывающегося блока...\n</details>`;
        case 'page_break':
          return `${sel}\n<hr>\n`;
        case 'tg_time': {
          const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `${sel} ⏱ ${nowTime}`;
        }
        case 'clear':
          return sel.replace(/<[^>]+>/g, '').replace(/[*_~`]/g, '').replace(/^#{1,4}\s+/gm, '');
        default:
          return sel;
      }
    } else {
      // Markdown V2 Mode
      switch (formatType) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
          return `*${sel}*`;
        case 'bold': return `*${sel}*`;
        case 'italic': return `_${sel}_`;
        case 'underline': return `__${sel}__`;
        case 'strike': return `~${sel}~`;
        case 'spoiler': return `||${sel}||`;
        case 'code': return `\`${sel}\``;
        case 'code_block': return `\`\`\`\n${sel}\n\`\`\``;
        case 'quote':
          return sel.split('\n').map(l => `>${l}`).join('\n');
        case 'expandable_quote':
          return `**>${sel}`;
        case 'clear':
          return sel.replace(/[*_~`|]/g, '');
        default:
          return sel;
      }
    }
  };

  // Handle format button click from floating toolbar
  const handleApplyFormat = (formatType: string) => {
    // Intercept constructor / modal actions so clicking them in the toolbar opens the constructor section instead of raw format text
    if (formatType === 'collage') {
      setActiveModal('collage');
      return;
    }
    if (formatType === 'carousel' || formatType === 'slideshow') {
      setActiveModal('carousel');
      return;
    }
    if (formatType === 'time' || formatType === 'tg_time') {
      setModalTab('time');
      setActiveModal('emoji_time');
      return;
    }
    if (formatType === 'emoji_time' || formatType === 'custom_emoji') {
      setModalTab('emoji');
      setActiveModal('emoji_time');
      return;
    }
    if (formatType === 'media') {
      setActiveModal('media');
      return;
    }
    if (formatType === 'table') {
      setActiveModal('table');
      return;
    }
    if (formatType === 'formula' || formatType === 'latex') {
      setActiveModal('formula');
      return;
    }
    if (formatType === 'link') {
      setActiveModal('link');
      return;
    }
    if (formatType === 'anchors' || formatType === 'anchor') {
      setActiveModal('anchors');
      return;
    }
    if (formatType === 'buttons' || formatType === 'button') {
      captureSelectionForModal();
      setActiveModal('buttons');
      return;
    }

    if (['h1', 'h2', 'h3', 'h4'].includes(formatType)) {
      if (selectionSource === 'input' && inputRef?.current && onInputTextChange) {
        const el = inputRef.current;
        const currentVal = el.value ?? inputText ?? '';
        const start = el.selectionStart ?? selectionRange.start;
        const end = el.selectionEnd ?? selectionRange.end;

        const openTag = formatType === 'h1' ? '# ' : formatType === 'h2' ? '## ' : formatType === 'h3' ? '### ' : '#### ';
        let lineStart = currentVal.lastIndexOf('\n', start - 1) + 1;
        let lineEnd = currentVal.indexOf('\n', end);
        if (lineEnd === -1) lineEnd = currentVal.length;
        const currentLine = currentVal.substring(lineStart, lineEnd);

        let newLine = currentLine;
        if (currentLine.startsWith(openTag)) {
          // Toggle off
          newLine = currentLine.substring(openTag.length);
        } else {
          // Replace any existing markdown heading tag and prepend new openTag
          const clean = currentLine.replace(/^(?:#{1,6}\s+|>\s+)/, '');
          newLine = `${openTag}${clean || 'Заголовок'}`;
        }

        const newFull = currentVal.substring(0, lineStart) + newLine + currentVal.substring(lineEnd);
        onInputTextChange(newFull);
        setTimeout(() => {
          if (el) {
            el.focus();
            el.setSelectionRange(lineStart, lineStart + newLine.length);
          }
        }, 30);
        return;
      }
    }

    if (selectionSource === 'input' && inputRef?.current && onInputTextChange) {
      const el = inputRef.current;
      const currentVal = el.value ?? inputText ?? '';
      const start = el.selectionStart ?? selectionRange.start;
      const end = el.selectionEnd ?? selectionRange.end;
      const sel = currentVal.substring(start, end);
      if (!sel) return;

      const before = currentVal.substring(0, start);
      const after = currentVal.substring(end);
      const formatted = formatTextSnippet(sel, formatType);
      const newFull = before + formatted + after;

      onInputTextChange(newFull);
      setTimeout(() => {
        if (el) {
          el.focus();
          el.setSelectionRange(start, start + formatted.length);
        }
      }, 30);
    } else if (selectionSource === 'message') {
      // Selected inside a message
      const formatted = formatTextSnippet(selectedText, formatType);
      if (onInsertToInput) {
        onInsertToInput(formatted);
      } else if (inputRef?.current && onInputTextChange) {
        const currentVal = inputRef.current.value ?? inputText ?? '';
        const updated = currentVal ? `${currentVal} ${formatted}` : formatted;
        onInputTextChange(updated);
        inputRef.current.focus();
      }
      setToolbarPos(null);
    }
  };

  // Handle inserting from modal dialogs
  const handleInsertFormatted = (formattedSnippet: string) => {
    if (!formattedSnippet) {
      setActiveModal(null);
      return;
    }

    if (inputRef?.current && onInputTextChange) {
      const el = inputRef.current;
      const currentVal = el.value ?? inputText ?? '';
      let start = savedModalSelectionRef.current.start;
      let end = savedModalSelectionRef.current.end;

      if (start === 0 && end === 0) {
        start = selectionRange.start;
        end = selectionRange.end;
      }
      if (start === 0 && end === 0 && (lastInputRangeRef.current.start !== 0 || lastInputRangeRef.current.end !== 0)) {
        start = lastInputRangeRef.current.start;
        end = lastInputRangeRef.current.end;
      }
      if (start === 0 && end === 0 && typeof el.selectionStart === 'number') {
        start = el.selectionStart;
        end = el.selectionEnd;
      }

      const safeStart = Math.min(start, end);
      const safeEnd = Math.max(start, end);

      const before = currentVal.substring(0, safeStart);
      const after = currentVal.substring(safeEnd);
      const newFull = before + formattedSnippet + after;

      onInputTextChange(newFull);
      setActiveModal(null);
      setToolbarPos(null);
      savedModalSelectionRef.current = { start: 0, end: 0, text: '' };

      setTimeout(() => {
        if (el) {
          el.focus();
          const targetPos = safeStart + formattedSnippet.length;
          el.setSelectionRange(targetPos, targetPos);
        }
      }, 50);
      return;
    }

    // Fallback: message selection or external input
    if (onInsertToInput) {
      onInsertToInput(formattedSnippet);
    } else if (inputRef?.current && onInputTextChange) {
      const currentVal = inputRef.current.value ?? inputText ?? '';
      const updated = currentVal ? `${currentVal} ${formattedSnippet}` : formattedSnippet;
      onInputTextChange(updated);
      inputRef.current.focus();
    }
    setActiveModal(null);
    setToolbarPos(null);
    savedModalSelectionRef.current = { start: 0, end: 0, text: '' };
  };

  const captureSelectionForModal = () => {
    let s = selectionRange.start;
    let e = selectionRange.end;
    if (s === 0 && e === 0 && (lastInputRangeRef.current.start !== 0 || lastInputRangeRef.current.end !== 0)) {
      s = lastInputRangeRef.current.start;
      e = lastInputRangeRef.current.end;
    }
    if (s === 0 && e === 0 && inputRef?.current) {
      s = inputRef.current.selectionStart ?? 0;
      e = inputRef.current.selectionEnd ?? 0;
    }
    savedModalSelectionRef.current = { start: s, end: e, text: selectedText };
  };

  const handleClose = () => {
    setToolbarPos(null);
    setActiveModal(null);
    setSelectionSource(null);
  };

  const handleQuoteClick = (textToQuote: string) => {
    if (onQuote) {
      onQuote(textToQuote);
    } else if (onInsertToInput) {
      const quoted = isRich ? `<blockquote>${textToQuote}</blockquote>\n` : `>${textToQuote}\n`;
      onInsertToInput(quoted);
    }
    handleClose();
  };

  const handleInsertToInputClick = (textToInsert: string) => {
    if (onInsertToInput) {
      onInsertToInput(textToInsert);
    } else if (inputRef?.current && onInputTextChange) {
      const currentVal = inputRef.current.value ?? inputText ?? '';
      const updated = currentVal ? `${currentVal} ${textToInsert}` : textToInsert;
      onInputTextChange(updated);
      inputRef.current.focus();
    }
    handleClose();
  };

  return (
    <>
      {/* Global Floating Toolbar */}
      {toolbarPos && !activeModal && (
        <TelegramFloatingToolbar
          toolbarRef={toolbarRef}
          toolbarPos={toolbarPos}
          selectedText={selectedText}
          messageFormat={isRich ? 'rich' : 'markdown_v2'}
          activeStyles={activeStyles}
          onApplyFormat={handleApplyFormat}
          onOpenLinkModal={() => {
            captureSelectionForModal();
            setActiveModal('link');
          }}
          onOpenTableModal={() => {
            captureSelectionForModal();
            setActiveModal('table');
          }}
          onOpenMediaModal={(tab) => {
            captureSelectionForModal();
            setModalTab(tab || 'photo');
            setActiveModal('media');
          }}
          onOpenButtonModal={() => {
            captureSelectionForModal();
            setActiveModal('buttons');
          }}
          onOpenCarouselModal={() => {
            captureSelectionForModal();
            setModalTab('slideshow');
            setActiveModal('carousel');
          }}
          onOpenCollageModal={() => {
            captureSelectionForModal();
            setModalTab('collage');
            setActiveModal('collage');
          }}
          onOpenFormulaModal={() => {
            captureSelectionForModal();
            setActiveModal('formula');
          }}
          onOpenQuoteModal={() => {
            captureSelectionForModal();
            setActiveModal('quote');
          }}
          onOpenEmojiTimeModal={(tab) => {
            if (tab === 'latex') {
              setActiveModal('formula');
            } else {
              setModalTab(tab || 'emoji');
              setActiveModal('emoji_time');
            }
          }}
          onOpenAnchorModal={(tab) => {
            setModalTab(tab || 'create');
            setActiveModal('anchors');
          }}
          onClose={handleClose}
          isFixed={true}
          onQuote={handleQuoteClick}
          onInsertToInput={handleInsertToInputClick}
          onCopy={(str) => {
            if (navigator.clipboard?.writeText) {
              navigator.clipboard.writeText(str);
            }
          }}
        />
      )}

      {/* Global Modals matching Post Editor */}
      <ChatLinkModal
        isOpen={activeModal === 'link'}
        onClose={() => setActiveModal(null)}
        initialText={selectedText}
        formatMode={formatMode}
        onApply={handleInsertFormatted}
      />

      <ChatQuoteModal
        isOpen={activeModal === 'quote'}
        onClose={() => setActiveModal(null)}
        initialText={selectedText}
        formatMode={formatMode}
        onApply={handleInsertFormatted}
      />

      <ChatTableModal
        isOpen={activeModal === 'table'}
        onClose={() => setActiveModal(null)}
        formatMode={formatMode}
        onApply={handleInsertFormatted}
      />

      <ChatFormulaModal
        isOpen={activeModal === 'formula'}
        onClose={() => setActiveModal(null)}
        initialText={selectedText}
        formatMode={formatMode}
        onApply={handleInsertFormatted}
      />

      <ChatMediaModal
        isOpen={activeModal === 'media'}
        onClose={() => setActiveModal(null)}
        initialType={(modalTab as any) || 'photo'}
        initialCaption={selectedText}
        formatMode={formatMode}
        onApply={handleInsertFormatted}
      />

      <ChatCarouselModal
        isOpen={activeModal === 'carousel'}
        onClose={() => setActiveModal(null)}
        initialCaption={selectedText}
        formatMode={formatMode}
        onApply={handleInsertFormatted}
      />

      <ChatCollageModal
        isOpen={activeModal === 'collage'}
        onClose={() => setActiveModal(null)}
        initialCaption={selectedText}
        formatMode={formatMode}
        onApply={handleInsertFormatted}
      />

      <ChatEmojiTimeModal
        isOpen={activeModal === 'emoji_time'}
        onClose={() => setActiveModal(null)}
        initialTab={(modalTab as any) || 'emoji'}
        formatMode={formatMode}
        onApply={handleInsertFormatted}
      />

      <ChatAnchorModal
        isOpen={activeModal === 'anchors'}
        onClose={() => setActiveModal(null)}
        initialText={selectedText}
        initialTab={(modalTab as any) || 'create'}
        formatMode={formatMode}
        onApply={handleInsertFormatted}
      />

      <EditorRichButtonModal
        open={activeModal === 'buttons'}
        onClose={() => setActiveModal(null)}
        initialText={selectedText}
        onInsertButtonMarkup={handleInsertFormatted}
      />
    </>
  );
};

export default ChatGlobalTextToolbar;
