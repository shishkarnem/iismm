import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  summary?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (nextOpen: boolean) => void;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  summary,
  icon,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  rightSlot,
  children,
  className = ''
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  useEffect(() => {
    if (controlledOpen === undefined && defaultOpen) {
      setInternalOpen(true);
    }
  }, [defaultOpen, controlledOpen]);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const handleToggle = () => {
    const next = !isOpen;
    if (controlledOpen === undefined) {
      setInternalOpen(next);
    }
    onToggle?.(next);
  };

  return (
    <div
      className={`w-full min-w-0 p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm ${className}`}
    >
      <div className="rounded-[14.5px] bg-gradient-to-r from-sky-100/65 via-pink-100/65 via-orange-100/65 via-pink-100/65 to-sky-100/65 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 min-h-[46px]">
          <button
            type="button"
            onClick={handleToggle}
            className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left cursor-pointer"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                {icon && <span className="shrink-0 text-pink-600">{icon}</span>}
                <span className="text-[14px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent break-words">
                  {title}
                </span>
              </div>
              {summary && !isOpen && (
                <div className="text-[14px] text-slate-700 font-medium leading-snug mt-0.5 break-words">
                  {summary}
                </div>
              )}
            </div>
            <ChevronDown
              size={18}
              className={`shrink-0 text-pink-600 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
          {rightSlot && <div className="shrink-0">{rightSlot}</div>}
        </div>

        {isOpen && (
          <div className="px-3.5 pb-3.5 pt-2 border-t border-pink-300/60 space-y-3">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};
