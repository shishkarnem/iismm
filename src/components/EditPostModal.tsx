import React, { useState, useEffect } from 'react';
import { Edit3, Check, AlertCircle, X, Image as ImageIcon, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { BlogPostData } from './PostCardRenderer';

interface EditPostModalProps {
  isOpen: boolean;
  post: BlogPostData | null;
  onClose: () => void;
  onSaved?: (updatedPost: BlogPostData) => void;
  onSave?: (updatedPost: BlogPostData) => void;
  onOpenInRedactor?: (postId: string) => void;
}

export default function EditPostModal({
  isOpen,
  post,
  onClose,
  onSaved,
  onSave,
  onOpenInRedactor
}: EditPostModalProps) {
  const [title, setTitle] = useState(post?.title || '');
  const [desc, setDesc] = useState(post?.desc || '');
  const [content, setContent] = useState(post?.content || '');
  const [category, setCategory] = useState(post?.category || 'ИИ & Нейросети');
  const [tag, setTag] = useState(post?.tag || '#smm');
  const [imageUrl, setImageUrl] = useState(post?.image || post?.attachmentUrl || '');
  const [messageFormat, setMessageFormat] = useState<'v2' | 'rich'>(post?.messageFormat || 'v2');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && post) {
      setTitle(post.title || '');
      setDesc(post.desc || '');
      setContent(post.content || '');
      setCategory(post.category || 'ИИ & Нейросети');
      setTag(post.tag || '#smm');
      setImageUrl(post.image || post.attachmentUrl || '');
      setMessageFormat(post.messageFormat || 'v2');
      setErrorMessage(null);
    }
  }, [isOpen, post]);

  if (!isOpen || !post) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setErrorMessage('Пожалуйста, заполните заголовок и текст публикации');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/blog/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          desc: desc.trim(),
          content: content.trim(),
          category,
          tag,
          image: imageUrl.trim() || undefined,
          attachmentUrl: imageUrl.trim() || undefined,
          attachmentType: imageUrl.trim() ? 'photo' : (post.attachmentType || 'article'),
          messageFormat
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при сохранении публикации');
      }

      const updated = data.post || {
        ...post,
        title: title.trim(),
        desc: desc.trim(),
        content: content.trim(),
        category,
        tag,
        image: imageUrl.trim() || undefined,
        attachmentUrl: imageUrl.trim() || undefined,
        messageFormat
      };

      if (onSaved) onSaved(updated);
      if (onSave) onSave(updated);
      onClose();
    } catch (err: any) {
      console.error('Update post error:', err);
      setErrorMessage(err.message || 'Ошибка обновления поста');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl rounded-3xl p-5 sm:p-6 border border-pink-300 shadow-2xl relative my-8"
        style={{
          background: 'linear-gradient(135deg, rgba(224,242,254,0.92) 0%, rgba(252,231,243,0.92) 25%, rgba(254,237,213,0.92) 50%, rgba(252,231,243,0.92) 75%, rgba(224,242,254,0.92) 100%)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-pink-200/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 flex items-center justify-center text-white shadow-xs">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-slate-900 leading-tight">
                Редактирование публикации
              </h3>
              <p className="text-[14px] text-slate-600 font-medium">
                Внесите изменения в вашу публикацию
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/80 hover:bg-white text-slate-500 hover:text-slate-800 flex items-center justify-center border border-pink-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {/* Title */}
          <div className="space-y-1">
            <label className="block text-[14px] font-bold text-slate-800">
              Заголовок публикации:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-pink-400"
              placeholder="Введите заголовок..."
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="block text-[14px] font-bold text-slate-800">
              Краткое описание / анонс:
            </label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-pink-400"
              placeholder="Краткое описание поста..."
            />
          </div>

          {/* Content */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-[14px] font-bold text-slate-800">
                Основной текст:
              </label>
              <div className="flex items-center space-x-1 p-0.5 rounded-lg bg-white/70 border border-pink-200 text-[14px]">
                <button
                  type="button"
                  onClick={() => setMessageFormat('v2')}
                  className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                    messageFormat === 'v2'
                      ? 'bg-gradient-to-r from-sky-400 to-pink-500 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Markdown V2
                </button>
                <button
                  type="button"
                  onClick={() => setMessageFormat('rich')}
                  className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                    messageFormat === 'rich'
                      ? 'bg-gradient-to-r from-sky-400 to-pink-500 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rich
                </button>
              </div>
            </div>
            <textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-pink-400 resize-y"
              placeholder="Текст публикации с поддержкой разметки..."
            />
          </div>

          {/* Category & Tag */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[14px] font-bold text-slate-800">
                Категория:
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
              >
                <option value="ИИ & Нейросети">ИИ & Нейросети</option>
                <option value="SMM & Продвижение">SMM & Продвижение</option>
                <option value="Кейсы & Опыт">Кейсы & Опыт</option>
                <option value="Инструкции & Гайды">Инструкции & Гайды</option>
                <option value="Инструменты">Инструменты</option>
                <option value="Новости">Новости</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[14px] font-bold text-slate-800">
                Хэштег:
              </label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-pink-400"
                placeholder="#smm #нейросети"
              />
            </div>
          </div>

          {/* Image URL */}
          <div className="space-y-1">
            <label className="block text-[14px] font-bold text-slate-800">
              Ссылка на изображение / обложку:
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-pink-400"
                placeholder="https://..."
              />
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Превью"
                  className="w-10 h-10 rounded-xl object-cover border border-pink-300 shrink-0"
                />
              )}
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-pink-100/90 border border-pink-300 text-rose-700 text-[14px] font-bold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="mt-5 pt-4 border-t border-pink-200/80 flex flex-wrap items-center justify-between gap-2.5">
            {onOpenInRedactor && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenInRedactor(post.id);
                }}
                className="px-4 py-2.5 rounded-xl bg-white/80 hover:bg-white text-pink-600 font-bold text-[14px] border border-pink-300 transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <Sparkles className="w-4 h-4 text-pink-500" />
                <span>Открыть в полном редакторе</span>
              </button>
            )}

            <div className="flex items-center space-x-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl bg-white/80 hover:bg-white text-slate-700 font-bold text-[14px] border border-pink-200 transition-colors cursor-pointer"
              >
                Отмена
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 to-sky-400 text-white font-bold text-[14px] shadow-md hover:opacity-90 active:scale-98 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Сохранение...' : 'Сохранить'}</span>
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
