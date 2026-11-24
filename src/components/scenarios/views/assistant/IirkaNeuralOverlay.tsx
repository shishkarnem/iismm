import React, { useEffect, useRef } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { NeurosphereLoader } from '../../../loaders/NeurosphereLoader';
import { IirkaStageProgress } from './useIirkaAssistant';

interface IirkaNeuralOverlayProps {
  isVisible: boolean;
  mode: 'create' | 'edit';
  stageProgress: IirkaStageProgress;
}

const OVERLAY_STAGES = [
  { index: 1, label: 'Анализ задачи и подключенных каналов' },
  { index: 2, label: 'Подбор формата и архитектуры цепочки' },
  { index: 3, label: 'Настройка промптов, расписания и блоков' },
  { index: 4, label: 'Проверка связей графа и расчет стоимости' }
];

export const IirkaNeuralOverlay: React.FC<IirkaNeuralOverlayProps> = ({
  isVisible,
  mode,
  stageProgress
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pctRef = useRef<number>(stageProgress.percent);
  pctRef.current = stageProgress.percent;

  useEffect(() => {
    if (!isVisible) return;
    let rafId = 0;

    // Precompute Fibonacci sphere vertices
    const pointsCount = 46;
    const basePoints: Array<{ x: number; y: number; z: number; colorIdx: number }> = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < pointsCount; i++) {
      const y = 1 - (i / (pointsCount - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * i;
      basePoints.push({
        x: Math.cos(theta) * r,
        y,
        z: Math.sin(theta) * r,
        colorIdx: i % 3
      });
    }

    const palette = ['#0ea5e9', '#ec4899', '#f97316'];

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const t = Date.now() * 0.0018;
      const energy = 0.25 + (pctRef.current / 100) * 0.55;
      const sphereRadius = 64 + Math.sin(t * 2.4) * (5 + energy * 4);

      ctx.clearRect(0, 0, w, h);

      // Soft outer halo rings (strictly sky / pink / orange, light & airy)
      const gradRing = ctx.createLinearGradient(cx - 90, cy - 90, cx + 90, cy + 90);
      gradRing.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      gradRing.addColorStop(0.5, 'rgba(236, 72, 153, 0.5)');
      gradRing.addColorStop(1, 'rgba(249, 115, 22, 0.45)');

      ctx.beginPath();
      ctx.arc(cx, cy, sphereRadius + 16 + Math.sin(t * 3) * 3, 0, Math.PI * 2);
      ctx.strokeStyle = gradRing;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([7, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Rotate 3D vertices
      const angleY = t * (0.85 + energy * 0.6);
      const angleX = Math.sin(t * 0.6) * 0.45;
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);

      const projected = basePoints.map((pt, idx) => {
        const wobble = 1 + 0.06 * Math.sin(t * 3 + idx * 0.7);
        const rx = (pt.x * cosY - pt.z * sinY) * wobble;
        const rz1 = (pt.x * sinY + pt.z * cosY) * wobble;
        const ry = pt.y * cosX - rz1 * sinX;
        const rz = pt.y * sinX + rz1 * cosX;

        const scale = 220 / (220 + rz * sphereRadius * 0.55);
        return {
          px: cx + rx * sphereRadius * scale,
          py: cy + ry * sphereRadius * scale,
          z: rz,
          alpha: Math.max(0.22, Math.min(0.95, 0.55 + rz * 0.4)),
          color: palette[pt.colorIdx]
        };
      });

      // Draw neural mesh connections
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].px - projected[j].px;
          const dy = projected[i].py - projected[j].py;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 42) {
            const lineAlpha = (1 - dist / 42) * 0.36;
            ctx.beginPath();
            ctx.moveTo(projected[i].px, projected[i].py);
            ctx.lineTo(projected[j].px, projected[j].py);
            ctx.strokeStyle = `rgba(236, 72, 153, ${lineAlpha.toFixed(3)})`;
            ctx.lineWidth = 1.1;
            ctx.stroke();
          }
        }
      }

      // Draw vertices back-to-front
      projected
        .slice()
        .sort((a, b) => a.z - b.z)
        .forEach((node) => {
          ctx.beginPath();
          ctx.arc(node.px, node.py, node.z > 0 ? 3.1 : 2.1, 0, Math.PI * 2);
          ctx.fillStyle = node.color;
          ctx.globalAlpha = node.alpha;
          ctx.fill();
        });
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [isVisible]);

  if (!isVisible) return null;

  const pct = Math.min(100, Math.max(5, Math.round(stageProgress.percent)));

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-6 bg-gradient-to-r from-sky-100/82 via-pink-100/82 via-orange-100/82 via-pink-100/82 to-sky-100/82 backdrop-blur-md rounded-[22px]">
      <div className="w-full max-w-xl p-[2px] rounded-3xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 shadow-xl">
        <div className="bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 backdrop-blur-md rounded-[22px] p-4 sm:p-6 space-y-4 text-center">
          {/* Interactive 3D Neural Sphere + Orbital Core */}
          <div className="relative mx-auto w-[184px] h-[184px] flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={200}
              height={200}
              className="w-[184px] h-[184px] pointer-events-none select-none"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-5">
              <NeurosphereLoader variant="embed" />
            </div>
          </div>

          <div className="space-y-1">
            <h4 className="text-[18px] sm:text-[20px] font-bold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 to-pink-600 bg-clip-text text-transparent">
              {mode === 'edit'
                ? 'Иирка обновляет цепочку сценария'
                : 'Иирка проектирует новый сценарий'}
            </h4>
            <p className="text-[14px] font-medium text-slate-800 break-words">
              {stageProgress.detail || stageProgress.stageTitle}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 text-left">
            <div className="flex items-center justify-between gap-2 text-[14px] font-bold">
              <span className="text-slate-800 truncate">{stageProgress.stageTitle}</span>
              <span className="text-pink-700 shrink-0">{pct}%</span>
            </div>
            <div className="w-full h-3 rounded-full bg-white/85 border border-pink-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Stage checklist (light semi-transparent gradient cards, zero green) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
            {OVERLAY_STAGES.map((st) => {
              const isCurrent = stageProgress.stageIndex === st.index;
              const isDone = stageProgress.stageIndex > st.index || pct >= 100;
              return (
                <div
                  key={st.index}
                  className={`rounded-2xl border px-3 py-2 flex items-center gap-2 text-[14px] transition-all ${
                    isCurrent
                      ? 'bg-gradient-to-r from-sky-100/90 via-pink-100/90 via-orange-100/90 via-pink-100/90 to-sky-100/90 border-pink-500 ring-2 ring-pink-300 font-bold text-slate-900'
                      : isDone
                      ? 'bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 border-sky-300 font-semibold text-slate-800'
                      : 'bg-gradient-to-r from-sky-50/65 via-pink-50/65 via-orange-50/65 via-pink-50/65 to-sky-50/65 border-pink-200/80 text-slate-600'
                  }`}
                >
                  {isCurrent ? (
                    <div className="w-5 h-5 shrink-0">
                      <NeurosphereLoader variant="embed" />
                    </div>
                  ) : isDone ? (
                    <CheckCircle2 size={15} className="text-sky-600 shrink-0" />
                  ) : (
                    <Clock size={15} className="text-pink-400 shrink-0" />
                  )}
                  <span className="leading-snug break-words">{st.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
