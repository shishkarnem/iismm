import React, { useState } from 'react';
import { Sparkles, Plus, Trash2, Check, X, Loader2 } from 'lucide-react';
import { PostStyleItem } from '../post-editor/core/postStylesData';
import { GradientModalShell, ResponsiveActionBtn } from '../ui-kit/ResponsiveActionBtn';
import { NeurosphereLoader } from '../loaders/NeurosphereLoader';
import { usePricingConfig } from '../../hooks/usePricingConfig';
import { formatIirkyCount } from '../../shared/pricingConfig';

interface ChannelStyleAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  telegramId?: number | string;
  hasRazgonTariff?: boolean;
  onRequireRazgon?: () => void;
  onStyleCreated: (newStyle: PostStyleItem) => void;
}

export const ChannelStyleAnalyzerModal: React.FC<ChannelStyleAnalyzerModalProps> = ({
  isOpen,
  onClose,
  userId,
  telegramId,
  hasRazgonTariff = true,
  onRequireRazgon,
  onStyleCreated
}) => {
  const { pricing } = usePricingConfig(userId);
  const styleCostLabel = formatIirkyCount(pricing.textAi.styleAnalyze);
  const [styleName, setStyleName] = useState('');
  const [posts, setPosts] = useState<Array<{ id: string; text: string }>>([
    { id: 'csp_1', text: '' },
    { id: 'csp_2', text: '' }
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const addPostField = () => {
    if (posts.length >= 10) return;
    setPosts(prev => [...prev, { id: `csp_${Date.now()}_${prev.length + 1}`, text: '' }]);
  };

  const removePostField = (id: string) => {
    if (posts.length <= 1) return;
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const updatePostText = (id: string, text: string) => {
    setPosts(prev => prev.map(p => (p.id === id ? { ...p, text } : p)));
  };

  const handleAnalyze = async () => {
    if (!hasRazgonTariff && onRequireRazgon) {
      onRequireRazgon();
      return;
    }
    const validPosts = posts.map(p => p.text.trim()).filter(t => t.length > 5);
    if (validPosts.length === 0) {
      setErrorMsg('Добавьте хотя бы один пример поста (от 6 символов)');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/protalk/analyze-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posts: validPosts.slice(0, 10),
          styleName: styleName.trim() || 'Фирменный стиль канала',
          userId,
          telegramId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Не удалось проанализировать стиль постов');
      }

      const created: PostStyleItem = {
        id: data.style?.id || `custom_${Date.now()}`,
        title: `👑 ${data.style?.title || styleName.trim() || 'Стиль канала'}`,
        desc: data.style?.desc || 'Фирменный стиль на основе примеров канала',
        prompt: data.style?.prompt || '',
        isCustom: true
      };

      onStyleCreated(created);
      setStyleName('');
      setPosts([{ id: 'csp_1', text: '' }]);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка анализа стиля');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <GradientModalShell
      open={isOpen}
      isOpen={isOpen}
      onClose={onClose}
      title="Создать фирменный стиль по примерам постов"
      subtitle={`Нейросеть изучит подачу, ритм и лексику до 10 постов канала · ${styleCostLabel}`}
      icon={<Sparkles className="w-5 h-5" />}
      maxWidthClass="max-w-xl"
      zIndexClass="z-[295]"
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          <ResponsiveActionBtn
            icon={<X className="w-4 h-4" />}
            label="Отмена"
            variant="ghost"
            onClick={onClose}
            disabled={isAnalyzing}
          />
          <ResponsiveActionBtn
            icon={isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            label={isAnalyzing ? 'Анализируем посты...' : `Создать стиль (${styleCostLabel})`}
            alwaysShowLabel
            variant="primary"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
          />
        </div>
      }
    >
      <div className="space-y-3">
        {isAnalyzing && (
          <div className="fixed inset-0 z-[310] flex flex-col items-center justify-center p-4 bg-gradient-to-br from-sky-100/55 via-pink-100/55 via-orange-100/55 via-pink-100/55 to-sky-100/55 backdrop-blur-sm">
            <NeurosphereLoader
              variant="inline"
              label="Нейросеть анализирует стиль постов..."
            />
          </div>
        )}
        {!hasRazgonTariff && (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 border border-pink-300 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[14px] font-bold text-slate-900">
              Формирование фирменного стиля из постов канала доступно с тарифа Разгон.
            </span>
            {onRequireRazgon && (
              <button
                type="button"
                onClick={onRequireRazgon}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white text-[14px] font-bold cursor-pointer shadow-xs"
              >
                Перейти к тарифам
              </button>
            )}
          </div>
        )}
        <div>
          <label className="block text-[14px] font-bold text-slate-900 mb-1">
            Название вашего стиля
          </label>
          <input
            type="text"
            value={styleName}
            onChange={(e) => setStyleName(e.target.value)}
            placeholder="Например: Авторский тон нашего блога"
            className="w-full px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 border border-pink-300 text-slate-900 text-[14px] font-medium focus:outline-none focus:border-pink-500"
          />
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-bold text-slate-900">
              Примеры постов ({posts.length}/10)
            </span>
            {posts.length < 10 && (
              <ResponsiveActionBtn
                icon={<Plus className="w-4 h-4" />}
                label="Добавить пример"
                variant="secondary"
                onClick={addPostField}
              />
            )}
          </div>

          {posts.map((p, idx) => (
            <div key={p.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium text-slate-700">Пример #{idx + 1}</span>
                {posts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePostField(p.id)}
                    className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                    title="Удалить пример"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <textarea
                rows={3}
                value={p.text}
                onChange={(e) => updatePostText(p.id, e.target.value)}
                placeholder="Вставьте текст опубликованного поста из канала..."
                className="w-full px-3.5 py-2 rounded-2xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 border border-pink-300 text-slate-900 text-[14px] font-medium focus:outline-none focus:border-pink-500 resize-y"
              />
            </div>
          ))}
        </div>

        {errorMsg && (
          <p className="text-[14px] font-bold text-rose-700 break-words">{errorMsg}</p>
        )}
      </div>
    </GradientModalShell>
  );
};
