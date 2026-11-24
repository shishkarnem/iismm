import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
  FileText
} from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import {
  ACADEMY_SECTIONS,
  ACADEMY_BLOCK_GRADIENT,
  ACADEMY_VIBRANT_GRADIENT,
  ACADEMY_TEXT_GRADIENT,
  AcademyArticleItem,
  AcademySectionInfo,
  fetchAcademyArticles
} from './academyConstants';

export interface AcademyContentViewerProps {
  initialSectionSlug?: string;
  initialArticleId?: string;
  compactMode?: boolean;
  onSectionChange?: (sectionSlug: string) => void;
  onNavigate?: (path: string) => void;
}

export const AcademyContentViewer: React.FC<AcademyContentViewerProps> = ({
  initialSectionSlug,
  initialArticleId,
  compactMode = false,
  onSectionChange,
  onNavigate
}) => {
  const [sections, setSections] = useState<AcademySectionInfo[]>(ACADEMY_SECTIONS);
  const [articles, setArticles] = useState<AcademyArticleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSectionSlug, setSelectedSectionSlug] = useState<string>(
    initialSectionSlug && ACADEMY_SECTIONS.some(s => s.slug === initialSectionSlug)
      ? initialSectionSlug
      : ACADEMY_SECTIONS[0].slug
  );
  const [selectedArticleId, setSelectedArticleId] = useState<string>(initialArticleId || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mobileSectionDropdownOpen, setMobileSectionDropdownOpen] = useState<boolean>(false);

  useEffect(() => {
    if (initialSectionSlug && ACADEMY_SECTIONS.some(s => s.slug === initialSectionSlug)) {
      setSelectedSectionSlug(initialSectionSlug);
    }
  }, [initialSectionSlug]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchAcademyArticles(false)
      .then(data => {
        if (!active) return;
        setSections(data.sections);
        setArticles(data.articles);
      })
      .catch(err => {
        if (!active) return;
        setError(err.message || 'Не удалось загрузить статьи Академии');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeSection = useMemo(
    () => sections.find(s => s.slug === selectedSectionSlug) || sections[0],
    [sections, selectedSectionSlug]
  );

  const sectionArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return articles.filter(
        a =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.content.toLowerCase().includes(q) ||
          a.sectionTitle.toLowerCase().includes(q)
      );
    }
    return articles.filter(a => a.sectionSlug === selectedSectionSlug);
  }, [articles, selectedSectionSlug, searchQuery]);

  useEffect(() => {
    if (sectionArticles.length === 0) {
      setSelectedArticleId('');
      return;
    }
    if (!selectedArticleId || !sectionArticles.some(a => a.id === selectedArticleId)) {
      setSelectedArticleId(sectionArticles[0].id);
    }
  }, [sectionArticles, selectedArticleId]);

  const activeArticle = useMemo(
    () => sectionArticles.find(a => a.id === selectedArticleId) || sectionArticles[0] || null,
    [sectionArticles, selectedArticleId]
  );

  const handleSelectSection = (slug: string) => {
    setSelectedSectionSlug(slug);
    setSearchQuery('');
    setMobileSectionDropdownOpen(false);
    onSectionChange?.(slug);
  };

  if (loading) {
    return (
      <div className={`p-[1.5px] rounded-3xl ${ACADEMY_VIBRANT_GRADIENT}`}>
        <div className={`rounded-[22.5px] p-8 flex flex-col items-center justify-center gap-3 ${ACADEMY_BLOCK_GRADIENT}`}>
          <Loader2 className="w-7 h-7 text-pink-600 animate-spin" />
          <p className="text-[15px] font-semibold text-slate-800">Загружаем статьи Академии...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-[1.5px] rounded-3xl ${ACADEMY_VIBRANT_GRADIENT}`}>
        <div className={`rounded-[22.5px] p-6 text-center space-y-2 ${ACADEMY_BLOCK_GRADIENT}`}>
          <p className="text-[15px] font-bold text-rose-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-4 text-left text-[14px]">
      {/* Search bar + Mobile Section Dropdown Selector (zero horizontal scroll) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* Mobile Section Dropdown (< lg) */}
        <div className="lg:hidden w-full min-w-0 relative">
          <button
            type="button"
            onClick={() => setMobileSectionDropdownOpen(prev => !prev)}
            className={`w-full px-4 py-3 rounded-2xl text-white font-bold text-[14px] shadow-sm flex items-center justify-between gap-2 cursor-pointer transition-all ${ACADEMY_VIBRANT_GRADIENT}`}
          >
            <span className="truncate text-left">
              Раздел: {activeSection?.title || 'Выберите раздел'}
            </span>
            <ChevronDown
              className={`w-5 h-5 shrink-0 transition-transform ${
                mobileSectionDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {mobileSectionDropdownOpen && (
            <div className={`mt-2 p-[1.5px] rounded-2xl shadow-lg ${ACADEMY_VIBRANT_GRADIENT}`}>
              <div className={`rounded-[14.5px] p-2 space-y-1.5 ${ACADEMY_BLOCK_GRADIENT}`}>
                {sections.map((sec, idx) => {
                  const count = articles.filter(a => a.sectionSlug === sec.slug).length;
                  const isCurrent = sec.slug === selectedSectionSlug && !searchQuery.trim();
                  return (
                    <button
                      key={sec.slug}
                      type="button"
                      onClick={() => handleSelectSection(sec.slug)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-[14px] font-bold text-left flex items-center justify-between gap-2 cursor-pointer transition-all ${
                        isCurrent
                          ? `${ACADEMY_VIBRANT_GRADIENT} text-white shadow-xs`
                          : 'text-slate-800 hover:bg-pink-100/60'
                      }`}
                    >
                      <span className="min-w-0 break-words">
                        {idx + 1}. {sec.title}
                      </span>
                      <span
                        className={`text-[14px] shrink-0 font-semibold ${
                          isCurrent ? 'text-white' : 'text-slate-600'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Search input across all Academy articles */}
        <div className="lg:col-span-12 w-full min-w-0">
          <div className={`p-[1.5px] rounded-2xl ${ACADEMY_VIBRANT_GRADIENT}`}>
            <div className={`rounded-[14.5px] px-3.5 py-2 flex items-center gap-2.5 ${ACADEMY_BLOCK_GRADIENT}`}>
              <Search className="w-4 h-4 text-pink-600 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск по разделам и статьям Академии..."
                className="w-full min-w-0 bg-transparent text-[14px] font-medium text-slate-900 placeholder:text-slate-600 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className={`px-3 py-1 rounded-xl text-white text-[14px] font-bold cursor-pointer shrink-0 ${ACADEMY_VIBRANT_GRADIENT}`}
                >
                  Сбросить
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout: Desktop Left Sections Column + Right Articles & Rich Reader */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Desktop 7 Sections Vertical Menu */}
        <div className="hidden lg:block lg:col-span-4 min-w-0">
          <div className={`p-[1.5px] rounded-3xl ${ACADEMY_VIBRANT_GRADIENT}`}>
            <div className={`rounded-[22.5px] p-3.5 space-y-2 ${ACADEMY_BLOCK_GRADIENT}`}>
              <div className="px-2 py-1">
                <h3 className={`text-[16px] font-extrabold ${ACADEMY_TEXT_GRADIENT}`}>
                  Разделы обучения
                </h3>
              </div>

              <div className="space-y-1.5">
                {sections.map((sec, idx) => {
                  const count = articles.filter(a => a.sectionSlug === sec.slug).length;
                  const isSelected = sec.slug === selectedSectionSlug && !searchQuery.trim();
                  return (
                    <button
                      key={sec.slug}
                      type="button"
                      onClick={() => handleSelectSection(sec.slug)}
                      className={`w-full px-3.5 py-3 rounded-2xl text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? `${ACADEMY_VIBRANT_GRADIENT} text-white shadow-sm`
                          : 'text-slate-800 hover:bg-pink-100/60 border border-pink-300/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-bold leading-snug break-words">
                          {idx + 1}. {sec.title}
                        </div>
                      </div>
                      <span
                        className={`text-[14px] font-bold shrink-0 ${
                          isSelected ? 'text-white' : 'text-pink-700'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Area: Section Description, Article Selector Cards & Markdown Rich Article View */}
        <div className="lg:col-span-8 min-w-0 space-y-4">
          {/* Active Section Intro */}
          {!searchQuery.trim() && activeSection && !compactMode && (
            <div className={`p-[1.5px] rounded-3xl ${ACADEMY_VIBRANT_GRADIENT}`}>
              <div className={`rounded-[22.5px] p-4 sm:p-5 space-y-1.5 ${ACADEMY_BLOCK_GRADIENT}`}>
                <h2 className={`text-[18px] sm:text-[20px] font-extrabold break-words ${ACADEMY_TEXT_GRADIENT}`}>
                  {activeSection.title}
                </h2>
                <p className="text-[14px] text-slate-800 font-medium leading-relaxed break-words">
                  {activeSection.description}
                </p>
              </div>
            </div>
          )}

          {/* Articles list in selected section (vertical stack on mobile, 2-col grid on wider screens — zero horizontal scroll) */}
          {sectionArticles.length > 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {sectionArticles.map(art => {
                const isActive = activeArticle?.id === art.id;
                return (
                  <button
                    key={art.id}
                    type="button"
                    onClick={() => setSelectedArticleId(art.id)}
                    className={`w-full min-w-0 p-[1.5px] rounded-2xl text-left transition-all cursor-pointer ${ACADEMY_VIBRANT_GRADIENT}`}
                  >
                    <div
                      className={`h-full rounded-[14.5px] p-3.5 flex items-start justify-between gap-2 transition-all ${
                        isActive
                          ? `${ACADEMY_VIBRANT_GRADIENT} text-white`
                          : `${ACADEMY_BLOCK_GRADIENT} text-slate-900`
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText
                            className={`w-4 h-4 shrink-0 ${
                              isActive ? 'text-white' : 'text-pink-600'
                            }`}
                          />
                          <span className="text-[14px] font-bold leading-snug break-words">
                            {art.title}
                          </span>
                        </div>
                        {art.summary && (
                          <p
                            className={`text-[14px] leading-snug line-clamp-2 break-words ${
                              isActive ? 'text-white/95' : 'text-slate-700'
                            }`}
                          >
                            {art.summary}
                          </p>
                        )}
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 mt-1 ${
                          isActive ? 'text-white' : 'text-pink-600'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Selected Article Reader in Rich Markdown */}
          {activeArticle ? (
            <div className={`p-[1.5px] rounded-3xl shadow-sm ${ACADEMY_VIBRANT_GRADIENT}`}>
              <article className={`rounded-[22.5px] p-4 sm:p-6 space-y-4 min-w-0 overflow-hidden ${ACADEMY_BLOCK_GRADIENT}`}>
                <div className="border-b border-pink-300/70 pb-3 space-y-1.5">
                  <div className="text-[14px] font-semibold text-pink-700 break-words">
                    {activeArticle.sectionTitle}
                  </div>
                  <h3 className={`text-[18px] sm:text-[22px] font-extrabold leading-snug break-words ${ACADEMY_TEXT_GRADIENT}`}>
                    {activeArticle.title}
                  </h3>
                  {activeArticle.summary && (
                    <p className="text-[14px] text-slate-800 font-medium leading-relaxed break-words">
                      {activeArticle.summary}
                    </p>
                  )}
                </div>

                {activeArticle.attachmentUrl && (
                  <div className={`p-[1.5px] rounded-2xl overflow-hidden ${ACADEMY_VIBRANT_GRADIENT}`}>
                    <img
                      src={activeArticle.attachmentUrl}
                      alt={activeArticle.title}
                      className="w-full max-h-80 object-cover rounded-[14.5px]"
                    />
                  </div>
                )}

                <div
                  className="text-[15px] text-slate-900 leading-relaxed min-w-0 break-words"
                  onClick={e => {
                    // Intercept internal relative links inside inline buttons if onNavigate is provided
                    const anchor = (e.target as HTMLElement)?.closest('a');
                    const href = anchor?.getAttribute('href');
                    if (href && href.startsWith('/') && onNavigate) {
                      e.preventDefault();
                      onNavigate(href);
                    }
                  }}
                >
                  <MarkdownRenderer
                    content={activeArticle.content}
                    format={activeArticle.formatMode || 'rich'}
                    attachmentUrls={activeArticle.attachmentUrls}
                    inlineButtons={activeArticle.inlineButtons as any}
                  />
                </div>
              </article>
            </div>
          ) : (
            <div className={`p-[1.5px] rounded-3xl ${ACADEMY_VIBRANT_GRADIENT}`}>
              <div className={`rounded-[22.5px] p-8 text-center space-y-2 ${ACADEMY_BLOCK_GRADIENT}`}>
                <BookOpen className="w-8 h-8 text-pink-600 mx-auto" />
                <p className="text-[15px] font-bold text-slate-900">
                  В этом разделе пока нет опубликованных статей
                </p>
                <p className="text-[14px] text-slate-700">
                  Попробуйте выбрать другой раздел обучения или изменить поисковый запрос.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
