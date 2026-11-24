import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Edit3,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Eye,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Image as ImageIcon
} from 'lucide-react';
import { InlineButton, UserAccount } from '../../types';
import { TelegramPostTextEditor } from '../TelegramPostTextEditor';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { InlineButtonsBuilder } from '../InlineButtonsBuilder';
import { FileUpload } from '../FileUpload';
import {
  ACADEMY_SECTIONS,
  ACADEMY_BLOCK_GRADIENT,
  ACADEMY_VIBRANT_GRADIENT,
  ACADEMY_TEXT_GRADIENT,
  AcademyArticleItem,
  AcademySectionInfo,
  fetchAcademyArticles
} from './academyConstants';

export interface AdminAcademyManagerProps {
  currentUser: UserAccount;
}

export const AdminAcademyManager: React.FC<AdminAcademyManagerProps> = ({ currentUser }) => {
  const [sections, setSections] = useState<AcademySectionInfo[]>(ACADEMY_SECTIONS);
  const [articles, setArticles] = useState<AcademyArticleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSectionSlug, setSelectedSectionSlug] = useState<string>(ACADEMY_SECTIONS[0].slug);
  const [mobileSectionOpen, setMobileSectionOpen] = useState<boolean>(false);

  // Editor state
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [formSectionSlug, setFormSectionSlug] = useState<string>(ACADEMY_SECTIONS[0].slug);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formSummary, setFormSummary] = useState<string>('');
  const [formContent, setFormContent] = useState<string>('');
  const [formFormatMode, setFormFormatMode] = useState<'rich' | 'v2'>('rich');
  const [formAttachmentUrl, setFormAttachmentUrl] = useState<string>('');
  const [formInlineButtons, setFormInlineButtons] = useState<InlineButton[][]>([]);
  const [formIsPublished, setFormIsPublished] = useState<boolean>(true);
  const [showPreviewPane, setShowPreviewPane] = useState<boolean>(true);

  const [saving, setSaving] = useState<boolean>(false);
  const [deletingTarget, setDeletingTarget] = useState<AcademyArticleItem | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const data = await fetchAcademyArticles(true);
      setSections(data.sections);
      setArticles(data.articles);
    } catch (e: any) {
      setNotice({ type: 'err', text: e.message || 'Ошибка загрузки статей Академии' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const currentSection = useMemo(
    () => sections.find(s => s.slug === selectedSectionSlug) || sections[0],
    [sections, selectedSectionSlug]
  );

  const filteredArticles = useMemo(
    () =>
      articles
        .filter(a => a.sectionSlug === selectedSectionSlug)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [articles, selectedSectionSlug]
  );

  const openCreateEditor = () => {
    setIsCreatingNew(true);
    setEditingArticleId(null);
    setFormSectionSlug(selectedSectionSlug);
    setFormTitle('');
    setFormSummary('');
    setFormFormatMode('rich');
    setFormContent('## Заголовок статьи\n\nНапишите подробную инструкцию в формате Markdown Rich...');
    setFormAttachmentUrl('');
    setFormInlineButtons([]);
    setFormIsPublished(true);
    setNotice(null);
  };

  const openEditArticle = (art: AcademyArticleItem) => {
    setIsCreatingNew(false);
    setEditingArticleId(art.id);
    setFormSectionSlug(art.sectionSlug);
    setFormTitle(art.title);
    setFormSummary(art.summary || '');
    setFormContent(art.content || '');
    setFormFormatMode(art.formatMode || 'rich');
    setFormAttachmentUrl(art.attachmentUrl || '');
    setFormInlineButtons(Array.isArray(art.inlineButtons) ? art.inlineButtons : []);
    setFormIsPublished(art.isPublished !== false);
    setNotice(null);
  };

  const closeEditor = () => {
    setIsCreatingNew(false);
    setEditingArticleId(null);
  };

  const handleSaveArticle = async () => {
    if (!formTitle.trim()) {
      setNotice({ type: 'err', text: 'Пожалуйста, укажите заголовок статьи Академии' });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const endpoint = isCreatingNew
        ? '/api/admin/academy/articles'
        : `/api/admin/academy/articles/${encodeURIComponent(editingArticleId || '')}`;
      const method = isCreatingNew ? 'POST' : 'PUT';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionSlug: formSectionSlug,
          title: formTitle.trim(),
          summary: formSummary.trim(),
          content: formContent,
          formatMode: formFormatMode,
          attachmentUrl: formAttachmentUrl.trim(),
          attachmentUrls: formAttachmentUrl.trim() ? [formAttachmentUrl.trim()] : [],
          inlineButtons: formInlineButtons,
          isPublished: formIsPublished
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Не удалось сохранить статью');
      }
      if (Array.isArray(data.articles)) {
        setArticles(data.articles);
      } else {
        await loadAll();
      }
      setSelectedSectionSlug(formSectionSlug);
      if (isCreatingNew && data.article?.id) {
        setIsCreatingNew(false);
        setEditingArticleId(data.article.id);
      }
      setNotice({
        type: 'ok',
        text: 'Статья Академии успешно сохранена и зафиксирована в базе данных!'
      });
    } catch (e: any) {
      setNotice({ type: 'err', text: e.message || 'Ошибка сохранения статьи' });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTarget) return;
    try {
      const res = await fetch(
        `/api/admin/academy/articles/${encodeURIComponent(deletingTarget.id)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Ошибка удаления статьи');
      if (Array.isArray(data.articles)) {
        setArticles(data.articles);
      } else {
        await loadAll();
      }
      if (editingArticleId === deletingTarget.id) {
        closeEditor();
      }
      setDeletingTarget(null);
      setNotice({ type: 'ok', text: 'Статья удалена из Академии' });
    } catch (e: any) {
      setNotice({ type: 'err', text: e.message || 'Не удалось удалить статью' });
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= filteredArticles.length) return;
    const copy = [...filteredArticles];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    const orderedIds = copy.map(a => a.id);

    try {
      const res = await fetch('/api/admin/academy/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds })
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.articles)) {
        setArticles(data.articles);
      }
    } catch (e) {
      console.error('Failed reordering academy articles:', e);
    }
  };

  const isEditorOpen = isCreatingNew || Boolean(editingArticleId);

  return (
    <div className="space-y-5 text-left text-[14px] min-w-0">
      {/* Top Admin Academy Header */}
      <div className={`p-[1.5px] rounded-3xl ${ACADEMY_VIBRANT_GRADIENT}`}>
        <div
          className={`rounded-[22.5px] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${ACADEMY_BLOCK_GRADIENT}`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <span className={`p-2 rounded-2xl text-white shadow-xs shrink-0 ${ACADEMY_VIBRANT_GRADIENT}`}>
                <BookOpen className="w-5 h-5" />
              </span>
              <h2 className={`text-[18px] sm:text-[22px] font-extrabold break-words ${ACADEMY_TEXT_GRADIENT}`}>
                Управление разделом Академия (Markdown Rich)
              </h2>
            </div>
            <p className="text-[14px] text-slate-800 font-medium break-words">
              Редактируйте обучающие статьи для страницы /academy и всплывающих окон справки (?) в личном кабинете
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href="/academy"
              target="_blank"
              rel="noreferrer"
              className={`px-4 py-2.5 rounded-2xl text-white font-bold text-[14px] shadow-xs hover:opacity-95 transition-all cursor-pointer inline-flex items-center gap-1.5 ${ACADEMY_VIBRANT_GRADIENT}`}
            >
              <Eye className="w-4 h-4" />
              <span>Открыть /academy</span>
            </a>

            <button
              type="button"
              onClick={openCreateEditor}
              className={`px-4 py-2.5 rounded-2xl text-white font-bold text-[14px] shadow-sm hover:opacity-95 transition-all cursor-pointer inline-flex items-center gap-1.5 ${ACADEMY_VIBRANT_GRADIENT}`}
            >
              <Plus className="w-4 h-4" />
              <span>Создать статью Академии</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Notice */}
      {notice && (
        <div className={`p-[1.5px] rounded-2xl ${ACADEMY_VIBRANT_GRADIENT}`}>
          <div
            className={`rounded-[14.5px] px-4 py-3 flex items-center justify-between gap-3 ${ACADEMY_BLOCK_GRADIENT}`}
          >
            <div className="flex items-center gap-2 text-[14px] font-bold text-slate-900 min-w-0 break-words">
              {notice.type === 'ok' ? (
                <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span>{notice.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-slate-600 hover:text-slate-900 font-bold text-[14px] cursor-pointer px-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Rich Markdown Editor Panel when creating or editing */}
      {isEditorOpen && (
        <div className={`p-[2px] rounded-3xl shadow-md ${ACADEMY_VIBRANT_GRADIENT}`}>
          <div className={`rounded-[22px] p-4 sm:p-6 space-y-5 min-w-0 ${ACADEMY_BLOCK_GRADIENT}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pink-300/80 pb-3.5">
              <h3 className={`text-[18px] font-extrabold ${ACADEMY_TEXT_GRADIENT}`}>
                {isCreatingNew ? 'Создание новой статьи Академии' : 'Редактирование статьи Академии'}
              </h3>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPreviewPane(prev => !prev)}
                  className={`px-3.5 py-2 rounded-xl text-white font-bold text-[14px] cursor-pointer flex items-center gap-1.5 ${ACADEMY_VIBRANT_GRADIENT}`}
                >
                  <Eye className="w-4 h-4" />
                  <span>{showPreviewPane ? 'Скрыть предпросмотр' : 'Показать предпросмотр'}</span>
                </button>

                <button
                  type="button"
                  onClick={closeEditor}
                  className={`px-3.5 py-2 rounded-xl text-white font-bold text-[14px] cursor-pointer flex items-center gap-1 ${ACADEMY_VIBRANT_GRADIENT}`}
                >
                  <X className="w-4 h-4" />
                  <span>Закрыть редактор</span>
                </button>
              </div>
            </div>

            {/* Metadata Fields: Section, Visibility, Title, Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 min-w-0">
                <label className="block text-[14px] font-bold text-slate-900">
                  Раздел обучения (1 из 7)
                </label>
                <select
                  value={formSectionSlug}
                  onChange={e => setFormSectionSlug(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 to-orange-50/90 border border-pink-300 text-[14px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400 cursor-pointer"
                >
                  {sections.map((sec, i) => (
                    <option key={sec.slug} value={sec.slug}>
                      {i + 1}. {sec.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 min-w-0">
                <label className="block text-[14px] font-bold text-slate-900">
                  Статус публикации статьи
                </label>
                <button
                  type="button"
                  onClick={() => setFormIsPublished(prev => !prev)}
                  className={`w-full px-4 py-2.5 rounded-2xl text-[14px] font-bold cursor-pointer transition-all text-white ${ACADEMY_VIBRANT_GRADIENT}`}
                >
                  {formIsPublished
                    ? 'Опубликована (видна на /academy и в окнах ?)'
                    : 'Скрыта (черновик статьи)'}
                </button>
              </div>

              <div className="space-y-1.5 md:col-span-2 min-w-0">
                <label className="block text-[14px] font-bold text-slate-900">
                  Заголовок статьи
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Например: Как подключить канал и распределить роли в команде"
                  className="w-full px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 to-orange-50/90 border border-pink-300 text-[14px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2 min-w-0">
                <label className="block text-[14px] font-bold text-slate-900">
                  Краткое описание (подзаголовок в карточке статьи)
                </label>
                <input
                  type="text"
                  value={formSummary}
                  onChange={e => setFormSummary(e.target.value)}
                  placeholder="Одно предложение о том, чему научит эта статья..."
                  className="w-full px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 to-orange-50/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
              </div>
            </div>

            {/* Cover Image URL + Upload */}
            <div className="space-y-2 min-w-0">
              <label className="block text-[14px] font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-pink-600" />
                <span>Обложка статьи (необязательно)</span>
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <input
                  type="text"
                  value={formAttachmentUrl}
                  onChange={e => setFormAttachmentUrl(e.target.value)}
                  placeholder="Ссылка на изображение обложки или загрузите файл..."
                  className="flex-1 min-w-0 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 to-orange-50/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
                <FileUpload
                  accept="image/*"
                  buttonLabel="Загрузить обложку"
                  onUploaded={(_key, url) => setFormAttachmentUrl(url)}
                />
              </div>
            </div>

            {/* Platform Rich Markdown Editor + Live Preview */}
            <div className={`grid grid-cols-1 ${showPreviewPane ? 'xl:grid-cols-2' : ''} gap-5 items-start`}>
              <div className="min-w-0 space-y-4">
                <TelegramPostTextEditor
                  text={formContent}
                  onChange={setFormContent}
                  formatMode={formFormatMode}
                  onFormatModeChange={setFormFormatMode}
                  label="Содержание статьи (Markdown Rich / v2)"
                  placeholder="Напишите текст обучающей статьи, выделите фрагмент для добавления заголовков, цитат, таблиц, спойлеров и списков..."
                  minRows={14}
                  showModeSwitch={true}
                  showAiButton={false}
                />

                <InlineButtonsBuilder
                  buttons={formInlineButtons}
                  onChange={setFormInlineButtons}
                  label="Кнопки быстрых переходов под статьей"
                  showReminderTemplates={false}
                  postTitle={formTitle}
                  postText={formContent}
                  userId={currentUser?.id || '16926299042'}
                />
              </div>

              {showPreviewPane && (
                <div className="min-w-0 space-y-2">
                  <div className="text-[14px] font-bold text-slate-900">
                    Живой предпросмотр статьи (как на /academy и в модальном окне ?)
                  </div>
                  <div className={`p-[1.5px] rounded-3xl ${ACADEMY_VIBRANT_GRADIENT}`}>
                    <div className={`rounded-[22.5px] p-4 sm:p-5 space-y-3 min-w-0 overflow-hidden ${ACADEMY_BLOCK_GRADIENT}`}>
                      <h4 className={`text-[18px] font-extrabold break-words ${ACADEMY_TEXT_GRADIENT}`}>
                        {formTitle || 'Заголовок статьи'}
                      </h4>
                      {formSummary && (
                        <p className="text-[14px] text-slate-800 font-medium break-words">
                          {formSummary}
                        </p>
                      )}
                      {formAttachmentUrl && (
                        <img
                          src={formAttachmentUrl}
                          alt=""
                          className="w-full max-h-60 object-cover rounded-2xl"
                        />
                      )}
                      <div className="text-[15px] text-slate-900 leading-relaxed min-w-0 break-words pt-2 border-t border-pink-300/60">
                        <MarkdownRenderer
                          content={formContent}
                          format={formFormatMode}
                          inlineButtons={formInlineButtons as any}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Save / Cancel Bar */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-pink-300/80">
              <button
                type="button"
                onClick={closeEditor}
                className="px-4 py-2.5 rounded-2xl border border-pink-300 text-slate-800 font-bold text-[14px] hover:bg-pink-100/60 cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveArticle}
                disabled={saving}
                className={`px-5 py-2.5 rounded-2xl text-white font-bold text-[14px] shadow-md hover:opacity-95 transition-all cursor-pointer inline-flex items-center gap-2 disabled:opacity-50 ${ACADEMY_VIBRANT_GRADIENT}`}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? 'Сохраняю...' : 'Сохранить статью в Академии'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section Filter (Mobile Dropdown + Desktop Grid, Zero Horizontal Scroll) */}
      <div className="space-y-3">
        {/* Mobile Section Selector */}
        <div className="md:hidden relative">
          <button
            type="button"
            onClick={() => setMobileSectionOpen(prev => !prev)}
            className={`w-full px-4 py-3 rounded-2xl text-white font-bold text-[14px] shadow-xs flex items-center justify-between gap-2 cursor-pointer ${ACADEMY_VIBRANT_GRADIENT}`}
          >
            <span className="truncate">Раздел: {currentSection?.title}</span>
            <ChevronDown className={`w-5 h-5 shrink-0 transition-transform ${mobileSectionOpen ? 'rotate-180' : ''}`} />
          </button>

          {mobileSectionOpen && (
            <div className={`mt-2 p-[1.5px] rounded-2xl ${ACADEMY_VIBRANT_GRADIENT}`}>
              <div className={`rounded-[14.5px] p-2 space-y-1.5 ${ACADEMY_BLOCK_GRADIENT}`}>
                {sections.map((sec, idx) => {
                  const count = articles.filter(a => a.sectionSlug === sec.slug).length;
                  const active = sec.slug === selectedSectionSlug;
                  return (
                    <button
                      key={sec.slug}
                      type="button"
                      onClick={() => {
                        setSelectedSectionSlug(sec.slug);
                        setMobileSectionOpen(false);
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-[14px] font-bold text-left flex items-center justify-between gap-2 cursor-pointer ${
                        active ? `${ACADEMY_VIBRANT_GRADIENT} text-white` : 'text-slate-800 hover:bg-pink-100/60'
                      }`}
                    >
                      <span className="min-w-0 break-words">
                        {idx + 1}. {sec.title}
                      </span>
                      <span>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Desktop 7 Sections Grid */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {sections.map((sec, idx) => {
            const count = articles.filter(a => a.sectionSlug === sec.slug).length;
            const active = sec.slug === selectedSectionSlug;
            return (
              <button
                key={sec.slug}
                type="button"
                onClick={() => setSelectedSectionSlug(sec.slug)}
                className={`p-[1.5px] rounded-2xl text-left cursor-pointer transition-all ${ACADEMY_VIBRANT_GRADIENT}`}
              >
                <div
                  className={`h-full rounded-[14.5px] px-3.5 py-3 flex items-center justify-between gap-2 ${
                    active ? `${ACADEMY_VIBRANT_GRADIENT} text-white` : `${ACADEMY_BLOCK_GRADIENT} text-slate-900`
                  }`}
                >
                  <span className="text-[14px] font-bold leading-snug break-words">
                    {idx + 1}. {sec.title}
                  </span>
                  <span className={`text-[14px] font-extrabold shrink-0 ${active ? 'text-white' : 'text-pink-700'}`}>
                    {count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Articles List in Selected Section */}
      <div className={`p-[1.5px] rounded-3xl ${ACADEMY_VIBRANT_GRADIENT}`}>
        <div className={`rounded-[22.5px] p-4 sm:p-6 space-y-4 ${ACADEMY_BLOCK_GRADIENT}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-pink-300/70 pb-3">
            <h3 className={`text-[17px] font-extrabold ${ACADEMY_TEXT_GRADIENT}`}>
              Статьи раздела «{currentSection?.title}» ({filteredArticles.length})
            </h3>
            <button
              type="button"
              onClick={openCreateEditor}
              className={`px-3.5 py-2 rounded-xl text-white font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 ${ACADEMY_VIBRANT_GRADIENT}`}
            >
              <Plus className="w-4 h-4" />
              <span>Добавить статью в этот раздел</span>
            </button>
          </div>

          {loading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-slate-800 font-semibold">
              <Loader2 className="w-5 h-5 animate-spin text-pink-600" />
              <span>Загрузка статей...</span>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-[15px] font-bold text-slate-800">В этом разделе пока нет статей</p>
              <button
                type="button"
                onClick={openCreateEditor}
                className={`px-4 py-2.5 rounded-2xl text-white font-bold text-[14px] cursor-pointer inline-flex items-center gap-1.5 ${ACADEMY_VIBRANT_GRADIENT}`}
              >
                <Plus className="w-4 h-4" />
                <span>Создать первую статью</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredArticles.map((art, idx) => (
                <div
                  key={art.id}
                  className={`p-[1.5px] rounded-2xl ${ACADEMY_VIBRANT_GRADIENT}`}
                >
                  <div
                    className={`rounded-[14.5px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${ACADEMY_BLOCK_GRADIENT}`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[14px] text-slate-700 font-semibold">
                        <span>Порядок: {idx + 1}</span>
                        <span>·</span>
                        <span>Формат: {art.formatMode === 'v2' ? 'v2' : 'Rich'}</span>
                        <span>·</span>
                        <span className={art.isPublished ? 'text-sky-700 font-bold' : 'text-orange-700 font-bold'}>
                          {art.isPublished ? 'Опубликована' : 'Скрыта'}
                        </span>
                      </div>
                      <h4 className="text-[16px] font-extrabold text-slate-900 break-words">
                        {art.title}
                      </h4>
                      {art.summary && (
                        <p className="text-[14px] text-slate-700 break-words">{art.summary}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveOrder(idx, 'up')}
                        disabled={idx === 0}
                        title="Поднять выше"
                        className="p-2 rounded-xl border border-pink-300 text-slate-800 hover:bg-pink-100/60 disabled:opacity-40 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveOrder(idx, 'down')}
                        disabled={idx === filteredArticles.length - 1}
                        title="Опустить ниже"
                        className="p-2 rounded-xl border border-pink-300 text-slate-800 hover:bg-pink-100/60 disabled:opacity-40 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditArticle(art)}
                        className={`px-3.5 py-2 rounded-xl text-white font-bold text-[14px] shadow-2xs hover:opacity-95 cursor-pointer inline-flex items-center gap-1.5 ${ACADEMY_VIBRANT_GRADIENT}`}
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Редактировать</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingTarget(art)}
                        className="px-3 py-2 rounded-xl border border-rose-300 text-rose-700 font-bold text-[14px] hover:bg-rose-100/60 cursor-pointer inline-flex items-center gap-1"
                        title="Удалить статью"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal (transparent light gradient, zero dark overlay) */}
      {deletingTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-br from-sky-100/50 via-pink-100/50 via-orange-100/50 to-sky-100/50 backdrop-blur-md"
          onClick={() => setDeletingTarget(null)}
        >
          <div
            className={`max-w-md w-full p-[2px] rounded-3xl shadow-xl ${ACADEMY_VIBRANT_GRADIENT}`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`rounded-[22px] p-6 space-y-4 ${ACADEMY_BLOCK_GRADIENT}`}>
              <h4 className={`text-[18px] font-extrabold ${ACADEMY_TEXT_GRADIENT}`}>
                Удалить статью Академии?
              </h4>
              <p className="text-[14px] text-slate-800 font-medium break-words">
                Вы действительно хотите удалить статью «{deletingTarget.title}»? Это действие нельзя отменить.
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingTarget(null)}
                  className="px-4 py-2 rounded-xl border border-pink-300 text-slate-800 font-bold text-[14px] cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className={`px-4 py-2 rounded-xl text-white font-bold text-[14px] cursor-pointer ${ACADEMY_VIBRANT_GRADIENT}`}
                >
                  Удалить статью
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
