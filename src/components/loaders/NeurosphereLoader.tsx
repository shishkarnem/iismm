import React, { useId } from 'react';
import { motion } from 'motion/react';
import { BRAND_ASSETS } from '../../constants/proTalkStorage';

export interface NeurosphereLoaderProps {
  /** 'viewport' centers at 25vmin in the middle of the screen; 'inline' centers inside parent container */
  variant?: 'viewport' | 'inline' | 'embed';
  /** Optional subtle text caption (>= 14px, unboxed, no pill/button look) */
  label?: string;
  className?: string;
}

/**
 * Animated SVG Neurosphere (matching AI Consultant sphere aesthetic)
 * with the compressed heart emblem centered inside (~25% of current viewport).
 * Strictly light translucent sky-pink-orange palette (no green, no dark backdrop).
 */
export const NeurosphereLoader: React.FC<NeurosphereLoaderProps> = ({
  variant = 'viewport',
  label,
  className = ''
}) => {
  const uid = useId().replace(/:/g, '');
  const gradPrimary = `ns-loader-primary-${uid}`;
  const gradSecondary = `ns-loader-secondary-${uid}`;
  const coreGlow = `ns-loader-glow-${uid}`;
  const blurFilter = `ns-loader-blur-${uid}`;

  const sphereSvg = (
    <div
      className="relative flex items-center justify-center select-none pointer-events-none"
      style={
        variant === 'embed'
          ? { width: '100%', height: '100%' }
          : {
              width: '25vmin',
              height: '25vmin',
              minWidth: '136px',
              minHeight: '136px',
              maxWidth: '280px',
              maxHeight: '280px'
            }
      }
    >
      {/* Translucent pastel aura ring (no dimming, zero dark colors) */}
      <motion.div
        aria-hidden="true"
        animate={{ scale: [0.95, 1.07, 0.95], opacity: [0.45, 0.72, 0.45] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-[8%] rounded-full bg-gradient-to-tr from-sky-300/35 via-pink-300/40 to-orange-300/35 blur-2xl"
      />

      {/* Orbital wireframe SVG neurosphere */}
      <svg
        viewBox="0 0 240 240"
        className="relative z-10 w-full h-full overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradPrimary} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="35%" stopColor="#ec4899" />
            <stop offset="68%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          <linearGradient id={gradSecondary} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="40%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          <radialGradient id={coreGlow} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#fce7f3" stopOpacity="0.55" />
            <stop offset="78%" stopColor="#e0f2fe" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ffedd5" stopOpacity="0" />
          </radialGradient>

          <filter id={blurFilter} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Soft luminous center backdrop behind the heart */}
        <circle cx="120" cy="120" r="64" fill={`url(#${coreGlow})`} />

        {/* Outer rotating dashed halo ring */}
        <g>
          <circle
            cx="120"
            cy="120"
            r="102"
            stroke={`url(#${gradPrimary})`}
            strokeWidth="1.6"
            strokeDasharray="6 8"
            opacity="0.6"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 120 120"
              to="360 120 120"
              dur="18s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Inner rotating meridian sphere ring */}
        <g>
          <circle
            cx="120"
            cy="120"
            r="84"
            stroke={`url(#${gradSecondary})`}
            strokeWidth="1.4"
            strokeDasharray="3 6"
            opacity="0.55"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="360 120 120"
              to="0 120 120"
              dur="14s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Orbit 1: Tilted 24 deg */}
        <g transform="rotate(24 120 120)">
          <ellipse
            cx="120"
            cy="120"
            rx="100"
            ry="34"
            stroke={`url(#${gradPrimary})`}
            strokeWidth="2.4"
            strokeDasharray="8 5"
            opacity="0.88"
          />
          <circle cx="220" cy="120" r="4.8" fill="#ec4899" filter={`url(#${blurFilter})`}>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 120 120"
              to="360 120 120"
              dur="3.4s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="20" cy="120" r="3.6" fill="#38bdf8">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="180 120 120"
              to="540 120 120"
              dur="3.4s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Orbit 2: Tilted -36 deg */}
        <g transform="rotate(-36 120 120)">
          <ellipse
            cx="120"
            cy="120"
            rx="98"
            ry="38"
            stroke={`url(#${gradSecondary})`}
            strokeWidth="2.2"
            strokeDasharray="10 6"
            opacity="0.85"
          />
          <circle cx="218" cy="120" r="4.6" fill="#f97316" filter={`url(#${blurFilter})`}>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 120 120"
              to="-360 120 120"
              dur="4.2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="22" cy="120" r="3.4" fill="#ec4899">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 120 120"
              to="-360 120 120"
              dur="4.2s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Orbit 3: Vertical-ish tilted 78 deg */}
        <g transform="rotate(78 120 120)">
          <ellipse
            cx="120"
            cy="120"
            rx="96"
            ry="30"
            stroke={`url(#${gradPrimary})`}
            strokeWidth="2"
            strokeDasharray="5 5"
            opacity="0.78"
          />
          <circle cx="216" cy="120" r="4.2" fill="#38bdf8" filter={`url(#${blurFilter})`}>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 120 120"
              to="360 120 120"
              dur="4.8s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Synaptic constellation nodes & subtle connecting links */}
        <g opacity="0.85">
          <line x1="120" y1="120" x2="62" y2="68" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.55" />
          <line x1="120" y1="120" x2="180" y2="70" stroke="#ec4899" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.55" />
          <line x1="120" y1="120" x2="64" y2="174" stroke="#f97316" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.55" />
          <line x1="120" y1="120" x2="176" y2="172" stroke="#ec4899" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.55" />

          <circle cx="62" cy="68" r="3.8" fill="#38bdf8" filter={`url(#${blurFilter})`} />
          <circle cx="180" cy="70" r="4" fill="#ec4899" filter={`url(#${blurFilter})`} />
          <circle cx="64" cy="174" r="3.8" fill="#f97316" filter={`url(#${blurFilter})`} />
          <circle cx="176" cy="172" r="4" fill="#ec4899" filter={`url(#${blurFilter})`} />
        </g>
      </svg>

      {/* Compressed Heart Emblem centered cleanly inside the neurosphere */}
      <motion.div
        animate={{ scale: [1, 1.07, 1, 1.04, 1] }}
        transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute z-20 flex items-center justify-center w-[42%] h-[42%] rounded-full"
      >
        <div
          className="absolute inset-0 rounded-full blur-md opacity-70"
          style={{
            background:
              'radial-gradient(circle, rgba(255,255,255,0.92) 0%, rgba(252,231,243,0.65) 55%, rgba(224,242,254,0) 100%)'
          }}
        />
        <img
          src={BRAND_ASSETS.heartCompact}
          alt="ИИSMM"
          width={160}
          height={160}
          loading="eager"
          decoding="async"
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.dataset.fallbackApplied) {
              img.dataset.fallbackApplied = '1';
              img.src = '/pwa/heart-loader.png';
            }
          }}
          className="relative z-10 w-full h-full object-contain drop-shadow-[0_4px_12px_rgba(236,72,153,0.35)]"
        />
      </motion.div>
    </div>
  );

  if (variant === 'embed') {
    return sphereSvg;
  }

  if (variant === 'inline') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`w-full min-h-[260px] py-8 flex flex-col items-center justify-center text-center select-none ${className}`}
      >
        {sphereSvg}
        {label ? (
          <p className="mt-3 text-[14px] font-semibold text-slate-700 leading-snug">{label}</p>
        ) : null}
      </div>
    );
  }

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label={label || 'Загрузка'}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed inset-0 z-[70] flex flex-col items-center justify-center pointer-events-none select-none px-4 ${className}`}
    >
      {sphereSvg}
      {label ? (
        <p className="mt-3 text-[14px] font-semibold text-slate-700 bg-gradient-to-r from-sky-50/75 via-pink-50/75 to-orange-50/75 backdrop-blur-sm px-3.5 py-1 rounded-2xl">
          {label}
        </p>
      ) : null}
    </motion.div>
  );
};

export default NeurosphereLoader;
