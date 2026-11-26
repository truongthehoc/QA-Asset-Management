import React, { useEffect, useState } from 'react';
import { Shield, Search, RefreshCw } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/UiPrimitives';
import { formatDateTime } from '../../utils/format';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');

  const load = async () => {
    const params: any = { limit: 200 };
    if (search.trim()) params.search = search.trim();
    if (entityType) params.entityType = entityType;
    const res = await api.get('/admin/audit-logs', { params });
    setLogs(res.data || []);
  };

  useEffect(() => {
    load();
  }, [entityType]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nhật ký hệ thống (Audit Log)"
        subtitle="Ghi nhận toàn bộ thao tác quan trọng (đăng nhập, duyệt tài sản, đổi mã, điều chuyển, xác minh Baseline, thay đổi cấu hình)."
        actions={
          <button onClick={load} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Làm mới
          </button>
        }
      />

      <div className="panel p-3.5 flex flex-wrap gap-3 items-center">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="relative flex-1 min-w-[240px]"
        >
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo người thực hiện, hành động, giá trị, lý do..."
            className="input-field pl-9"
          />
        </form>
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="input-field w-48">
          <option value="">Tất cả đối tượng</option>
          <option value="Asset">Tài sản</option>
          <option value="User">Người dùng</option>
          <option value="DeviceAgent">Windows Agent</option>
          <option value="AlertEvent">Cảnh báo</option>
          <option value="SystemSetting">Cấu hình hệ thống</option>
          <option value="EnrollmentToken">Enrollment Token</option>
          <option value="InventorySession">Kiểm kê</option>
        </select>
        <button onClick={load} className="btn-secondary">Lọc</button>
      </div>

      <div className="panel overflow-hidden">
        <div className="px-4 py-2.5 border-b border-line flex items-center gap-2 text-xs text-ink-secondary bg-slate-50/60">
          <Shield className="w-4 h-4 text-brand shrink-0" />
          Nhật ký kiểm toán bất biến theo SRS Mục 9.2 — không cho phép chỉnh sửa hay xóa bản ghi.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th-cell w-12 text-center">STT</th>
                <th className="th-cell">Thời điểm</th>
                <th className="th-cell">Người thực hiện</th>
                <th className="th-cell">Hành động</th>
                <th className="th-cell">Đối tượng</th>
                <th className="th-cell">Giá trị thay đổi</th>
                <th className="th-cell">Lý do</th>
                <th className="th-cell">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={8} className="td-cell text-center text-ink-muted py-8">Không có bản ghi nhật ký phù hợp.</td></tr>
              ) : (
                logs.map((l, idx) => (
                  <tr key={l.id} className="hover:bg-slate-50/70">
                    <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                    <td className="td-cell text-xs whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                    <td className="td-cell text-xs font-medium">{l.actorName}</td>
                    <td className="td-cell font-mono text-xs font-semibold text-brand">{l.action}</td>
                    <td className="td-cell text-xs">{l.entityType}</td>
                    <td className="td-cell text-xs max-w-xs truncate" title={`${l.oldValue || ''} -> ${l.newValue || ''}`}>
                      {l.oldValue ? `${l.oldValue} → ` : ''}
                      {l.newValue || '—'}
                    </td>
                    <td className="td-cell text-xs text-ink-secondary">{l.reason || '—'}</td>
                    <td className="td-cell font-mono text-xs text-ink-muted">{l.ipAddress || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
