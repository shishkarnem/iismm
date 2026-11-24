import React from 'react';
import { ExternalLink } from 'lucide-react';

interface ProductLinkItem {
  label: string;
  href: string;
}

const ECOSYSTEM_PRODUCTS: ProductLinkItem[] = [
  { label: 'Робот Рекрутер', href: 'https://hr-rr.ru/' },
  { label: 'ИИ-Ревизор', href: 'https://ii-rr.ru/' },
  { label: 'ИИ-Викторины', href: 'https://qaiz.ru/' },
  { label: 'АлхимИИ', href: 'https://aihim.ru/' },
  { label: 'ИИ-Разработка', href: 'https://sav-ai.ru/' },
  { label: 'Канал про ИИ', href: 'https://t.me/SAV_AI' },
  { label: 'AI РОП', href: 'https://rent-rop.com/ii-dlya-otdela-prodazh/' }
];

export const EcosystemProductsBar: React.FC = () => {
  return (
    <div className="w-full min-w-0 p-[1.5px] rounded-2xl shadow-2xs bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
      <div className="w-full min-w-0 rounded-[14.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md px-[2vw] sm:px-4 py-3.5 sm:py-4 space-y-3">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <h4 className="text-[15px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent leading-snug break-words">
            Наши продукты и проекты
          </h4>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 min-w-0">
          {ECOSYSTEM_PRODUCTS.map((item, idx) => {
            const isLast = idx === ECOSYSTEM_PRODUCTS.length - 1;
            return (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`min-h-[42px] px-2.5 py-2 rounded-xl text-white font-bold text-[14px] leading-tight text-center shadow-2xs hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer min-w-0 bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 ${
                  isLast ? 'col-span-2 sm:col-span-2 lg:col-span-1' : ''
                }`}
              >
                <span className="break-words whitespace-normal">{item.label}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-90" />
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EcosystemProductsBar;
