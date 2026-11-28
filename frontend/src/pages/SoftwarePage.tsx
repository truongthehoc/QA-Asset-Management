import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, ShieldAlert, CheckCircle2, AlertTriangle, Eye, FileText } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, Badge } from '../components/UiPrimitives';
import { TablePagination, usePagination } from '../components/TablePagination';
import {
  formatDate,
  formatDateTime,
  formatVnd,
  LICENSE_STATUS_META,
  LICENSE_TYPE_META,
} from '../utils/format';

const LICENSE_STATUS_FILTERS = [
  { key: '', label: 'Tất cả' },
  { key: 'ACTIVE', label: 'Đang hiệu lực' },
  { key: 'EXPIRING_SOON', label: 'Sắp hết hạn' },
  { key: 'EXPIRED', label: 'Đã hết hạn' },
  { key: 'REVOKED', label: 'Đã thu hồi' },
] as const;

export const SoftwarePage: React.FC = () => {
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const resolveTab = (raw: string | null): 'licenses' | 'catalog' | 'windows' | 'check' => {
    if (raw === 'catalog' || raw === 'windows' || raw === 'check' || raw === 'licenses') return raw;
    return 'licenses';
  };
  const [tab, setTabState] = useState<'licenses' | 'catalog' | 'windows' | 'check'>(() =>
    resolveTab(searchParams.get('tab')),
  );
  const [licenses, setLicenses] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [windowsList, setWindowsList] = useState<any[]>([]);
  const [licenseStatusFilter, setLicenseStatusFilter] = useState(searchParams.get('status') || '');
  const [licenseSearch, setLicenseSearch] = useState('');
  const [search, setSearch] = useState('');

  const setTab = (next: 'licenses' | 'catalog' | 'windows' | 'check') => {
    setTabState(next);
    const params: Record<string, string> = {};
    if (next !== 'licenses') params.tab = next;
    else if (licenseStatusFilter) params.status = licenseStatusFilter;
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    const qTab = resolveTab(searchParams.get('tab'));
    const qStatus = searchParams.get('status') || '';
    setTabState(qTab);
    if (qStatus !== licenseStatusFilter) {
      setLicenseStatusFilter(qStatus);
    }
  }, [searchParams]);

  const load = async (q = '') => {
    const [lRes, cRes, wRes] = await Promise.all([
      api.get('/software/licenses'),
      api.get('/software/catalog', { params: q ? { search: q } : {} }),
      api.get('/software/windows'),
    ]);
    setLicenses(lRes.data || []);
    setCatalog(cRes.data || []);
    setWindowsList(wRes.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredLicenses = useMemo(() => {
    const q = licenseSearch.trim().toLowerCase();
    return licenses.filter((l) => {
      if (licenseStatusFilter && l.effectiveStatus !== licenseStatusFilter) return false;
      if (!q) return true;
      const hay = `${l.licenseCode} ${l.name} ${l.publisher || ''} ${l.contractNumber || ''} ${l.supplierName || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [licenses, licenseStatusFilter, licenseSearch]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { '': licenses.length };
    for (const l of licenses) {
      counts[l.effectiveStatus] = (counts[l.effectiveStatus] || 0) + 1;
    }
    return counts;
  }, [licenses]);

  const licensesPg = usePagination(filteredLicenses, 10);
  const catalogPg = usePagination(catalog, 10);
  const windowsPg = usePagination(windowsList, 10);

  const needCheckList = [
    ...licenses
      .filter((l) => l.effectiveStatus === 'EXPIRED' || l.effectiveStatus === 'EXPIRING_SOON')
      .map((l) => ({ type: 'LICENSE', item: l })),
    ...catalog.filter((s) => s.isUnauthorized).map((s) => ({ type: 'SOFTWARE', item: s })),
    ...windowsList.filter((w) => w.activationStatus !== 'ACTIVATED').map((w) => ({ type: 'WINDOWS', item: w })),
  ];

  const totalLicenseCost = licenses.reduce((s, l) => s + (l.purchasePrice || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Phần mềm & Bản quyền (License)"
        subtitle={`Quản lý vòng đời bản quyền phần mềm, hợp đồng, cấp phát/luân chuyển/thu hồi (Tổng giá trị: ${formatVnd(totalLicenseCost)}), phần mềm cài đặt và trạng thái Windows.`}
        actions={
          can('assets.create') && (
            <Link to="/software/licenses/new" className="btn-primary">
              <Plus className="w-4 h-4" /> Thêm bản quyền phần mềm
            </Link>
          )
        }
      />

      <div className="flex gap-1 border-b border-line overflow-x-auto">
        <button
          onClick={() => setTab('licenses')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
            tab === 'licenses' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'
          }`}
        >
          Bản quyền phần mềm ({licenses.length})
        </button>
        <button
          onClick={() => setTab('catalog')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
            tab === 'catalog' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'
          }`}
        >
          Phần mềm cài đặt ({catalog.length})
        </button>
        <button
          onClick={() => setTab('windows')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
            tab === 'windows' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'
          }`}
        >
          Trạng thái Windows ({windowsList.length})
        </button>
        <button
          onClick={() => setTab('check')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
            tab === 'check' ? 'border-brand text-brand' : 'border-transparent text-ink-secondary'
          }`}
        >
          Cần kiểm tra & Hết hạn ({needCheckList.length})
        </button>
      </div>

      {/* TAB 1: QUẢN LÝ BẢN QUYỀN PHẦN MỀM */}
      {tab === 'licenses' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-nowrap sm:flex-wrap gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              {LICENSE_STATUS_FILTERS.map((f) => {
                const active = licenseStatusFilter === f.key;
                const count = statusCounts[f.key] || 0;
                return (
                  <button
                    key={f.key || 'all'}
                    type="button"
                    onClick={() => {
                      setLicenseStatusFilter(f.key);
                      licensesPg.setPage(1);
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
                value={licenseSearch}
                onChange={(e) => {
                  setLicenseSearch(e.target.value);
                  licensesPg.setPage(1);
                }}
                placeholder="Tìm mã, tên phần mềm, số hợp đồng..."
                className="input-field pl-9 text-xs"
              />
            </div>
          </div>

          <div className="panel overflow-hidden">
            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-line">
              {licensesPg.totalItems === 0 ? (
                <div className="p-8 text-center text-xs text-ink-muted">
                  Chưa có bản quyền phần mềm nào.
                </div>
              ) : (
                licensesPg.paginated.map((l) => {
                  const tpMeta = LICENSE_TYPE_META[l.licenseType] || LICENSE_TYPE_META.SUBSCRIPTION;
                  const stMeta = LICENSE_STATUS_META[l.effectiveStatus] || LICENSE_STATUS_META.ACTIVE;
                  return (
                    <Link key={l.id} to={`/software/licenses/${l.id}`} className="block p-3.5 hover:bg-slate-50/70 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-brand">{l.licenseCode}</span>
                        <Badge label={stMeta.label} cls={stMeta.cls} />
                      </div>
                      <div className="text-xs font-semibold text-ink-primary">{l.name}</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-secondary">
                        <Badge label={tpMeta.label} cls={tpMeta.cls} />
                        <span className="font-mono font-medium">Suất: {l.usedSeats}/{l.totalSeats}</span>
                        <span>• HH: {l.expirationDate ? formatDate(l.expirationDate) : 'Vĩnh viễn'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-ink-muted pt-1 border-t border-slate-100">
                        <span>HĐ: {l.contractNumber || '—'}</span>
                        <span className="font-mono font-semibold text-ink-primary">{formatVnd(l.purchasePrice)}</span>
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
                    <th className="th-cell">Mã / Tên phần mềm</th>
                    <th className="th-cell">Loại bản quyền</th>
                    <th className="th-cell">Suất sử dụng</th>
                    <th className="th-cell">Hợp đồng / NCC</th>
                    <th className="th-cell">Mua / Kích hoạt / Hết hạn</th>
                    <th className="th-cell">Chi phí</th>
                    <th className="th-cell">Trạng thái</th>
                    <th className="th-cell text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {licensesPg.totalItems === 0 ? (
                    <tr>
                      <td colSpan={9} className="td-cell text-center text-ink-muted py-10">
                        Chưa có bản quyền phần mềm nào. Bấm <strong>Thêm bản quyền phần mềm</strong> để bắt đầu quản lý.
                      </td>
                    </tr>
                  ) : (
                    licensesPg.paginated.map((l, idx) => {
                      const tpMeta = LICENSE_TYPE_META[l.licenseType] || LICENSE_TYPE_META.SUBSCRIPTION;
                      const stMeta = LICENSE_STATUS_META[l.effectiveStatus] || LICENSE_STATUS_META.ACTIVE;
                      const pct = l.totalSeats > 0 ? Math.min(100, Math.round((l.usedSeats / l.totalSeats) * 100)) : 0;

                      return (
                        <tr key={l.id} className="hover:bg-slate-50/70">
                          <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">
                            {licensesPg.startIndex + idx + 1}
                          </td>
                          <td className="td-cell">
                            <Link
                              to={`/software/licenses/${l.id}`}
                              className="font-mono text-xs font-semibold text-brand hover:underline block"
                            >
                              {l.licenseCode}
                            </Link>
                            <div className="text-xs font-medium text-ink-primary">{l.name}</div>
                            {l.publisher && <div className="text-[11px] text-ink-muted">{l.publisher}{l.version ? ` · ${l.version}` : ''}</div>}
                          </td>
                          <td className="td-cell">
                            <Badge label={tpMeta.label} cls={tpMeta.cls} />
                          </td>
                          <td className="td-cell min-w-[120px]">
                            <div className="flex items-center justify-between text-xs font-mono tabular-nums mb-1">
                              <span className="font-semibold text-ink-primary">{l.usedSeats}/{l.totalSeats}</span>
                              <span className="text-[11px] text-ink-muted">Trống {l.availableSeats}</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct >= 95 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-brand'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </td>
                          <td className="td-cell text-xs">
                            <div className="font-mono font-medium text-ink-primary">{l.contractNumber || '—'}</div>
                            <div className="text-[11px] text-ink-muted">{l.supplierName || '—'}</div>
                            {(l._count?.documents || 0) > 0 && (
                              <div className="inline-flex items-center gap-1 text-[11px] text-brand mt-0.5">
                                <FileText className="w-3 h-3" /> {l._count.documents} chứng từ
                              </div>
                            )}
                          </td>
                          <td className="td-cell text-xs whitespace-nowrap">
                            <div>Mua: {formatDate(l.purchaseDate)}</div>
                            <div className="text-ink-secondary">KH: {formatDate(l.activationDate)}</div>
                            <div className="font-medium">
                              HH: {l.expirationDate ? formatDate(l.expirationDate) : 'Vĩnh viễn'}
                            </div>
                          </td>
                          <td className="td-cell font-mono text-xs font-medium tabular-nums">{formatVnd(l.purchasePrice)}</td>
                          <td className="td-cell">
                            <Badge label={stMeta.label} cls={stMeta.cls} />
                            {l.daysRemaining != null && (
                              <div className={`text-[11px] mt-0.5 ${l.daysRemaining < 0 ? 'text-red-600' : l.daysRemaining <= 30 ? 'text-amber-700' : 'text-ink-muted'}`}>
                                {l.daysRemaining < 0 ? `Quá hạn ${Math.abs(l.daysRemaining)} ngày` : `Còn ${l.daysRemaining} ngày`}
                              </div>
                            )}
                          </td>
                          <td className="td-cell text-right">
                            <Link to={`/software/licenses/${l.id}`} className="btn-secondary px-2.5 py-1 text-xs inline-flex">
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
              totalItems={licensesPg.totalItems}
              page={licensesPg.page}
              pageSize={licensesPg.pageSize}
              onPageChange={licensesPg.setPage}
              onPageSizeChange={licensesPg.setPageSize}
              unitLabel="bản quyền"
            />
          </div>
        </div>
      )}

      {/* TAB 2: PHẦN MỀM CÀI ĐẶT (AGENT) */}
      {tab === 'catalog' && (
        <div className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load(search);
            }}
            className="panel p-3 flex gap-2 max-w-lg"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên phần mềm hoặc nhà phát hành..." className="input-field pl-9" />
            </div>
            <button type="submit" className="btn-secondary">Tìm</button>
          </form>

          <div className="panel overflow-hidden">
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-line">
              {catalogPg.paginated.map((s) => (
                <div key={s.displayName} className={`p-3.5 space-y-2 ${s.isUnauthorized ? 'bg-red-50/40' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-ink-primary">{s.displayName}</div>
                      <div className="text-[11px] text-ink-muted">{s.publisher}</div>
                    </div>
                    {s.isUnauthorized ? (
                      <Badge label="Không được phép" cls="bg-red-50 text-red-700 border-red-200" />
                    ) : (
                      <Badge label="Cho phép" cls="bg-emerald-50 text-emerald-700 border-emerald-200" />
                    )}
                  </div>
                  <div className="text-[11px] text-ink-secondary font-mono">
                    Phiên bản: {s.versions.join(', ') || '—'} · <strong>{s.installCount} máy</strong>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {s.devices.map((d: any, dIdx: number) =>
                      d.assetId ? (
                        <Link key={dIdx} to={`/assets/${d.assetId}`} className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-brand">
                          {d.assetCode}
                        </Link>
                      ) : (
                        <span key={dIdx} className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">{d.hostname}</span>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th-cell w-12 text-center">STT</th>
                    <th className="th-cell">Tên phần mềm</th>
                    <th className="th-cell">Nhà phát hành</th>
                    <th className="th-cell">Phiên bản phát hiện</th>
                    <th className="th-cell">Số máy cài</th>
                    <th className="th-cell">Thiết bị cài đặt</th>
                    <th className="th-cell">Chính sách</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogPg.paginated.map((s, idx) => (
                    <tr key={s.displayName} className={s.isUnauthorized ? 'bg-red-50/40' : 'hover:bg-slate-50/70'}>
                      <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{catalogPg.startIndex + idx + 1}</td>
                      <td className="td-cell font-medium">{s.displayName}</td>
                      <td className="td-cell text-xs text-ink-secondary">{s.publisher}</td>
                      <td className="td-cell font-mono text-xs">{s.versions.join(', ') || '—'}</td>
                      <td className="td-cell font-mono font-semibold tabular-nums">{s.installCount}</td>
                      <td className="td-cell text-xs">
                        <div className="flex flex-wrap gap-1">
                          {s.devices.map((d: any, dIdx: number) =>
                            d.assetId ? (
                              <Link key={dIdx} to={`/assets/${d.assetId}`} className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 text-brand">
                                {d.assetCode}
                              </Link>
                            ) : (
                              <span key={dIdx} className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">{d.hostname}</span>
                            ),
                          )}
                        </div>
                      </td>
                      <td className="td-cell">
                        {s.isUnauthorized ? (
                          <Badge label="Không được phép" cls="bg-red-50 text-red-700 border-red-200" />
                        ) : (
                          <Badge label="Cho phép" cls="bg-emerald-50 text-emerald-700 border-emerald-200" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              totalItems={catalogPg.totalItems}
              page={catalogPg.page}
              pageSize={catalogPg.pageSize}
              onPageChange={catalogPg.setPage}
              onPageSizeChange={catalogPg.setPageSize}
              unitLabel="phần mềm"
            />
          </div>
        </div>
      )}

      {/* TAB 3: TRẠNG THÁI WINDOWS */}
      {tab === 'windows' && (
        <div className="panel overflow-hidden">
          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-line">
            {windowsPg.paginated.map((w) => (
              <div key={w.agentId} className="p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    {w.assetId ? (
                      <Link to={`/assets/${w.assetId}`} className="font-mono text-xs font-bold text-brand hover:underline">
                        {w.assetCode}
                      </Link>
                    ) : (
                      <span className="text-xs text-amber-700 font-medium">Chưa duyệt</span>
                    )}
                    <span className="font-mono text-xs text-ink-muted ml-1.5">({w.hostname})</span>
                  </div>
                  {w.activationStatus === 'ACTIVATED' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Activated
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                      <AlertTriangle className="w-3.5 h-3.5" /> {w.activationStatus}
                    </span>
                  )}
                </div>
                <div className="text-xs font-medium text-ink-primary">{w.productName} ({w.architecture})</div>
                <div className="text-[11px] text-ink-secondary font-mono">
                  {w.version} / {w.buildNumber} • {w.licenseChannel} • *****-{w.partialProductKey}
                </div>
                <div className="flex items-center justify-between text-[11px] text-ink-muted">
                  <span>{w.department}</span>
                  <span>{formatDateTime(w.checkedAt)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th-cell w-12 text-center">STT</th>
                  <th className="th-cell">Tài sản / Hostname</th>
                  <th className="th-cell">Phòng ban</th>
                  <th className="th-cell">Hệ điều hành</th>
                  <th className="th-cell">Version / Build</th>
                  <th className="th-cell">Kênh / Partial Key</th>
                  <th className="th-cell">Trạng thái kích hoạt</th>
                  <th className="th-cell">Kiểm tra gần nhất</th>
                </tr>
              </thead>
              <tbody>
                {windowsPg.paginated.map((w, idx) => (
                  <tr key={w.agentId} className="hover:bg-slate-50/70">
                    <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">{windowsPg.startIndex + idx + 1}</td>
                    <td className="td-cell">
                      {w.assetId ? (
                        <Link to={`/assets/${w.assetId}`} className="font-mono text-xs font-semibold text-brand hover:underline block">{w.assetCode}</Link>
                      ) : (
                        <span className="text-xs text-amber-700 font-medium">Chưa duyệt</span>
                      )}
                      <span className="font-mono text-xs text-ink-muted">{w.hostname}</span>
                    </td>
                    <td className="td-cell text-xs">{w.department}</td>
                    <td className="td-cell text-xs font-medium">{w.productName} ({w.architecture})</td>
                    <td className="td-cell font-mono text-xs">{w.version} / {w.buildNumber}</td>
                    <td className="td-cell font-mono text-xs">{w.licenseChannel} • *****-{w.partialProductKey}</td>
                    <td className="td-cell">
                      {w.activationStatus === 'ACTIVATED' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Activated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                          <AlertTriangle className="w-3.5 h-3.5" /> {w.activationStatus}
                        </span>
                      )}
                    </td>
                    <td className="td-cell text-xs text-ink-secondary">{formatDateTime(w.checkedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            totalItems={windowsPg.totalItems}
            page={windowsPg.page}
            pageSize={windowsPg.pageSize}
            onPageChange={windowsPg.setPage}
            onPageSizeChange={windowsPg.setPageSize}
            unitLabel="máy tính"
          />
        </div>
      )}

      {/* TAB 4: CẦN KIỂM TRA & HẾT HẠN */}
      {tab === 'check' && (
        <div className="space-y-3">
          {needCheckList.length === 0 ? (
            <div className="panel p-8 text-center text-sm text-emerald-700">
              Không phát hiện bản quyền hết hạn, phần mềm vi phạm chính sách hay Windows chưa kích hoạt.
            </div>
          ) : (
            needCheckList.map((entry, idx) => (
              <div key={idx} className="panel p-4 flex items-start justify-between gap-4 border-l-4 border-l-red-500">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    {entry.type === 'LICENSE' ? (
                      <>
                        <div className="text-sm font-semibold text-ink-primary">
                          Bản quyền {entry.item.effectiveStatus === 'EXPIRED' ? 'đã hết hạn' : 'sắp hết hạn'}:{' '}
                          <Link to={`/software/licenses/${entry.item.id}`} className="text-brand hover:underline">
                            {entry.item.licenseCode} — {entry.item.name}
                          </Link>
                        </div>
                        <div className="text-xs text-ink-secondary mt-0.5">
                          Hết hạn: {formatDate(entry.item.expirationDate)} • Đang dùng {entry.item.usedSeats}/{entry.item.totalSeats} suất • HĐ: {entry.item.contractNumber || '—'}
                        </div>
                      </>
                    ) : entry.type === 'SOFTWARE' ? (
                      <>
                        <div className="text-sm font-semibold text-ink-primary">Phần mềm cần kiểm tra: {entry.item.displayName}</div>
                        <div className="text-xs text-ink-secondary mt-0.5">
                          Cài trên {entry.item.installCount} máy ({entry.item.devices.map((d: any) => `${d.assetCode} / ${d.hostname}`).join(', ')})
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-semibold text-ink-primary">Windows chưa kích hoạt trên {entry.item.assetCode} ({entry.item.hostname})</div>
                        <div className="text-xs text-ink-secondary mt-0.5">
                          {entry.item.productName} {entry.item.version} • Trạng thái: {entry.item.activationStatus} • Phòng ban: {entry.item.department}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
