import React, { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';

/**
 * Format numeric string / number with Vietnamese dot thousand separators: 3000000 -> "3.000.000"
 */
export function formatDotNumber(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === '') return '';
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function stripNonDigits(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

/**
 * Currency input that always displays dot-separated thousands (e.g. 3.000.000)
 * while emitting clean numeric string (e.g. "3000000") via onChange.
 */
export const CurrencyInput: React.FC<{
  value: string;
  onChange: (rawDigits: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}> = ({ value, onChange, placeholder = 'Nhập số tiền', className = 'input-field font-mono', disabled }) => {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={formatDotNumber(value)}
        onChange={(e) => onChange(stripNonDigits(e.target.value))}
        placeholder={placeholder}
        className={`${className} pr-12 tabular-nums`}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-ink-muted">
        VNĐ
      </span>
    </div>
  );
};

function isoToVn(iso?: string | null): string {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function vnToIso(vn: string): string | null {
  const m = vn.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > 2100) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/**
 * Vietnamese dd/mm/yyyy Date input with native calendar picker button.
 * Value & onChange use standard ISO "YYYY-MM-DD" (or "").
 */
export const DateInputVN: React.FC<{
  value: string;
  onChange: (isoValue: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}> = ({ value, onChange, placeholder = 'dd/mm/yyyy', className = 'input-field font-mono', disabled }) => {
  const [text, setText] = useState(() => isoToVn(value));
  const nativeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(isoToVn(value));
  }, [value]);

  const handleTextChange = (raw: string) => {
    // Auto-format digits while typing, allow slashes
    const cleaned = raw.replace(/[^\d/]/g, '').slice(0, 10);
    setText(cleaned);
    if (!cleaned) {
      onChange('');
      return;
    }
    const iso = vnToIso(cleaned);
    if (iso) onChange(iso);
  };

  const handleBlur = () => {
    if (!text.trim()) {
      onChange('');
      return;
    }
    const iso = vnToIso(text);
    if (iso) {
      setText(isoToVn(iso));
      onChange(iso);
    } else {
      // Revert to last valid value
      setText(isoToVn(value));
    }
  };

  const openPicker = () => {
    if (disabled || !nativeRef.current) return;
    if (typeof (nativeRef.current as any).showPicker === 'function') {
      (nativeRef.current as any).showPicker();
    } else {
      nativeRef.current.focus();
      nativeRef.current.click();
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`${className} pr-9 tabular-nums`}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        tabIndex={-1}
        title="Chọn ngày từ lịch"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-brand disabled:opacity-40"
      >
        <Calendar className="w-4 h-4" />
      </button>
      <input
        ref={nativeRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value || ''}
        onChange={(e) => {
          const iso = e.target.value;
          setText(isoToVn(iso));
          onChange(iso);
        }}
        className="sr-only"
      />
    </div>
  );
};
