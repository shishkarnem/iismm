import React from 'react';

interface NeuralSphereProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

export const NeuralSphere: React.FC<NeuralSphereProps> = ({
  size = 64,
  className = '',
  glow = true
}) => {
  return (
    <div 
      className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ns-grad-cyan-pink" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>

          <linearGradient id="ns-grad-orange-pink" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          <radialGradient id="ns-core-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </radialGradient>

          <filter id="ns-glow-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient Center Glow */}
        {glow && (
          <circle cx="100" cy="100" r="46" fill="url(#ns-core-glow)" className="animate-pulse" />
        )}

        {/* Central Quantum Neural Core */}
        <circle
          cx="100"
          cy="100"
          r="16"
          fill="url(#ns-grad-cyan-pink)"
          filter={glow ? 'url(#ns-glow-filter)' : undefined}
        >
          <animate
            attributeName="r"
            values="15;18;15"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="100" cy="100" r="7" fill="#ffffff" opacity="0.95" />

        {/* Orbit 1: Tilted 25 deg */}
        <g transform="rotate(25 100 100)">
          <ellipse
            cx="100"
            cy="100"
            rx="78"
            ry="28"
            fill="none"
            stroke="url(#ns-grad-cyan-pink)"
            strokeWidth="2"
            strokeDasharray="6 4"
            opacity="0.85"
          />
          {/* Orbiting data particle 1 */}
          <circle cx="178" cy="100" r="4" fill="#ec4899" filter={glow ? 'url(#ns-glow-filter)' : undefined}>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 100 100"
              to="360 100 100"
              dur="3.2s"
              repeatCount="indefinite"
            />
          </circle>
          {/* Orbiting data particle 2 */}
          <circle cx="22" cy="100" r="3" fill="#38bdf8">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="180 100 100"
              to="540 100 100"
              dur="3.2s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Orbit 2: Tilted -35 deg */}
        <g transform="rotate(-35 100 100)">
          <ellipse
            cx="100"
            cy="100"
            rx="76"
            ry="30"
            fill="none"
            stroke="url(#ns-grad-orange-pink)"
            strokeWidth="2"
            strokeDasharray="8 5"
            opacity="0.85"
          />
          {/* Orbiting data particle 3 */}
          <circle cx="176" cy="100" r="4.2" fill="#f97316" filter={glow ? 'url(#ns-glow-filter)' : undefined}>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 100 100"
              to="-360 100 100"
              dur="4s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="24" cy="100" r="2.8" fill="#ec4899">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 100 100"
              to="-360 100 100"
              dur="4s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Orbit 3: Vertical-ish Tilted 75 deg */}
        <g transform="rotate(75 100 100)">
          <ellipse
            cx="100"
            cy="100"
            rx="74"
            ry="24"
            fill="none"
            stroke="url(#ns-grad-cyan-pink)"
            strokeWidth="1.8"
            strokeDasharray="4 4"
            opacity="0.75"
          />
          <circle cx="174" cy="100" r="3.5" fill="#38bdf8">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 100 100"
              to="360 100 100"
              dur="5s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      </svg>
    </div>
  );
};

export default NeuralSphere;
