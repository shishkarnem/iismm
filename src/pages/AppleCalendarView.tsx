import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Download, 
  History as HistoryIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  CalendarDays,
  FileText,
  Filter,
  Trash2,
  Image as ImageIcon,
  Edit3,
  ExternalLink,
  Tag,
  Radio,
  Sparkles,
  Code,
  ArrowUpDown,
  Layers,
  Bot,
  FileEdit,
  Copy,
  Check,
  Upload,
  Plus,
  RefreshCw,
  X,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  FileSpreadsheet,
  HelpCircle,
  Info,
  ChevronDown
} from 'lucide-react';
import { DayRequest, Publication, Channel, User } from '../types';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { AcademyHelpButton } from '../components/academy/AcademyHelpModal';
import { stripDuplicateTitleFromPostContent } from '../utils/formatting/postTitleAndTagHelpers';
import {
  UnifiedPublicationItem,
  buildUnifiedCalendarItems,
  getCalendarStatusRuLabel
} from '../utils/calendar/calendarStatusHelpers';
import { CalendarPostPreviewModal } from '../components/calendar/CalendarPostPreviewModal';

export type { UnifiedPublicationItem };

interface AppleCalendarViewProps {
  dayRequests: DayRequest[];
  publications: Publication[];
  channels: Channel[];
  currentUser?: User | null;
  handleExportCSV: () => void;
  setActiveTab?: (tab: string) => void;
  onSelectPostForEdit?: (postId: string) => void;
  onDeletePublication?: (id: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
  initialViewMode?: 'calendar' | 'history';
}

export default function AppleCalendarView({
  dayRequests,
  publications,
  channels,
  currentUser = null,
  handleExportCSV,
  setActiveTab,
  onSelectPostForEdit,
  onDeletePublication,
  onRefresh,
  initialViewMode = 'calendar'
}: AppleCalendarViewProps) {
  // Calendar View Mode: 'calendar' (Apple Grid) or 'history' (Log Table)
  const [viewMode, setViewMode] = useState<'calendar' | 'history'>(initialViewMode);

  useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);

  // Helper for route push
  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('popstate'));
  };

  // Status Banner Message
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Multi-Selection state
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());

  // Delete Confirmation Modal state
  const [deleteModalTarget, setDeleteModalTarget] = useState<{
    type: 'single' | 'selected' | 'filtered';
    post?: UnifiedPublicationItem;
    count?: number;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Column Sort state
  const [sortColumn, setSortColumn] = useState<'id' | 'date' | 'title' | 'channel' | 'format' | 'status' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Per-column filters
  const [colFilterId, setColFilterId] = useState('');
  const [colFilterTitle, setColFilterTitle] = useState('');
  const [colFilterChannels, setColFilterChannels] = useState<string[]>([]);
  const [colFilterFormats, setColFilterFormats] = useState<string[]>([]);
  const [colFilterStatuses, setColFilterStatuses] = useState<string[]>([]);
  const [activeHeaderFilter, setActiveHeaderFilter] = useState<'id' | 'title' | 'channel' | 'format' | 'status' | null>(null);

  // Manual Add Post Modal state
  const [isManualAddModalOpen, setIsManualAddModalOpen] = useState(false);
  const [manualId, setManualId] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [titleUniquenessInfo, setTitleUniquenessInfo] = useState<{ isUnique: boolean; suggestedTitle: string } | null>(null);
  const [manualText, setManualText] = useState('');
  const [manualChannel, setManualChannel] = useState('');
  const [manualStatus, setManualStatus] = useState<'создается' | 'отложено' | 'опубликовано'>('создается');
  const [manualFormat, setManualFormat] = useState<'v2' | 'rich'>('v2');
  const [manualCategory, setManualCategory] = useState('Общее');
  const [manualDisplayDate, setManualDisplayDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [manualSignature, setManualSignature] = useState('');
  const [isSavingManualPost, setIsSavingManualPost] = useState(false);

  // CSV Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importParsedPosts, setImportParsedPosts] = useState<any[]>([]);
  const [importAutoCorrectCount, setImportAutoCorrectCount] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate unique post ID
  const generateNewPostId = () => {
    const timestamp = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 6);
    return `p_${timestamp}_${rand}`;
  };

  // Live title uniqueness check
  useEffect(() => {
    if (!manualTitle.trim()) {
      setTitleUniquenessInfo(null);
      return;
    }
    const timer = setTimeout(() => {
      fetch('/api/history/check-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: manualTitle.trim() })
      })
        .then(res => res.json())
        .then(data => {
          setTitleUniquenessInfo(data);
        })
        .catch(() => null);
    }, 250);
    return () => clearTimeout(timer);
  }, [manualTitle]);

  // Month & Year state
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());

  // Preview Modal state
  const [previewPublication, setPreviewPublication] = useState<UnifiedPublicationItem | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'creating' | 'scheduled' | 'published' | 'failed'>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | 'v2' | 'rich'>('all');
  const [originFilter, setOriginFilter] = useState<'all' | 'auto' | 'manual'>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'category'>('newest');

  // Month navigation helpers
  const prevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDay(today.getDate());
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNamesRu = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const daysOfWeekRu = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  // Days in month calculation
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const totalDays = lastDayOfMonth.getDate();

  // Convert Sunday-first day index to Monday-first (0 = Monday, 6 = Sunday)
  let startingDayIndex = firstDayOfMonth.getDay() - 1;
  if (startingDayIndex === -1) startingDayIndex = 6;

  const todayDate = new Date();
  const isCurrentMonthToday = todayDate.getFullYear() === year && todayDate.getMonth() === month;

  const safePublications = Array.isArray(publications) ? publications : [];
  const safeDayRequests = Array.isArray(dayRequests) ? dayRequests : [];

  // Helper to find associated prompt / dayRequest to determine category or schedule type
  const promptMap = useMemo(() => {
    const map = new Map<string, DayRequest>();
    safeDayRequests.forEach(d => {
      if (d.id) map.set(d.id, d);
    });
    return map;
  }, [safeDayRequests]);

  // Unified items combining posts table (dayRequests) and publications
  const unifiedItems = useMemo<UnifiedPublicationItem[]>(
    () => buildUnifiedCalendarItems(safeDayRequests, safePublications, channels),
    [safeDayRequests, safePublications, channels]
  );

  // Extract unique categories
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    unifiedItems.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).filter(Boolean);
  }, [unifiedItems]);

  // Helper to determine exact publication message format (V2 vs Rich)
  const getPublicationFormat = (item: UnifiedPublicationItem): 'v2' | 'rich' => {
    const text = item.text || '';
    const hasRich = /(?:^|\n)\s*#{1,6}\s+|<details|<tg-collage|<tg-slideshow|!\[.*?\]\s*\([^\)]+\)|\[[\u200B\s]*\]\s*\(https?:|\|:?---|-(?:\s*\[[ xX]\])|<table>|<blockquote>|<spoiler>|<\/tg-/i.test(text);
    if (item.messageFormat === 'rich' || item.messageFormat === 'html' || hasRich) return 'rich';
    return 'v2';
  };

  // Global Filtered and Sorted publications
  const filteredPublications = useMemo(() => {
    let result = unifiedItems.filter(item => {
      const title = item.promptTitle || '';
      const text = item.text || '';
      const postId = item.postId || '';
      const pubCategory = item.category || '';

      // Search match (postId, title, text, or category)
      const matchesSearch = !searchQuery || 
        postId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.channel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pubCategory.toLowerCase().includes(searchQuery.toLowerCase());

      // Channel filter
      const matchesChannel = !channelFilter || (item.channel && item.channel.includes(channelFilter));
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || item.normStatus === statusFilter;

      // Format filter
      const pubFormat = getPublicationFormat(item);
      const isRichText = pubFormat === 'rich';
      const matchesFormat = formatFilter === 'all' ||
        (formatFilter === 'rich' && isRichText) ||
        (formatFilter === 'v2' && !isRichText);

      // Origin filter (auto vs manual)
      const matchesOrigin = originFilter === 'all' ||
        (originFilter === 'auto' && item.isAuto) ||
        (originFilter === 'manual' && !item.isAuto);

      // Category filter
      const matchesCategory = !categoryFilter || pubCategory === categoryFilter;

      return matchesSearch && matchesChannel && matchesStatus && matchesFormat && matchesOrigin && matchesCategory;
    });

    // Sorting
    return result.sort((a, b) => {
      const dateA = new Date(a.displayDate).getTime() || 0;
      const dateB = new Date(b.displayDate).getTime() || 0;

      if (sortBy === 'newest') {
        return dateB - dateA;
      }
      if (sortBy === 'oldest') {
        return dateA - dateB;
      }
      if (sortBy === 'title') {
        return (a.promptTitle || '').localeCompare(b.promptTitle || '');
      }
      if (sortBy === 'category') {
        const catA = a.category || '';
        const catB = b.category || '';
        return catA.localeCompare(catB);
      }
      return 0;
    });
  }, [unifiedItems, searchQuery, channelFilter, statusFilter, formatFilter, originFilter, categoryFilter, sortBy]);

  // Get publications for a specific day in the selected month
  const getPublicationsForDay = (dayNum: number) => {
    return filteredPublications.filter(p => {
      if (!p.displayDate) return false;
      const pDate = new Date(p.displayDate);
      if (isNaN(pDate.getTime())) return false;
      return pDate.getFullYear() === year && pDate.getMonth() === month && pDate.getDate() === dayNum;
    });
  };

  const selectedDayPubs = selectedDay ? getPublicationsForDay(selectedDay) : [];

  // Status counts based on unified items
  const creatingCount = useMemo(() => unifiedItems.filter(p => p.normStatus === 'creating').length, [unifiedItems]);
  const scheduledCount = useMemo(() => unifiedItems.filter(p => p.normStatus === 'scheduled').length, [unifiedItems]);
  const publishedCount = useMemo(() => unifiedItems.filter(p => p.normStatus === 'published').length, [unifiedItems]);
  const failedCount = useMemo(() => unifiedItems.filter(p => p.normStatus === 'failed').length, [unifiedItems]);

  // Dedicated memo for History Table combining base filters, per-column filters, and column header sorting
  const historyTablePublications = useMemo(() => {
    let list = [...filteredPublications];

    // Column Filters
    if (colFilterId.trim()) {
      const q = colFilterId.toLowerCase().trim();
      list = list.filter(item => (item.postId || '').toLowerCase().includes(q));
    }
    if (colFilterTitle.trim()) {
      const q = colFilterTitle.toLowerCase().trim();
      list = list.filter(item => 
        (item.promptTitle || '').toLowerCase().includes(q) || 
        (item.text || '').toLowerCase().includes(q)
      );
    }
    if (colFilterChannels.length > 0) {
      list = list.filter(item => colFilterChannels.includes(item.channel));
    }
    if (colFilterFormats.length > 0) {
      list = list.filter(item => {
        const fmt = getPublicationFormat(item);
        return colFilterFormats.includes(fmt);
      });
    }
    if (colFilterStatuses.length > 0) {
      list = list.filter(item => colFilterStatuses.includes(item.normStatus));
    }

    // Column Header Sorting
    if (sortColumn) {
      list.sort((a, b) => {
        let cmp = 0;
        if (sortColumn === 'id') {
          cmp = (a.postId || '').localeCompare(b.postId || '', undefined, { numeric: true });
        } else if (sortColumn === 'date') {
          const tA = new Date(a.displayDate).getTime() || 0;
          const tB = new Date(b.displayDate).getTime() || 0;
          cmp = tA - tB;
        } else if (sortColumn === 'title') {
          cmp = (a.promptTitle || '').localeCompare(b.promptTitle || '');
        } else if (sortColumn === 'channel') {
          cmp = (a.channel || '').localeCompare(b.channel || '');
        } else if (sortColumn === 'format') {
          const fA = getPublicationFormat(a);
          const fB = getPublicationFormat(b);
          cmp = fA.localeCompare(fB);
        } else if (sortColumn === 'status') {
          cmp = (a.normStatus || '').localeCompare(b.normStatus || '');
        }
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  }, [
    filteredPublications, 
    colFilterId, 
    colFilterTitle, 
    colFilterChannels, 
    colFilterFormats, 
    colFilterStatuses, 
    sortColumn, 
    sortDirection
  ]);

  // Unique channels for column filter dropdown
  const availableChannels = useMemo(() => {
    const set = new Set<string>();
    channels.forEach(c => {
      if (c.username) set.add(c.username);
    });
    unifiedItems.forEach(item => {
      if (item.channel) set.add(item.channel);
    });
    return Array.from(set).filter(Boolean);
  }, [channels, unifiedItems]);

  // Header sort toggle helper
  const handleToggleSort = (column: 'id' | 'date' | 'title' | 'channel' | 'format' | 'status') => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortColumn(null);
      setSortDirection('desc');
    }
  };

  // Check if all current filtered rows in history are selected
  const isAllHistorySelected = historyTablePublications.length > 0 && 
    historyTablePublications.every(p => selectedPostIds.has(p.postId || p.id));

  const handleToggleSelectAll = () => {
    if (isAllHistorySelected) {
      setSelectedPostIds(new Set());
    } else {
      const allIds = new Set(historyTablePublications.map(p => p.postId || p.id));
      setSelectedPostIds(allIds);
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedPostIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Execution of deletion (single, selected, or filtered)
  const handleConfirmDelete = async () => {
    if (!deleteModalTarget) return;
    setIsDeleting(true);
    let idsToDelete: string[] = [];

    if (deleteModalTarget.type === 'single' && deleteModalTarget.post) {
      idsToDelete = [deleteModalTarget.post.id, deleteModalTarget.post.postId];
    } else if (deleteModalTarget.type === 'selected') {
      idsToDelete = Array.from(selectedPostIds);
    } else if (deleteModalTarget.type === 'filtered') {
      idsToDelete = historyTablePublications.map(p => p.id || p.postId);
    }

    try {
      const res = await fetch('/api/history/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postIds: idsToDelete })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedPostIds(new Set());
        setDeleteModalTarget(null);
        setStatusMessage({
          type: 'success',
          text: `Успешно удалено записей: ${data.count || idsToDelete.length}`
        });
        if (onRefresh) await onRefresh();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Ошибка удаления записей' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e.message || 'Ошибка сети при удалении' });
    } finally {
      setIsDeleting(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // CSV Template download
  const handleDownloadCsvTemplate = () => {
    const userId = currentUser?.id || '16926299042';
    const a = document.createElement('a');
    a.href = `/api/history/csv-template?userId=${encodeURIComponent(userId)}`;
    a.download = 'history_posts_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // CSV File select & parse
  const handleCsvFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseAndPrepareCsv(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const parseAndPrepareCsv = (content: string) => {
    const cleanContent = content.replace(/^\uFEFF/, '').trim();
    if (!cleanContent) {
      setStatusMessage({ type: 'error', text: 'CSV файл пуст' });
      return;
    }

    const lines = cleanContent.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      setStatusMessage({ type: 'error', text: 'CSV файл должен содержать строку заголовков и хотя бы одну запись' });
      return;
    }

    const firstLine = lines[0];
    const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

    const parseCsvRow = (rowText: string): string[] => {
      const result: string[] = [];
      let current = '';
      let insideQuotes = false;
      for (let i = 0; i < rowText.length; i++) {
        const char = rowText[i];
        if (char === '"') {
          if (insideQuotes && rowText[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            insideQuotes = !insideQuotes;
          }
        } else if (char === delimiter && !insideQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCsvRow(lines[0]).map(h => h.toLowerCase().replace(/^[#_\s]+|[#_\s]+$/g, ''));
    const parsed: any[] = [];
    let autoCorrects = 0;
    const fallbackChannel = channels[0]?.username || (channels[0]?.telegramId ? String(channels[0].telegramId) : '@restreamsav');

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvRow(lines[i]);
      if (cols.every(c => !c)) continue;

      const rowObj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = cols[idx] || '';
      });

      let title = rowObj.title || rowObj.заголовок || rowObj.name || rowObj.тема || '';
      if (!title.trim()) {
        title = `Импортированный пост ${i}`;
        autoCorrects++;
      }

      let text = rowObj.text || rowObj.текст || rowObj.content || rowObj.контент || '';
      if (!text.trim()) {
        text = title;
        autoCorrects++;
      }

      let channel = rowObj.channel || rowObj.канал || '';
      if (!channel.trim()) {
        channel = fallbackChannel;
        autoCorrects++;
      } else if (!channel.startsWith('@') && !channel.startsWith('https://')) {
        channel = '@' + channel;
      }

      let status = (rowObj.status || rowObj.статус || 'создается').toLowerCase().trim();
      if (status === 'draft' || status === 'черновик' || status === 'creating') status = 'создается';
      else if (status === 'scheduled' || status === 'план' || status === 'запланировано') status = 'отложено';
      else if (status === 'published' || status === 'sent' || status === 'готов') status = 'опубликовано';
      else if (status !== 'создается' && status !== 'отложено' && status !== 'опубликовано' && status !== 'ошибка') {
        status = 'создается';
        autoCorrects++;
      }

      let format = (rowObj.format || rowObj.формат || rowObj.messageformat || 'v2').toLowerCase().trim();
      if (format.includes('rich') || format.includes('html')) format = 'rich';
      else format = 'v2';

      let dateStr = rowObj.display_date || rowObj.displaydate || rowObj.date || rowObj.дата || '';
      let validDate = new Date(dateStr);
      if (isNaN(validDate.getTime())) {
        validDate = new Date();
        if (dateStr) autoCorrects++;
      }

      parsed.push({
        id: rowObj.id && !rowObj.id.startsWith('p_example') ? rowObj.id : `imp_${Date.now().toString(36)}_${i}`,
        title: title.trim(),
        text: text.trim(),
        channel: channel.trim(),
        status,
        format,
        category: rowObj.category || rowObj.категория || 'Импорт',
        signature: rowObj.signature || rowObj.подпись || '',
        display_date: validDate.toISOString()
      });
    }

    if (parsed.length === 0) {
      setStatusMessage({ type: 'error', text: 'Не удалось извлечь записи из CSV файла' });
      return;
    }

    setImportParsedPosts(parsed);
    setImportAutoCorrectCount(autoCorrects);
    setIsImportModalOpen(true);
  };

  const handleExecuteImport = async () => {
    if (importParsedPosts.length === 0) return;
    setIsImporting(true);
    try {
      const res = await fetch('/api/history/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id || '16926299042',
          posts: importParsedPosts
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsImportModalOpen(false);
        setImportParsedPosts([]);
        setStatusMessage({
          type: 'success',
          text: `Успешно импортировано ${data.importedCount} постов в базу данных! (Авто-исправлено полей: ${data.autoCorrectedCount})`
        });
        if (onRefresh) await onRefresh();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Ошибка при импорте данных' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e.message || 'Ошибка сети' });
    } finally {
      setIsImporting(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // Open manual add modal
  const handleOpenManualAddModal = () => {
    const newId = generateNewPostId();
    setManualId(newId);
    setManualTitle('');
    setTitleUniquenessInfo(null);
    setManualText('');
    setManualChannel(channels[0]?.username || (channels[0]?.telegramId ? String(channels[0].telegramId) : '@restreamsav'));
    setManualStatus('создается');
    setManualFormat('v2');
    setManualCategory('Общее');
    setManualSignature('');
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setManualDisplayDate(now.toISOString().slice(0, 16));
    setIsManualAddModalOpen(true);
  };

  // Save manual post
  const handleSaveManualPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) {
      setStatusMessage({ type: 'error', text: 'Пожалуйста, укажите заголовок публикации' });
      return;
    }
    setIsSavingManualPost(true);
    try {
      const res = await fetch('/api/history/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: manualId || generateNewPostId(),
          userId: currentUser?.id || '16926299042',
          title: manualTitle.trim(),
          text: manualText.trim() || manualTitle.trim(),
          channel: manualChannel || channels[0]?.username || (channels[0]?.telegramId ? String(channels[0].telegramId) : '@restreamsav'),
          status: manualStatus,
          messageFormat: manualFormat,
          category: manualCategory.trim() || 'Общее',
          signature: manualSignature.trim(),
          displayDate: manualDisplayDate
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsManualAddModalOpen(false);
        setStatusMessage({
          type: 'success',
          text: `Пост «${data.post?.title || manualTitle}» успешно добавлен в базу данных!`
        });
        if (onRefresh) await onRefresh();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Ошибка при сохранении поста' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e.message || 'Ошибка сети' });
    } finally {
      setIsSavingManualPost(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // Check if any column filter is active
  const hasActiveColFilters = Boolean(
    colFilterId.trim() || 
    colFilterTitle.trim() || 
    colFilterChannels.length > 0 || 
    colFilterFormats.length > 0 || 
    colFilterStatuses.length > 0 ||
    sortColumn !== null
  );

  const handleClearColFilters = () => {
    setColFilterId('');
    setColFilterTitle('');
    setColFilterChannels([]);
    setColFilterFormats([]);
    setColFilterStatuses([]);
    setSortColumn(null);
    setSortDirection('desc');
    setActiveHeaderFilter(null);
  };

  return (
    <div className="space-y-6 text-left">
      {/* Top Bar with Integrated Tabs */}
      <div className="bg-gradient-to-r from-sky-100 via-pink-100 via-orange-100 via-pink-100 to-sky-100 backdrop-blur-md border border-pink-200/80 rounded-3xl p-4 md:p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center space-x-2.5">
            <CalendarDays className="text-orange-500" size={24} />
            <span>{viewMode === 'calendar' ? 'Календарь публикаций' : 'История публикаций'}</span>
          </h2>
          <p className="text-sm text-slate-600 font-bold mt-1">
            Отложенные публикации на месяц вперед, история отправок и контент-план
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center bg-white/90 p-1.5 rounded-2xl border border-pink-200/80 gap-1.5 shadow-2xs w-full lg:w-auto">
          <div className="grid grid-cols-2 sm:flex items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => {
                setViewMode('calendar');
                navigateTo('/calendar');
              }}
              className={`flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl text-[14px] font-black transition-all cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-pink-50'
              }`}
            >
              <CalendarDays size={16} />
              <span>Календарь</span>
            </button>

            <button
              onClick={() => navigateTo('/gallery')}
              className="flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl text-[14px] font-black transition-all cursor-pointer text-slate-700 hover:text-slate-900 hover:bg-pink-50"
            >
              <ImageIcon size={16} />
              <span>Галерея</span>
            </button>

            <button
              onClick={() => {
                setViewMode('history');
                navigateTo('/history');
              }}
              className={`flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl text-[14px] font-black transition-all cursor-pointer ${
                viewMode === 'history'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-pink-50'
              }`}
            >
              <HistoryIcon size={16} />
              <span>История ({unifiedItems.length})</span>
            </button>

            <div className="flex items-center justify-center sm:justify-start">
              <AcademyHelpButton
                sectionSlug="calendar-history-gallery"
                onNavigate={navigateTo}
                showLabelOnDesktop={true}
                label="Справка"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Unified Filter & Search Bar */}
      <div className="bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md border border-pink-200/80 rounded-3xl p-3.5 sm:p-4 space-y-3.5 shadow-2xs">
        {/* Row 1: Status filter (dropdown on mobile, gradient pills on sm+) and Search Input */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Mobile Dropdown Status Filter (no horizontal tab overflow) */}
          <div className="sm:hidden flex items-center bg-white/95 border border-pink-200 rounded-2xl px-3 py-2 shadow-2xs">
            <Filter size={16} className="text-pink-600 mr-2 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-transparent border-none text-[14px] text-slate-900 font-bold focus:outline-none cursor-pointer"
            >
              <option value="all">Все статусы ({unifiedItems.length})</option>
              <option value="creating">Создается ({creatingCount})</option>
              <option value="scheduled">Запланированные ({scheduledCount})</option>
              <option value="published">Отправленные ({publishedCount})</option>
              <option value="failed">Ошибки ({failedCount})</option>
            </select>
          </div>

          {/* Desktop Status Badges */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-bold text-slate-700 mr-1">Статус:</span>
            
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer border ${
                statusFilter === 'all'
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white border-white/30 shadow-2xs'
                  : 'bg-white/90 text-slate-700 border-pink-200/80 hover:bg-white'
              }`}
            >
              Все ({unifiedItems.length})
            </button>

            <button
              onClick={() => setStatusFilter('creating')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer border ${
                statusFilter === 'creating'
                  ? 'bg-amber-400 text-slate-900 border-amber-500 shadow-2xs font-extrabold'
                  : 'bg-amber-50/90 text-amber-900 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <FileEdit size={14} className={statusFilter === 'creating' ? 'text-slate-900' : 'text-amber-600'} />
              <span>Создается ({creatingCount})</span>
            </button>

            <button
              onClick={() => setStatusFilter('scheduled')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer border ${
                statusFilter === 'scheduled'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                  : 'bg-amber-50/90 text-amber-900 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Clock size={14} className={statusFilter === 'scheduled' ? 'text-white' : 'text-amber-600'} />
              <span>Запланированные ({scheduledCount})</span>
            </button>

            <button
              onClick={() => setStatusFilter('published')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer border ${
                statusFilter === 'published'
                  ? 'bg-sky-500 text-white border-sky-600 shadow-2xs'
                  : 'bg-sky-50/90 text-sky-900 border-sky-200 hover:bg-sky-100'
              }`}
            >
              <CheckCircle2 size={14} className={statusFilter === 'published' ? 'text-white' : 'text-sky-600'} />
              <span>Отправленные ({publishedCount})</span>
            </button>

            <button
              onClick={() => setStatusFilter('failed')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer border ${
                statusFilter === 'failed'
                  ? 'bg-rose-500 text-white border-rose-600 shadow-2xs'
                  : 'bg-rose-50/90 text-rose-900 border-rose-200 hover:bg-rose-100'
              }`}
            >
              <AlertCircle size={14} className={statusFilter === 'failed' ? 'text-white' : 'text-rose-600'} />
              <span>Ошибки ({failedCount})</span>
            </button>
          </div>

          {/* Search Bar (Search by ID, Title, Text, Channel) */}
          <div className="flex flex-1 min-w-0 w-full lg:max-w-md bg-white/90 border border-pink-200/80 rounded-2xl px-3.5 py-2 items-center space-x-2 focus-within:ring-2 focus-within:ring-pink-400 shadow-2xs">
            <Search size={16} className="text-orange-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по коду поста, названию или тексту..."
              className="w-full min-w-0 bg-transparent border-none text-[14px] text-slate-800 font-semibold focus:outline-none placeholder-slate-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-800 font-bold text-[14px] cursor-pointer px-1">
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Format, Origin, Category, Channel, Sorting, Export */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2.5 pt-2 border-t border-pink-200/70">
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2">
            {/* Format Filter */}
            <div className="flex items-center bg-white/90 border border-pink-200/80 rounded-2xl px-3 py-1.5 shadow-2xs">
              <Code size={15} className="text-pink-500 mr-1.5 shrink-0" />
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value as any)}
                className="w-full sm:w-auto bg-transparent border-none text-[14px] text-slate-800 font-bold focus:outline-none cursor-pointer"
              >
                <option value="all">Все форматы</option>
                <option value="v2">Markdown V2</option>
                <option value="rich">Markdown Rich</option>
              </select>
            </div>

            {/* Origin Filter */}
            <div className="flex items-center bg-white/90 border border-pink-200/80 rounded-2xl px-3 py-1.5 shadow-2xs">
              <Bot size={15} className="text-pink-500 mr-1.5 shrink-0" />
              <select
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value as any)}
                className="w-full sm:w-auto bg-transparent border-none text-[14px] text-slate-800 font-bold focus:outline-none cursor-pointer"
              >
                <option value="all">Все типы</option>
                <option value="auto">Авто / Расписание</option>
                <option value="manual">Ручные посты</option>
              </select>
            </div>

            {/* Category Filter */}
            {uniqueCategories.length > 0 && (
              <div className="flex items-center bg-white/90 border border-pink-200/80 rounded-2xl px-3 py-1.5 shadow-2xs">
                <Tag size={15} className="text-pink-500 mr-1.5 shrink-0" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full sm:w-auto bg-transparent border-none text-[14px] text-slate-800 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="">Все рубрики</option>
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Channel Filter */}
            <div className="flex items-center bg-white/90 border border-pink-200/80 rounded-2xl px-3 py-1.5 shadow-2xs">
              <Radio size={15} className="text-pink-500 mr-1.5 shrink-0" />
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="w-full sm:w-auto bg-transparent border-none text-[14px] text-slate-800 font-bold focus:outline-none cursor-pointer"
              >
                <option value="">Все каналы</option>
                {channels.map(ch => (
                  <option key={ch.id} value={ch.name}>{ch.name}</option>
                ))}
              </select>
            </div>

            {/* Sort in History or Calendar */}
            <div className="flex items-center bg-white/90 border border-pink-200/80 rounded-2xl px-3 py-1.5 shadow-2xs">
              <ArrowUpDown size={15} className="text-pink-500 mr-1.5 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full sm:w-auto bg-transparent border-none text-[14px] text-slate-800 font-bold focus:outline-none cursor-pointer"
              >
                <option value="newest">Сначала новые</option>
                <option value="oldest">Сначала старые</option>
                <option value="title">По названию</option>
                <option value="category">По категории</option>
              </select>
            </div>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            className="w-full sm:w-auto flex items-center justify-center space-x-1.5 border border-pink-200 bg-white/90 hover:bg-white text-slate-800 px-3.5 py-2 sm:py-1.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer shadow-2xs"
          >
            <Download size={15} className="text-pink-500" />
            <span>Экспорт в таблицу</span>
          </button>
        </div>
      </div>

      {/* TAB 1: APPLE CALENDAR GRID */}
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Main Apple Month Grid */}
          <div className="lg:col-span-8 bg-gradient-to-r from-sky-100 via-pink-100 via-orange-100 via-pink-100 to-sky-100 backdrop-blur-md border border-pink-200/80 rounded-3xl p-3.5 sm:p-6 shadow-sm space-y-4 sm:space-y-6 min-w-0">
            {/* Month Navigation Bar */}
            <div className="flex items-center justify-between border-b border-pink-200/80 pb-3 sm:pb-4 gap-2">
              <div className="flex items-center flex-wrap gap-2 min-w-0">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-wide">
                  {monthNamesRu[month]} <span className="text-pink-600">{year}</span>
                </h3>
                <button
                  onClick={goToToday}
                  className="text-[14px] bg-white/90 hover:bg-white text-pink-600 font-extrabold px-3 py-1 rounded-xl border border-pink-200 transition-all cursor-pointer shadow-2xs"
                >
                  Сегодня
                </button>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={prevMonth}
                  className="p-2 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 rounded-xl border border-pink-200 transition-colors shadow-2xs cursor-pointer"
                  title="Предыдущий месяц"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={nextMonth}
                  className="p-2 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 rounded-xl border border-pink-200 transition-colors shadow-2xs cursor-pointer"
                  title="Следующий месяц"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Day Names Header */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center">
              {daysOfWeekRu.map((dayName, i) => (
                <div 
                  key={dayName} 
                  className={`text-[14px] font-mono font-black py-1 ${
                    i >= 5 ? 'text-pink-600' : 'text-slate-600'
                  }`}
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* Monthly Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {/* Empty leading spacer cells for previous month */}
              {Array.from({ length: startingDayIndex }).map((_, idx) => (
                <div key={`empty-${idx}`} className="h-16 sm:h-24 md:h-28 rounded-xl sm:rounded-2xl bg-white/30 border border-pink-100/50 opacity-40" />
              ))}

              {/* Day Cells */}
              {Array.from({ length: totalDays }).map((_, index) => {
                const dayNum = index + 1;
                const isToday = isCurrentMonthToday && todayDate.getDate() === dayNum;
                const isSelected = selectedDay === dayNum;
                const dayPubs = getPublicationsForDay(dayNum);

                return (
                  <button
                    key={dayNum}
                    onClick={() => setSelectedDay(dayNum)}
                    className={`h-16 sm:h-24 md:h-28 p-1 sm:p-2 rounded-xl sm:rounded-2xl border text-left transition-all relative flex flex-col justify-between overflow-hidden cursor-pointer ${
                      isSelected
                        ? 'border-pink-500 bg-white ring-2 ring-pink-400/50 shadow-md sm:scale-[1.02] z-10'
                        : isToday
                        ? 'border-orange-400 bg-orange-50/70 hover:bg-white'
                        : 'border-pink-200/80 bg-white/70 hover:bg-white hover:border-pink-300'
                    }`}
                  >
                    {/* Day number & indicators */}
                    <div className="flex justify-between items-center w-full gap-0.5">
                      <span 
                        className={`text-[14px] font-mono font-black px-1.5 py-0.5 rounded-lg leading-none ${
                          isToday 
                            ? 'bg-orange-500 text-white shadow-2xs' 
                            : isSelected 
                            ? 'bg-pink-500 text-white' 
                            : 'text-slate-800'
                        }`}
                      >
                        {dayNum}
                      </span>
                      {dayPubs.length > 0 && (
                        <span className="hidden sm:inline-flex text-[14px] font-mono font-black text-pink-600 bg-pink-100 px-1.5 py-0.5 rounded-full leading-none">
                          {dayPubs.length}
                        </span>
                      )}
                    </div>

                    {/* Mobile compact status dots */}
                    {dayPubs.length > 0 && (
                      <div className="sm:hidden flex items-center justify-center gap-0.5 flex-wrap pt-0.5 w-full">
                        {dayPubs.slice(0, 3).map((p) => {
                          const st = p.normStatus;
                          return (
                            <span
                              key={p.id}
                              className={`w-2 h-2 rounded-full ${
                                st === 'creating'
                                  ? 'bg-amber-400'
                                  : st === 'scheduled'
                                  ? 'bg-orange-500'
                                  : st === 'failed'
                                  ? 'bg-rose-500'
                                  : 'bg-sky-500'
                              }`}
                            />
                          );
                        })}
                        {dayPubs.length > 3 && (
                          <span className="w-2 h-2 rounded-full bg-pink-500" />
                        )}
                      </div>
                    )}

                    {/* Mini publication bars inside cell (desktop sm+) */}
                    <div className="hidden sm:block space-y-1 my-1 overflow-hidden flex-1 w-full">
                      {dayPubs.slice(0, 2).map((p) => {
                        const status = p.normStatus;
                        return (
                          <div 
                            key={p.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewPublication(p);
                            }}
                            title={`#${p.postId}: ${p.promptTitle} (${getCalendarStatusRuLabel(status)})`}
                            className={`text-[14px] font-bold px-1.5 py-0.5 rounded-lg truncate transition-opacity hover:opacity-80 shadow-2xs leading-tight ${
                              status === 'creating'
                                ? 'bg-amber-300 text-slate-900 border border-amber-400'
                                : status === 'scheduled'
                                ? 'bg-amber-100/90 text-amber-900 border border-amber-300'
                                : status === 'failed'
                                ? 'bg-rose-100/90 text-rose-900 border border-rose-300'
                                : 'bg-sky-100/90 text-sky-900 border border-sky-200'
                            }`}
                          >
                            {p.promptTitle}
                          </div>
                        );
                      })}
                      {dayPubs.length > 2 && (
                        <div className={`text-[14px] font-mono pl-0.5 leading-none ${isSelected ? 'text-slate-700' : 'text-slate-500'}`}>
                          +{dayPubs.length - 2}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Details Inspector Panel */}
          <div className="lg:col-span-4 bg-gradient-to-r from-sky-100 via-pink-100 via-orange-100 via-pink-100 to-sky-100 backdrop-blur-md border border-pink-200/80 rounded-3xl p-3.5 sm:p-6 shadow-sm space-y-4 sm:space-y-5 flex flex-col justify-between min-w-0">
            <div className="space-y-4 min-w-0">
              <div className="border-b border-pink-200/80 pb-3 flex flex-wrap justify-between items-start gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <h4 className="text-[14px] sm:text-base font-black text-slate-900 leading-snug break-words">
                    Публикации за {selectedDay || '—'} {monthNamesRu[month]} {year} г.
                  </h4>
                  <p className="text-[14px] text-slate-600 font-semibold mt-0.5">
                    Создающиеся, отложенные и опубликованные посты
                  </p>
                </div>
                <span className="shrink-0 text-[14px] font-mono font-extrabold bg-white/90 text-pink-600 border border-pink-200 px-2.5 py-1 rounded-xl shadow-2xs">
                  {selectedDayPubs.length} шт.
                </span>
              </div>

              {/* Publication list on selected day */}
              {selectedDayPubs.length === 0 ? (
                <div className="p-6 sm:p-8 border border-dashed border-pink-300 rounded-2xl text-center space-y-2 bg-white/40">
                  <CalendarDays className="mx-auto text-pink-400" size={28} />
                  <p className="text-[14px] text-slate-700 font-bold">На этот день нет публикаций по выбранным фильтрам.</p>
                  <p className="text-[14px] text-slate-500 font-medium">Создайте пост с расписанием или измените фильтры.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-0.5">
                  {selectedDayPubs.map((pub) => {
                    const status = pub.normStatus;
                    const timeStr = new Date(pub.displayDate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

                    const statusBadgeEl =
                      status === 'creating' ? (
                        <span className="inline-flex items-center gap-1 text-[14px] font-bold px-2.5 py-0.5 rounded-xl bg-amber-200 text-slate-900 border border-amber-300 shrink-0">
                          <FileEdit size={13} />
                          <span>Создается</span>
                        </span>
                      ) : status === 'scheduled' ? (
                        <span className="inline-flex items-center gap-1 text-[14px] font-bold px-2.5 py-0.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                          <Clock size={13} />
                          <span>Запланирован</span>
                        </span>
                      ) : status === 'failed' ? (
                        <span className="inline-flex items-center gap-1 text-[14px] font-bold px-2.5 py-0.5 rounded-xl bg-rose-100 text-rose-900 border border-rose-300 shrink-0">
                          <AlertCircle size={13} />
                          <span>Ошибка</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[14px] font-bold px-2.5 py-0.5 rounded-xl bg-sky-100 text-sky-900 border border-sky-300 shrink-0">
                          <CheckCircle2 size={13} />
                          <span>Отправлено</span>
                        </span>
                      );

                    return (
                      <div 
                        key={pub.id} 
                        onClick={() => setPreviewPublication(pub)}
                        className="p-3 sm:p-3.5 bg-white/90 border border-pink-200/80 hover:border-pink-400 rounded-2xl space-y-2 transition-all cursor-pointer group shadow-2xs min-w-0"
                      >
                        {/* Mobile header: ONLY status badge so long IDs/titles never clip the badge */}
                        <div className="sm:hidden space-y-1.5 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            {statusBadgeEl}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <span className="inline-block max-w-full truncate text-[14px] font-mono font-bold text-pink-700 bg-pink-50 px-2 py-0.5 rounded-lg border border-pink-200">
                              #{pub.postId}
                            </span>
                            <h5 className="text-[14px] font-black text-slate-900 group-hover:text-pink-600 transition-colors break-words leading-snug">
                              {pub.promptTitle}
                            </h5>
                          </div>
                        </div>

                        {/* Desktop header */}
                        <div className="hidden sm:flex justify-between items-start gap-2 min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              <span className="text-[14px] font-mono font-bold text-pink-700 bg-pink-50 px-2 py-0.5 rounded-lg border border-pink-200 max-w-full truncate">
                                #{pub.postId}
                              </span>
                              <h5 className="text-[14px] font-black text-slate-900 group-hover:text-pink-600 transition-colors line-clamp-1">
                                {pub.promptTitle}
                              </h5>
                            </div>
                          </div>
                          {statusBadgeEl}
                        </div>

                        {/* Card Formatted Preview */}
                        <div className="overflow-hidden max-h-48 bg-white/60 p-2 rounded-xl border border-pink-100 min-w-0">
                          <MarkdownRenderer
                            content={stripDuplicateTitleFromPostContent(pub.text, pub.promptTitle)}
                            format={getPublicationFormat(pub)}
                            isCompact={true}
                            maxLines={3}
                            attachmentType={pub.attachmentType}
                            attachmentUrl={pub.attachmentUrl}
                            attachmentUrls={pub.attachmentUrls}
                            inlineButtons={pub.inlineButtons}
                            signature={pub.signature}
                            uppercaseHeader={pub.uppercaseHeader}
                          />
                        </div>

                        <div className="flex justify-between items-center gap-2 text-[14px] font-mono text-slate-600 pt-1.5 border-t border-pink-100 min-w-0">
                          <span className="font-bold shrink-0">{timeStr}</span>
                          <span className="text-pink-600 font-bold group-hover:underline truncate min-w-0">{pub.channel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-pink-200/80">
              <button
                onClick={handleExportCSV}
                className="w-full flex items-center justify-center space-x-2 bg-white/90 hover:bg-white border border-pink-200 text-slate-800 py-2.5 rounded-xl text-[14px] font-black transition-all cursor-pointer shadow-2xs"
              >
                <Download size={15} className="text-pink-500 shrink-0" />
                <span>Скачать выгрузку публикаций</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FULL HISTORY & LOGS TABLE */}
      {viewMode === 'history' && (
        <div className="space-y-5">
          {/* Status Message Banner */}
          {statusMessage && (
            <div className={`p-4 rounded-2xl border text-sm font-bold flex items-center justify-between shadow-md transition-all ${
              statusMessage.type === 'success'
                ? 'bg-sky-50/90 border-sky-300 text-sky-900'
                : 'bg-rose-50/90 border-rose-300 text-rose-900'
            }`}>
              <div className="flex items-center space-x-2">
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 size={18} className="text-sky-600 shrink-0" />
                ) : (
                  <AlertCircle size={18} className="text-rose-600 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
              <button 
                type="button"
                onClick={() => setStatusMessage(null)}
                className="p-1 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="bg-gradient-to-r from-sky-100 via-pink-100 via-orange-100 via-pink-100 to-sky-100 backdrop-blur-md border border-pink-200/80 rounded-3xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:flex-wrap">
              <button
                type="button"
                onClick={handleOpenManualAddModal}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white rounded-xl text-[14px] font-black transition-all cursor-pointer shadow-2xs hover:opacity-95"
              >
                <Plus size={16} />
                <span>Добавить запись в историю</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                title="Скачать образец таблицы с предзаполненными каналами и статусами"
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2.5 bg-white/90 hover:bg-white text-slate-800 border border-pink-200 rounded-xl text-[14px] font-bold transition-all cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet size={16} className="text-pink-600" />
                <span>Скачать шаблон таблицы</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Импортировать посты из файла таблицы согласно шаблону"
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2.5 bg-white/90 hover:bg-white text-slate-800 border border-pink-200 rounded-xl text-[14px] font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Upload size={16} className="text-pink-600" />
                <span>Импорт из таблицы</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCsvFileInput}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                title="Экспортировать текущие публикации в таблицу"
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2.5 bg-white/90 hover:bg-white text-slate-800 border border-pink-200 rounded-xl text-[14px] font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Download size={16} className="text-pink-500" />
                <span>Экспорт публикаций</span>
              </button>
            </div>
          </div>

          {/* Active Column Filter Indicator & Reset Bar */}
          {hasActiveColFilters && (
            <div className="bg-white/85 border border-pink-200/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs text-[14px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-700">Фильтры таблицы:</span>
                {colFilterId && (
                  <span className="px-2.5 py-1 bg-pink-100/90 text-pink-800 rounded-xl text-[14px] font-mono font-bold flex items-center gap-1.5 border border-pink-200">
                    Код: {colFilterId}
                    <button type="button" onClick={() => setColFilterId('')} className="cursor-pointer hover:text-rose-600">✕</button>
                  </span>
                )}
                {colFilterTitle && (
                  <span className="px-2.5 py-1 bg-pink-100/90 text-pink-800 rounded-xl text-[14px] font-bold flex items-center gap-1.5 border border-pink-200">
                    Заголовок: {colFilterTitle}
                    <button type="button" onClick={() => setColFilterTitle('')} className="cursor-pointer hover:text-rose-600">✕</button>
                  </span>
                )}
                {colFilterChannels.length > 0 && (
                  <span className="px-2.5 py-1 bg-pink-100/90 text-pink-800 rounded-xl text-[14px] font-bold flex items-center gap-1.5 border border-pink-200">
                    Каналы ({colFilterChannels.length})
                    <button type="button" onClick={() => setColFilterChannels([])} className="cursor-pointer hover:text-rose-600">✕</button>
                  </span>
                )}
                {colFilterFormats.length > 0 && (
                  <span className="px-2.5 py-1 bg-pink-100/90 text-pink-800 rounded-xl text-[14px] font-bold flex items-center gap-1.5 border border-pink-200">
                    Форматы ({colFilterFormats.length})
                    <button type="button" onClick={() => setColFilterFormats([])} className="cursor-pointer hover:text-rose-600">✕</button>
                  </span>
                )}
                {colFilterStatuses.length > 0 && (
                  <span className="px-2.5 py-1 bg-pink-100/90 text-pink-800 rounded-xl text-[14px] font-bold flex items-center gap-1.5 border border-pink-200">
                    Статусы ({colFilterStatuses.length})
                    <button type="button" onClick={() => setColFilterStatuses([])} className="cursor-pointer hover:text-rose-600">✕</button>
                  </span>
                )}
                {sortColumn && (
                  <span className="px-2.5 py-1 bg-sky-100/90 text-sky-800 rounded-xl text-[14px] font-bold flex items-center gap-1.5 border border-sky-200">
                    Сортировка: {sortColumn === 'id' ? 'код' : sortColumn === 'date' ? 'дата' : sortColumn === 'title' ? 'заголовок' : sortColumn === 'channel' ? 'канал' : sortColumn === 'format' ? 'формат' : 'статус'} ({sortDirection === 'asc' ? 'по возрастанию' : 'по убыванию'})
                    <button type="button" onClick={() => setSortColumn(null)} className="cursor-pointer hover:text-rose-600">✕</button>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleClearColFilters}
                className="text-[14px] font-black text-pink-600 hover:text-pink-800 underline cursor-pointer"
              >
                Сбросить фильтры
              </button>
            </div>
          )}

          {/* Multi-Selection Mass Action Bar */}
          {selectedPostIds.size > 0 && (
            <div className="bg-gradient-to-r from-sky-200/90 via-pink-200/90 to-orange-200/90 border border-pink-300 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md animate-fadeIn">
              <div className="flex items-center space-x-2 text-[14px] font-black text-slate-800">
                <CheckSquare size={18} className="text-pink-600" />
                <span>Выбрано записей: {selectedPostIds.size} из {historyTablePublications.length}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="px-3 py-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-xl text-[14px] font-bold border border-pink-200 cursor-pointer shadow-2xs"
                >
                  {isAllHistorySelected ? 'Снять выбор' : `Выбрать все (${historyTablePublications.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteModalTarget({ type: 'selected', count: selectedPostIds.size })}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[14px] font-bold cursor-pointer shadow-2xs transition-all"
                >
                  <Trash2 size={14} />
                  <span>Удалить выбранные ({selectedPostIds.size})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteModalTarget({ type: 'filtered', count: historyTablePublications.length })}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-white/90 hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-[14px] font-bold cursor-pointer shadow-2xs transition-all"
                >
                  <Trash2 size={14} />
                  <span>Удалить все ({historyTablePublications.length})</span>
                </button>
              </div>
            </div>
          )}

          {/* History Table / Mobile Cards */}
          <div className="bg-gradient-to-r from-sky-100 via-pink-100 via-orange-100 via-pink-100 to-sky-100 backdrop-blur-md border border-pink-200/80 rounded-3xl overflow-hidden shadow-sm">
            {/* Mobile Compact History Cards (no horizontal scroll) */}
            <div className="md:hidden p-3 space-y-3">
              {historyTablePublications.length === 0 ? (
                <div className="p-8 text-center text-slate-700 text-[14px] font-bold bg-white/75 rounded-2xl border border-pink-200">
                  Записи не найдены по указанным критериям.
                </div>
              ) : (
                historyTablePublications.map((pub) => {
                  const status = pub.normStatus;
                  const isSelected = selectedPostIds.has(pub.postId || pub.id);
                  const pubFormat = getPublicationFormat(pub);
                  let formattedDateStr = 'Сегодня';
                  if (pub.displayDate) {
                    const parsed = new Date(pub.displayDate);
                    if (!isNaN(parsed.getTime())) {
                      formattedDateStr = `${parsed.toLocaleDateString('ru-RU')} ${parsed.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
                    }
                  }

                  return (
                    <div
                      key={`mob_${pub.id}`}
                      onClick={() => setPreviewPublication(pub)}
                      className={`p-3 rounded-2xl border space-y-2.5 cursor-pointer shadow-2xs transition-all min-w-0 ${
                        isSelected ? 'bg-pink-50/95 border-pink-400' : 'bg-white/90 border-pink-200'
                      }`}
                    >
                      {/* Mobile card header: checkbox + status badge ONLY */}
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelectRow(pub.postId || pub.id);
                          }}
                          className="p-1 rounded-lg hover:bg-pink-100 text-pink-600 cursor-pointer shrink-0"
                        >
                          {isSelected ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-400" />}
                        </button>

                        {status === 'creating' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[14px] font-bold bg-amber-200 text-slate-900 border border-amber-300">
                            <FileEdit size={13} />
                            <span>Создается</span>
                          </span>
                        ) : status === 'scheduled' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[14px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Clock size={13} />
                            <span>Запланирован</span>
                          </span>
                        ) : status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[14px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                            <AlertCircle size={13} />
                            <span>Ошибка</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[14px] font-bold bg-sky-100 text-sky-900 border border-sky-300">
                            <CheckCircle2 size={13} />
                            <span>Отправлено</span>
                          </span>
                        )}
                      </div>

                      {/* ID, Title & excerpt */}
                      <div className="space-y-1 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard?.writeText(pub.postId).catch(() => {});
                            setStatusMessage({ type: 'success', text: `Код #${pub.postId} скопирован` });
                            setTimeout(() => setStatusMessage(null), 2500);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-pink-50 text-pink-700 border border-pink-200 rounded-lg font-mono text-[14px] font-bold max-w-full"
                        >
                          <span className="truncate">#{pub.postId}</span>
                          <Copy size={12} className="shrink-0" />
                        </button>
                        <p className="font-black text-slate-900 text-[14px] leading-snug break-words">
                          {pub.promptTitle}
                        </p>
                        {pub.text && (
                          <p className="text-[14px] text-slate-600 line-clamp-2 break-words">
                            {pub.text}
                          </p>
                        )}
                      </div>

                      {/* Meta: Date, Channel, Format */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[14px] pt-1.5 border-t border-pink-100">
                        <span className="font-mono font-bold text-slate-700">{formattedDateStr}</span>
                        <span className="font-mono font-bold text-sky-700 truncate max-w-[160px]">{pub.channel}</span>
                        <span className="px-2 py-0.5 rounded-lg border border-pink-200 bg-white text-slate-800 text-[14px] font-bold">
                          {pubFormat === 'rich' ? 'Rich' : 'V2'}
                        </span>
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-pink-100" onClick={(e) => e.stopPropagation()}>
                        {onSelectPostForEdit && (
                          <button
                            type="button"
                            onClick={() => onSelectPostForEdit(pub.postId)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-sky-500 via-pink-500 to-orange-500 text-white rounded-xl text-[14px] font-bold cursor-pointer shadow-2xs"
                          >
                            <Edit3 size={14} />
                            <span>Редактор</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteModalTarget({ type: 'single', post: pub })}
                          className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer"
                          title="Удалить запись"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table (md+) */}
            <div className="hidden md:block overflow-x-auto rounded-3xl">
              <table className="w-full text-left text-[14px] min-w-[850px]">
                <thead className="bg-white/90 text-[14px] font-mono font-black text-slate-700 border-b border-pink-200/80">
                  <tr>
                    {/* Header Col 1: Select All Checkbox */}
                    <th className="p-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        title={isAllHistorySelected ? 'Снять выбор со всех' : 'Выбрать все записи'}
                        className="p-1 rounded hover:bg-pink-100 text-pink-600 transition-colors cursor-pointer"
                      >
                        {isAllHistorySelected ? (
                          <CheckSquare size={16} />
                        ) : selectedPostIds.size > 0 ? (
                          <div className="w-4 h-4 border-2 border-pink-600 rounded flex items-center justify-center">
                            <div className="w-2 h-2 bg-pink-600 rounded-xs" />
                          </div>
                        ) : (
                          <Square size={16} className="text-slate-400" />
                        )}
                      </button>
                    </th>

                    {/* Header Col 2: ID */}
                    <th className="p-3">
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleSort('id')}
                          className="flex items-center space-x-1 font-black text-slate-800 hover:text-pink-600 cursor-pointer"
                        >
                          <span>ID Поста</span>
                          {sortColumn === 'id' ? (
                            sortDirection === 'asc' ? <ArrowUp size={13} className="text-pink-600" /> : <ArrowDown size={13} className="text-pink-600" />
                          ) : (
                            <ArrowUpDown size={12} className="text-slate-400 opacity-60" />
                          )}
                        </button>
                        <input
                          type="text"
                          value={colFilterId}
                          onChange={(e) => setColFilterId(e.target.value)}
                          placeholder="Поиск ID..."
                          className="w-full text-xs font-normal font-sans px-2 py-1 bg-white/95 border border-pink-200 rounded-lg focus:border-pink-500 focus:outline-hidden"
                        />
                      </div>
                    </th>

                    {/* Header Col 3: Date */}
                    <th className="p-3">
                      <button
                        type="button"
                        onClick={() => handleToggleSort('date')}
                        className="flex items-center space-x-1 font-black text-slate-800 hover:text-pink-600 cursor-pointer py-1"
                      >
                        <span>Дата / Время</span>
                        {sortColumn === 'date' ? (
                          sortDirection === 'asc' ? <ArrowUp size={13} className="text-pink-600" /> : <ArrowDown size={13} className="text-pink-600" />
                        ) : (
                          <ArrowUpDown size={12} className="text-slate-400 opacity-60" />
                        )}
                      </button>
                    </th>

                    {/* Header Col 4: Title */}
                    <th className="p-3">
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleSort('title')}
                          className="flex items-center space-x-1 font-black text-slate-800 hover:text-pink-600 cursor-pointer"
                        >
                          <span>Заголовок Поста</span>
                          {sortColumn === 'title' ? (
                            sortDirection === 'asc' ? <ArrowUp size={13} className="text-pink-600" /> : <ArrowDown size={13} className="text-pink-600" />
                          ) : (
                            <ArrowUpDown size={12} className="text-slate-400 opacity-60" />
                          )}
                        </button>
                        <input
                          type="text"
                          value={colFilterTitle}
                          onChange={(e) => setColFilterTitle(e.target.value)}
                          placeholder="Поиск по названию..."
                          className="w-full text-xs font-normal font-sans px-2 py-1 bg-white/95 border border-pink-200 rounded-lg focus:border-pink-500 focus:outline-hidden"
                        />
                      </div>
                    </th>

                    {/* Header Col 5: Channel */}
                    <th className="p-3 relative">
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleSort('channel')}
                          className="flex items-center space-x-1 font-black text-slate-800 hover:text-pink-600 cursor-pointer"
                        >
                          <span>Канал</span>
                          {sortColumn === 'channel' ? (
                            sortDirection === 'asc' ? <ArrowUp size={13} className="text-pink-600" /> : <ArrowDown size={13} className="text-pink-600" />
                          ) : (
                            <ArrowUpDown size={12} className="text-slate-400 opacity-60" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveHeaderFilter(prev => prev === 'channel' ? null : 'channel')}
                          className={`w-full flex items-center justify-between text-xs font-normal font-sans px-2 py-1 bg-white/95 border rounded-lg cursor-pointer ${
                            colFilterChannels.length > 0 ? 'border-pink-500 text-pink-700 font-bold' : 'border-pink-200 text-slate-600'
                          }`}
                        >
                          <span className="truncate">
                            {colFilterChannels.length === 0 ? 'Все каналы' : `Выбрано: ${colFilterChannels.length}`}
                          </span>
                          <ChevronDown size={12} />
                        </button>

                        {/* Channel Dropdown */}
                        {activeHeaderFilter === 'channel' && (
                          <div className="absolute left-0 mt-1 w-52 bg-white/95 backdrop-blur-md border border-pink-300 rounded-2xl p-2.5 shadow-xl z-30 space-y-2">
                            <div className="flex justify-between items-center pb-1.5 border-b border-pink-100">
                              <span className="text-xs font-bold text-slate-800">Каналы</span>
                              <button
                                type="button"
                                onClick={() => setColFilterChannels([])}
                                className="text-[11px] text-pink-600 hover:underline cursor-pointer"
                              >
                                Сбросить
                              </button>
                            </div>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                              {availableChannels.map(ch => {
                                const checked = colFilterChannels.includes(ch);
                                return (
                                  <label key={ch} className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-pink-50">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        setColFilterChannels(prev => 
                                          checked ? prev.filter(c => c !== ch) : [...prev, ch]
                                        );
                                      }}
                                      className="rounded text-pink-500 focus:ring-0 cursor-pointer"
                                    />
                                    <span className="truncate">{ch}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveHeaderFilter(null)}
                              className="w-full text-center text-xs font-bold bg-pink-50 hover:bg-pink-100 text-pink-700 py-1 rounded-lg cursor-pointer"
                            >
                              Готово
                            </button>
                          </div>
                        )}
                      </div>
                    </th>

                    {/* Header Col 6: Format */}
                    <th className="p-3 relative">
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleSort('format')}
                          className="flex items-center space-x-1 font-black text-slate-800 hover:text-pink-600 cursor-pointer"
                        >
                          <span>Формат</span>
                          {sortColumn === 'format' ? (
                            sortDirection === 'asc' ? <ArrowUp size={13} className="text-pink-600" /> : <ArrowDown size={13} className="text-pink-600" />
                          ) : (
                            <ArrowUpDown size={12} className="text-slate-400 opacity-60" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveHeaderFilter(prev => prev === 'format' ? null : 'format')}
                          className={`w-full flex items-center justify-between text-xs font-normal font-sans px-2 py-1 bg-white/95 border rounded-lg cursor-pointer ${
                            colFilterFormats.length > 0 ? 'border-pink-500 text-pink-700 font-bold' : 'border-pink-200 text-slate-600'
                          }`}
                        >
                          <span className="truncate">
                            {colFilterFormats.length === 0 ? 'Все форматы' : `Выбрано: ${colFilterFormats.length}`}
                          </span>
                          <ChevronDown size={12} />
                        </button>

                        {/* Format Dropdown */}
                        {activeHeaderFilter === 'format' && (
                          <div className="absolute left-0 mt-1 w-44 bg-white/95 backdrop-blur-md border border-pink-300 rounded-2xl p-2.5 shadow-xl z-30 space-y-2">
                            <div className="flex justify-between items-center pb-1.5 border-b border-pink-100">
                              <span className="text-xs font-bold text-slate-800">Формат</span>
                              <button
                                type="button"
                                onClick={() => setColFilterFormats([])}
                                className="text-[11px] text-pink-600 hover:underline cursor-pointer"
                              >
                                Сбросить
                              </button>
                            </div>
                            <div className="space-y-1">
                              {[
                                { key: 'rich', label: 'Markdown Rich' },
                                { key: 'v2', label: 'Markdown V2' }
                              ].map(f => {
                                const checked = colFilterFormats.includes(f.key);
                                return (
                                  <label key={f.key} className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-pink-50">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        setColFilterFormats(prev => 
                                          checked ? prev.filter(c => c !== f.key) : [...prev, f.key]
                                        );
                                      }}
                                      className="rounded text-pink-500 focus:ring-0 cursor-pointer"
                                    />
                                    <span>{f.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveHeaderFilter(null)}
                              className="w-full text-center text-xs font-bold bg-pink-50 hover:bg-pink-100 text-pink-700 py-1 rounded-lg cursor-pointer"
                            >
                              Готово
                            </button>
                          </div>
                        )}
                      </div>
                    </th>

                    {/* Header Col 7: Status */}
                    <th className="p-3 text-center relative">
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleSort('status')}
                          className="flex items-center justify-center space-x-1 font-black text-slate-800 hover:text-pink-600 cursor-pointer w-full"
                        >
                          <span>Статус</span>
                          {sortColumn === 'status' ? (
                            sortDirection === 'asc' ? <ArrowUp size={13} className="text-pink-600" /> : <ArrowDown size={13} className="text-pink-600" />
                          ) : (
                            <ArrowUpDown size={12} className="text-slate-400 opacity-60" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveHeaderFilter(prev => prev === 'status' ? null : 'status')}
                          className={`w-full flex items-center justify-between text-xs font-normal font-sans px-2 py-1 bg-white/95 border rounded-lg cursor-pointer ${
                            colFilterStatuses.length > 0 ? 'border-pink-500 text-pink-700 font-bold' : 'border-pink-200 text-slate-600'
                          }`}
                        >
                          <span className="truncate">
                            {colFilterStatuses.length === 0 ? 'Все статусы' : `Выбрано: ${colFilterStatuses.length}`}
                          </span>
                          <ChevronDown size={12} />
                        </button>

                        {/* Status Dropdown */}
                        {activeHeaderFilter === 'status' && (
                          <div className="absolute right-0 mt-1 w-44 bg-white/95 backdrop-blur-md border border-pink-300 rounded-2xl p-2.5 shadow-xl z-30 space-y-2">
                            <div className="flex justify-between items-center pb-1.5 border-b border-pink-100">
                              <span className="text-xs font-bold text-slate-800">Статус</span>
                              <button
                                type="button"
                                onClick={() => setColFilterStatuses([])}
                                className="text-[11px] text-pink-600 hover:underline cursor-pointer"
                              >
                                Сбросить
                              </button>
                            </div>
                            <div className="space-y-1">
                              {[
                                { key: 'published', label: 'Отправлено' },
                                { key: 'scheduled', label: 'Запланирован' },
                                { key: 'creating', label: 'Создается' },
                                { key: 'failed', label: 'Ошибка' }
                              ].map(s => {
                                const checked = colFilterStatuses.includes(s.key);
                                return (
                                  <label key={s.key} className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-pink-50">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        setColFilterStatuses(prev => 
                                          checked ? prev.filter(c => c !== s.key) : [...prev, s.key]
                                        );
                                      }}
                                      className="rounded text-pink-500 focus:ring-0 cursor-pointer"
                                    />
                                    <span>{s.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveHeaderFilter(null)}
                              className="w-full text-center text-xs font-bold bg-pink-50 hover:bg-pink-100 text-pink-700 py-1 rounded-lg cursor-pointer"
                            >
                              Готово
                            </button>
                          </div>
                        )}
                      </div>
                    </th>

                    {/* Header Col 8: Actions */}
                    <th className="p-3 text-right">
                      <span>Действия</span>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-pink-200/60">
                  {historyTablePublications.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-600 text-sm font-bold">
                        Записи не найдены по указанным критериям и фильтрам колонок.
                      </td>
                    </tr>
                  ) : (
                    historyTablePublications.map((pub) => {
                      const status = pub.normStatus;
                      const isSelected = selectedPostIds.has(pub.postId || pub.id);
                      let formattedDateStr = 'Сегодня';
                      if (pub.displayDate) {
                        const parsed = new Date(pub.displayDate);
                        if (!isNaN(parsed.getTime())) {
                          formattedDateStr = `${parsed.toLocaleDateString('ru-RU')} в ${parsed.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
                        }
                      }

                      return (
                        <tr 
                          key={pub.id} 
                          onClick={() => setPreviewPublication(pub)}
                          className={`hover:bg-white/90 text-slate-800 transition-colors cursor-pointer ${
                            isSelected ? 'bg-pink-50/80' : ''
                          }`}
                        >
                          {/* Row Col 1: Checkbox */}
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleToggleSelectRow(pub.postId || pub.id)}
                              className="p-1 rounded hover:bg-pink-100 text-pink-600 transition-colors cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare size={16} />
                              ) : (
                                <Square size={16} className="text-slate-400" />
                              )}
                            </button>
                          </td>

                          {/* Row Col 2: ID */}
                          <td className="p-3 font-mono text-xs whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(pub.postId);
                                setStatusMessage({ type: 'success', text: `ID #${pub.postId} скопирован в буфер` });
                                setTimeout(() => setStatusMessage(null), 2500);
                              }}
                              title="Нажмите чтобы скопировать ID"
                              className="px-2.5 py-1 bg-white/90 hover:bg-pink-50 text-pink-700 border border-pink-200 rounded-xl font-bold flex items-center space-x-1 transition-all cursor-pointer shadow-2xs"
                            >
                              <span>#{pub.postId}</span>
                              <Copy size={11} className="text-pink-500" />
                            </button>
                          </td>

                          {/* Row Col 3: Date */}
                          <td className="p-3 font-mono text-sm whitespace-nowrap font-bold">
                            {formattedDateStr}
                          </td>

                          {/* Row Col 4: Title & text */}
                          <td className="p-3">
                            <p className="font-black text-slate-900 text-sm hover:text-pink-600 transition-colors">{pub.promptTitle}</p>
                            <p className="text-xs text-slate-600 font-sans mt-0.5 line-clamp-1 truncate max-w-md font-medium">{pub.text}</p>
                          </td>

                          {/* Row Col 5: Channel */}
                          <td className="p-3 font-mono text-sm text-sky-600 font-bold whitespace-nowrap">{pub.channel}</td>

                          {/* Row Col 6: Format */}
                          <td className="p-3 font-mono text-xs whitespace-nowrap font-bold">
                            {(() => {
                              const pubFormat = getPublicationFormat(pub);
                              return (
                                <span className={`px-2.5 py-1 rounded-xl border font-bold shadow-2xs ${
                                  pubFormat === 'rich'
                                    ? 'bg-gradient-to-r from-sky-100 via-pink-100 to-orange-100 text-slate-900 border-pink-300'
                                    : 'bg-white/90 text-slate-800 border-pink-200'
                                }`}>
                                  {pubFormat === 'rich' ? 'Markdown Rich' : 'Markdown V2'}
                                </span>
                              );
                            })()}
                          </td>

                          {/* Row Col 7: Status */}
                          <td className="p-3 text-center whitespace-nowrap">
                            {status === 'creating' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-mono font-black bg-amber-200 text-slate-900 border border-amber-300 shadow-2xs">
                                <FileEdit size={12} />
                                <span>Создается</span>
                              </span>
                            ) : status === 'scheduled' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-mono font-black bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
                                <Clock size={12} />
                                <span>Запланирован</span>
                              </span>
                            ) : status === 'failed' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-mono font-black bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                                <AlertCircle size={12} />
                                <span>Ошибка</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-mono font-black bg-sky-100 text-sky-800 border border-sky-300 shadow-2xs">
                                <CheckCircle2 size={12} />
                                <span>Отправлено</span>
                              </span>
                            )}
                          </td>

                          {/* Row Col 8: Actions */}
                          <td className="p-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end space-x-1.5">
                              {onSelectPostForEdit && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectPostForEdit(pub.postId);
                                  }}
                                  className="flex items-center space-x-1 px-2.5 py-1.5 bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs hover:opacity-95"
                                  title="Открыть в редакторе"
                                >
                                  <Edit3 size={13} />
                                  <span>Редактор</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteModalTarget({ type: 'single', post: pub });
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                title="Удалить запись из базы данных"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: MANUAL ADD POST MODAL */}
      {/* ========================================================================= */}
      {isManualAddModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-2.5 sm:p-4 pb-20 sm:pb-4 bg-sky-100/55 backdrop-blur-md animate-fadeIn">
          <div className="bg-gradient-to-r from-sky-100 via-pink-100 via-orange-100 via-pink-100 to-sky-100 border border-pink-300 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative overflow-hidden text-left max-h-[92vh] flex flex-col justify-between">
            <div className="flex justify-between items-start border-b border-pink-200/80 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Plus size={20} className="text-pink-600" />
                  <span>Добавить запись в историю</span>
                </h3>
                <p className="text-xs text-slate-600 font-bold mt-0.5">
                  Ручное создание поста со связью с базой данных и проверкой уникальности
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsManualAddModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-800 bg-white/80 rounded-xl border border-pink-200 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveManualPost} className="space-y-3.5 overflow-y-auto pr-1">
              {/* Post ID & Uniqueness Indicator */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ID Поста (сгенерирован):</label>
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="text"
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      className="w-full font-mono text-xs font-bold px-3 py-2 bg-white/90 border border-pink-200 rounded-xl focus:border-pink-500 focus:outline-hidden"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setManualId(generateNewPostId())}
                      title="Сгенерировать новый ID"
                      className="p-2 bg-white/90 hover:bg-white border border-pink-200 rounded-xl text-pink-600 transition-all cursor-pointer shadow-2xs"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Дата и время публикации:</label>
                  <input
                    type="datetime-local"
                    value={manualDisplayDate}
                    onChange={(e) => setManualDisplayDate(e.target.value)}
                    className="w-full text-xs font-bold px-3 py-2 bg-white/90 border border-pink-200 rounded-xl focus:border-pink-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              {/* Title Input with Uniqueness check */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Заголовок публикации:</label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Введите уникальный заголовок поста..."
                  className="w-full text-sm font-bold px-3.5 py-2.5 bg-white/95 border border-pink-200 rounded-xl focus:border-pink-500 focus:outline-hidden"
                  required
                />
                
                {titleUniquenessInfo && (
                  <div className="mt-1.5">
                    {titleUniquenessInfo.isUnique ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-200">
                        <Check size={12} className="text-sky-600" />
                        <span>Заголовок уникален в базе данных</span>
                      </span>
                    ) : (
                      <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle size={14} className="text-amber-600 shrink-0" />
                          <span>Заголовок уже существует. Предлагаем: <b>«{titleUniquenessInfo.suggestedTitle}»</b></span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setManualTitle(titleUniquenessInfo.suggestedTitle)}
                          className="px-2 py-1 bg-amber-200 hover:bg-amber-300 text-slate-900 rounded-lg font-bold cursor-pointer transition-colors shrink-0"
                        >
                          Использовать
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Channel, Status, Format selects */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Канал:</label>
                  <select
                    value={manualChannel}
                    onChange={(e) => setManualChannel(e.target.value)}
                    className="w-full text-xs font-bold px-3 py-2 bg-white/90 border border-pink-200 rounded-xl focus:border-pink-500 focus:outline-hidden"
                  >
                    {channels.length === 0 ? (
                      <option value="@restreamsav">@restreamsav</option>
                    ) : (
                      channels.map(ch => (
                        <option key={ch.id} value={ch.username}>{ch.name} ({ch.username})</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Статус:</label>
                  <select
                    value={manualStatus}
                    onChange={(e) => setManualStatus(e.target.value as any)}
                    className="w-full text-xs font-bold px-3 py-2 bg-white/90 border border-pink-200 rounded-xl focus:border-pink-500 focus:outline-hidden"
                  >
                    <option value="создается">Создается (черновик)</option>
                    <option value="запланирован">Запланирован в отложку</option>
                    <option value="опубликован">Отправлено</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Формат:</label>
                  <select
                    value={manualFormat}
                    onChange={(e) => setManualFormat(e.target.value as any)}
                    className="w-full text-xs font-bold px-3 py-2 bg-white/90 border border-pink-200 rounded-xl focus:border-pink-500 focus:outline-hidden"
                  >
                    <option value="v2">Markdown V2</option>
                    <option value="rich">Markdown Rich</option>
                  </select>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Категория / Ниша:</label>
                <input
                  type="text"
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                  placeholder="Общее, Технологии, Бизнес..."
                  className="w-full text-xs font-bold px-3 py-2 bg-white/90 border border-pink-200 rounded-xl focus:border-pink-500 focus:outline-hidden"
                />
              </div>

              {/* Post Text */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Текст публикации:</label>
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  rows={4}
                  placeholder="Введите текст поста или статьи..."
                  className="w-full text-sm font-normal px-3.5 py-2.5 bg-white/95 border border-pink-200 rounded-xl focus:border-pink-500 focus:outline-hidden"
                />
              </div>

              {/* Signature */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Подпись автора (хэштеги, ссылка):</label>
                <input
                  type="text"
                  value={manualSignature}
                  onChange={(e) => setManualSignature(e.target.value)}
                  placeholder="#нейросети #маркетинг @канал"
                  className="w-full text-xs font-normal px-3 py-2 bg-white/90 border border-pink-200 rounded-xl focus:border-pink-500 focus:outline-hidden"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end items-center gap-2 pt-3 border-t border-pink-200/80">
                <button
                  type="button"
                  onClick={() => setIsManualAddModalOpen(false)}
                  className="px-4 py-2 bg-white/90 hover:bg-white text-slate-700 border border-pink-200 rounded-xl text-sm font-bold transition-all cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSavingManualPost}
                  className="px-5 py-2 bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white rounded-xl text-sm font-black transition-all cursor-pointer shadow-2xs hover:opacity-95 disabled:opacity-50"
                >
                  {isSavingManualPost ? 'Сохранение...' : 'Сохранить запись'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CSV IMPORT PREVIEW & CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-2.5 sm:p-4 pb-20 sm:pb-4 bg-sky-100/55 backdrop-blur-md animate-fadeIn">
          <div className="bg-gradient-to-r from-sky-100 via-pink-100 via-orange-100 via-pink-100 to-sky-100 border border-pink-300 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl relative overflow-hidden text-left max-h-[92vh] flex flex-col justify-between">
            <div className="flex justify-between items-start border-b border-pink-200/80 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Upload size={20} className="text-pink-600" />
                  <span>Импорт истории постов из CSV</span>
                </h3>
                <p className="text-xs text-slate-600 font-bold mt-0.5">
                  Предпросмотр записей перед сохранением в базу данных
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-800 bg-white/80 rounded-xl border border-pink-200 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Info badge */}
            <div className="p-3 bg-white/90 border border-pink-200 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-800">
                Найдено строк: <b className="text-pink-600">{importParsedPosts.length}</b>
              </span>
              {importAutoCorrectCount > 0 && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-lg font-bold border border-amber-200">
                  Автоматически исправлено полей: {importAutoCorrectCount} (согласно правилам базы)
                </span>
              )}
            </div>

            {/* Preview table */}
            <div className="overflow-y-auto max-h-[360px] border border-pink-200 rounded-2xl bg-white/90">
              <table className="w-full text-left text-xs">
                <thead className="bg-pink-50/90 text-slate-700 font-black border-b border-pink-200">
                  <tr>
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">Заголовок</th>
                    <th className="p-2.5">Канал</th>
                    <th className="p-2.5">Статус</th>
                    <th className="p-2.5">Формат</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pink-100">
                  {importParsedPosts.map((post, idx) => (
                    <tr key={idx} className="hover:bg-pink-50/50">
                      <td className="p-2.5 font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-2.5">
                        <p className="font-bold text-slate-900 truncate max-w-xs">{post.title}</p>
                        <p className="text-[11px] text-slate-500 truncate max-w-xs">{post.text}</p>
                      </td>
                      <td className="p-2.5 font-mono text-sky-600 font-bold">{post.channel}</td>
                      <td className="p-2.5 font-bold">
                        <span className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded-lg font-mono text-[11px]">
                          {post.status}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-600">{post.format}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center gap-2 pt-3 border-t border-pink-200/80">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 bg-white/90 hover:bg-white text-slate-700 border border-pink-200 rounded-xl text-sm font-bold transition-all cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isImporting || importParsedPosts.length === 0}
                className="px-5 py-2 bg-gradient-to-r from-sky-400 via-pink-500 to-orange-400 text-white rounded-xl text-sm font-black transition-all cursor-pointer shadow-2xs hover:opacity-95 disabled:opacity-50"
              >
                {isImporting ? 'Импортирование...' : `Импортировать ${importParsedPosts.length} записей в базу данных`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteModalTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-2.5 sm:p-4 pb-20 sm:pb-4 bg-sky-100/55 backdrop-blur-md animate-fadeIn">
          <div className="bg-gradient-to-r from-sky-100 via-pink-100 via-orange-100 via-pink-100 to-sky-100 border border-pink-300 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative overflow-hidden text-left">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-2xl">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900">Подтверждение удаления</h3>
            </div>

            <div className="text-sm text-slate-700 leading-relaxed font-bold">
              {deleteModalTarget.type === 'single' && (
                <p>
                  Вы действительно хотите удалить публикацию «<b>{deleteModalTarget.post?.promptTitle}</b>» (ID #{deleteModalTarget.post?.postId})? Запись будет полностью удалена из базы данных и истории.
                </p>
              )}
              {deleteModalTarget.type === 'selected' && (
                <p>
                  Вы действительно хотите удалить <b>{deleteModalTarget.count}</b> выбранных записей? Они будут безвозвратно удалены из базы данных и истории.
                </p>
              )}
              {deleteModalTarget.type === 'filtered' && (
                <p>
                  Вы действительно хотите удалить ВСЕ <b>{deleteModalTarget.count}</b> записей по текущему фильтру? Они будут удалены из базы данных.
                </p>
              )}
            </div>

            <div className="flex justify-end items-center gap-2 pt-3 border-t border-pink-200/80">
              <button
                type="button"
                onClick={() => setDeleteModalTarget(null)}
                className="px-4 py-2 bg-white/90 hover:bg-white text-slate-700 border border-pink-200 rounded-xl text-sm font-bold transition-all cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-black transition-all cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {isDeleting ? 'Удаление...' : 'Да, удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL POST PREVIEW MODAL */}
      <CalendarPostPreviewModal
        publication={previewPublication}
        format={previewPublication ? getPublicationFormat(previewPublication) : 'v2'}
        onClose={() => setPreviewPublication(null)}
        onSelectPostForEdit={onSelectPostForEdit}
        onDeletePublication={onDeletePublication}
      />
    </div>
  );
}
