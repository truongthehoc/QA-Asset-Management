import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Download,
  QrCode,
  AlertTriangle,
  Paperclip,
  Printer,
  HardDrive,
  CheckCircle2,
  PackageOpen,
  Wrench,
  Wifi,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  ArrowLeftRight,
  UserCheck,
  RotateCcw,
  Building2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api, downloadAuthorizedFile } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useAssetStatuses } from '../contexts/AssetStatusContext';
import { PageHeader, Modal, AssetStatusBadge, AgentStatusBadge } from '../components/UiPrimitives';
import { AssetQrLabel } from '../components/AssetQrLabel';
import { formatVnd, formatDate } from '../utils/format';

const QUICK_TRANSFER_REASONS = [
  'Điều chuyển nhân sự',
  'Luân chuyển phòng ban',
  'Nâng cấp / Đổi thiết bị',
  'Bàn giao sử dụng mới',
];

const QUICK_RETURN_REASONS = [
  'Nhân sự nghỉ việc / Thu hồi',
  'Không còn nhu cầu sử dụng',
  'Thu hồi về kho kiểm tra / bảo trì',
  'Đổi sang thiết bị mới',
];

export const AssetsPage: React.FC = () => {
  const { can } = useAuth();
  const { statuses: assetStatusList, activeStatuses, statusMap } = useAssetStatuses();
  const getStatusInfo = (code: string) => {
    const found = statusMap[code];
    return {
      label: found?.name || code,
      bgColor: found?.bgColor || '#F1F5F9',
      textColor: found?.textColor || '#334155',
    };
  };
  const [searchParams] = useSearchParams();
  const [assets, setAssets] = useState<any[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ departments: [], assetTypes: [], locations: [], suppliers: [], employees: [] });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [typeFilter, setTypeFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  // QR Print Modal
  const [qrAsset, setQrAsset] = useState<any>(null);

  // Quick Assign / Transfer / Return Modal
  const [actionAsset, setActionAsset] = useState<any>(null);
  const [actionMode, setActionMode] = useState<'HANDOVER' | 'TRANSFER' | 'RETURN'>('HANDOVER');
  const [actionSaving, setActionSaving] = useState(false);
  const [actionErr, setActionErr] = useState('');
  const [empQuery, setEmpQuery] = useState('');
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
  const empBoxRef = useRef<HTMLDivElement>(null);
  const [actionForm, setActionForm] = useState({
    employeeId: '',
    departmentId: '',
    locationId: '',
    locationDetail: '',
    reason: '',
    notes: '',
  });

  const loadSummary = async () => {
    try {
      const res = await api.get('/assets');
      setAllAssets(res.data || []);
    } catch {
      // ignore
    }
  };

  const loadAssets = async (searchQuery = debouncedSearch, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params: any = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.assetTypeId = typeFilter;
      if (deptFilter) params.departmentId = deptFilter;
      const res = await api.get('/assets', { params });
      setAssets(res.data || []);
      if (!silent) setCurrentPage(1);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/admin/meta').then((r) => setMeta(r.data));
    loadSummary();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (empBoxRef.current && !empBoxRef.current.contains(e.target as Node)) {
        setEmpDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const employees: any[] = meta.employees || [];
  const deptNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of meta.departments || []) map.set(d.id, d.name);
    return map;
  }, [meta.departments]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === actionForm.employeeId) || null,
    [employees, actionForm.employeeId],
  );

  const filteredEmployees = useMemo(() => {
    const q = empQuery.trim().toLowerCase();
    if (!q) return employees.slice(0, 30);
    return employees
      .filter((e) => {
        const dName = e.department?.name || deptNameById.get(e.departmentId) || '';
        return (
          (e.fullName || '').toLowerCase().includes(q) ||
          (e.code || '').toLowerCase().includes(q) ||
          dName.toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [employees, empQuery, deptNameById]);

  const openActionModal = (asset: any) => {
    const hasHolder = Boolean(asset.usingDepartmentId || asset.assignedEmployeeId || asset.assignedUserName);
    setActionAsset(asset);
    setActionMode(hasHolder ? 'TRANSFER' : 'HANDOVER');
    setActionErr('');
    setEmpQuery('');
    setEmpDropdownOpen(false);
    setActionForm({
      employeeId: '',
      departmentId: '',
      locationId: asset.locationId || '',
      locationDetail: asset.locationDetail || '',
      reason: '',
      notes: '',
    });
  };

  const resolveDeptLocationId = (deptId?: string | null) => {
    if (!deptId) return '';
    const dept = (meta.departments || []).find((d: any) => d.id === deptId);
    return dept?.locationId || dept?.location?.id || '';
  };

  const handleSelectActionEmployee = (emp: any) => {
    const nextDeptId = emp.departmentId || '';
    const mappedLocId = emp.department?.locationId || resolveDeptLocationId(nextDeptId);
    setActionForm((prev) => ({
      ...prev,
      employeeId: emp.id,
      departmentId: nextDeptId || prev.departmentId,
      locationId: mappedLocId || prev.locationId,
    }));
    setEmpQuery(`${emp.code} — ${emp.fullName}`);
    setEmpDropdownOpen(false);
  };

  const handleActionDeptChange = (deptId: string) => {
    const mappedLocId = resolveDeptLocationId(deptId);
    setActionForm((prev) => ({
      ...prev,
      departmentId: deptId,
      locationId: mappedLocId || prev.locationId,
    }));
  };

  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionAsset) return;
    setActionErr('');
    if (actionMode !== 'RETURN' && !actionForm.employeeId && !actionForm.departmentId) {
      setActionErr('Vui lòng chọn nhân viên hoặc phòng ban tiếp nhận.');
      return;
    }
    if ((actionMode === 'TRANSFER' || actionMode === 'RETURN') && !actionForm.reason.trim()) {
      setActionErr('Vui lòng nhập hoặc chọn lý do điều chuyển / thu hồi.');
      return;
    }
    const pickedLoc = (meta.locations || []).find((l: any) => l.id === actionForm.locationId);
    const resolvedLocationText = actionForm.locationDetail.trim() || pickedLoc?.name || undefined;
    setActionSaving(true);
    try {
      if (actionMode === 'HANDOVER') {
        await api.post('/transfers/handover', {
          assetId: actionAsset.id,
          employeeId: actionForm.employeeId || undefined,
          departmentId: actionForm.departmentId || undefined,
          assigneeName: selectedEmployee?.fullName || undefined,
          locationId: actionForm.locationId || undefined,
          locationDetail: resolvedLocationText,
          notes: actionForm.notes.trim() || undefined,
        });
        setNotice({
          type: 'ok',
          text: `Đã cấp phát tài sản "${actionAsset.assetCode}" cho ${selectedEmployee?.fullName || deptNameById.get(actionForm.departmentId) || 'đơn vị tiếp nhận'}.`,
        });
      } else if (actionMode === 'RETURN') {
        await api.post('/transfers', {
          assetId: actionAsset.id,
          mode: 'RETURN',
          reason: actionForm.reason.trim(),
          notes: actionForm.notes.trim() || undefined,
        });
        setNotice({
          type: 'err',
          text: `Đã thu hồi tài sản "${actionAsset.assetCode}" về Kho IT (Chưa phân bổ).`,
        });
      } else {
        await api.post('/transfers', {
          assetId: actionAsset.id,
          employeeId: actionForm.employeeId || undefined,
          toDepartmentId: actionForm.departmentId || undefined,
          toUserName: selectedEmployee?.fullName || undefined,
          toLocationId: actionForm.locationId || undefined,
          toLocation: resolvedLocationText,
          reason: actionForm.reason.trim(),
          notes: actionForm.notes.trim() || undefined,
        });
        setNotice({
          type: 'ok',
          text: `Đã điều chuyển tài sản "${actionAsset.assetCode}" sang ${selectedEmployee?.fullName || deptNameById.get(actionForm.departmentId) || 'đơn vị mới'}.`,
        });
      }
      setActionAsset(null);
      loadSummary();
      loadAssets(debouncedSearch, true);
    } catch (err: any) {
      setActionErr(err.response?.data?.message || 'Không thể thực hiện thao tác cấp phát / điều chuyển.');
    } finally {
      setActionSaving(false);
    }
  };

  const handleQuickStatusChange = async (asset: any, nextStatus: string) => {
    if (!nextStatus || nextStatus === asset.status || updatingStatusId) return;
    setUpdatingStatusId(asset.id);
    try {
      await api.patch(`/assets/${asset.id}`, {
        status: nextStatus,
        reason: 'Cập nhật nhanh trạng thái tại danh sách tài sản',
      });
      const info = getStatusInfo(nextStatus);
      const isAlertStatus = ['BROKEN', 'LOST', 'DISPOSED'].includes(nextStatus);
      setNotice({
        type: isAlertStatus ? 'err' : 'ok',
        text: `Đã chuyển trạng thái "${asset.assetCode}" sang "${info.label}".`,
      });
      loadSummary();
      loadAssets(debouncedSearch, true);
    } catch (err: any) {
      setNotice({
        type: 'err',
        text: err.response?.data?.message || 'Không thể cập nhật trạng thái tài sản.',
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  useEffect(() => {
    const q = searchParams.get('search') || '';
    setSearch(q);
    setDebouncedSearch(q);
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadAssets(debouncedSearch);
    const onRealtime = () => {
      loadSummary();
      loadAssets(debouncedSearch, true);
    };
    window.addEventListener('itam:realtime-update', onRealtime);
    return () => window.removeEventListener('itam:realtime-update', onRealtime);
  }, [debouncedSearch, statusFilter, typeFilter, deptFilter]);

  const stats = useMemo(() => {
    const src = allAssets;
    const total = src.length;
    let inUse = 0;
    let unallocated = 0;
    let maintenance = 0;
    let broken = 0;
    let agentOnline = 0;
    let agentOffline = 0;
    let noAgent = 0;
    let totalValue = 0;

    for (const a of src) {
      if (a.status === 'IN_USE') inUse++;
      else if (a.status === 'UNALLOCATED') unallocated++;
      else if (a.status === 'MAINTENANCE') maintenance++;
      else if (a.status === 'BROKEN') broken++;

      const price = Number(a.purchase?.purchasePrice || 0);
      if (!Number.isNaN(price)) totalValue += price;

      const ag = a.agents?.[0];
      if (!ag) noAgent++;
      else if (ag.status === 'ONLINE') agentOnline++;
      else agentOffline++;
    }

    const inUsePct = total > 0 ? Math.round((inUse / total) * 100) : 0;
    return {
      total,
      inUse,
      inUsePct,
      unallocated,
      maintenance,
      broken,
      agentOnline,
      agentOffline,
      noAgent,
      totalValue,
    };
  }, [allAssets]);

  const totalPages = Math.max(1, Math.ceil(assets.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedAssets = useMemo(
    () => assets.slice(startIndex, startIndex + pageSize),
    [assets, startIndex, pageSize],
  );

  const goToPage = (page: number) => {
    const next = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(next);
    tableScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('ellipsis');
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  }, [safePage, totalPages]);

  const statCards = [
    {
      key: 'ALL',
      label: 'Tổng số tài sản',
      value: stats.total,
      sub: formatVnd(stats.totalValue),
      icon: HardDrive,
      bg: 'bg-gradient-to-br from-[#eef8fc] via-white to-[#dff1f8]',
      border: 'border-sky-200/80',
      activeRing: 'border-[#006E96] ring-2 ring-[#006E96]/20',
      iconBox: 'bg-[#006E96]/12 text-[#006E96]',
      watermark: 'text-[#006E96]',
      orb: 'bg-[#006E96]/10',
      accentBar: 'bg-[#006E96]',
      active: statusFilter === '',
      onClick: () => setStatusFilter(''),
    },
    {
      key: 'IN_USE',
      label: 'Đang sử dụng',
      value: stats.inUse,
      sub: `${stats.inUsePct}% tổng tài sản`,
      icon: CheckCircle2,
      bg: 'bg-gradient-to-br from-emerald-50 via-white to-teal-50/90',
      border: 'border-emerald-200/80',
      activeRing: 'border-emerald-600 ring-2 ring-emerald-500/20',
      iconBox: 'bg-emerald-500/12 text-emerald-700',
      watermark: 'text-emerald-600',
      orb: 'bg-emerald-500/10',
      accentBar: 'bg-emerald-500',
      active: statusFilter === 'IN_USE',
      onClick: () => setStatusFilter((s) => (s === 'IN_USE' ? '' : 'IN_USE')),
    },
    {
      key: 'UNALLOCATED',
      label: 'Chưa phân bổ',
      value: stats.unallocated,
      sub: 'Sẵn sàng cấp phát tại kho',
      icon: PackageOpen,
      bg: 'bg-gradient-to-br from-indigo-50/80 via-white to-sky-50/90',
      border: 'border-indigo-200/80',
      activeRing: 'border-indigo-600 ring-2 ring-indigo-500/20',
      iconBox: 'bg-indigo-500/12 text-indigo-700',
      watermark: 'text-indigo-600',
      orb: 'bg-indigo-500/10',
      accentBar: 'bg-indigo-500',
      active: statusFilter === 'UNALLOCATED',
      onClick: () => setStatusFilter((s) => (s === 'UNALLOCATED' ? '' : 'UNALLOCATED')),
    },
    {
      key: 'MAINTENANCE',
      label: 'Sửa chữa / Hư hỏng',
      value: stats.maintenance + stats.broken,
      sub: `Sửa chữa: ${stats.maintenance} · Hư hỏng: ${stats.broken}`,
      icon: Wrench,
      bg: 'bg-gradient-to-br from-amber-50 via-white to-orange-50/85',
      border: 'border-amber-200/80',
      activeRing: 'border-amber-600 ring-2 ring-amber-500/20',
      iconBox: 'bg-amber-500/15 text-amber-700',
      watermark: 'text-amber-600',
      orb: 'bg-amber-500/10',
      accentBar: 'bg-amber-500',
      active: statusFilter === 'MAINTENANCE',
      onClick: () => setStatusFilter((s) => (s === 'MAINTENANCE' ? '' : 'MAINTENANCE')),
    },
    {
      key: 'AGENT',
      label: 'Agent trực tuyến',
      value: stats.agentOnline,
      sub: `Ngoại tuyến: ${stats.agentOffline} · Chưa cài: ${stats.noAgent}`,
      icon: Wifi,
      bg: 'bg-gradient-to-br from-teal-50/90 via-white to-cyan-50/85',
      border: 'border-teal-200/80',
      activeRing: 'border-teal-600 ring-2 ring-teal-500/20',
      iconBox: 'bg-teal-500/12 text-teal-700',
      watermark: 'text-teal-600',
      orb: 'bg-teal-500/10',
      accentBar: 'bg-teal-500',
      active: false,
      onClick: undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-3.5 lg:h-[calc(100vh-3.5rem-3rem)] lg:min-h-[520px] lg:overflow-hidden">
      <PageHeader
        className="mb-0 shrink-0"
        title="Quản lý tài sản"
        subtitle="Danh mục tài sản chính thức, thông tin mua sắm, bảo hành, hồ sơ đính kèm và trạng thái liên kết Windows Agent."
        actions={
          <>
            <button
              onClick={() => downloadAuthorizedFile('/reports/export?type=assets', 'danh-sach-tai-san.csv')}
              className="btn-secondary"
            >
              <Download className="w-4 h-4" /> Xuất Excel/CSV
            </button>
            {can('assets.write') && (
              <Link to="/assets/new" className="btn-primary">
                <Plus className="w-4 h-4" /> Thêm tài sản thủ công
              </Link>
            )}
          </>
        }
      />

      {/* Asset Statistics Cards */}
      {notice && (
        <div
          className={`p-3 rounded-md border text-sm flex items-center gap-2 shrink-0 ${
            notice.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {notice.type === 'err' && <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
        {statCards.map((c) => {
          const Icon = c.icon;
          const interactive = Boolean(c.onClick);
          return (
            <button
              key={c.key}
              type="button"
              onClick={c.onClick}
              disabled={!interactive}
              className={`relative overflow-hidden rounded-lg border p-3.5 text-left transition-all flex flex-col justify-between shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
                c.bg
              } ${c.active ? c.activeRing : c.border} ${
                interactive ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-sm' : 'cursor-default'
              }`}
            >
              {/* Subtle top accent bar */}
              <span className={`absolute inset-x-0 top-0 h-[3px] ${c.accentBar} ${c.active ? 'opacity-100' : 'opacity-65'}`} />

              {/* Decorative geometric orbs & subtle dot pattern */}
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute -right-5 -top-5 w-20 h-20 rounded-full ${c.orb}`}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.22]"
                style={{
                  backgroundImage: 'radial-gradient(currentColor 0.75px, transparent 0.75px)',
                  backgroundSize: '12px 12px',
                  color: '#94a3b8',
                }}
              />
              <Icon
                aria-hidden="true"
                className={`pointer-events-none absolute -right-2 -bottom-2.5 w-16 h-16 opacity-[0.09] ${c.watermark}`}
                strokeWidth={1.5}
              />

              <div className="relative z-10 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink-secondary truncate">{c.label}</span>
                <span className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${c.iconBox}`}>
                  <Icon className="w-4 h-4" />
                </span>
              </div>
              <div className="relative z-10 mt-1.5 text-2xl font-bold text-ink-primary tabular-nums leading-tight">
                {c.value}
              </div>
              <div className="relative z-10 text-[11px] text-ink-secondary/85 mt-1 truncate tabular-nums">{c.sub}</div>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="panel p-3 flex flex-wrap items-center gap-2.5 shrink-0">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã tài sản, serial, hostname, model, người sử dụng..."
            className="input-field pl-9 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
              title="Xóa từ khóa"
              aria-label="Xóa từ khóa"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field w-full sm:w-44">
          <option value="">Tất cả loại</option>
          {meta.assetTypes.map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="input-field w-full sm:w-48">
          <option value="">Tất cả phòng ban</option>
          {meta.departments.map((d: any) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field w-full sm:w-44">
          <option value="">Tất cả trạng thái</option>
          {assetStatusList.length > 0 ? (
            assetStatusList.map((s) => (
              <option key={s.id} value={s.code}>
                {s.name}{!s.isActive ? ' (Ngưng)' : ''}
              </option>
            ))
          ) : (
            <>
              <option value="IN_USE">Đang sử dụng</option>
              <option value="UNALLOCATED">Chưa phân bổ</option>
              <option value="MAINTENANCE">Đang sửa chữa</option>
              <option value="BROKEN">Hư hỏng</option>
              <option value="DISPOSED">Đã thanh lý</option>
            </>
          )}
        </select>
      </div>

      {/* Assets Table (Desktop) + Card List (Mobile) */}
      <div className="panel flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="py-10 text-center text-xs text-ink-muted">Đang tải danh sách tài sản...</div>
          ) : paginatedAssets.length === 0 ? (
            <div className="py-10 text-center text-xs text-ink-muted">Không tìm thấy tài sản phù hợp bộ lọc.</div>
          ) : (
            paginatedAssets.map((a) => {
              const ag = a.agents?.[0];
              const hasHolder = Boolean(a.usingDepartmentId || a.assignedEmployeeId || a.assignedUserName);
              const info = getStatusInfo(a.status);
              const statusOptions = activeStatuses.length > 0 ? activeStatuses : assetStatusList;
              const hasCurrent = statusOptions.some((s) => s.code === a.status);
              return (
                <div key={a.id} className="p-3.5 space-y-2.5 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/assets/${a.id}`} className="font-mono text-xs font-bold text-brand hover:underline block">
                        {a.assetCode}
                      </Link>
                      <Link to={`/assets/${a.id}`} className="text-sm font-semibold text-ink-primary truncate block">
                        {a.name}
                      </Link>
                      <div className="text-[11px] text-ink-muted truncate">
                        {a.assetType?.name || '—'}
                        {a.serialNumber ? ` · SN: ${a.serialNumber}` : ''}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {can('assets.update') ? (
                        <select
                          value={a.status}
                          disabled={updatingStatusId === a.id}
                          onChange={(e) => handleQuickStatusChange(a, e.target.value)}
                          style={{
                            backgroundColor: info.bgColor,
                            color: info.textColor,
                            borderColor: `${info.textColor}33`,
                          }}
                          className="px-2 py-0.5 rounded border text-[11px] font-medium focus:outline-none"
                        >
                          {!hasCurrent && <option value={a.status}>{info.label}</option>}
                          {statusOptions.map((s) => (
                            <option key={s.id} value={s.code} style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <AssetStatusBadge status={a.status} />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/80 rounded-md p-2 border border-slate-100">
                    <div className="min-w-0">
                      <div className="text-[10px] text-ink-muted">Phòng ban / Người dùng</div>
                      <div className="font-medium text-ink-primary truncate">{a.usingDepartment?.name || 'Kho / Chưa phân bổ'}</div>
                      <div className="text-[11px] text-ink-secondary truncate">
                        {a.assignedEmployee
                          ? `${a.assignedEmployee.code} — ${a.assignedEmployee.fullName}`
                          : a.assignedUserName || '—'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-ink-muted mb-0.5">Agent / Giá trị</div>
                      <div className="flex justify-end">
                        {ag ? <AgentStatusBadge status={ag.status} /> : <span className="text-[11px] text-ink-muted">Không có Agent</span>}
                      </div>
                      <div className="text-[11px] font-medium tabular-nums mt-0.5">{formatVnd(a.purchase?.purchasePrice)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-0.5">
                    {can('transfers.manage') && a.status !== 'DISPOSED' && (
                      <Link
                        to={`/transfers/new?assetId=${a.id}`}
                        className={`btn-secondary px-2.5 py-1.5 text-xs ${
                          hasHolder
                            ? 'bg-sky-50 border-sky-200 text-[#006E96]'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}
                      >
                        {hasHolder ? <ArrowLeftRight className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        <span>{hasHolder ? 'Điều chuyển' : 'Cấp phát'}</span>
                      </Link>
                    )}
                    <button onClick={() => setQrAsset(a)} className="btn-secondary px-2.5 py-1.5 text-xs">
                      <QrCode className="w-3.5 h-3.5" /> QR
                    </button>
                    <Link to={`/assets/${a.id}`} className="btn-primary px-3 py-1.5 text-xs">
                      Chi tiết
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div ref={tableScrollRef} className="hidden md:block flex-1 min-h-0 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="th-cell w-12 text-center">STT</th>
                <th className="th-cell">Mã tài sản</th>
                <th className="th-cell">Tên tài sản & Thiết bị</th>
                <th className="th-cell">Loại</th>
                <th className="th-cell">Phòng ban / Người dùng</th>
                <th className="th-cell">Trạng thái</th>
                <th className="th-cell">Agent</th>
                <th className="th-cell">Bảo hành / Giá trị</th>
                <th className="th-cell text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="td-cell text-center py-10 text-ink-muted">
                    Đang tải danh sách tài sản...
                  </td>
                </tr>
              ) : paginatedAssets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="td-cell text-center py-10 text-ink-muted">
                    Không tìm thấy tài sản phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                paginatedAssets.map((a, idx) => {
                  const ag = a.agents?.[0];
                  const pendingDrift = a._count?.deviceChanges || 0;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/70">
                      <td className="td-cell text-center font-mono text-xs text-ink-muted tabular-nums">
                        {startIndex + idx + 1}
                      </td>
                      <td className="td-cell">
                        <Link to={`/assets/${a.id}`} className="font-mono text-xs font-semibold text-brand hover:underline block">
                          {a.assetCode}
                        </Link>
                        <span className="text-[11px] text-ink-muted">
                          {a.codeMode === 'MANUAL' ? 'Mã thủ công' : 'Tự sinh'}
                        </span>
                      </td>
                      <td className="td-cell">
                        <Link to={`/assets/${a.id}`} className="font-medium text-ink-primary hover:text-brand block">
                          {a.name}
                        </Link>
                        <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5 flex-wrap">
                          {a.hostname && <span className="font-mono">{a.hostname}</span>}
                          {a.serialNumber && <span className="font-mono">SN: {a.serialNumber}</span>}
                          {a._count?.documents > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-slate-500">
                              <Paperclip className="w-3 h-3" /> {a._count.documents}
                            </span>
                          )}
                          {pendingDrift > 0 && (
                            <span className="inline-flex items-center gap-1 text-orange-700 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" /> {pendingDrift} sai lệch Baseline
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="td-cell text-xs">
                        <span className="font-mono font-semibold text-ink-secondary mr-1">{a.assetType?.code}</span>
                        <span>{a.assetType?.name}</span>
                      </td>
                      <td className="td-cell text-xs">
                        <div className="font-medium text-ink-primary">{a.usingDepartment?.name || 'Kho / Chưa phân bổ'}</div>
                        <div className="text-ink-muted">
                          {a.assignedEmployee
                            ? `${a.assignedEmployee.code} — ${a.assignedEmployee.fullName}`
                            : a.assignedUserName || '—'}
                        </div>
                      </td>
                      <td className="td-cell">
                        {can('assets.update') ? (
                          (() => {
                            const info = getStatusInfo(a.status);
                            const options = activeStatuses.length > 0 ? activeStatuses : assetStatusList;
                            const hasCurrent = options.some((s) => s.code === a.status);
                            return (
                              <select
                                value={a.status}
                                disabled={updatingStatusId === a.id}
                                onChange={(e) => handleQuickStatusChange(a, e.target.value)}
                                title="Cập nhật nhanh trạng thái tài sản"
                                style={{
                                  backgroundColor: info.bgColor,
                                  color: info.textColor,
                                  borderColor: `${info.textColor}33`,
                                }}
                                className="px-2 py-0.5 rounded border text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50"
                              >
                                {!hasCurrent && <option value={a.status}>{info.label}</option>}
                                {options.map((s) => (
                                  <option key={s.id} value={s.code} style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            );
                          })()
                        ) : (
                          <AssetStatusBadge status={a.status} />
                        )}
                      </td>
                      <td className="td-cell">
                        {ag ? (
                          <AgentStatusBadge status={ag.status} />
                        ) : (
                          <span className="text-xs text-ink-muted">Không có Agent</span>
                        )}
                      </td>
                      <td className="td-cell text-xs tabular-nums">
                        <div className="font-medium">{formatVnd(a.purchase?.purchasePrice)}</div>
                        <div className="text-ink-muted">BH: {formatDate(a.purchase?.warrantyEndDate)}</div>
                      </td>
                      <td className="td-cell text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {can('transfers.manage') && a.status !== 'DISPOSED' && (() => {
                            const hasHolder = Boolean(a.usingDepartmentId || a.assignedEmployeeId || a.assignedUserName);
                            return (
                              <Link
                                to={`/transfers/new?assetId=${a.id}`}
                                className={`btn-secondary p-1.5 ${
                                  hasHolder
                                    ? 'bg-sky-50 border-sky-200 text-[#006E96] hover:bg-sky-100'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                }`}
                                title={hasHolder ? 'Điều chuyển / Thu hồi tài sản' : 'Cấp phát tài sản'}
                              >
                                {hasHolder ? (
                                  <ArrowLeftRight className="w-3.5 h-3.5" />
                                ) : (
                                  <UserCheck className="w-3.5 h-3.5" />
                                )}
                              </Link>
                            );
                          })()}
                          <button
                            onClick={() => setQrAsset(a)}
                            className="btn-secondary p-1.5"
                            title="In tem mã QR"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          <Link to={`/assets/${a.id}`} className="btn-secondary px-2.5 py-1 text-xs">
                            Chi tiết
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="shrink-0 border-t border-line bg-slate-50/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-secondary">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="tabular-nums">
              {assets.length === 0
                ? 'Hiển thị 0 tài sản'
                : `Hiển thị ${startIndex + 1}–${Math.min(startIndex + pageSize, assets.length)} / ${assets.length} tài sản`}
            </span>
            <label className="inline-flex items-center gap-1.5">
              <span>Số dòng/trang:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                  tableScrollRef.current?.scrollTo({ top: 0 });
                }}
                className="px-2 py-1 text-xs bg-white border border-line rounded text-ink-primary focus:outline-none focus:border-brand"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToPage(1)}
              disabled={safePage <= 1}
              className="p-1.5 rounded border border-line bg-white text-ink-secondary hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Trang đầu"
              aria-label="Trang đầu"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage <= 1}
              className="p-1.5 rounded border border-line bg-white text-ink-secondary hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Trang trước"
              aria-label="Trang trước"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {pageNumbers.map((p, i) =>
              p === 'ellipsis' ? (
                <span key={`e-${i}`} className="px-1.5 text-ink-muted select-none">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => goToPage(p)}
                  className={`min-w-[28px] h-7 px-2 rounded border text-xs font-medium tabular-nums transition-colors ${
                    p === safePage
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white text-ink-primary border-line hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              ),
            )}

            <button
              type="button"
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage >= totalPages}
              className="p-1.5 rounded border border-line bg-white text-ink-secondary hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Trang sau"
              aria-label="Trang sau"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => goToPage(totalPages)}
              disabled={safePage >= totalPages}
              className="p-1.5 rounded border border-line bg-white text-ink-secondary hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Trang cuối"
              aria-label="Trang cuối"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Assign / Transfer / Return Modal */}
      <Modal
        open={!!actionAsset}
        onClose={() => setActionAsset(null)}
        title={actionAsset ? `Cấp phát & Điều chuyển — ${actionAsset.assetCode}` : 'Cấp phát & Điều chuyển tài sản'}
        maxWidth="max-w-lg"
      >
        {actionAsset && (
          <form onSubmit={handleSubmitAction} className="space-y-4">
            <div className="p-3 rounded-lg bg-slate-50 border border-line text-xs space-y-1">
              <div className="font-semibold text-ink-primary flex items-center justify-between gap-2">
                <span className="truncate">{actionAsset.name}</span>
                <span className="font-mono text-brand shrink-0">{actionAsset.assetCode}</span>
              </div>
              <div className="text-ink-secondary">
                Hiện tại: <strong>{actionAsset.usingDepartment?.name || 'Kho / Chưa phân bổ'}</strong>
                {' · '}
                Người dùng:{' '}
                <strong>
                  {actionAsset.assignedEmployee
                    ? `${actionAsset.assignedEmployee.code} — ${actionAsset.assignedEmployee.fullName}`
                    : actionAsset.assignedUserName || 'Chưa gán'}
                </strong>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-slate-100 border border-line text-xs">
              <button
                type="button"
                onClick={() => {
                  setActionMode('HANDOVER');
                  setActionErr('');
                }}
                className={`py-1.5 px-2 rounded-md font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${
                  actionMode === 'HANDOVER' ? 'bg-white text-brand shadow-xs' : 'text-ink-secondary hover:text-ink-primary'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" /> Cấp phát
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionMode('TRANSFER');
                  setActionErr('');
                }}
                className={`py-1.5 px-2 rounded-md font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${
                  actionMode === 'TRANSFER' ? 'bg-white text-brand shadow-xs' : 'text-ink-secondary hover:text-ink-primary'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" /> Điều chuyển
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionMode('RETURN');
                  setActionErr('');
                }}
                className={`py-1.5 px-2 rounded-md font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${
                  actionMode === 'RETURN' ? 'bg-white text-red-600 shadow-xs' : 'text-ink-secondary hover:text-ink-primary'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Thu hồi kho
              </button>
            </div>

            {actionErr && (
              <div className="p-2.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionErr}</span>
              </div>
            )}

            {actionMode !== 'RETURN' && (
              <>
                {/* Searchable Employee Selector */}
                <div ref={empBoxRef} className="relative">
                  <label className="label-field">Nhân viên tiếp nhận</label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      value={empQuery}
                      onFocus={() => setEmpDropdownOpen(true)}
                      onChange={(e) => {
                        setEmpQuery(e.target.value);
                        setEmpDropdownOpen(true);
                        if (actionForm.employeeId) setActionForm((p) => ({ ...p, employeeId: '' }));
                      }}
                      className="input-field pl-9 pr-8"
                      placeholder="Nhập mã hoặc tên nhân viên để tìm..."
                      autoComplete="off"
                    />
                    {(empQuery || actionForm.employeeId) && (
                      <button
                        type="button"
                        onClick={() => {
                          setEmpQuery('');
                          setActionForm((p) => ({ ...p, employeeId: '' }));
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {empDropdownOpen && (
                    <div className="absolute z-30 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-line bg-white shadow-lg divide-y divide-slate-100">
                      {filteredEmployees.length === 0 ? (
                        <div className="px-3 py-3 text-xs text-ink-muted text-center">
                          {employees.length === 0 ? 'Chưa có nhân viên trong Danh mục Nhân viên.' : 'Không tìm thấy nhân viên phù hợp.'}
                        </div>
                      ) : (
                        filteredEmployees.map((emp) => {
                          const dLabel = emp.department?.name || deptNameById.get(emp.departmentId) || 'Chưa gán phòng ban';
                          return (
                            <button
                              type="button"
                              key={emp.id}
                              onClick={() => handleSelectActionEmployee(emp)}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-sky-50/70 transition-colors ${
                                emp.id === actionForm.employeeId ? 'bg-[#DFF1F8]' : ''
                              }`}
                            >
                              <div className="font-medium text-ink-primary">
                                <span className="font-mono font-semibold text-brand mr-1.5">{emp.code}</span>
                                {emp.fullName}
                              </div>
                              <div className="text-[11px] text-ink-muted">
                                {dLabel}{emp.title ? ` · ${emp.title}` : ''}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label-field flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-brand" /> Phòng ban tiếp nhận
                    </label>
                    <select
                      value={actionForm.departmentId}
                      onChange={(e) => handleActionDeptChange(e.target.value)}
                      className="input-field"
                    >
                      <option value="">-- Chọn phòng ban --</option>
                      {(meta.departments || []).map((d: any) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-field">Vị trí đặt máy</label>
                    <select
                      value={actionForm.locationId}
                      onChange={(e) => setActionForm({ ...actionForm, locationId: e.target.value })}
                      className="input-field"
                    >
                      <option value="">-- Chọn vị trí --</option>
                      {(meta.locations || []).map((loc: any) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                          {[loc.building, loc.floor, loc.room].filter(Boolean).length > 0
                            ? ` (${[loc.building, loc.floor, loc.room].filter(Boolean).join(' · ')})`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {(actionMode === 'TRANSFER' || actionMode === 'RETURN') && (
              <div className="space-y-1.5">
                <label className="label-field">
                  Lý do {actionMode === 'RETURN' ? 'thu hồi' : 'điều chuyển'} <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(actionMode === 'RETURN' ? QUICK_RETURN_REASONS : QUICK_TRANSFER_REASONS).map((chip) => (
                    <button
                      type="button"
                      key={chip}
                      onClick={() => setActionForm((p) => ({ ...p, reason: chip }))}
                      className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                        actionForm.reason === chip
                          ? 'bg-brand text-white border-brand'
                          : 'bg-slate-50 text-ink-secondary border-line hover:border-brand/50'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <input
                  required
                  value={actionForm.reason}
                  onChange={(e) => setActionForm({ ...actionForm, reason: e.target.value })}
                  className="input-field"
                  placeholder="Nhập lý do thực hiện"
                />
              </div>
            )}

            <div>
              <label className="label-field">Ghi chú</label>
              <input
                value={actionForm.notes}
                onChange={(e) => setActionForm({ ...actionForm, notes: e.target.value })}
                className="input-field"
                placeholder="Ghi chú bàn giao / tình trạng máy kèm theo (nếu có)"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button type="button" onClick={() => setActionAsset(null)} className="btn-secondary">
                Hủy
              </button>
              <button
                type="submit"
                disabled={actionSaving}
                className={actionMode === 'RETURN' ? 'btn-primary !bg-red-600 hover:!bg-red-700' : 'btn-primary'}
              >
                {actionSaving
                  ? 'Đang lưu...'
                  : actionMode === 'HANDOVER'
                    ? 'Xác nhận cấp phát'
                    : actionMode === 'RETURN'
                      ? 'Xác nhận thu hồi về kho'
                      : 'Xác nhận điều chuyển'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* QR Code Label Print Modal */}
      <Modal open={!!qrAsset} onClose={() => setQrAsset(null)} title="Tem nhãn mã QR tài sản" maxWidth="max-w-sm">
        {qrAsset && (() => {
          const qrUrl = `${window.location.origin}/qr/${encodeURIComponent(qrAsset.assetCode)}`;
          return (
            <div className="text-center space-y-4">
              <AssetQrLabel asset={qrAsset} config={meta.qrConfig} />
              <div className="no-print text-[11px] text-ink-muted space-y-1">
                <div>Quét bằng camera điện thoại để xem ngay thẻ thông tin tài sản.</div>
                <a
                  href={qrUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-brand hover:underline font-medium"
                >
                  <ExternalLink className="w-3 h-3" /> Mở trang xem trước tem QR
                </a>
              </div>
              <div className="no-print flex justify-center gap-2">
                <button onClick={() => window.print()} className="btn-primary">
                  <Printer className="w-4 h-4" /> In tem QR
                </button>
                <button onClick={() => setQrAsset(null)} className="btn-secondary">
                  Đóng
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};
