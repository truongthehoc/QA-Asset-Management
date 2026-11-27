import React from 'react';
import { X } from 'lucide-react';
import { ASSET_STATUS_META, SEVERITY_META, ALERT_STATUS_META, INVENTORY_STATUS_META } from '../utils/format';
import { useAssetStatuses } from '../contexts/AssetStatusContext';

export const Badge: React.FC<{ label: string; cls?: string }> = ({
  label,
  cls = 'bg-slate-100 text-slate-700 border-slate-200',
}) => (
  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap ${cls}`}>
    {label}
  </span>
);

export const AssetStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const { statusMap } = useAssetStatuses();
  const custom = statusMap[status];
  if (custom) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap"
        style={{
          backgroundColor: custom.bgColor,
          color: custom.textColor,
          borderColor: `${custom.textColor}33`,
        }}
      >
        {custom.name}
      </span>
    );
  }
  const m = ASSET_STATUS_META[status] || { label: status, cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  return <Badge label={m.label} cls={m.cls} />;
};

export const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const m = SEVERITY_META[severity] || { label: severity, cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  return <Badge label={m.label} cls={m.cls} />;
};

export const AlertStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const m = ALERT_STATUS_META[status] || { label: status, cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  return <Badge label={m.label} cls={m.cls} />;
};

export const InventoryStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const m = INVENTORY_STATUS_META[status] || { label: status, cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  return <Badge label={m.label} cls={m.cls} />;
};

export const AgentStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; dot: string; cls: string }> = {
    ONLINE: { label: 'Trực tuyến', dot: 'bg-emerald-500', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    OFFLINE: { label: 'Ngoại tuyến', dot: 'bg-slate-400', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    REVOKED: { label: 'Đã thu hồi', dot: 'bg-red-500', cls: 'bg-red-50 text-red-700 border-red-200' },
    CONFLICT: { label: 'Mâu thuẫn định danh', dot: 'bg-orange-500', cls: 'bg-orange-50 text-orange-800 border-orange-200' },
  };
  const m = map[status] || map.OFFLINE;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
};

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, actions, className = 'mb-4 sm:mb-5' }) => (
  <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 ${className}`}>
    <div className="min-w-0">
      <h1 className="text-lg sm:text-xl font-semibold text-ink-primary tracking-tight leading-snug">{title}</h1>
      {subtitle && <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
  </div>
);

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, maxWidth = 'max-w-2xl', children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4 overflow-y-auto">
      <div className={`w-full ${maxWidth} bg-white rounded-t-2xl sm:rounded-lg border border-line shadow-xl sm:my-8 overflow-hidden`}>
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-line bg-slate-50/70">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-semibold text-ink-primary truncate">{title}</h2>
            {subtitle && <p className="text-xs text-ink-secondary mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-200/60 shrink-0"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 sm:p-5 max-h-[82vh] sm:max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
