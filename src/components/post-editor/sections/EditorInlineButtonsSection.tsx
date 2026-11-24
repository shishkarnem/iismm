import React, { useState } from 'react';
import { Loader2, MousePointerClick, Sparkles } from 'lucide-react';
import { InlineButtonRow } from '../../../types';
import { CollapsibleSection } from '../../ui-kit/CollapsibleSection';
import { GradientSelect } from '../../ui-kit/GradientDropdown';
import {
  AiInlineButtonsDbPromptSection,
  INLINE_LAYOUT_RULE_OPTIONS,
  InlineButtonsLayoutRuleOption,
  InlineKeyboardVisualGrid
} from '../../ui-kit/InlineKeyboardVisualGrid';
import { ResponsiveActionBtn, UnboxedMetaLine } from '../../ui-kit/ResponsiveActionBtn';
import { usePricingConfig } from '../../../hooks/usePricingConfig';
import { formatIirkyCount } from '../../../shared/pricingConfig';

export interface GenerateAiButtonsPayload {
  count: number;
  defaultUrl: string;
  layoutRule: InlineButtonsLayoutRuleOption;
  customInstruction?: string;
  customPrompt?: string;
}

interface EditorInlineButtonsSectionProps {
  userId?: string;
  inlineButtons: InlineButtonRow[];
  onChangeInlineButtons: (rows: InlineButtonRow[]) => void;
  isGeneratingButtons: boolean;
  onGenerateAiButtons: (payload: GenerateAiButtonsPayload) => void;
}

export const EditorInlineButtonsSection: React.FC<EditorInlineButtonsSectionProps> = ({
  userId,
  inlineButtons,
  onChangeInlineButtons,
  isGeneratingButtons,
  onGenerateAiButtons
}) => {
  const { pricing } = usePricingConfig(userId);
  const btnCostLabel = formatIirkyCount(pricing.textAi.inlineButtons);
  const [aiButtonsCount, setAiButtonsCount] = useState<string>('2');
  const [aiLayoutRule, setAiLayoutRule] = useState<InlineButtonsLayoutRuleOption>('1_per_row');
  const [aiDefaultUrl, setAiDefaultUrl] = useState<string>('https://t.me/IIrkiBot');
  const [aiCustomInstruction, setAiCustomInstruction] = useState<string>('');
  const [aiPromptText, setAiPromptText] = useState<string>('');

  const totalBtns = inlineButtons.reduce((acc, r) => acc + r.buttons.length, 0);
  const summary =
    totalBtns > 0
      ? `Строк: ${inlineButtons.length} · Настроено кнопок: ${totalBtns}`
      : 'Кнопки не добавлены';

  return (
    <CollapsibleSection
      title="Конструктор инлайн-кнопок"
      summary={summary}
      icon={<MousePointerClick size={17} />}
      defaultOpen={totalBtns > 0}
    >
      <div className="space-y-3.5 min-w-0">
        {/* Nested collapsible AI Button Generator with layout rule, custom text field & PostgreSQL prompt */}
        <CollapsibleSection
          title="Нейрогенератор кнопок по смыслу поста"
          summary={`${btnCostLabel} · Правило раскладки, пожелания и свой промпт в базе`}
          icon={<Sparkles size={16} />}
          defaultOpen={false}
        >
          <div className="space-y-3 min-w-0">
            <UnboxedMetaLine
              items={[
                btnCostLabel,
                'Формирует лаконичные кнопки под тему вашего текста и раскладывает по строкам'
              ]}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
              <GradientSelect
                label="Количество кнопок"
                value={aiButtonsCount}
                onChange={setAiButtonsCount}
                options={[
                  { value: '1', label: '1 целевая кнопка' },
                  { value: '2', label: '2 кнопки' },
                  { value: '3', label: '3 кнопки' },
                  { value: '4', label: '4 кнопки' },
                  { value: '5', label: '5 кнопок' },
                  { value: '6', label: '6 кнопок' }
                ]}
              />

              <GradientSelect
                label="Правило раскладки кнопок"
                value={aiLayoutRule}
                onChange={(val) => setAiLayoutRule(val as InlineButtonsLayoutRuleOption)}
                options={INLINE_LAYOUT_RULE_OPTIONS}
              />
            </div>

            <div className="min-w-0">
              <label className="block text-[14px] font-bold mb-1.5 bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                Ссылка по умолчанию для новых кнопок
              </label>
              <input
                type="text"
                value={aiDefaultUrl}
                onChange={(e) => setAiDefaultUrl(e.target.value)}
                placeholder="https://t.me/IIrkiBot"
                className="w-full min-w-0 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 to-sky-50/90 border border-pink-300 text-[14px] text-slate-900 focus:outline-none"
              />
            </div>

            <AiInlineButtonsDbPromptSection
              userId={userId}
              layoutRule={aiLayoutRule}
              onChangeLayoutRule={setAiLayoutRule}
              customInstruction={aiCustomInstruction}
              onChangeCustomInstruction={setAiCustomInstruction}
              promptText={aiPromptText}
              onChangePromptText={setAiPromptText}
            />

            <ResponsiveActionBtn
              icon={
                isGeneratingButtons ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )
              }
              label={`Сгенерировать кнопки (${btnCostLabel})`}
              alwaysShowLabel
              variant="vivid"
              disabled={isGeneratingButtons}
              onClick={() =>
                onGenerateAiButtons({
                  count: Number(aiButtonsCount) || 2,
                  defaultUrl: aiDefaultUrl,
                  layoutRule: aiLayoutRule,
                  customInstruction: aiCustomInstruction,
                  customPrompt: aiPromptText
                })
              }
            />
          </div>
        </CollapsibleSection>

        {/* Visual Horizontal Rows & Columns Builder */}
        <InlineKeyboardVisualGrid
          rows={inlineButtons}
          onChangeRows={onChangeInlineButtons}
          defaultUrl={aiDefaultUrl}
          allowButtonTypes
          maxButtonsPerRow={3}
        />
      </div>
    </CollapsibleSection>
  );
};
