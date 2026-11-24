import React from 'react';
import { Sparkles, Image as ImageIcon, GitBranch, FolderHeart, Coins } from 'lucide-react';
import { PricingConfig } from '../../../shared/pricingConfig';

interface AdminPricingAiSectionsProps {
  pricing: PricingConfig;
  onChange: (next: PricingConfig) => void;
}

interface NumberFieldProps {
  label: string;
  hint: string;
  value: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
}

const NumberField: React.FC<NumberFieldProps> = ({
  label,
  hint,
  value,
  step = 1,
  unit = 'ИИрок',
  onChange
}) => (
  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/75 via-pink-50/75 via-orange-50/75 via-pink-50/75 to-sky-50/75 border border-pink-300/80 space-y-2 flex flex-col justify-between">
    <div className="space-y-0.5">
      <div className="text-[14px] font-bold text-slate-900 leading-snug">{label}</div>
      <div className="text-[14px] text-slate-700 leading-snug">{hint}</div>
    </div>
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const parsed = step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
          onChange(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
        }}
        className="w-full px-3 py-2 rounded-xl bg-white/85 border border-pink-300 text-[15px] font-mono font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
      />
      <span className="text-[14px] font-bold text-pink-700 shrink-0">{unit}</span>
    </div>
  </div>
);

export const AdminPricingAiSections: React.FC<AdminPricingAiSectionsProps> = ({
  pricing,
  onChange
}) => {
  const presetsStr = (pricing.topup.topupPresetsRub || []).join(', ');

  return (
    <div className="space-y-5">
      {/* 1. Нейротекст и редактура */}
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-xs">
        <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-pink-300/70 pb-3">
            <div className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-[16px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                Генерация текстов, стилей и кнопок
              </h3>
              <p className="text-[14px] text-slate-700 font-medium">
                Стоимость всех текстовых ИИ-инструментов в редакторе постов и каналов
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <NumberField
              label="Генерация поста в редакторе"
              hint="Маршрут /api/protalk/generate"
              value={pricing.textAi.postGeneration}
              onChange={(val) => onChange({ ...pricing, textAi: { ...pricing.textAi, postGeneration: val } })}
            />
            <NumberField
              label="Анализ и создание стиля канала"
              hint="Маршрут /api/protalk/analyze-style"
              value={pricing.textAi.styleAnalysis}
              onChange={(val) => onChange({ ...pricing, textAi: { ...pricing.textAi, styleAnalysis: val } })}
            />
            <NumberField
              label="Нейроплан (15 постов наперед)"
              hint="Маршрут /api/protalk/neuroplan"
              value={pricing.textAi.neuroplan}
              onChange={(val) => onChange({ ...pricing, textAi: { ...pricing.textAi, neuroplan: val } })}
            />
            <NumberField
              label="Генерация инлайн-кнопок ИИ"
              hint="Кнопки по тексту в редакторе и сценариях"
              value={pricing.textAi.inlineButtons}
              onChange={(val) => onChange({ ...pricing, textAi: { ...pricing.textAi, inlineButtons: val } })}
            />
            <NumberField
              label="Генерация описания канала"
              hint="Раздел «Каналы» и мастер бота"
              value={pricing.textAi.channelDescription}
              onChange={(val) => onChange({ ...pricing, textAi: { ...pricing.textAi, channelDescription: val } })}
            />
            <NumberField
              label="ИИ-заполнение расписания"
              hint="Распознавание расписания по тексту"
              value={pricing.textAi.scheduleAiFill}
              onChange={(val) => onChange({ ...pricing, textAi: { ...pricing.textAi, scheduleAiFill: val } })}
            />
            <NumberField
              label="Красивое оформление через ИИ"
              hint="Стилизация текста в блоке сценария"
              value={pricing.textAi.beautyPostAi}
              onChange={(val) => onChange({ ...pricing, textAi: { ...pricing.textAi, beautyPostAi: val } })}
            />
          </div>
        </div>
      </div>

      {/* 2. Модели генерации картинок */}
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-xs">
        <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-pink-300/70 pb-3">
            <div className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0">
              <ImageIcon size={18} />
            </div>
            <div>
              <h3 className="text-[16px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                Генерация изображений и каруселей
              </h3>
              <p className="text-[14px] text-slate-700 font-medium">
                Синхронизируется с конструктором изображений, сценариями и системными настройками ProTalk
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <NumberField
              label="Модель 787 (базовая быстрая)"
              hint="am/flux.2-klein-4b в конструкторе"
              value={pricing.imageModels.func_787}
              onChange={(val) => onChange({ ...pricing, imageModels: { ...pricing.imageModels, func_787: val } })}
            />
            <NumberField
              label="Модель 621 (стандартная без текста)"
              hint="Основная генерация иллюстраций"
              value={pricing.imageModels.func_621}
              onChange={(val) => onChange({ ...pricing, imageModels: { ...pricing.imageModels, func_621: val } })}
            />
            <NumberField
              label="Модель 784 (кириллица и инфографика)"
              hint="Текст на русском и до 4 референсов"
              value={pricing.imageModels.func_784}
              onChange={(val) => onChange({ ...pricing, imageModels: { ...pricing.imageModels, func_784: val } })}
            />
            <NumberField
              label="Модель 791 (флагман, до 16 референсов)"
              hint="Студийная композиция и карусели"
              value={pricing.imageModels.func_791}
              onChange={(val) => onChange({ ...pricing, imageModels: { ...pricing.imageModels, func_791: val } })}
            />
            <NumberField
              label="Быстрая генерация обложек (legacy 621)"
              hint="Маршрут /api/protalk/generate-image"
              value={pricing.imageModels.legacyGenerateImage}
              onChange={(val) => onChange({ ...pricing, imageModels: { ...pricing.imageModels, legacyGenerateImage: val } })}
            />
          </div>
        </div>
      </div>

      {/* 3. ИИ-сценарии и Иирка */}
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-xs">
        <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-pink-300/70 pb-3">
            <div className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0">
              <GitBranch size={18} />
            </div>
            <div>
              <h3 className="text-[16px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                Блоки сценариев и помощница Иирка
              </h3>
              <p className="text-[14px] text-slate-700 font-medium">
                Расчет стоимости сборки сценариев и выполнения каждого ИИ-блока
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <NumberField
              label="Сборка или правка сценария с Ииркой"
              hint="Голосовой/текстовый конструктор сценария"
              value={pricing.scenarioAi.assistantBuildOrEdit}
              onChange={(val) => onChange({ ...pricing, scenarioAi: { ...pricing.scenarioAi, assistantBuildOrEdit: val } })}
            />
            <NumberField
              label="Уникальная тема с анализом архива"
              hint="Блок ai_generate_topic (за 30 дней)"
              value={pricing.scenarioAi.topicArchive}
              onChange={(val) => onChange({ ...pricing, scenarioAi: { ...pricing.scenarioAi, topicArchive: val } })}
            />
            <NumberField
              label="Быстрая генерация темы"
              hint="Блок ai_generate_topic_fast"
              value={pricing.scenarioAi.topicFast}
              onChange={(val) => onChange({ ...pricing, scenarioAi: { ...pricing.scenarioAi, topicFast: val } })}
            />
            <NumberField
              label="Генерация текста в сценарии"
              hint="Блок ai_generate_text (за 1 запуск)"
              value={pricing.scenarioAi.textGeneration}
              onChange={(val) => onChange({ ...pricing, scenarioAi: { ...pricing.scenarioAi, textGeneration: val } })}
            />
            <NumberField
              label="Промпт для картинки (за 1 часть)"
              hint="Блок ai_generate_image_prompt"
              value={pricing.scenarioAi.imagePromptPerItem}
              onChange={(val) => onChange({ ...pricing, scenarioAi: { ...pricing.scenarioAi, imagePromptPerItem: val } })}
            />
            <NumberField
              label="ИИ-разделение Rich по смыслу"
              hint="Блок rich_split_parts в ИИ-режиме"
              value={pricing.scenarioAi.richSplitAi}
              onChange={(val) => onChange({ ...pricing, scenarioAi: { ...pricing.scenarioAi, richSplitAi: val } })}
            />
          </div>
        </div>
      </div>

      {/* 4. Папки и подборки */}
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-xs">
        <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-pink-300/70 pb-3">
            <div className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0">
              <FolderHeart size={18} />
            </div>
            <div>
              <h3 className="text-[16px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                Папки, подборки и взаимный пиар
              </h3>
              <p className="text-[14px] text-slate-700 font-medium">
                Стоимость участия каналов, модерации и нейрогенерации обложек промо
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <NumberField
              label="Участие канала в папке"
              hint="Списание с участника при заявке"
              value={pricing.promoAndFolders.folderJoin}
              onChange={(val) => onChange({ ...pricing, promoAndFolders: { ...pricing.promoAndFolders, folderJoin: val } })}
            />
            <NumberField
              label="Участие канала в подборке"
              hint="Базовый взнос за вступление"
              value={pricing.promoAndFolders.selectionJoin}
              onChange={(val) => onChange({ ...pricing, promoAndFolders: { ...pricing.promoAndFolders, selectionJoin: val } })}
            />
            <NumberField
              label="Нейромодерация текста (функция 763)"
              hint="Дополнительно при вступлении в подборку"
              value={pricing.promoAndFolders.selectionModeration}
              onChange={(val) => onChange({ ...pricing, promoAndFolders: { ...pricing.promoAndFolders, selectionModeration: val } })}
            />
            <NumberField
              label="Редактирование рекламы в подборке"
              hint="Повторная проверка и обновление"
              value={pricing.promoAndFolders.selectionEdit}
              onChange={(val) => onChange({ ...pricing, promoAndFolders: { ...pricing.promoAndFolders, selectionEdit: val } })}
            />
            <NumberField
              label="ИИ-текст для папки или подборки"
              hint="Улучшение описания и заголовка"
              value={pricing.promoAndFolders.promoAiText}
              onChange={(val) => onChange({ ...pricing, promoAndFolders: { ...pricing.promoAndFolders, promoAiText: val } })}
            />
            <NumberField
              label="ИИ-обложка для папки или подборки"
              hint="Генерация промо-баннера"
              value={pricing.promoAndFolders.promoAiImage}
              onChange={(val) => onChange({ ...pricing, promoAndFolders: { ...pricing.promoAndFolders, promoAiImage: val } })}
            />
          </div>
        </div>
      </div>

      {/* 5. Курс пополнения и пресеты */}
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-xs">
        <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-pink-300/70 pb-3">
            <div className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0">
              <Coins size={18} />
            </div>
            <div>
              <h3 className="text-[16px] font-extrabold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                Курс пополнения ИИрок и быстрые суммы
              </h3>
              <p className="text-[14px] text-slate-700 font-medium">
                Применяется только к новым счетам и обменам — прошлые чеки и начисления не затрагиваются
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <NumberField
              label="Сколько ИИрок начисляется за 1 ₽"
              hint="Например: 1 (1 ₽ = 1 ИИрка) или 2 (1 ₽ = 2 ИИрки)"
              value={pricing.topup.iirkyPerRub}
              step={0.1}
              unit="ИИрок за 1 ₽"
              onChange={(val) => onChange({ ...pricing, topup: { ...pricing.topup, iirkyPerRub: Math.max(0.01, val) } })}
            />

            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/75 via-pink-50/75 via-orange-50/75 via-pink-50/75 to-sky-50/75 border border-pink-300/80 space-y-2 flex flex-col justify-between">
              <div className="space-y-0.5">
                <div className="text-[14px] font-bold text-slate-900">Быстрые суммы пополнения (в рублях, через запятую)</div>
                <div className="text-[14px] text-slate-700">Отображаются кнопками в окне пополнения баланса</div>
              </div>
              <input
                type="text"
                value={presetsStr}
                onChange={(e) => {
                  const arr = e.target.value
                    .split(/[,\s;]+/)
                    .map((s) => Math.round(Number(s.trim())))
                    .filter((n) => Number.isFinite(n) && n >= 10);
                  onChange({
                    ...pricing,
                    topup: {
                      ...pricing.topup,
                      topupPresetsRub: arr.length > 0 ? arr : pricing.topup.topupPresetsRub
                    }
                  });
                }}
                placeholder="500, 990, 2500, 4900, 10000, 25000"
                className="w-full px-3 py-2 rounded-xl bg-white/85 border border-pink-300 text-[14px] font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
