import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ResponsiveActionBtnProps {
  icon: React.ReactNode;
  label: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  title?: string;
  variant?: 'vivid' | 'outline' | 'danger' | 'primary' | 'secondary' | 'ghost';
  showLabelFrom?: 'sm' | 'md' | 'lg' | 'xl' | 'always' | 'never';
  alwaysShowLabel?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}

/**
 * Ergonomic action button: renders a >=40x40px icon button on mobile,
 * and reveals text label on desktop (or according to showLabelFrom).
 */
export const ResponsiveActionBtn: React.FC<ResponsiveActionBtnProps> = ({
  icon,
  label,
  onClick,
  onMouseDown,
  disabled = false,
  title,
  variant = 'vivid',
  showLabelFrom = 'sm',
  alwaysShowLabel = false,
  type = 'button',
  className = ''
}) => {
  const effectiveShowFrom = alwaysShowLabel ? 'always' : showLabelFrom;
  const normalizedVariant =
    variant === 'primary'
      ? 'vivid'
      : variant === 'secondary' || variant === 'ghost'
      ? 'outline'
      : variant;

  const labelVisibility =
    effectiveShowFrom === 'always'
      ? 'inline'
      : effectiveShowFrom === 'never'
      ? 'hidden'
      : effectiveShowFrom === 'md'
      ? 'hidden md:inline'
      : effectiveShowFrom === 'lg'
      ? 'hidden lg:inline'
      : effectiveShowFrom === 'xl'
      ? 'hidden xl:inline'
      : 'hidden sm:inline';

  if (normalizedVariant === 'outline') {
    return (
      <div className={`inline-flex p-[1.5px] rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm ${className}`}>
        <button
          type={type}
          disabled={disabled}
          onMouseDown={onMouseDown}
          onClick={onClick}
          title={title || label}
          aria-label={title || label}
          className="w-full min-w-[40px] min-h-[40px] px-2.5 sm:px-3.5 py-2 rounded-[10.5px] bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md text-slate-900 font-semibold text-[14px] inline-flex items-center justify-center gap-2 hover:brightness-102 transition-all cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
        >
          <span className="shrink-0 text-pink-600">{icon}</span>
          <span className={`${labelVisibility} leading-snug`}>{label}</span>
        </button>
      </div>
    );
  }

  if (variant === 'danger') {
    return (
      <button
        type={type}
        disabled={disabled}
        onMouseDown={onMouseDown}
        onClick={onClick}
        title={title || label}
        aria-label={title || label}
        className={`min-w-[40px] min-h-[40px] px-2.5 sm:px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-500 via-pink-600 to-orange-500 text-white font-semibold text-[14px] inline-flex items-center justify-center gap-2 shadow-sm hover:brightness-105 transition-all cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${className}`}
      >
        <span className="shrink-0">{icon}</span>
        <span className={`${labelVisibility} leading-snug`}>{label}</span>
      </button>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onMouseDown={onMouseDown}
      onClick={onClick}
      title={title || label}
      aria-label={title || label}
      className={`min-w-[40px] min-h-[40px] px-2.5 sm:px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white font-bold text-[14px] inline-flex items-center justify-center gap-2 shadow-sm hover:brightness-105 transition-all cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${className}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className={`${labelVisibility} leading-snug`}>{label}</span>
    </button>
  );
};

/**
 * Clean unboxed metadata line separated by middle dots (`·`) — zero-pill discipline.
 */
export const UnboxedMetaLine: React.FC<{
  items: Array<string | null | undefined | false>;
  className?: string;
}> = ({ items, className = '' }) => {
  const valid = items.filter((it): it is string => Boolean(it && it.trim()));
  if (valid.length === 0) return null;

  return (
    <div className={`text-[14px] font-medium text-slate-700 leading-snug break-words ${className}`}>
      {valid.map((item, idx) => (
        <React.Fragment key={`${item}_${idx}`}>
          {idx > 0 && <span className="mx-1.5 text-pink-500 font-bold">·</span>}
          <span>{item}</span>
        </React.Fragment>
      ))}
    </div>
  );
};

/**
 * Light translucent gradient modal wrapper without dark backdrop.
 */
export const GradientModalShell: React.FC<{
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
  zIndexClass?: string;
  children: React.ReactNode;
}> = ({
  open,
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  headerRight,
  footer,
  maxWidthClass = 'max-w-3xl',
  zIndexClass = 'z-[260]',
  children
}) => {
  const isVisible = Boolean(open ?? isOpen);
  if (!isVisible) return null;

  const modalNode = (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-2 sm:p-4 bg-gradient-to-br from-sky-200/45 via-pink-200/45 via-orange-200/45 via-pink-200/45 to-sky-200/45 backdrop-blur-md overflow-y-auto`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidthClass} max-h-[92vh] flex flex-col p-[2px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-2xl my-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col max-h-[calc(92vh-4px)] rounded-[22px] bg-gradient-to-br from-sky-100/88 via-pink-100/88 via-orange-100/88 via-pink-100/88 to-sky-100/88 backdrop-blur-xl overflow-hidden">
          {(title || headerRight) && (
            <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-pink-300/70 shrink-0">
              <div className="min-w-0 flex-1 flex items-start gap-2.5">
                {icon && (
                  <span className="p-2 rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white shrink-0 shadow-xs">
                    {icon}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  {typeof title === 'string' ? (
                    <h3 className="text-[16px] sm:text-[18px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent break-words">
                      {title}
                    </h3>
                  ) : (
                    title
                  )}
                  {subtitle && (
                    <p className="text-[14px] text-slate-700 font-medium mt-0.5 break-words">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {headerRight}
                <button
                  type="button"
                  onClick={onClose}
                  title="Закрыть окно"
                  aria-label="Закрыть окно"
                  className="min-w-[40px] min-h-[40px] rounded-xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white flex items-center justify-center shadow-sm hover:brightness-105 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 min-w-0">
            {children}
          </div>

          {footer && (
            <div className="px-4 sm:px-6 py-3 border-t border-pink-300/70 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalNode, document.body);
  }
  return modalNode;
};
