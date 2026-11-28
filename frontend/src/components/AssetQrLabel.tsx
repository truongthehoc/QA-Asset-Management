import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { formatDate } from '../utils/format';

export interface QrLabelConfig {
  labelTitle: string;
  sizePx: number;
  fields: string[];
}

export const DEFAULT_QR_CONFIG: QrLabelConfig = {
  labelTitle: 'TÀI SẢN',
  sizePx: 180,
  fields: ['assetCode', 'name', 'serialNumber', 'department', 'employee'],
};

export const QR_FIELD_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'assetCode', label: 'Mã tài sản' },
  { key: 'name', label: 'Tên tài sản' },
  { key: 'assetType', label: 'Loại tài sản' },
  { key: 'serialNumber', label: 'Số Serial (S/N)' },
  { key: 'department', label: 'Phòng ban sử dụng' },
  { key: 'employee', label: 'Nhân viên sử dụng' },
  { key: 'location', label: 'Vị trí đặt máy' },
  { key: 'handoverDate', label: 'Ngày bàn giao' },
  { key: 'warrantyEndDate', label: 'Hạn bảo hành' },
];

export const AssetQrLabel: React.FC<{
  asset: any;
  config?: QrLabelConfig;
}> = ({ asset, config }) => {
  const cfg = config || DEFAULT_QR_CONFIG;
  const fieldSet = new Set(cfg.fields && cfg.fields.length > 0 ? cfg.fields : DEFAULT_QR_CONFIG.fields);
  const qrUrl = `${window.location.origin}/qr/${encodeURIComponent(asset.assetCode || '')}`;
  const size = Math.max(120, Math.min(260, Number(cfg.sizePx) || 180));

  const employeeName = asset.assignedEmployee
    ? `${asset.assignedEmployee.code ? `${asset.assignedEmployee.code} — ` : ''}${asset.assignedEmployee.fullName}`
    : asset.assignedUserName || '';
  const deptName = asset.usingDepartment?.name || '';
  const locText = [asset.location?.name, asset.locationDetail].filter(Boolean).join(' · ');

  return (
    <div className="p-5 border-2 border-dashed border-slate-300 rounded-lg inline-block bg-white text-center min-w-[230px] max-w-[300px]">
      {cfg.labelTitle?.trim() && (
        <div className="text-[11px] font-bold uppercase tracking-wider text-brand mb-2 border-b border-slate-200 pb-1.5">
          {cfg.labelTitle.trim()}
        </div>
      )}

      <div className="flex justify-center">
        <QRCodeSVG value={qrUrl} size={size} level="M" includeMargin />
      </div>

      <div className="mt-2 space-y-0.5">
        {fieldSet.has('assetCode') && (
          <div className="font-mono text-base font-bold text-ink-primary">{asset.assetCode}</div>
        )}
        {fieldSet.has('name') && (
          <div className="text-xs font-medium text-ink-secondary truncate">{asset.name}</div>
        )}
        {fieldSet.has('assetType') && asset.assetType?.name && (
          <div className="text-[11px] text-ink-muted truncate">Loại: {asset.assetType.name}</div>
        )}
        {fieldSet.has('serialNumber') && asset.serialNumber && (
          <div className="text-[11px] font-mono text-ink-muted truncate">SN: {asset.serialNumber}</div>
        )}
        {fieldSet.has('department') && (
          <div className="text-[11px] text-ink-muted truncate">
            PB: {deptName || 'Kho / Chưa phân bổ'}
          </div>
        )}
        {fieldSet.has('employee') && employeeName && (
          <div className="text-[11px] text-ink-muted truncate">NV: {employeeName}</div>
        )}
        {fieldSet.has('location') && locText && (
          <div className="text-[11px] text-ink-muted truncate">VT: {locText}</div>
        )}
        {fieldSet.has('handoverDate') && asset.handoverDate && (
          <div className="text-[11px] text-ink-muted">BG: {formatDate(asset.handoverDate)}</div>
        )}
        {fieldSet.has('warrantyEndDate') && asset.purchase?.warrantyEndDate && (
          <div className="text-[11px] text-ink-muted">BH: {formatDate(asset.purchase.warrantyEndDate)}</div>
        )}
      </div>
    </div>
  );
};
