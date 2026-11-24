import React, { useEffect, useRef } from 'react';
import { NeuralSphere } from '../NeuralSphere';

interface ConsultantSphereButtonProps {
  onClick: () => void;
  hasBottomNavbar?: boolean;
  isLoading?: boolean;
}

export const ConsultantSphereButton: React.FC<ConsultantSphereButtonProps> = ({
  onClick,
  hasBottomNavbar = false,
  isLoading = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let rafId = 0;
    const pointsCount = 28;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const basePoints = Array.from({ length: pointsCount }, (_, i) => {
      const y = 1 - (i / (pointsCount - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * i;
      return {
        x: Math.cos(theta) * r,
        y,
        z: Math.sin(theta) * r,
        colorIdx: i % 3
      };
    });

    const palette = ['#38bdf8', '#ec4899', '#f97316'];

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const t = Date.now() * (isLoading ? 0.0032 : 0.0016);
      const radius = 25 + Math.sin(t * 2.2) * 1.8;

      ctx.clearRect(0, 0, w, h);

      const cosY = Math.cos(t);
      const sinY = Math.sin(t);
      const cosX = Math.cos(Math.sin(t * 0.7) * 0.45);
      const sinX = Math.sin(Math.sin(t * 0.7) * 0.45);

      const projected = basePoints.map((pt) => {
        const rx = pt.x * cosY - pt.z * sinY;
        const rz1 = pt.x * sinY + pt.z * cosY;
        const ry = pt.y * cosX - rz1 * sinX;
        const rz = pt.y * sinX + rz1 * cosX;
        const scale = 120 / (120 + rz * radius * 0.5);
        return {
          px: cx + rx * radius * scale,
          py: cy + ry * radius * scale,
          z: rz,
          alpha: Math.max(0.3, Math.min(0.95, 0.58 + rz * 0.38)),
          color: palette[pt.colorIdx]
        };
      });

      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].px - projected[j].px;
          const dy = projected[i].py - projected[j].py;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 20) {
            const alpha = (1 - dist / 20) * 0.34;
            ctx.beginPath();
            ctx.moveTo(projected[i].px, projected[i].py);
            ctx.lineTo(projected[j].px, projected[j].py);
            ctx.strokeStyle = `rgba(236, 72, 153, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      projected
        .slice()
        .sort((a, b) => a.z - b.z)
        .forEach((node) => {
          ctx.beginPath();
          ctx.arc(node.px, node.py, node.z > 0 ? 2.3 : 1.6, 0, Math.PI * 2);
          ctx.fillStyle = node.color;
          ctx.globalAlpha = node.alpha;
          ctx.fill();
        });
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [isLoading]);

  // Mobile: left side strictly above BottomNavbar when present; Desktop: bottom-left corner
  const mobileBottomClass = hasBottomNavbar ? 'bottom-[74px]' : 'bottom-4';

  return (
    <button
      type="button"
      onClick={onClick}
      title="Открыть консультанта"
      aria-label="Открыть консультанта"
      className={`fixed ${mobileBottomClass} left-3 md:bottom-5 md:left-5 z-[65] group flex items-center justify-center cursor-pointer select-none bg-transparent border-0 p-0 focus:outline-none transition-transform duration-200 hover:scale-105 active:scale-95`}
    >
      <div className="relative w-[62px] h-[62px] md:w-[68px] md:h-[68px] flex items-center justify-center rounded-full">
        {/* Soft glowing sky-pink-orange aura */}
        <span className="absolute inset-1 rounded-full bg-gradient-to-tr from-sky-400/35 via-pink-500/35 to-orange-400/35 blur-md group-hover:blur-lg transition-all" />

        {/* 3D Neural Gallery Mesh Sphere */}
        <canvas
          ref={canvasRef}
          width={72}
          height={72}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Core Orbital NeuralSphere */}
        <NeuralSphere size={58} glow={true} className="relative z-10" />
      </div>
    </button>
  );
};
