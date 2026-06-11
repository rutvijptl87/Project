import React, { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';

/**
 * Simple touch + mouse drawable signature pad.
 *
 * Props:
 *  - value: existing data-URL (used to restore an already-saved signature)
 *  - onChange: called with the new data-URL whenever the user lifts the pen
 *  - label: shown above the pad
 *  - testId: data-testid prefix for the canvas and clear button
 */
const SignaturePad = ({ value, onChange, label = 'Signature', testId = 'sign' }) => {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const [empty, setEmpty] = useState(!value);

  // Restore signature whenever the `value` prop arrives or changes
  // (covers async pre-fill from default_signature, edit-mode load, etc.)
  useEffect(() => {
    if (!value) { setEmpty(true); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setEmpty(false);
    };
    img.src = value;
  }, [value]);

  const point = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const t = e.touches?.[0];
    const x = (t ? t.clientX : e.clientX) - rect.left;
    const y = (t ? t.clientY : e.clientY) - rect.top;
    return {
      x: (x / rect.width) * canvasRef.current.width,
      y: (y / rect.height) * canvasRef.current.height,
    };
  };

  const begin = (e) => {
    e.preventDefault();
    drawing.current = true;
    last.current = point(e);
    setEmpty(false);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = point(e);
    ctx.strokeStyle = '#0A2E1F';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (onChange) onChange(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const c = canvasRef.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    if (onChange) onChange('');
  };

  return (
    <div className="space-y-1.5" data-testid={`${testId}-wrap`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium" style={{ color: 'var(--cc-text-muted)' }}>{label}</label>
        <button
          type="button"
          onClick={clear}
          className="text-xs flex items-center gap-1 hover:underline"
          style={{ color: empty ? 'var(--cc-text-muted)' : '#B91C1C' }}
          data-testid={`${testId}-clear`}
        >
          <Eraser size={12} /> Clear
        </button>
      </div>
      <div
        className="rounded-lg overflow-hidden"
        style={{ background: '#FFFFFF', border: '1px dashed var(--cc-border)' }}
      >
        <canvas
          ref={canvasRef}
          width={600}
          height={180}
          className="block w-full touch-none"
          style={{ height: '110px', cursor: 'crosshair' }}
          onMouseDown={begin}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={begin}
          onTouchMove={move}
          onTouchEnd={end}
          data-testid={`${testId}-canvas`}
        />
      </div>
    </div>
  );
};

export default SignaturePad;
