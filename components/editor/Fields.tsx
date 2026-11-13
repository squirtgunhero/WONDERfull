'use client';
import { useEffect, useRef, useState } from 'react';
import type { FieldDef } from '../../lib/editor/defs';
import { getP, setP } from '../../lib/editor/path';

// A number box that lets you type freely (a lone "-" or "1." is fine) and reports valid numbers.
function NumberInput({ id, value, step, label, onValue }: { id: string; value: number; step?: number; label: string; onValue: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(String(value)); }, [value]);
  return (
    <input type="number" id={id} step={step} aria-label={label} value={text}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setText(String(value)); }}
      onChange={(e) => { setText(e.target.value); const v = parseFloat(e.target.value); if (!isNaN(v)) onValue(v); }} />
  );
}

// Inline style that tells the slider's track how far to fill.
export function fill(value: number, min = 0, max = 1) {
  const pct = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
  return { ['--p' as string]: pct + '%' } as React.CSSProperties;
}

// Renders a list of field definitions as labeled controls bound to `target`.
// Edits are written straight into `target`, then onChange is called.
export function Fields({ prefix, target, defs, onChange }: { prefix: string; target: any; defs: FieldDef[]; onChange: () => void }) {
  return (
    <>
      {defs.map((d, i) => {
        if (d.show && !d.show(target)) return null;
        if (d.h) return <h2 key={'h' + i}>{d.h}</h2>;
        if (d.note) return <p className="note" key={'n' + i}>{d.note}</p>;
        const k = d.k as string;
        const id = 'f-' + prefix + '-' + k.replace(/\./g, '-');
        const set = (v: any) => { setP(target, k, v); onChange(); };
        const raw = getP(target, k);

        if (d.type === 'check') {
          return (
            <div className="check" key={id}>
              <input type="checkbox" id={id} checked={!!raw} onChange={(e) => set(e.target.checked)} />
              <label htmlFor={id}>{d.label}</label>
            </div>
          );
        }
        if (d.type === 'vec3') {
          return (
            <div className="row wide" key={id}>
              <span className="lab">{d.label}</span>
              <div className="vec">
                {['x', 'y', 'z'].map((axis, n) => (
                  <NumberInput key={axis} id={id + '-' + axis} step={d.step} label={d.label + ' ' + axis} value={raw[n]}
                    onValue={(v) => { getP(target, k)[n] = v; onChange(); }} />
                ))}
              </div>
            </div>
          );
        }
        if (d.type === 'range' || d.type === 'uscale') {
          const current = d.type === 'uscale' ? raw[0] : raw;
          const value = Number(current == null ? d.def || 0 : current);
          return (
            <div className="row" key={id}>
              <label htmlFor={id}>{d.label}</label>
              <input type="range" id={id} min={d.min} max={d.max} step={d.step} value={value} style={fill(value, d.min, d.max)}
                onChange={(e) => { const v = Number(e.target.value); set(d.type === 'uscale' ? [v, v, v] : v); }} />
              <output htmlFor={id}>{d.int ? String(Math.round(value)) : value.toFixed(2)}</output>
            </div>
          );
        }
        if (d.type === 'select') {
          return (
            <div className="row wide" key={id}>
              <label htmlFor={id}>{d.label}</label>
              <select id={id} value={raw == null ? '' : raw} onChange={(e) => set(e.target.value)}>
                {(d.options || []).map((op) => <option key={op[0]} value={op[0]}>{op[1]}</option>)}
              </select>
            </div>
          );
        }
        return (
          <div className="row wide" key={id}>
            <label htmlFor={id}>{d.label}</label>
            <input type={d.type} id={id} value={raw == null ? '' : raw} maxLength={d.type === 'text' ? d.max : undefined} placeholder={d.ph}
              onChange={(e) => set(e.target.value)} />
          </div>
        );
      })}
    </>
  );
}
