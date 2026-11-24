import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActiveSelectionStyles,
  detectStylesAtRange,
  findMatchingFormatSpan,
  getTextareaCaretCoordinates
} from './formatSpanHelpers';

interface UseEditorFormattingActionsParams {
  postText: string;
  setPostText: React.Dispatch<React.SetStateAction<string>>;
  messageFormat: 'rich' | 'markdown_v2' | 'html';
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
}

export function useEditorFormattingActions({
  postText,
  setPostText,
  messageFormat,
  textareaRef,
  toolbarRef
}: UseEditorFormattingActionsParams) {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const selectionRangeRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [activeStyles, setActiveStyles] = useState<ActiveSelectionStyles>({});
  const [toolbarPos, setToolbarPos] = useState<{
    top: number;
    left: number;
    arrow?: 'top' | 'bottom';
    arrowLeft?: number;
  } | null>(null);

  const pushToHistory = useCallback(
    (nextVal: string) => {
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        const updated = [...sliced, nextVal].slice(-40);
        setHistoryIndex(updated.length - 1);
        return updated;
      });
    },
    [historyIndex]
  );

  const resetHistory = useCallback((initialVal: string) => {
    setHistory([initialVal]);
    setHistoryIndex(0);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setPostText(history[prevIdx]);
    }
  }, [history, historyIndex, setPostText]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= 0 && historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setPostText(history[nextIdx]);
    }
  }, [history, historyIndex, setPostText]);

  const updateFloatingToolbarFromSelection = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    selectionRangeRef.current = { start, end };

    if (start === end) {
      setToolbarPos(null);
      setSelectedText('');
      setActiveStyles({});
      return;
    }

    const sel = el.value.slice(start, end);
    if (!sel.trim()) {
      setToolbarPos(null);
      setSelectedText('');
      return;
    }

    setSelectedText(sel);
    const isRich = messageFormat === 'rich';
    setActiveStyles(detectStylesAtRange(el.value, start, end, isRich));

    const coords = getTextareaCaretCoordinates(el, start);
    const rect = el.getBoundingClientRect();
    const toolbarWidth = Math.min(540, window.innerWidth - 20);
    const rawLeft = rect.left + coords.left - 24;
    const clampedLeft = Math.max(8, Math.min(rawLeft, window.innerWidth - toolbarWidth - 8));
    const arrowLeft = Math.max(18, Math.min(rect.left + coords.left - clampedLeft, toolbarWidth - 28));

    const estimatedHeight = 148;
    const rawTopAbove = rect.top + coords.top - estimatedHeight - 10;
    if (rawTopAbove > 12) {
      setToolbarPos({ top: rawTopAbove, left: clampedLeft, arrow: 'bottom', arrowLeft });
    } else {
      setToolbarPos({
        top: Math.min(window.innerHeight - estimatedHeight - 12, rect.top + coords.top + coords.lineHeight + 10),
        left: clampedLeft,
        arrow: 'top',
        arrowLeft
      });
    }
  }, [messageFormat, textareaRef]);

  useEffect(() => {
    const handleOutsidePress = (e: MouseEvent | TouchEvent) => {
      if (!toolbarPos) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (toolbarRef.current?.contains(target) || textareaRef.current?.contains(target)) {
        return;
      }
      setToolbarPos(null);
    };
    document.addEventListener('mousedown', handleOutsidePress, true);
    document.addEventListener('touchstart', handleOutsidePress, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsidePress, true);
      document.removeEventListener('touchstart', handleOutsidePress, true);
    };
  }, [toolbarPos, textareaRef, toolbarRef]);

  const getSelectionTextSnapshot = useCallback((): string => {
    const el = textareaRef.current;
    if (el) {
      const s = el.selectionStart ?? 0;
      const e = el.selectionEnd ?? 0;
      if (s !== e) {
        selectionRangeRef.current = { start: s, end: e };
        return el.value.slice(s, e);
      }
    }
    const { start, end } = selectionRangeRef.current;
    if (start !== end && postText) {
      return postText.slice(start, end);
    }
    return selectedText || '';
  }, [postText, selectedText, textareaRef]);

  const replaceSelectionWithSnippet = useCallback(
    (snippet: string) => {
      const el = textareaRef.current;
      const liveStart = el ? el.selectionStart ?? 0 : 0;
      const liveEnd = el ? el.selectionEnd ?? 0 : 0;
      const useLive = Boolean(el && (liveStart !== liveEnd || document.activeElement === el));
      const start = useLive ? liveStart : selectionRangeRef.current.start;
      const end = useLive ? liveEnd : selectionRangeRef.current.end;

      const next = postText.slice(0, start) + snippet + postText.slice(end);
      setPostText(next);
      pushToHistory(next);
      setToolbarPos(null);

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const cursorEnd = start + snippet.length;
          textareaRef.current.setSelectionRange(cursorEnd, cursorEnd);
          selectionRangeRef.current = { start: cursorEnd, end: cursorEnd };
        }
      });
    },
    [postText, pushToHistory, setPostText, textareaRef]
  );

  const insertRichTag = useCallback(
    (prefix: string, suffix = '', placeholder = '') => {
      const el = textareaRef.current;
      const start = el ? el.selectionStart : selectionRangeRef.current.start;
      const end = el ? el.selectionEnd : selectionRangeRef.current.end;
      const selected = postText.slice(start, end);
      const inner = selected || placeholder;
      const next = postText.slice(0, start) + prefix + inner + suffix + postText.slice(end);
      setPostText(next);
      pushToHistory(next);

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const cursorStart = start + prefix.length;
          const cursorEnd = cursorStart + inner.length;
          textareaRef.current.setSelectionRange(cursorStart, cursorEnd);
          selectionRangeRef.current = { start: cursorStart, end: cursorEnd };
        }
      });
    },
    [postText, pushToHistory, setPostText, textareaRef]
  );

  const applySmartFormat = useCallback(
    (formatType: string) => {
      const el = textareaRef.current;
      const start = el ? el.selectionStart : selectionRangeRef.current.start;
      const end = el ? el.selectionEnd : selectionRangeRef.current.end;
      const isRich = messageFormat === 'rich';
      const selected = postText.slice(start, end);

      if (formatType === 'clear') {
        const cleaned = selected
          .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
          .replace(/__([\s\S]+?)__/g, '$1')
          .replace(/~~([\s\S]+?)~~/g, '$1')
          .replace(/\|\|([\s\S]+?)\|\|/g, '$1')
          .replace(/```(?:[a-zA-Z0-9_-]*\n)?([\s\S]*?)```/g, '$1')
          .replace(/`([^`]+)`/g, '$1')
          .replace(/\*([^*\n]+)\*/g, '$1')
          .replace(/_([^_\n]+)_/g, '$1')
          .replace(/~([^~\n]+)~/g, '$1')
          .replace(/<\/?(?:b|strong|i|u|s|sup|sub|aside|details|summary)>/gi, '')
          .replace(/^#{1,4}\s+/gm, '')
          .replace(/^(?:\*\*>|>)\s?/gm, '');
        const next = postText.slice(0, start) + cleaned + postText.slice(end);
        setPostText(next);
        pushToHistory(next);
        setToolbarPos(null);
        return;
      }

      const toggleInlineKeys: Record<string, { open: string; close: string; key: keyof ActiveSelectionStyles }> = {
        bold: { open: isRich ? '**' : '*', close: isRich ? '**' : '*', key: 'bold' },
        italic: { open: '_', close: '_', key: 'italic' },
        underline: { open: '__', close: '__', key: 'underline' },
        strike: { open: isRich ? '~~' : '~', close: isRich ? '~~' : '~', key: 'strike' },
        spoiler: { open: '||', close: '||', key: 'spoiler' },
        code: { open: '`', close: '`', key: 'code' },
        code_block: { open: '```\n', close: '\n```', key: 'code_block' },
        sup: { open: '<sup>', close: '</sup>', key: 'sup' },
        sub: { open: '<sub>', close: '</sub>', key: 'sub' },
        aside: { open: '<aside>', close: '</aside>', key: 'aside' }
      };

      if (toggleInlineKeys[formatType]) {
        const cfg = toggleInlineKeys[formatType];
        const existingSpan = findMatchingFormatSpan(postText, start, end, cfg.key, isRich);
        if (existingSpan) {
          const unwrapped = postText.slice(existingSpan.innerStart, existingSpan.innerEnd);
          const next = postText.slice(0, existingSpan.outerStart) + unwrapped + postText.slice(existingSpan.outerEnd);
          setPostText(next);
          pushToHistory(next);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              textareaRef.current.setSelectionRange(
                existingSpan.outerStart,
                existingSpan.outerStart + unwrapped.length
              );
              updateFloatingToolbarFromSelection();
            }
          });
          return;
        }
        insertRichTag(cfg.open, cfg.close, 'текст');
        return;
      }

      if (formatType === 'formula') {
        insertRichTag('$', '$', 'E = mc^2');
        return;
      }
      if (formatType === 'formula_block') {
        insertRichTag('\n$$\n', '\n$$\n', '\\sum_{i=1}^{n} x_i');
        return;
      }
      if (formatType === 'details') {
        insertRichTag('<details>\n<summary>Подробнее</summary>\n', '\n</details>', selected || 'Скрытый текст');
        return;
      }
      if (formatType === 'page_break') {
        insertRichTag('\n---\n', '', '');
        return;
      }
      if (formatType === 'br') {
        insertRichTag('<br>', '', '');
        return;
      }

      if (['h1', 'h2', 'h3', 'h4'].includes(formatType)) {
        const hashes = '#'.repeat(Number(formatType.slice(1))) + ' ';
        const stripped = (selected || 'Заголовок раздела').replace(/^#{1,4}\s+/, '');
        const next = postText.slice(0, start) + hashes + stripped + postText.slice(end);
        setPostText(next);
        pushToHistory(next);
        return;
      }

      if (formatType === 'quote' || formatType === 'expandable_quote') {
        const lines = (selected || 'Текст цитаты').split('\n');
        const formatted =
          formatType === 'expandable_quote'
            ? lines.map((l, idx) => (idx === 0 ? `**> ${l}` : `> ${l}`)).join('\n') + '||'
            : lines.map((l) => `> ${l}`).join('\n');
        const next = postText.slice(0, start) + formatted + postText.slice(end);
        setPostText(next);
        pushToHistory(next);
        return;
      }

      if (formatType === 'bullet_list') {
        const lines = (selected || 'Пункт списка').split('\n').map((l) => `• ${l.replace(/^(?:•|-|\*|\d+\.)\s+/, '')}`);
        const next = postText.slice(0, start) + lines.join('\n') + postText.slice(end);
        setPostText(next);
        pushToHistory(next);
        return;
      }

      if (formatType === 'number_list') {
        const lines = (selected || 'Пункт списка')
          .split('\n')
          .map((l, idx) => `${idx + 1}. ${l.replace(/^(?:•|-|\*|\d+\.)\s+/, '')}`);
        const next = postText.slice(0, start) + lines.join('\n') + postText.slice(end);
        setPostText(next);
        pushToHistory(next);
        return;
      }

      if (formatType === 'checkbox' || formatType === 'checkbox_done') {
        const mark = formatType === 'checkbox_done' ? '- [x] ' : '- [ ] ';
        const lines = (selected || 'Задача')
          .split('\n')
          .map((l) => `${mark}${l.replace(/^(?:(?:•|-|\*|\+)\s+)?(?:\[[ xX✓✔]?\]\s+)?/, '')}`);
        const next = postText.slice(0, start) + lines.join('\n') + postText.slice(end);
        setPostText(next);
        pushToHistory(next);
      }
    },
    [insertRichTag, messageFormat, postText, pushToHistory, setPostText, textareaRef, updateFloatingToolbarFromSelection]
  );

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        applySmartFormat('bold');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        applySmartFormat('italic');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        applySmartFormat('underline');
      }
    },
    [applySmartFormat, handleRedo, handleUndo]
  );

  return {
    history,
    historyIndex,
    canUndo: historyIndex > 0,
    canRedo: historyIndex >= 0 && historyIndex < history.length - 1,
    pushToHistory,
    resetHistory,
    handleUndo,
    handleRedo,
    selectionRangeRef,
    selectedText,
    getSelectionTextSnapshot,
    replaceSelectionWithSnippet,
    activeStyles,
    toolbarPos,
    setToolbarPos,
    updateFloatingToolbarFromSelection,
    insertRichTag,
    applySmartFormat,
    handleTextareaKeyDown
  };
}
