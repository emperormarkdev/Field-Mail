import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Circle, MoveUpRight, Pencil, RotateCcw, Stamp, Trash2 } from 'lucide-react';
import type { StoredPhoto } from '../types';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';
import { blobUrl, photoBlobsFromCanvas } from '../lib/photos';
import { cn } from '../lib/cn';

type Tool = 'arrow' | 'circle' | 'pen';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  tool: Tool;
  color: string;
  points: Point[];
  stamp?: string;
}

const COLORS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#ffffff', label: 'White' },
];

export function PhotoMarkupSheet({
  photo,
  siteName,
  stampLabel,
  lowSignal,
  onClose,
  onSave,
}: {
  photo: StoredPhoto | null;
  siteName?: string;
  stampLabel: string;
  lowSignal?: boolean;
  onClose: () => void;
  onSave: (photoId: string, updated: { blob: Blob; thumb: Blob; width: number; height: number }) => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>('arrow');
  const [color, setColor] = useState<string>('#ef4444');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!photo) return;
    setStrokes([]);
    setActiveStroke(null);

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      redraw(img, [], null);
    };
    img.src = blobUrl(photo.blob);
  }, [photo]);

  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;
    redraw(img, strokes, activeStroke);
  }, [strokes, activeStroke]);

  const redraw = (img: HTMLImageElement, committed: Stroke[], current: Stroke | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = img.naturalWidth || photo?.width || 800;
    const h = img.naturalHeight || photo?.height || 600;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const all = current ? [...committed, current] : committed;
    const lineW = Math.max(4, Math.round(Math.min(w, h) * 0.008));

    for (const s of all) {
      if (s.stamp) {
        const fontSize = Math.max(14, Math.round(Math.min(w, h) * 0.028));
        ctx.save();
        ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        const padX = Math.round(fontSize * 0.65);
        const padY = Math.round(fontSize * 0.45);
        const margin = Math.round(fontSize * 0.6);
        const metrics = ctx.measureText(s.stamp);
        const boxW = Math.min(w - margin * 2, Math.ceil(metrics.width + padX * 2));
        const boxH = Math.ceil(fontSize + padY * 2);
        const boxX = w - boxW - margin;
        const boxY = h - boxH - margin;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, Math.round(fontSize * 0.35));
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.stamp, boxX + padX, boxY + boxH / 2, boxW - padX * 2);
        ctx.restore();
        continue;
      }

      if (s.points.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = lineW;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (s.tool === 'pen') {
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }
        ctx.stroke();
      } else if (s.tool === 'arrow') {
        const start = s.points[0];
        const end = s.points[s.points.length - 1];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.hypot(dx, dy);
        if (len > 4) {
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();

          const angle = Math.atan2(dy, dx);
          const head = Math.max(16, lineW * 3.8);
          ctx.beginPath();
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(
            end.x - head * Math.cos(angle - Math.PI / 6),
            end.y - head * Math.sin(angle - Math.PI / 6),
          );
          ctx.lineTo(
            end.x - head * Math.cos(angle + Math.PI / 6),
            end.y - head * Math.sin(angle + Math.PI / 6),
          );
          ctx.closePath();
          ctx.fill();
        }
      } else if (s.tool === 'circle') {
        const start = s.points[0];
        const end = s.points[s.points.length - 1];
        const cx = (start.x + end.x) / 2;
        const cy = (start.y + end.y) / 2;
        const rx = Math.max(4, Math.abs(end.x - start.x) / 2);
        const ry = Math.max(4, Math.abs(end.y - start.y) / 2);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  const toCanvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const pt = toCanvasPoint(event);
    setActiveStroke({ tool, color, points: [pt] });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!activeStroke) return;
    const pt = toCanvasPoint(event);
    if (activeStroke.tool === 'pen') {
      setActiveStroke({ ...activeStroke, points: [...activeStroke.points, pt] });
    } else {
      setActiveStroke({ ...activeStroke, points: [activeStroke.points[0], pt] });
    }
  };

  const onPointerUp = () => {
    if (!activeStroke) return;
    if (activeStroke.points.length >= 2) {
      setStrokes((prev) => [...prev, activeStroke]);
    }
    setActiveStroke(null);
  };

  const addDateStamp = () => {
    const text = [siteName?.trim(), stampLabel].filter(Boolean).join(' · ');
    setStrokes((prev) => [...prev.filter((s) => !s.stamp), { tool: 'arrow', color, points: [], stamp: text }]);
  };

  const handleSave = async () => {
    if (!photo || !canvasRef.current) return;
    setSaving(true);
    try {
      const updated = await photoBlobsFromCanvas(canvasRef.current, lowSignal);
      await onSave(photo.id, updated);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={photo !== null}
      onClose={onClose}
      title="Mark up photo"
      size="lg"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth
            loading={saving}
            onClick={() => void handleSave()}
          >
            Save changes to photo
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Markup tool">
            {(
              [
                { id: 'arrow', label: 'Arrow', icon: MoveUpRight },
                { id: 'circle', label: 'Circle', icon: Circle },
                { id: 'pen', label: 'Draw', icon: Pencil },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTool(id)}
                aria-pressed={tool === id}
                className={cn(
                  'press inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-field border px-3 text-body-2-semibold',
                  tool === id
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-line-strong bg-surface text-ink hover:bg-raised',
                )}
              >
                <Icon aria-hidden className="size-3.5" />
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={addDateStamp}
              className="press inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-field border border-line-strong bg-surface px-3 text-body-2-semibold text-ink hover:bg-raised"
            >
              <Stamp aria-hidden className="size-3.5" />
              Stamp date & site
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                aria-label={`${c.label} markup color`}
                aria-pressed={color === c.value}
                className={cn(
                  'size-7 cursor-pointer rounded-full border-2 transition-transform',
                  color === c.value ? 'scale-110 border-ink ring-2 ring-accent/40' : 'border-line-strong',
                )}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>

        <div className="relative flex max-h-[58dvh] items-center justify-center overflow-hidden rounded-card border border-line bg-neutral-900">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="max-h-[58dvh] w-auto max-w-full cursor-crosshair touch-none object-contain"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-caption-1-regular text-muted">
            Drag on the photo to draw an arrow, circle an area, or highlight details.
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={strokes.length === 0}
              onClick={() => setStrokes((prev) => prev.slice(0, -1))}
              className="press inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-field border border-line-strong bg-surface px-2.5 text-caption-1-semibold text-ink hover:bg-raised disabled:opacity-40"
            >
              <RotateCcw aria-hidden className="size-3.5" />
              Undo
            </button>
            <button
              type="button"
              disabled={strokes.length === 0}
              onClick={() => setStrokes([])}
              className="press inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-field border border-line-strong bg-surface px-2.5 text-caption-1-semibold text-danger hover:bg-raised disabled:opacity-40"
            >
              <Trash2 aria-hidden className="size-3.5" />
              Clear
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

