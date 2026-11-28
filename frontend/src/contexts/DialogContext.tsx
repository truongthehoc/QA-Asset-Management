import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, Trash2, X } from 'lucide-react';

type DialogTone = 'primary' | 'warning' | 'danger';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
}

export interface PromptOptions extends ConfirmOptions {
  defaultValue?: string;
  placeholder?: string;
  inputLabel?: string;
  multiline?: boolean;
  required?: boolean;
}

interface DialogState {
  kind: 'confirm' | 'prompt';
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: DialogTone;
  defaultValue: string;
  placeholder: string;
  inputLabel: string;
  multiline: boolean;
  required: boolean;
  resolve: (value: any) => void;
}

interface DialogContextValue {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [validationErr, setValidationErr] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setValidationErr('');
      setDialog({
        kind: 'confirm',
        title: opts.title || 'Xác nhận thao tác',
        message: opts.message,
        confirmLabel: opts.confirmLabel || 'Xác nhận',
        cancelLabel: opts.cancelLabel || 'Hủy',
        tone: opts.tone || 'danger',
        defaultValue: '',
        placeholder: '',
        inputLabel: '',
        multiline: false,
        required: false,
        resolve,
      });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setValidationErr('');
      setInputValue(options.defaultValue ?? '');
      setDialog({
        kind: 'prompt',
        title: options.title || 'Nhập thông tin xác nhận',
        message: options.message,
        confirmLabel: options.confirmLabel || 'Xác nhận',
        cancelLabel: options.cancelLabel || 'Hủy',
        tone: options.tone || 'primary',
        defaultValue: options.defaultValue ?? '',
        placeholder: options.placeholder || 'Nhập nội dung...',
        inputLabel: options.inputLabel || 'Ghi chú / Lý do',
        multiline: Boolean(options.multiline),
        required: Boolean(options.required),
        resolve,
      });
    });
  }, []);

  const closeCancel = useCallback(() => {
    if (!dialog) return;
    const { kind, resolve } = dialog;
    setDialog(null);
    resolve(kind === 'confirm' ? false : null);
  }, [dialog]);

  const handleConfirm = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!dialog) return;
      if (dialog.kind === 'prompt') {
        if (dialog.required && !inputValue.trim()) {
          setValidationErr('Vui lòng nhập nội dung trước khi xác nhận.');
          return;
        }
        const { resolve } = dialog;
        setDialog(null);
        resolve(inputValue);
      } else {
        const { resolve } = dialog;
        setDialog(null);
        resolve(true);
      }
    },
    [dialog, inputValue],
  );

  useEffect(() => {
    if (!dialog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    if (dialog.kind === 'prompt') {
      window.setTimeout(() => {
        inputRef.current?.focus();
        if (inputRef.current && 'select' in inputRef.current) {
          inputRef.current.select();
        }
      }, 30);
    }
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dialog, closeCancel]);

  const toneConfig = dialog
    ? {
        danger: {
          iconBg: 'bg-rose-100 text-rose-600',
          Icon: Trash2,
          btnCls: 'btn-danger',
        },
        warning: {
          iconBg: 'bg-amber-100 text-amber-600',
          Icon: AlertTriangle,
          btnCls: 'bg-amber-600 hover:bg-amber-700 text-white inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors',
        },
        primary: {
          iconBg: 'bg-sky-100 text-brand',
          Icon: dialog.kind === 'prompt' ? HelpCircle : CheckCircle2,
          btnCls: 'btn-primary',
        },
      }[dialog.tone]
    : null;

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}

      {dialog && toneConfig && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-0 sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeCancel();
          }}
        >
          <form
            onSubmit={handleConfirm}
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-line shadow-2xl overflow-hidden animate-fade-in"
          >
            <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 flex items-start gap-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${toneConfig.iconBg}`}>
                <toneConfig.Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-bold text-ink-primary leading-snug">{dialog.title}</h3>
                <p className="text-xs sm:text-sm text-ink-secondary mt-1.5 leading-relaxed whitespace-pre-wrap break-words">
                  {dialog.message}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCancel}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md shrink-0"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {dialog.kind === 'prompt' && (
              <div className="px-4 sm:px-5 pb-4 pt-1">
                {dialog.inputLabel && <label className="label-field">{dialog.inputLabel}</label>}
                {dialog.multiline ? (
                  <textarea
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    rows={3}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      if (validationErr) setValidationErr('');
                    }}
                    placeholder={dialog.placeholder}
                    className="input-field text-sm"
                  />
                ) : (
                  <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      if (validationErr) setValidationErr('');
                    }}
                    placeholder={dialog.placeholder}
                    className="input-field text-sm"
                  />
                )}
                {validationErr && <p className="text-xs text-red-600 mt-1.5">{validationErr}</p>}
              </div>
            )}

            <div className="px-4 sm:px-5 py-3 bg-slate-50/80 border-t border-line flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button type="button" onClick={closeCancel} className="btn-secondary w-full sm:w-auto justify-center">
                {dialog.cancelLabel}
              </button>
              <button type="submit" className={`${toneConfig.btnCls} w-full sm:w-auto justify-center`}>
                {dialog.confirmLabel}
              </button>
            </div>
          </form>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside DialogProvider');
  return ctx;
}
