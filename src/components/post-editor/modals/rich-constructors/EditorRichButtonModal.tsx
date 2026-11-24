import React, { useEffect, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { GradientSelect } from '../../../ui-kit/GradientDropdown';
import { GradientModalShell, ResponsiveActionBtn } from '../../../ui-kit/ResponsiveActionBtn';
import { ParsedRichButton, RichButtonRowPreview, RichButtonChip } from '../../preview/RichButtonsAndMediaPreview';

export interface EditorRichButtonModalProps {
  open: boolean;
  onClose: () => void;
  initialText?: string;
  onInsertButtonMarkup: (markup: string) => void;
}

interface EditableRichButton {
  text: string;
  type: 'url' | 'copy_text' | 'callback_data' | 'web_app' | 'disabled';
  style: 'primary' | 'success' | 'danger' | 'link';
  url: string;
  copyText: string;
  callbackData: string;
}

function escapeAttr(val: string): string {
  return String(val || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeInner(val: string): string {
  return String(val || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function createEmptyButton(seedText = ''): EditableRichButton {
  return {
    text: seedText.trim() || 'Открыть подробности',
    type: 'url',
    style: 'primary',
    url: 'https://t.me/',
    copyText: '',
    callbackData: 'action_1'
  };
}

export const EditorRichButtonModal: React.FC<EditorRichButtonModalProps> = ({
  open,
  onClose,
  initialText = '',
  onInsertButtonMarkup
}) => {
  const [containerMode, setContainerMode] = useState<'row' | 'inline'>('row');
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('center');
  const [buttons, setButtons] = useState<EditableRichButton[]>([createEmptyButton()]);

  useEffect(() => {
    if (!open) return;
    const cleaned = (initialText || '').replace(/<[^>]+>/g, '').trim();
    setContainerMode('row');
    setAlign('center');
    setButtons([createEmptyButton(cleaned)]);
  }, [open, initialText]);

  const buildTagString = (btn: EditableRichButton): string => {
    const attrs: string[] = [`type="${btn.type}"`, `style="${btn.style}"`];
    if ((btn.type === 'url' || btn.type === 'web_app') && btn.url.trim()) {
      attrs.push(`url="${escapeAttr(btn.url.trim())}"`);
    } else if (btn.type === 'copy_text') {
      const val = btn.copyText.trim() || btn.text.trim();
      attrs.push(`text="${escapeAttr(val)}"`);
    } else if (btn.type === 'callback_data' && btn.callbackData.trim()) {
      attrs.push(`data="${escapeAttr(btn.callbackData.trim())}"`);
    }
    return `<tg-button ${attrs.join(' ')}>${escapeInner(btn.text.trim() || 'Кнопка')}</tg-button>`;
  };

  const generatedMarkup =
    containerMode === 'inline'
      ? buildTagString(buttons[0] || createEmptyButton())
      : `<tg-button-row align="${align}">\n${buttons.map((b) => `  ${buildTagString(b)}`).join('\n')}\n</tg-button-row>`;

  const previewButtons: ParsedRichButton[] = buttons.map((b) => ({
    text: b.text.trim() || 'Кнопка',
    type: b.type,
    style: b.style,
    url: b.url.trim(),
    copyText: b.copyText.trim() || b.text.trim(),
    callbackData: b.callbackData.trim()
  }));

  const handleConfirm = () => {
    const snippet = containerMode === 'row' ? `\n${generatedMarkup}\n` : generatedMarkup;
    onInsertButtonMarkup(snippet);
    onClose();
  };

  const displayedButtons = containerMode === 'inline' ? buttons.slice(0, 1) : buttons;

  return (
    <GradientModalShell
      open={open}
      onClose={onClose}
      title="Конструктор кнопок в тексте (Rich 10.3)"
      subtitle="Создайте ряд кнопок <tg-button-row> или встроенную в строку кнопку <tg-button>"
      maxWidthClass="max-w-2xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <ResponsiveActionBtn
            icon={<Check size={16} />}
            label="Вставить кнопку"
            alwaysShowLabel
            variant="vivid"
            onClick={handleConfirm}
          />
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <GradientSelect
            label="Режим размещения"
            value={containerMode}
            onChange={(val) => setContainerMode(val as 'row' | 'inline')}
            options={[
              {
                value: 'row',
                label: 'Ряд кнопок (<tg-button-row>)',
                sublabel: 'До 8 кнопок в аккуратном ряду внутри статьи'
              },
              {
                value: 'inline',
                label: 'Встроенная кнопка (<tg-button>)',
                sublabel: 'Одиночная кнопка прямо внутри абзаца текста'
              }
            ]}
          />

          {containerMode === 'row' && (
            <GradientSelect
              label="Выравнивание ряда"
              value={align}
              onChange={(val) => setAlign(val as 'left' | 'center' | 'right')}
              options={[
                { value: 'left', label: 'По левому краю (left)' },
                { value: 'center', label: 'По центру (center)' },
                { value: 'right', label: 'По правому краю (right)' }
              ]}
            />
          )}
        </div>

        <div className="space-y-3">
          {displayedButtons.map((btn, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-2xl bg-white/75 border border-pink-300/80 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-bold text-slate-900">
                  {containerMode === 'inline' ? 'Параметры кнопки' : `Кнопка ${idx + 1} из ${buttons.length}`}
                </span>
                {containerMode === 'row' && buttons.length > 1 && (
                  <ResponsiveActionBtn
                    icon={<Trash2 size={15} />}
                    label="Удалить"
                    showLabelFrom="never"
                    variant="danger"
                    onClick={() => setButtons((prev) => prev.filter((_, i) => i !== idx))}
                  />
                )}
              </div>

              <div>
                <label className="block text-[14px] font-bold mb-1 text-slate-900">
                  Текст на кнопке
                </label>
                <input
                  type="text"
                  value={btn.text}
                  onChange={(e) =>
                    setButtons((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, text: e.target.value } : it))
                    )
                  }
                  placeholder="Например: Перейти в канал"
                  className="w-full px-3.5 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <GradientSelect
                  compact
                  label="Тип действия"
                  value={btn.type}
                  onChange={(val) =>
                    setButtons((prev) =>
                      prev.map((it, i) =>
                        i === idx ? { ...it, type: val as EditableRichButton['type'] } : it
                      )
                    )
                  }
                  options={[
                    { value: 'url', label: 'Ссылка (url)' },
                    { value: 'copy_text', label: 'Копировать текст (copy_text)' },
                    { value: 'callback_data', label: 'Callback-команда (callback_data)' },
                    { value: 'web_app', label: 'Мини-приложение (web_app)' },
                    { value: 'disabled', label: 'Неактивная (disabled)' }
                  ]}
                />

                <GradientSelect
                  compact
                  label="Стиль кнопки Telegram"
                  value={btn.style}
                  onChange={(val) =>
                    setButtons((prev) =>
                      prev.map((it, i) =>
                        i === idx ? { ...it, style: val as EditableRichButton['style'] } : it
                      )
                    )
                  }
                  options={[
                    { value: 'primary', label: 'Основная (primary)' },
                    { value: 'success', label: 'Акцентная (success)' },
                    { value: 'danger', label: 'Важная (danger)' },
                    { value: 'link', label: 'Контурная ссылка (link)' }
                  ]}
                />
              </div>

              {(btn.type === 'url' || btn.type === 'web_app') && (
                <div>
                  <label className="block text-[14px] font-bold mb-1 text-slate-900">
                    Адрес ссылки (https:// или tg://)
                  </label>
                  <input
                    type="text"
                    value={btn.url}
                    onChange={(e) =>
                      setButtons((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, url: e.target.value } : it))
                      )
                    }
                    placeholder="https://t.me/..."
                    className="w-full px-3.5 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] font-mono text-slate-900 focus:outline-none focus:border-pink-500"
                  />
                </div>
              )}

              {btn.type === 'copy_text' && (
                <div>
                  <label className="block text-[14px] font-bold mb-1 text-slate-900">
                    Текст или промокод для копирования в буфер
                  </label>
                  <input
                    type="text"
                    value={btn.copyText}
                    onChange={(e) =>
                      setButtons((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, copyText: e.target.value } : it))
                      )
                    }
                    placeholder="Например: promo2026"
                    className="w-full px-3.5 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] font-mono text-slate-900 focus:outline-none focus:border-pink-500"
                  />
                </div>
              )}

              {btn.type === 'callback_data' && (
                <div>
                  <label className="block text-[14px] font-bold mb-1 text-slate-900">
                    Идентификатор callback-data
                  </label>
                  <input
                    type="text"
                    value={btn.callbackData}
                    onChange={(e) =>
                      setButtons((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, callbackData: e.target.value } : it))
                      )
                    }
                    placeholder="open_menu_1"
                    className="w-full px-3.5 py-2 rounded-xl bg-white/90 border border-pink-300 text-[14px] font-mono text-slate-900 focus:outline-none focus:border-pink-500"
                  />
                </div>
              )}
            </div>
          ))}

          {containerMode === 'row' && buttons.length < 8 && (
            <ResponsiveActionBtn
              icon={<Plus size={16} />}
              label="Добавить кнопку в ряд"
              alwaysShowLabel
              variant="outline"
              onClick={() => setButtons((prev) => [...prev, createEmptyButton(`Кнопка ${prev.length + 1}`)])}
            />
          )}
        </div>

        {/* Live preview */}
        <div className="p-3.5 rounded-2xl bg-white/75 border border-pink-300/80 space-y-2">
          <div className="text-[14px] font-bold text-slate-900">Предпросмотр</div>
          {containerMode === 'row' ? (
            <RichButtonRowPreview align={align} buttons={previewButtons} />
          ) : (
            <div className="py-1 text-[14px] text-slate-800">
              Текст абзаца <RichButtonChip btn={previewButtons[0]} inline /> продолжение строки
            </div>
          )}
          <pre className="p-2.5 rounded-xl bg-white/85 border border-pink-200 text-[14px] font-mono text-slate-700 whitespace-pre-wrap break-all">
            {generatedMarkup}
          </pre>
        </div>
      </div>
    </GradientModalShell>
  );
};
