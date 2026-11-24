import React from 'react';
import { CalendarRange, Cpu, FileText, Globe, Share2 } from 'lucide-react';
import { GradientSelect } from '../ui-kit/GradientDropdown';

export type PostsWorkspaceTabKey = 'blog' | 'drafts' | 'neuroplan' | 'scenarios' | 'crosspost';

interface PostsWorkspaceNavProps {
  activeTab: PostsWorkspaceTabKey;
  userId?: string;
  onNavigate: (path: string) => void;
}

export const PostsWorkspaceNav: React.FC<PostsWorkspaceNavProps> = ({
  activeTab,
  userId = '16926299042',
  onNavigate
}) => {
  const cleanUid = String(userId || '16926299042');
  const blogUrl = `/posts${cleanUid}`;
  const draftsUrl = `/posts${cleanUid}/redactor`;
  const neuroplanUrl = '/neuroplan';
  const scenariosUrl = '/scenarios';
  const crosspostUrl = '/crosspost';

  const items: Array<{
    key: PostsWorkspaceTabKey;
    label: string;
    path: string;
    btnId: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'blog',
      label: 'Блог',
      path: blogUrl,
      btnId: 'nav-posts-blog-btn',
      icon: <Globe className="w-4 h-4 shrink-0" />
    },
    {
      key: 'drafts',
      label: 'Черновики',
      path: draftsUrl,
      btnId: 'nav-posts-drafts-btn',
      icon: <FileText className="w-4 h-4 shrink-0" />
    },
    {
      key: 'neuroplan',
      label: 'Нейроплан',
      path: neuroplanUrl,
      btnId: 'nav-posts-neuroplan-btn',
      icon: <CalendarRange className="w-4 h-4 shrink-0" />
    },
    {
      key: 'scenarios',
      label: 'Сценарии',
      path: scenariosUrl,
      btnId: 'nav-posts-scenarios-btn',
      icon: <Cpu className="w-4 h-4 shrink-0" />
    },
    {
      key: 'crosspost',
      label: 'Кросспостинг',
      path: crosspostUrl,
      btnId: 'nav-posts-crosspost-btn',
      icon: <Share2 className="w-4 h-4 shrink-0" />
    }
  ];

  const handleSelectChange = (val: string) => {
    const found = items.find((i) => i.key === val);
    if (found) onNavigate(found.path);
  };

  return (
    <>
      <div className="sm:hidden min-w-0">
        <GradientSelect
          value={activeTab}
          onChange={handleSelectChange}
          buttonVariant="vivid"
          options={items.map((it) => ({
            value: it.key,
            label: it.label,
            icon: it.icon
          }))}
        />
      </div>

      <div className="hidden sm:grid sm:grid-cols-5 gap-2 w-full pt-1 min-w-0">
        {items.map((it) => {
          const isActive = activeTab === it.key;
          return (
            <button
              key={it.key}
              type="button"
              id={it.btnId}
              onClick={() => onNavigate(it.path)}
              className={`px-3 py-2.5 rounded-2xl text-[14px] font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer min-w-0 ${
                isActive
                  ? 'bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white'
                  : 'bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 hover:brightness-103 text-slate-900 border border-pink-300'
              }`}
            >
              <span className={isActive ? 'text-white shrink-0' : 'text-pink-600 shrink-0'}>
                {it.icon}
              </span>
              <span className="truncate">{it.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};
