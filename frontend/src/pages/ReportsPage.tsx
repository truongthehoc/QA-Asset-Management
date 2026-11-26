import React, { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { api, downloadAuthorizedFile } from '../api/client';
import { PageHeader, Badge, InventoryStatusBadge, SeverityBadge } from '../components/UiPrimitives';
import { formatVnd, formatDate, formatDateTime } from '../utils/format';

export const ReportsPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<'dept' | 'warranty' | 'changes' | 'maintenance' | 'inventory'>('dept');

  useEffect(() => {
    api.get('/reports/summary').then((r) => setData(r.data));
  }, []);

  if (!data) return <div className="py-12 text-center text-sm text-ink-secondary">Đang tổng hợp dữ liệu báo cáo...</div>;

  const totalAssetVal = (data.byDepartment || []).reduce((s: number, d: any) => s + d.totalValue, 0);
  const totalMaintCost = (data.byDepartment || []).reduce((s: number, d: any) => s + d.maintenanceCost, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Báo cáo quản trị tài sản"
        subtitle="Tổng hợp giá trị tài sản, chi phí bảo trì, hạn bảo hành, lịch sử biến động cấu hình và sai lệch kiểm kê."
        actions={
          <div className="no-print flex items-center gap-2 flex-wrap">
            <button onClick={() => downloadAuthorizedFile('/reports/export?type=assets', 'bao-cao-tai-san.csv')} className="btn-secondary text-xs">
              <Download className="w-3.5 h-3.5" /> Xuất DS Tài sản (CSV)
            </button>
            <button onClick={() => downloadAuthorizedFile('/reports/export?type=warranty', 'bao-cao-bao-hanh.csv')} className="btn-secondary text-xs">
              <Download className="w-3.5 h-3.5" /> Xuất Bảo hành (CSV)
            </button>
            <button onClick={() => downloadAuthorizedFile('/reports/export?type=changes', 'bao-cao-thay-doi-cau-hinh.csv')} className="btn-secondary text-xs">
              <Download className="w-3.5 h-3.5" /> Xuất Thay đổi cấu hình
            </button>
            <button onClick={() => window.print()} className="btn-primary text-xs">
              <Printer className="w-3.5 h-3.5" /> In / Xuất PDF
            </button>
          </div>
        }
      />

      <div className="grid sm:grid-cols-4 gap-3.5">
        <div className="panel p-4">
          <div className="text-xs text-ink-secondary">Tổng giá trị tài sản</div>
          <div className="text-xl font-bold text-ink-primary mt-1 tabular-nums">{formatVnd(totalAssetVal)}</div>
        </div>
        <div className="panel p-4">
          <div className="text-xs text-ink-secondary">Tổng chi phí sửa chữa</div>
          <div className="text-xl font-bold text-amber-700 mt-1 tabular-nums">{formatVnd(totalMaintCost)}</div>
        </div>
        <div className="panel p-4">
          <div className="text-xs text-ink-secondary">Sắp / Đã hết bảo hành</div>
          <div className="text-xl font-bold text-orange-600 mt-1 tabular-nums">{data.warrantyList.length} thiết bị</div>
        </div>
        <div className="panel p-4">
          <div className="text-xs text-ink-secondary">Sai lệch kiểm kê</div>
          <div className="text-xl font-bold text-red-600 mt-1 tabular-nums">{data.inventoryDiscrepancies.length} mục</div>
        </div>
      </div>

      <div className="no-print flex gap-1 border-b border-line overflow-x-auto">
        {[
          { id: 'dept', label: 'Giá trị & Chi phí theo phòng ban' },
          { id: 'warranty', label: `Bảo hành (${data.warrantyList.length})` },
          { id: 'changes', label: `Lịch sử thay đổi cấu hình (${data.configChanges.length})` },
          { id: 'maintenance', label: `Sửa chữa & Nâng cấp (${data.maintenances.length})` },
          { id: 'inventory', label: `Sai lệch kiểm kê (${data.inventoryDiscrepancies.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${tab === t.id ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dept' && (
        <div className="panel overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th-cell w-12 text-center">STT</th>
                <th className="th-cell">Phòng ban / Đơn vị</th>
                <th className="th-cell text-right">Số lượng tài sản</th>
                <th className="th-cell text-right">Tổng giá trị mua sắm</th>
                <th className="th-cell text-right">Chi phí bảo trì lũy kế</th>
              </tr>
            </thead>
            <tbody>
              {data.byDepartment.map((d: any, idx: number) => (
                <tr key={d.department}>
                  <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                  <td className="td-cell font-medium">{d.department}</td>
                  <td className="td-cell text-right font-mono tabular-nums">{d.count}</td>
                  <td className="td-cell text-right font-mono tabular-nums font-medium">{formatVnd(d.totalValue)}</td>
                  <td className="td-cell text-right font-mono tabular-nums text-amber-700">{formatVnd(d.maintenanceCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'warranty' && (
        <div className="panel overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th-cell w-12 text-center">STT</th>
                <th className="th-cell">Mã tài sản</th>
                <th className="th-cell">Tên thiết bị</th>
                <th className="th-cell">Phòng ban</th>
                <th className="th-cell">Nhà cung cấp</th>
                <th className="th-cell">Hết bảo hành</th>
                <th className="th-cell">Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {data.warrantyList.map((w: any, idx: number) => (
                <tr key={w.assetId}>
                  <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                  <td className="td-cell font-mono text-xs font-semibold">{w.assetCode}</td>
                  <td className="td-cell text-xs font-medium">{w.name}</td>
                  <td className="td-cell text-xs">{w.department}</td>
                  <td className="td-cell text-xs">{w.supplier}</td>
                  <td className="td-cell text-xs font-mono">{formatDate(w.warrantyEndDate)}</td>
                  <td className="td-cell">
                    <Badge
                      label={w.status === 'EXPIRED' ? `Quá hạn ${Math.abs(w.daysLeft)} ngày` : `Còn ${w.daysLeft} ngày`}
                      cls={w.status === 'EXPIRED' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-800 border-amber-200'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'changes' && (
        <div className="panel overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th-cell w-12 text-center">STT</th>
                <th className="th-cell">Thời điểm</th>
                <th className="th-cell">Tài sản</th>
                <th className="th-cell">Thành phần</th>
                <th className="th-cell">Trước → Sau</th>
                <th className="th-cell">Mức độ</th>
                <th className="th-cell">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {data.configChanges.map((c: any, idx: number) => (
                <tr key={c.id}>
                  <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                  <td className="td-cell text-xs">{formatDateTime(c.detectedAt)}</td>
                  <td className="td-cell font-mono text-xs font-semibold">{c.asset?.assetCode || '—'}</td>
                  <td className="td-cell text-xs font-medium">{c.component}</td>
                  <td className="td-cell text-xs">{c.previousValue} → <strong>{c.newValue}</strong></td>
                  <td className="td-cell"><SeverityBadge severity={c.severity} /></td>
                  <td className="td-cell text-xs">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="panel overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th-cell w-12 text-center">STT</th>
                <th className="th-cell">Mã phiếu</th>
                <th className="th-cell">Tài sản</th>
                <th className="th-cell">Nội dung</th>
                <th className="th-cell">Đơn vị</th>
                <th className="th-cell text-right">Chi phí</th>
                <th className="th-cell">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {data.maintenances.map((m: any, idx: number) => (
                <tr key={m.id}>
                  <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                  <td className="td-cell font-mono text-xs">{m.ticketCode}</td>
                  <td className="td-cell text-xs font-medium">{m.asset?.assetCode} — {m.asset?.name}</td>
                  <td className="td-cell text-xs">{m.issueSummary}</td>
                  <td className="td-cell text-xs">{m.vendorName || 'Nội bộ'}</td>
                  <td className="td-cell text-right font-mono text-xs tabular-nums">{formatVnd(m.cost)}</td>
                  <td className="td-cell text-xs">{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'inventory' && (
        <div className="panel overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th-cell w-12 text-center">STT</th>
                <th className="th-cell">Đợt kiểm kê</th>
                <th className="th-cell">Mã tài sản</th>
                <th className="th-cell">Tên tài sản</th>
                <th className="th-cell">Sai lệch</th>
                <th className="th-cell">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {data.inventoryDiscrepancies.map((it: any, idx: number) => (
                <tr key={it.id}>
                  <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{idx + 1}</td>
                  <td className="td-cell font-mono text-xs">{it.session?.sessionCode}</td>
                  <td className="td-cell font-mono text-xs font-semibold">{it.asset?.assetCode}</td>
                  <td className="td-cell text-xs">{it.asset?.name}</td>
                  <td className="td-cell"><InventoryStatusBadge status={it.status} /></td>
                  <td className="td-cell text-xs">{it.discrepancyNotes || it.actualCondition || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
