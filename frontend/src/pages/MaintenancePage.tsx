import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Search, Eye, History } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, Badge } from '../components/UiPrimitives';
import { TablePagination, usePagination } from '../components/TablePagination';
import {
  DISPOSAL_METHOD_META,
  formatDate,
  formatVnd,
  MAINTENANCE_STATUS_META,
  MAINTENANCE_TYPE_META,
} from '../utils/format';

const STATUS_FILTERS = [
  { key: '', label: 'Tất cả' },
  { key: 'OPEN', label: 'Chờ tiếp nhận' },
  { key: 'IN_PROGRESS', label: 'Đang sửa chữa' },
  { key: 'WAITING_PARTS', label: 'Chờ linh kiện' },
  { key: 'COMPLETED', label: 'Hoàn thành' },
  { key: 'CANCELLED', label: 'Đã hủy' },
] as const;

export const MaintenancePage: React.FC = () => {
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: 'maintenance' | 'disposals' =
    searchParams.get('tab') === 'disposals' ? 'disposals' : 'maintenance';

  const setTab = (next: 'maintenance' | 'disposals') => {
    if (next === 'disposals') setSearchParams({ tab: 'disposals' });
    else setSearchParams({});
  };

  const [tickets, setTickets] = useState<any[]>([]);
  const [disposals, setDisposals] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    const [mRes, dRes] = await Promise.all([
      api.get('/maintenance'),
      api.get('/maintenance/disposals'),
    ]);
    setTickets(mRes.data || []);
    setDisposals(dRes.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${t.ticketCode} ${t.issueSummary || ''} ${t.vendorName || ''} ${t.performedBy || ''} ${t.asset?.assetCode || ''} ${t.asset?.name || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tickets, statusFilter, search]);

  const ticketsPg = usePagination(filteredTickets, 10);
  const disposalsPg = usePagination(disposals, 10);

  const totalCost = tickets.reduce((s, t) => s + (t.cost || 0), 0);
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { '': tickets.length };
    for (const t of tickets) {
      counts[t.status] = (counts[t.status] || 0) + 1;
    }
    return counts;
  }, [tickets]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bảo trì, Sửa chữa & Thanh lý"
        subtitle={`Theo dõi phiếu sửa chữa, trạng thái xử lý, nhật ký tiến độ (Tổng chi phí: ${formatVnd(totalCost)}) và hồ sơ thanh lý.`}
        actions={
          can('maintenance.manage') && (
            <>
              <Link to="/maintenance/disposals/new" className="btn-danger">
                <Trash2 className="w-4 h-4" /> Lập biên bản thanh lý
              </Link>
              <Link to="/maintenance/new" className="btn-primary">
                <Plus className="w-4 h-4" /> Lập phiếu bảo trì
              </Link>
            </>
          )
        }
      />

      <div className="flex gap-1 border-b border-line overflow-x-auto">
        <button
          onClick={() => setTab('maintenance')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
            tab === 'maintenance' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'
          }`}
        >
          Phiếu bảo trì & sửa chữa ({tickets.length})
        </button>
        <button
          onClick={() => setTab('disposals')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
            tab === 'disposals' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'
          }`}
        >
          Hồ sơ thanh lý ({disposals.length})
        </button>
      </div>

      {tab === 'maintenance' && (
        <div className="space-y-4">
          {/* BỘ LỌC TRẠNG THÁI & TÌM KIẾM */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-nowrap sm:flex-wrap gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              {STATUS_FILTERS.map((f) => {
                const active = statusFilter === f.key;
                const count = statusCounts[f.key] || 0;
                return (
                  <button
                    key={f.key || 'all'}
                    type="button"
                    onClick={() => {
                      setStatusFilter(f.key);
                      ticketsPg.setPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-brand text-white border-brand'
                        : 'bg-white text-ink-secondary border-line hover:bg-slate-50'
                    }`}
                  >
                    {f.label} <span className={active ? 'opacity-85' : 'text-ink-muted'}>({count})</span>
                  </button>
                );
              })}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  ticketsPg.setPage(1);
                }}
                placeholder="Tìm mã phiếu, tài sản, sự cố..."
                className="input-field pl-9 text-xs"
              />
            </div>
          </div>

          <div className="panel overflow-hidden">
            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-line">
              {ticketsPg.totalItems === 0 ? (
                <div className="p-8 text-center text-xs text-ink-muted">Không có phiếu bảo trì nào phù hợp.</div>
              ) : (
                ticketsPg.paginated.map((t) => {
                  const stMeta = MAINTENANCE_STATUS_META[t.status] || {
                    label: t.status,
                    cls: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  const tpMeta = MAINTENANCE_TYPE_META[t.maintenanceType] || MAINTENANCE_TYPE_META.REPAIR;
                  return (
                    <Link key={t.id} to={`/maintenance/${t.id}`} className="block p-3.5 hover:bg-slate-50/70 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-brand">{t.ticketCode}</span>
                        <Badge label={stMeta.label} cls={stMeta.cls} />
                      </div>
                      <div className="text-xs font-semibold text-ink-primary">{t.issueSummary}</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-secondary">
                        <Badge label={tpMeta.label} cls={tpMeta.cls} />
                        <span className="font-mono">{t.asset?.assetCode}</span>
                        <span>• {t.asset?.name}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-ink-muted pt-1 border-t border-slate-100">
                        <span>{formatDate(t.receivedDate)} · {t.vendorName || 'Nội bộ IT'}</span>
                        <span className="font-mono font-semibold text-ink-primary">{formatVnd(t.cost)}</span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th-cell w-12 text-center">STT</th>
                    <th className="th-cell">Mã phiếu / Loại</th>
                    <th className="th-cell">Tài sản</th>
                    <th className="th-cell">Nội dung & Linh kiện</th>
                    <th className="th-cell">Đơn vị / Thực hiện</th>
                    <th className="th-cell">Chi phí</th>
                    <th className="th-cell">Trạng thái</th>
                    <th className="th-cell text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketsPg.totalItems === 0 ? (
                    <tr>
                      <td colSpan={8} className="td-cell text-center text-ink-muted py-10">
                        Không có phiếu bảo trì nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    ticketsPg.paginated.map((t, idx) => {
                      const stMeta = MAINTENANCE_STATUS_META[t.status] || {
                        label: t.status,
                        cls: 'bg-slate-100 text-slate-700 border-slate-200',
                      };
                      const tpMeta = MAINTENANCE_TYPE_META[t.maintenanceType] || MAINTENANCE_TYPE_META.REPAIR;
                      const logCount = t._count?.logs ?? 0;

                      return (
                        <tr key={t.id} className="hover:bg-slate-50/70">
                          <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">
                            {ticketsPg.startIndex + idx + 1}
                          </td>
                          <td className="td-cell">
                            <Link
                              to={`/maintenance/${t.id}`}
                              className="font-mono text-xs font-semibold text-brand hover:underline block"
                            >
                              {t.ticketCode}
                            </Link>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Badge label={tpMeta.label} cls={tpMeta.cls} />
                            </div>
                            <div className="text-[11px] text-ink-muted mt-0.5">{formatDate(t.receivedDate)}</div>
                          </td>
                          <td className="td-cell">
                            <Link to={`/assets/${t.asset?.id}`} className="font-mono text-xs font-semibold text-brand hover:underline block">
                              {t.asset?.assetCode}
                            </Link>
                            <span className="text-xs text-ink-primary block">{t.asset?.name}</span>
                            {t.asset?.usingDepartment?.name && (
                              <span className="text-[11px] text-ink-muted">{t.asset.usingDepartment.name}</span>
                            )}
                          </td>
                          <td className="td-cell text-xs max-w-sm">
                            <div className="font-medium text-ink-primary">{t.issueSummary}</div>
                            {t.replacedParts && <div className="text-ink-secondary mt-0.5">Linh kiện: {t.replacedParts}</div>}
                            {logCount > 0 && (
                              <div className="inline-flex items-center gap-1 text-[11px] text-ink-muted mt-1">
                                <History className="w-3 h-3" /> {logCount} dòng nhật ký
                              </div>
                            )}
                          </td>
                          <td className="td-cell text-xs">
                            <div className="font-medium text-ink-primary">{t.vendorName || 'Nội bộ IT'}</div>
                            <div className="text-ink-muted">{t.performedBy || '—'}</div>
                          </td>
                          <td className="td-cell font-mono text-xs font-medium tabular-nums">{formatVnd(t.cost)}</td>
                          <td className="td-cell">
                            <Badge label={stMeta.label} cls={stMeta.cls} />
                          </td>
                          <td className="td-cell text-right">
                            <Link to={`/maintenance/${t.id}`} className="btn-secondary px-2.5 py-1 text-xs inline-flex">
                              <Eye className="w-3.5 h-3.5" /> Chi tiết
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination
              totalItems={ticketsPg.totalItems}
              page={ticketsPg.page}
              pageSize={ticketsPg.pageSize}
              onPageChange={ticketsPg.setPage}
              onPageSizeChange={ticketsPg.setPageSize}
              unitLabel="phiếu bảo trì"
            />
          </div>
        </div>
      )}

      {tab === 'disposals' && (
        <div className="panel overflow-hidden">
          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-line">
            {disposalsPg.totalItems === 0 ? (
              <div className="p-8 text-center text-xs text-ink-muted">Chưa có hồ sơ thanh lý.</div>
            ) : (
              disposalsPg.paginated.map((d) => {
                const mMeta = DISPOSAL_METHOD_META[d.method] || {
                  label: d.method,
                  cls: 'bg-slate-100 text-slate-700 border-slate-200',
                };
                return (
                  <div key={d.id} className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-ink-primary">{d.disposalCode}</span>
                      <Badge label={mMeta.label} cls={mMeta.cls} />
                    </div>
                    <div className="text-xs">
                      <Link to={`/assets/${d.asset?.id}`} className="font-mono font-semibold text-brand hover:underline">
                        {d.asset?.assetCode}
                      </Link>
                      <span className="text-ink-primary"> — {d.asset?.name}</span>
                    </div>
                    <div className="text-xs text-ink-secondary">{d.reason}</div>
                    <div className="flex items-center justify-between text-[11px] text-ink-muted pt-1 border-t border-slate-100">
                      <span>{formatDate(d.disposalDate)} · QĐ: {d.decisionNumber || '—'}</span>
                      <span className="font-mono font-semibold text-ink-primary">{formatVnd(d.salvageValue)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th-cell w-12 text-center">STT</th>
                  <th className="th-cell">Mã thanh lý</th>
                  <th className="th-cell">Tài sản</th>
                  <th className="th-cell">Hình thức</th>
                  <th className="th-cell">Số quyết định</th>
                  <th className="th-cell">Lý do</th>
                  <th className="th-cell">Giá trị thu hồi</th>
                  <th className="th-cell">Ngày / Phê duyệt</th>
                </tr>
              </thead>
              <tbody>
                {disposalsPg.totalItems === 0 ? (
                  <tr>
                    <td colSpan={8} className="td-cell text-center text-ink-muted py-8">
                      Chưa có hồ sơ thanh lý.
                    </td>
                  </tr>
                ) : (
                  disposalsPg.paginated.map((d, idx) => {
                    const mMeta = DISPOSAL_METHOD_META[d.method] || {
                      label: d.method,
                      cls: 'bg-slate-100 text-slate-700 border-slate-200',
                    };
                    return (
                      <tr key={d.id} className="hover:bg-slate-50/70">
                        <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">
                          {disposalsPg.startIndex + idx + 1}
                        </td>
                        <td className="td-cell font-mono text-xs font-semibold">{d.disposalCode}</td>
                        <td className="td-cell text-xs">
                          <Link to={`/assets/${d.asset?.id}`} className="font-mono font-semibold text-brand hover:underline block">
                            {d.asset?.assetCode}
                          </Link>
                          <span className="text-ink-primary">{d.asset?.name}</span>
                        </td>
                        <td className="td-cell">
                          <Badge label={mMeta.label} cls={mMeta.cls} />
                        </td>
                        <td className="td-cell font-mono text-xs">{d.decisionNumber || '—'}</td>
                        <td className="td-cell text-xs max-w-xs">{d.reason}</td>
                        <td className="td-cell font-mono text-xs font-medium tabular-nums">{formatVnd(d.salvageValue)}</td>
                        <td className="td-cell text-xs">
                          <div>{formatDate(d.disposalDate)}</div>
                          <div className="text-[11px] text-ink-muted">{d.approvedBy || '—'}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            totalItems={disposalsPg.totalItems}
            page={disposalsPg.page}
            pageSize={disposalsPg.pageSize}
            onPageChange={disposalsPg.setPage}
            onPageSizeChange={disposalsPg.setPageSize}
            unitLabel="hồ sơ thanh lý"
          />
        </div>
      )}
    </div>
  );
};
