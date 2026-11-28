import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Eye,
  FileText,
  BellRing,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, Badge } from '../components/UiPrimitives';
import { TablePagination, usePagination } from '../components/TablePagination';
import {
  CONTRACT_STATUS_META,
  CONTRACT_TYPE_META,
  formatDate,
  formatVnd,
} from '../utils/format';

const STATUS_FILTERS = [
  { key: '', label: 'Tất cả' },
  { key: 'ACTIVE', label: 'Đang hiệu lực' },
  { key: 'EXPIRING_SOON', label: 'Sắp hết hạn' },
  { key: 'EXPIRED', label: 'Đã hết hạn' },
  { key: 'DRAFT', label: 'Bản nháp' },
  { key: 'TERMINATED', label: 'Đã thanh lý' },
] as const;

export const ContractsPage: React.FC = () => {
  const { can } = useAuth();
  const [contracts, setContracts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.allSettled([api.get('/contracts'), api.get('/admin/suppliers')]).then(([cRes, sRes]) => {
      if (cRes.status === 'fulfilled') setContracts(cRes.value.data || []);
      if (sRes.status === 'fulfilled') setSuppliers(sRes.value.data || []);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((c) => {
      if (statusFilter && c.effectiveStatus !== statusFilter) return false;
      if (supplierFilter && c.supplierId !== supplierFilter) return false;
      if (!q) return true;
      const hay = `${c.contractCode} ${c.title} ${c.supplierName || ''} ${c.ownerName || ''} ${c.departmentName || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [contracts, statusFilter, supplierFilter, search]);

  const pg = usePagination(filtered, 10);

  const stats = useMemo(() => {
    const counts: Record<string, number> = { '': contracts.length };
    let totalValue = 0;
    for (const c of contracts) {
      counts[c.effectiveStatus] = (counts[c.effectiveStatus] || 0) + 1;
      totalValue += c.contractValue || 0;
    }
    return {
      counts,
      totalValue,
      active: counts['ACTIVE'] || 0,
      expiringSoon: counts['EXPIRING_SOON'] || 0,
      expired: counts['EXPIRED'] || 0,
    };
  }, [contracts]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quản lý Hợp đồng"
        subtitle={`Theo dõi hợp đồng gắn với nhà cung cấp, giá trị thực hiện (${formatVnd(stats.totalValue)}) và nhắc hẹn tự động trước khi hết hạn.`}
        actions={
          can('assets.create') && (
            <Link to="/contracts/new" className="btn-primary">
              <Plus className="w-4 h-4" /> Thêm hợp đồng
            </Link>
          )
        }
      />

      {/* 4 KPI TÓM TẮT */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3.5">
        <button
          type="button"
          onClick={() => {
            setStatusFilter('');
            pg.setPage(1);
          }}
          className="text-left bg-white rounded-xl border border-slate-200/80 p-3 sm:p-4 flex items-center gap-3 hover:border-slate-300 transition-colors"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] sm:text-xs text-ink-secondary truncate">Tổng hợp đồng</div>
            <div className="text-lg sm:text-2xl font-bold text-ink-primary tabular-nums">{contracts.length}</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('ACTIVE');
            pg.setPage(1);
          }}
          className="text-left bg-white rounded-xl border border-slate-200/80 p-3 sm:p-4 flex items-center gap-3 hover:border-slate-300 transition-colors"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] sm:text-xs text-ink-secondary truncate">Đang hiệu lực</div>
            <div className="text-lg sm:text-2xl font-bold text-emerald-700 tabular-nums">{stats.active}</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('EXPIRING_SOON');
            pg.setPage(1);
          }}
          className="text-left bg-white rounded-xl border border-slate-200/80 p-3 sm:p-4 flex items-center gap-3 hover:border-amber-300 transition-colors"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] sm:text-xs text-ink-secondary truncate">Sắp hết hạn (Nhắc hẹn)</div>
            <div className="text-lg sm:text-2xl font-bold text-amber-700 tabular-nums">{stats.expiringSoon}</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('EXPIRED');
            pg.setPage(1);
          }}
          className="text-left bg-white rounded-xl border border-slate-200/80 p-3 sm:p-4 flex items-center gap-3 hover:border-rose-300 transition-colors"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] sm:text-xs text-ink-secondary truncate">Đã hết hạn</div>
            <div className="text-lg sm:text-2xl font-bold text-rose-600 tabular-nums">{stats.expired}</div>
          </div>
        </button>
      </div>

      {/* BANNER NHẮC HẸN HỢP ĐỒNG */}
      {(stats.expiringSoon > 0 || stats.expired > 0) && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <BellRing className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Đang có <strong>{stats.expiringSoon} hợp đồng sắp hết hạn</strong> trong ngưỡng nhắc hẹn
              {stats.expired > 0 ? (
                <> và <strong className="text-red-700">{stats.expired} hợp đồng đã quá hạn</strong></>
              ) : null}
              .
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setStatusFilter(stats.expiringSoon > 0 ? 'EXPIRING_SOON' : 'EXPIRED');
              pg.setPage(1);
            }}
            className="text-xs font-semibold text-amber-800 underline"
          >
            Xem danh sách cần xử lý
          </button>
        </div>
      )}

      {/* BỘ LỌC & TÌM KIẾM */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-nowrap sm:flex-wrap gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.key;
            const count = stats.counts[f.key] || 0;
            return (
              <button
                key={f.key || 'all'}
                type="button"
                onClick={() => {
                  setStatusFilter(f.key);
                  pg.setPage(1);
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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <select
            value={supplierFilter}
            onChange={(e) => {
              setSupplierFilter(e.target.value);
              pg.setPage(1);
            }}
            className="input-field text-xs sm:w-52"
          >
            <option value="">Tất cả nhà cung cấp</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="relative sm:w-64">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                pg.setPage(1);
              }}
              placeholder="Tìm số HĐ, tên hợp đồng, NCC..."
              className="input-field pl-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* DANH SÁCH HỢP ĐỒNG */}
      <div className="panel overflow-hidden">
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-line">
          {pg.totalItems === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">
              Chưa có hợp đồng nào phù hợp.
            </div>
          ) : (
            pg.paginated.map((c) => {
              const tpMeta = CONTRACT_TYPE_META[c.contractType] || CONTRACT_TYPE_META.PURCHASE;
              const stMeta = CONTRACT_STATUS_META[c.effectiveStatus] || CONTRACT_STATUS_META.ACTIVE;
              return (
                <Link key={c.id} to={`/contracts/${c.id}`} className="block p-3.5 hover:bg-slate-50/70 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-brand">{c.contractCode}</span>
                    <Badge label={stMeta.label} cls={stMeta.cls} />
                  </div>
                  <div className="text-xs font-semibold text-ink-primary">{c.title}</div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-secondary">
                    <Badge label={tpMeta.label} cls={tpMeta.cls} />
                    {c.supplierName && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-ink-muted" /> {c.supplierName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                    <span className={c.daysRemaining != null && c.daysRemaining <= (c.remindDaysBefore || 30) ? 'text-amber-700 font-semibold' : 'text-ink-muted'}>
                      HH: {c.endDate ? formatDate(c.endDate) : 'Không thời hạn'}
                      {c.daysRemaining != null && ` (${c.daysRemaining < 0 ? `Quá ${Math.abs(c.daysRemaining)} ngày` : `Còn ${c.daysRemaining} ngày`})`}
                    </span>
                    <span className="font-mono font-semibold text-ink-primary">{formatVnd(c.contractValue)}</span>
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
                <th className="th-cell">Số hợp đồng / Nội dung</th>
                <th className="th-cell">Loại hợp đồng</th>
                <th className="th-cell">Nhà cung cấp</th>
                <th className="th-cell">Thời hạn & Nhắc hẹn</th>
                <th className="th-cell">Giá trị</th>
                <th className="th-cell">Trạng thái</th>
                <th className="th-cell text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pg.totalItems === 0 ? (
                <tr>
                  <td colSpan={8} className="td-cell text-center text-ink-muted py-10">
                    Chưa có hợp đồng nào. Bấm <strong>Thêm hợp đồng</strong> để khởi tạo.
                  </td>
                </tr>
              ) : (
                pg.paginated.map((c, idx) => {
                  const tpMeta = CONTRACT_TYPE_META[c.contractType] || CONTRACT_TYPE_META.PURCHASE;
                  const stMeta = CONTRACT_STATUS_META[c.effectiveStatus] || CONTRACT_STATUS_META.ACTIVE;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">
                        {pg.startIndex + idx + 1}
                      </td>
                      <td className="td-cell max-w-xs">
                        <Link to={`/contracts/${c.id}`} className="font-mono text-xs font-semibold text-brand hover:underline block">
                          {c.contractCode}
                        </Link>
                        <div className="text-xs font-medium text-ink-primary">{c.title}</div>
                        {(c._count?.documents || 0) > 0 && (
                          <div className="inline-flex items-center gap-1 text-[11px] text-ink-muted mt-0.5">
                            <FileText className="w-3 h-3" /> {c._count.documents} tệp đính kèm
                          </div>
                        )}
                      </td>
                      <td className="td-cell">
                        <Badge label={tpMeta.label} cls={tpMeta.cls} />
                      </td>
                      <td className="td-cell text-xs">
                        <div className="font-medium text-ink-primary">{c.supplierName || '—'}</div>
                        {c.ownerName && <div className="text-[11px] text-ink-muted">PT: {c.ownerName}</div>}
                      </td>
                      <td className="td-cell text-xs whitespace-nowrap">
                        <div>Hiệu lực: {formatDate(c.startDate)}</div>
                        <div className="font-medium text-ink-primary">
                          Hết hạn: {c.endDate ? formatDate(c.endDate) : 'Không thời hạn'}
                        </div>
                        <div className="text-[11px] text-ink-muted">Nhắc trước {c.remindDaysBefore || 30} ngày</div>
                      </td>
                      <td className="td-cell font-mono text-xs font-semibold tabular-nums">{formatVnd(c.contractValue)}</td>
                      <td className="td-cell">
                        <Badge label={stMeta.label} cls={stMeta.cls} />
                        {c.daysRemaining != null && (
                          <div className={`text-[11px] mt-0.5 ${c.daysRemaining < 0 ? 'text-red-600 font-semibold' : c.isReminding ? 'text-amber-700 font-semibold' : 'text-ink-muted'}`}>
                            {c.daysRemaining < 0 ? `Quá hạn ${Math.abs(c.daysRemaining)} ngày` : `Còn ${c.daysRemaining} ngày`}
                          </div>
                        )}
                      </td>
                      <td className="td-cell text-right">
                        <Link to={`/contracts/${c.id}`} className="btn-secondary px-2.5 py-1 text-xs inline-flex">
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
          totalItems={pg.totalItems}
          page={pg.page}
          pageSize={pg.pageSize}
          onPageChange={pg.setPage}
          onPageSizeChange={pg.setPageSize}
          unitLabel="hợp đồng"
        />
      </div>
    </div>
  );
};
