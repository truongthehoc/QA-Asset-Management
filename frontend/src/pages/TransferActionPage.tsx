import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowLeftRight,
  UserCheck,
  RotateCcw,
  Search,
  X,
  Building2,
  MapPin,
  Printer,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  FileText,
  Plus,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, AssetStatusBadge } from '../components/UiPrimitives';
import { HandoverReceipt, ReceiptData } from '../components/HandoverReceipt';

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

export const TransferActionPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialAssetId = searchParams.get('assetId') || '';
  const initialModeParam = (searchParams.get('mode') || '').toUpperCase();

  const [assets, setAssets] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ departments: [], locations: [], employees: [], qrConfig: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const [mode, setMode] = useState<'HANDOVER' | 'TRANSFER' | 'RETURN'>(
    initialModeParam === 'TRANSFER'
      ? 'TRANSFER'
      : initialModeParam === 'RETURN'
        ? 'RETURN'
        : 'HANDOVER',
  );

  // Asset searchable combobox
  const [assetQuery, setAssetQuery] = useState('');
  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
  const assetBoxRef = useRef<HTMLDivElement>(null);

  // Employee searchable combobox
  const [empQuery, setEmpQuery] = useState('');
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
  const empBoxRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    assetId: initialAssetId,
    employeeId: '',
    departmentId: '',
    locationId: '',
    locationDetail: '',
    handoverBy: user?.fullName || '',
    receivedBy: '',
    reason: '',
    notes: '',
  });

  useEffect(() => {
    Promise.all([api.get('/assets'), api.get('/admin/meta')])
      .then(([aRes, mRes]) => {
        const list = (aRes.data || []).filter((a: any) => a.status !== 'DISPOSED');
        setAssets(list);
        setMeta(mRes.data || { departments: [], locations: [], employees: [] });
        if (initialAssetId) {
          const found = list.find((a: any) => a.id === initialAssetId);
          if (found) {
            setAssetQuery(`${found.assetCode} — ${found.name}`);
            if (!initialModeParam) {
              const hasHolder = Boolean(found.usingDepartmentId || found.assignedEmployeeId || found.assignedUserName);
              setMode(hasHolder ? 'TRANSFER' : 'HANDOVER');
            }
          }
        }
      })
      .finally(() => setLoading(false));
  }, [initialAssetId, initialModeParam]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (assetBoxRef.current && !assetBoxRef.current.contains(e.target as Node)) {
        setAssetDropdownOpen(false);
      }
      if (empBoxRef.current && !empBoxRef.current.contains(e.target as Node)) {
        setEmpDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const departments: any[] = meta.departments || [];
  const locations: any[] = meta.locations || [];
  const employees: any[] = meta.employees || [];

  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === form.assetId) || null,
    [assets, form.assetId],
  );
  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === form.employeeId) || null,
    [employees, form.employeeId],
  );
  const selectedDept = useMemo(
    () => departments.find((d) => d.id === form.departmentId) || null,
    [departments, form.departmentId],
  );
  const selectedLoc = useMemo(
    () => locations.find((l) => l.id === form.locationId) || null,
    [locations, form.locationId],
  );

  const assetHasHolder = Boolean(
    selectedAsset &&
      (selectedAsset.usingDepartmentId || selectedAsset.assignedEmployeeId || selectedAsset.assignedUserName),
  );
  const isCurrentlyAllocated = Boolean(selectedAsset && (assetHasHolder || selectedAsset.status === 'IN_USE'));

  useEffect(() => {
    if (!selectedAsset) return;
    if (!isCurrentlyAllocated && mode !== 'HANDOVER') {
      setMode('HANDOVER');
    } else if (isCurrentlyAllocated && mode === 'HANDOVER') {
      setMode('TRANSFER');
    }
  }, [selectedAsset, isCurrentlyAllocated, mode]);

  const currentHolderLabel = useMemo(() => {
    if (!selectedAsset) return '';
    return (
      selectedAsset.assignedEmployee?.fullName ||
      selectedAsset.assignedUserName ||
      selectedAsset.usingDepartment?.name ||
      ''
    );
  }, [selectedAsset]);

  // Auto-fill Bên bàn giao (Bên A) & Bên tiếp nhận (Bên B) accurately by mode
  useEffect(() => {
    if (mode === 'RETURN') {
      setForm((p) => ({
        ...p,
        handoverBy: currentHolderLabel || p.handoverBy,
        receivedBy: user?.fullName || p.receivedBy,
      }));
    } else if (mode === 'TRANSFER') {
      setForm((p) => ({
        ...p,
        handoverBy: currentHolderLabel || user?.fullName || p.handoverBy,
        receivedBy: selectedEmployee?.fullName || '',
      }));
    } else {
      setForm((p) => ({
        ...p,
        handoverBy: user?.fullName || p.handoverBy,
        receivedBy: selectedEmployee?.fullName || '',
      }));
    }
  }, [mode, currentHolderLabel, user?.fullName]);

  const filteredAssets = useMemo(() => {
    const q = assetQuery.trim().toLowerCase();
    if (!q) return assets.slice(0, 30);
    return assets
      .filter(
        (a) =>
          (a.assetCode || '').toLowerCase().includes(q) ||
          (a.name || '').toLowerCase().includes(q) ||
          (a.serialNumber || '').toLowerCase().includes(q) ||
          (a.assignedUserName || '').toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [assets, assetQuery]);

  const filteredEmployees = useMemo(() => {
    const q = empQuery.trim().toLowerCase();
    if (!q) return employees.slice(0, 30);
    return employees
      .filter((e) => {
        const dName = e.department?.name || '';
        return (
          (e.fullName || '').toLowerCase().includes(q) ||
          (e.code || '').toLowerCase().includes(q) ||
          dName.toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [employees, empQuery]);

  const resolveDeptLocationId = (deptId?: string | null) => {
    if (!deptId) return '';
    const d = departments.find((x) => x.id === deptId);
    return d?.locationId || d?.location?.id || '';
  };

  const handlePickAsset = (a: any) => {
    setForm((p) => ({ ...p, assetId: a.id }));
    setAssetQuery(`${a.assetCode} — ${a.name}`);
    setAssetDropdownOpen(false);
    const hasHolder = Boolean(a.usingDepartmentId || a.assignedEmployeeId || a.assignedUserName);
    setMode(hasHolder ? 'TRANSFER' : 'HANDOVER');
  };

  const handlePickEmployee = (emp: any) => {
    const nextDeptId = emp.departmentId || '';
    const mappedLocId = emp.department?.locationId || resolveDeptLocationId(nextDeptId);
    setForm((p) => ({
      ...p,
      employeeId: emp.id,
      departmentId: nextDeptId || p.departmentId,
      locationId: mappedLocId || p.locationId,
      receivedBy: emp.fullName,
    }));
    setEmpQuery(`${emp.code} — ${emp.fullName}`);
    setEmpDropdownOpen(false);
  };

  const handleDeptChange = (deptId: string) => {
    const mappedLocId = resolveDeptLocationId(deptId);
    setForm((p) => ({
      ...p,
      departmentId: deptId,
      locationId: mappedLocId || p.locationId,
    }));
  };

  const handleResetForNew = () => {
    setReceipt(null);
    setAssetQuery('');
    setEmpQuery('');
    setForm({
      assetId: '',
      employeeId: '',
      departmentId: '',
      locationId: '',
      locationDetail: '',
      handoverBy: user?.fullName || '',
      receivedBy: '',
      reason: '',
      notes: '',
    });
    api.get('/assets').then((r) => setAssets((r.data || []).filter((a: any) => a.status !== 'DISPOSED')));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (!selectedAsset) {
      setNotice({ type: 'err', text: 'Vui lòng chọn tài sản cần thực hiện.' });
      return;
    }
    if (mode !== 'RETURN' && !form.employeeId && !form.departmentId) {
      setNotice({ type: 'err', text: 'Vui lòng chọn nhân viên hoặc phòng ban tiếp nhận.' });
      return;
    }
    if ((mode === 'TRANSFER' || mode === 'RETURN') && !form.reason.trim()) {
      setNotice({ type: 'err', text: 'Vui lòng nhập hoặc chọn lý do thực hiện.' });
      return;
    }

    const currentUserDeptName =
      departments.find((d) => d.id === user?.departmentId)?.name ||
      meta.docTemplate?.departmentSubtitle ||
      'Phòng Công nghệ Thông tin';
    const locText = [selectedLoc?.name, form.locationDetail.trim()].filter(Boolean).join(' · ') || undefined;
    setSaving(true);
    try {
      if (mode === 'HANDOVER') {
        const res = await api.post('/transfers/handover', {
          assetId: selectedAsset.id,
          employeeId: form.employeeId || undefined,
          departmentId: form.departmentId || undefined,
          assigneeName: selectedEmployee?.fullName || undefined,
          locationId: form.locationId || undefined,
          locationDetail: locText,
          handoverBy: form.handoverBy.trim(),
          receivedBy: form.receivedBy.trim(),
          notes: form.notes.trim() || undefined,
        });
        const rec = res.data;
        setReceipt({
          kind: 'HANDOVER',
          code: rec.assignmentCode,
          date: rec.handoverDate || new Date().toISOString(),
          companyName: meta.qrConfig?.labelTitle,
          orgInfo: meta.orgInfo,
          docTemplate: meta.docTemplate,
          asset: {
            assetCode: selectedAsset.assetCode,
            name: selectedAsset.name,
            assetTypeName: selectedAsset.assetType?.name,
            serialNumber: selectedAsset.serialNumber,
            manufacturer: selectedAsset.manufacturer,
            model: selectedAsset.model,
          },
          fromDepartment: currentUserDeptName,
          toDepartment: selectedDept?.name || selectedEmployee?.department?.name || '—',
          handoverBy: rec.handoverBy,
          receivedBy: rec.receivedBy,
          reason: 'Cấp phát / Bàn giao tài sản cho đơn vị sử dụng',
          notes: rec.notes || undefined,
        });
        setNotice({ type: 'ok', text: `Đã lập biên bản bàn giao ${rec.assignmentCode} thành công.` });
      } else if (mode === 'RETURN') {
        const res = await api.post('/transfers', {
          assetId: selectedAsset.id,
          mode: 'RETURN',
          reason: form.reason.trim(),
          handoverBy: form.handoverBy.trim(),
          receivedBy: form.receivedBy.trim(),
          notes: form.notes.trim() || undefined,
        });
        const rec = res.data;
        setReceipt({
          kind: 'RETURN',
          code: rec.transferCode,
          date: rec.transferDate || new Date().toISOString(),
          companyName: meta.qrConfig?.labelTitle,
          orgInfo: meta.orgInfo,
          docTemplate: meta.docTemplate,
          asset: {
            assetCode: selectedAsset.assetCode,
            name: selectedAsset.name,
            assetTypeName: selectedAsset.assetType?.name,
            serialNumber: selectedAsset.serialNumber,
            manufacturer: selectedAsset.manufacturer,
            model: selectedAsset.model,
          },
          fromDepartment: selectedAsset.usingDepartment?.name || '—',
          toDepartment: currentUserDeptName,
          handoverBy: rec.handoverBy,
          receivedBy: rec.receivedBy,
          reason: rec.reason,
          notes: rec.notes || undefined,
        });
        setNotice({ type: 'err', text: `Đã lập biên bản thu hồi ${rec.transferCode} — tài sản đã chuyển về Kho IT.` });
      } else {
        const res = await api.post('/transfers', {
          assetId: selectedAsset.id,
          employeeId: form.employeeId || undefined,
          toDepartmentId: form.departmentId || undefined,
          toUserName: selectedEmployee?.fullName || undefined,
          toLocationId: form.locationId || undefined,
          toLocation: locText,
          reason: form.reason.trim(),
          handoverBy: form.handoverBy.trim(),
          receivedBy: form.receivedBy.trim(),
          notes: form.notes.trim() || undefined,
        });
        const rec = res.data;
        setReceipt({
          kind: 'TRANSFER',
          code: rec.transferCode,
          date: rec.transferDate || new Date().toISOString(),
          companyName: meta.qrConfig?.labelTitle,
          orgInfo: meta.orgInfo,
          docTemplate: meta.docTemplate,
          asset: {
            assetCode: selectedAsset.assetCode,
            name: selectedAsset.name,
            assetTypeName: selectedAsset.assetType?.name,
            serialNumber: selectedAsset.serialNumber,
            manufacturer: selectedAsset.manufacturer,
            model: selectedAsset.model,
          },
          fromDepartment: selectedAsset.usingDepartment?.name || currentUserDeptName,
          toDepartment: selectedDept?.name || selectedEmployee?.department?.name || '—',
          handoverBy: rec.handoverBy,
          receivedBy: rec.receivedBy,
          reason: rec.reason,
          notes: rec.notes || undefined,
        });
        setNotice({ type: 'ok', text: `Đã lập biên bản điều chuyển ${rec.transferCode} thành công.` });
      }
    } catch (err: any) {
      setNotice({ type: 'err', text: err.response?.data?.message || 'Không thể lập phiếu bàn giao / điều chuyển.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-ink-secondary">Đang tải dữ liệu nghiệp vụ...</div>;
  }

  // AFTER SUBMIT: OFFICIAL PRINTABLE RECEIPT VIEW
  if (receipt) {
    return (
      <div className="space-y-5">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-ink-primary">Biên bản đã được lập & lưu lịch sử</h1>
              <p className="text-xs text-ink-secondary">
                Chứng từ <span className="font-mono font-semibold text-brand">{receipt.code}</span> đã sẵn sàng để in hoặc lưu PDF ký xác nhận.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => window.print()} className="btn-primary">
              <Printer className="w-4 h-4" /> In biên bản / Lưu PDF
            </button>
            <button type="button" onClick={handleResetForNew} className="btn-secondary">
              <Plus className="w-4 h-4" /> Lập phiếu khác
            </button>
            <Link to="/transfers" className="btn-secondary">
              Danh sách phiếu
            </Link>
            <Link to="/assets" className="btn-secondary">
              Danh sách tài sản
            </Link>
          </div>
        </div>

        {notice && (
          <div
            className={`no-print p-3 rounded-md border text-sm flex items-center gap-2 ${
              notice.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {notice.type === 'err' && <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{notice.text}</span>
          </div>
        )}

        <HandoverReceipt data={receipt} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cấp phát, Điều chuyển & Thu hồi tài sản"
        subtitle="Thực hiện bàn giao, luân chuyển hoặc thu hồi tài sản về kho và tự động sinh Biên bản chính thức kèm lịch sử Audit Log."
        actions={
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
        }
      />

      {notice && (
        <div
          className={`p-3 rounded-md border text-sm flex items-center gap-2 ${
            notice.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {notice.type === 'err' && <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* 3-Mode Selector Cards */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          {
            id: 'HANDOVER' as const,
            title: 'Cấp phát / Bàn giao mới',
            desc: 'Giao tài sản từ kho cho nhân viên / phòng ban sử dụng',
            icon: UserCheck,
            disabled: Boolean(selectedAsset && isCurrentlyAllocated),
            disabledHint: 'Tài sản đang được sử dụng — hãy chọn Điều chuyển hoặc Thu hồi',
            baseCls: 'border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/60 hover:border-emerald-400',
            activeCls: 'border-emerald-600 bg-gradient-to-br from-emerald-100/90 via-emerald-50 to-teal-50 ring-2 ring-emerald-500/25 shadow-sm',
            iconCls: 'bg-emerald-600 text-white',
            titleCls: 'text-emerald-900',
          },
          {
            id: 'TRANSFER' as const,
            title: 'Điều chuyển tài sản',
            desc: 'Chuyển đổi người sử dụng hoặc phòng ban quản lý',
            icon: ArrowLeftRight,
            disabled: Boolean(selectedAsset && !isCurrentlyAllocated),
            disabledHint: 'Tài sản chưa được cấp phát — chỉ có thể chọn Cấp phát',
            baseCls: 'border-sky-200 bg-gradient-to-br from-sky-50/80 via-white to-indigo-50/60 hover:border-sky-400',
            activeCls: 'border-[#006E96] bg-gradient-to-br from-sky-100/90 via-sky-50 to-indigo-50 ring-2 ring-[#006E96]/25 shadow-sm',
            iconCls: 'bg-[#006E96] text-white',
            titleCls: 'text-sky-950',
          },
          {
            id: 'RETURN' as const,
            title: 'Thu hồi về Kho IT',
            desc: 'Thu hồi thiết bị về trạng thái Chưa phân bổ tại kho',
            icon: RotateCcw,
            disabled: Boolean(selectedAsset && !isCurrentlyAllocated),
            disabledHint: 'Tài sản đang ở kho — không cần thu hồi',
            baseCls: 'border-red-200 bg-gradient-to-br from-red-50/80 via-white to-rose-50/60 hover:border-red-400',
            activeCls: 'border-red-600 bg-gradient-to-br from-red-100/90 via-red-50 to-rose-50 ring-2 ring-red-500/25 shadow-sm',
            iconCls: 'bg-red-600 text-white',
            titleCls: 'text-red-900',
          },
        ].map((item) => {
          const Icon = item.icon;
          const active = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              title={item.disabled ? item.disabledHint : undefined}
              onClick={() => !item.disabled && setMode(item.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3 ${
                item.disabled
                  ? 'border-slate-200 bg-slate-100/80 opacity-50 cursor-not-allowed grayscale'
                  : active
                    ? item.activeCls
                    : item.baseCls
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-xs ${item.disabled ? 'bg-slate-400 text-white' : item.iconCls}`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-bold ${item.disabled ? 'text-slate-500' : item.titleCls}`}>
                  {item.title}
                </div>
                <div className="text-xs text-ink-secondary mt-0.5">
                  {item.disabled ? item.disabledHint : item.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main 2-column layout: Form (left) + Live Summary (right) */}
      <form onSubmit={handleSubmit} className="grid lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 space-y-4">
          {/* Section 1: Chọn tài sản */}
          <div className="rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50/65 via-sky-50/35 to-white p-5 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <h2 className="text-sm font-semibold text-sky-950 flex items-center gap-2 border-b border-sky-200/70 pb-2.5">
              <span className="w-6 h-6 rounded-md bg-sky-600 text-white inline-flex items-center justify-center shrink-0">
                <HardDrive className="w-3.5 h-3.5" />
              </span>
              1. Chọn tài sản thực hiện
            </h2>

            <div ref={assetBoxRef} className="relative">
              <label className="label-field">Tài sản <span className="text-red-500">*</span></label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={assetQuery}
                  onFocus={() => setAssetDropdownOpen(true)}
                  onChange={(e) => {
                    setAssetQuery(e.target.value);
                    setAssetDropdownOpen(true);
                    if (form.assetId) setForm((p) => ({ ...p, assetId: '' }));
                  }}
                  placeholder="Nhập mã tài sản, tên thiết bị, số serial hoặc người đang dùng..."
                  className="input-field pl-9 pr-8"
                  autoComplete="off"
                />
                {(assetQuery || form.assetId) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAssetQuery('');
                      setForm((p) => ({ ...p, assetId: '' }));
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {assetDropdownOpen && (
                <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-line bg-white shadow-lg divide-y divide-slate-100">
                  {filteredAssets.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-ink-muted text-center">Không tìm thấy tài sản phù hợp.</div>
                  ) : (
                    filteredAssets.map((a) => (
                      <button
                        type="button"
                        key={a.id}
                        onClick={() => handlePickAsset(a)}
                        className={`w-full text-left px-3 py-2.5 text-xs hover:bg-sky-50/70 transition-colors flex items-center justify-between gap-2 ${
                          a.id === form.assetId ? 'bg-[#DFF1F8]' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-ink-primary truncate">
                            <span className="font-mono font-semibold text-brand mr-1.5">{a.assetCode}</span>
                            {a.name}
                          </div>
                          <div className="text-[11px] text-ink-muted truncate">
                            {a.usingDepartment?.name || 'Kho / Chưa phân bổ'}
                            {a.assignedEmployee?.fullName || a.assignedUserName
                              ? ` · ${a.assignedEmployee?.fullName || a.assignedUserName}`
                              : ''}
                            {a.serialNumber ? ` · SN: ${a.serialNumber}` : ''}
                          </div>
                        </div>
                        <AssetStatusBadge status={a.status} />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedAsset && (
              <div className="p-3.5 rounded-lg bg-slate-50 border border-line grid sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-ink-muted">Đơn vị hiện tại</div>
                  <div className="font-semibold text-ink-primary mt-0.5">
                    {selectedAsset.usingDepartment?.name || 'Kho / Chưa phân bổ'}
                  </div>
                </div>
                <div>
                  <div className="text-ink-muted">Người đang sử dụng</div>
                  <div className="font-semibold text-ink-primary mt-0.5">
                    {selectedAsset.assignedEmployee
                      ? `${selectedAsset.assignedEmployee.code} — ${selectedAsset.assignedEmployee.fullName}`
                      : selectedAsset.assignedUserName || 'Chưa gán'}
                  </div>
                </div>
                <div>
                  <div className="text-ink-muted">Vị trí hiện tại</div>
                  <div className="font-medium text-ink-primary mt-0.5">
                    {Array.from(new Set([selectedAsset.location?.name, selectedAsset.locationDetail].filter(Boolean))).join(' · ') || '—'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Thông tin tiếp nhận */}
          {mode !== 'RETURN' && (
            <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/65 via-emerald-50/35 to-white p-5 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <h2 className="text-sm font-semibold text-emerald-950 flex items-center gap-2 border-b border-emerald-200/70 pb-2.5">
                <span className="w-6 h-6 rounded-md bg-emerald-600 text-white inline-flex items-center justify-center shrink-0">
                  <UserCheck className="w-3.5 h-3.5" />
                </span>
                2. Thông tin đơn vị & nhân viên tiếp nhận
              </h2>

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
                      if (form.employeeId) setForm((p) => ({ ...p, employeeId: '' }));
                    }}
                    placeholder="Nhập mã hoặc tên nhân viên (tự động nạp Phòng ban & Vị trí)..."
                    className="input-field pl-9 pr-8"
                    autoComplete="off"
                  />
                  {(empQuery || form.employeeId) && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmpQuery('');
                        setForm((p) => ({ ...p, employeeId: '' }));
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {empDropdownOpen && (
                  <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-line bg-white shadow-lg divide-y divide-slate-100">
                    {filteredEmployees.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-ink-muted text-center">
                        {employees.length === 0 ? 'Chưa có nhân viên trong Danh mục Nhân viên.' : 'Không tìm thấy nhân viên phù hợp.'}
                      </div>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <button
                          type="button"
                          key={emp.id}
                          onClick={() => handlePickEmployee(emp)}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-sky-50/70 transition-colors ${
                            emp.id === form.employeeId ? 'bg-[#DFF1F8]' : ''
                          }`}
                        >
                          <div className="font-medium text-ink-primary">
                            <span className="font-mono font-semibold text-brand mr-1.5">{emp.code}</span>
                            {emp.fullName}
                          </div>
                          <div className="text-[11px] text-ink-muted">
                            {emp.department?.name || 'Chưa gán phòng ban'}
                            {emp.department?.location?.name ? ` · ${emp.department.location.name}` : ''}
                            {emp.title ? ` · ${emp.title}` : ''}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="label-field flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-brand" /> Phòng ban tiếp nhận
                  </label>
                  <select
                    value={form.departmentId}
                    onChange={(e) => handleDeptChange(e.target.value)}
                    className="input-field"
                  >
                    <option value="">-- Chọn phòng ban --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label-field flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-brand" /> Vị trí đặt máy
                  </label>
                  <select
                    value={form.locationId}
                    onChange={(e) => setForm({ ...form, locationId: e.target.value })}
                    className="input-field"
                  >
                    <option value="">-- Chọn vị trí --</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                        {[loc.building, loc.floor, loc.room].filter(Boolean).length > 0
                          ? ` (${[loc.building, loc.floor, loc.room].filter(Boolean).join(' · ')})`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="label-field">Chi tiết vị trí / Bàn làm việc (tùy chọn)</label>
                  <input
                    value={form.locationDetail}
                    onChange={(e) => setForm({ ...form, locationDetail: e.target.value })}
                    className="input-field"
                    placeholder="Nhập vị trí cụ thể như số bàn, khu vực làm việc..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Thông tin biên bản & Lý do */}
          <div className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/65 via-amber-50/35 to-white p-5 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <h2 className="text-sm font-semibold text-amber-950 flex items-center gap-2 border-b border-amber-200/70 pb-2.5">
              <span className="w-6 h-6 rounded-md bg-amber-600 text-white inline-flex items-center justify-center shrink-0">
                <FileText className="w-3.5 h-3.5" />
              </span>
              {mode === 'RETURN' ? '2.' : '3.'} Thông tin biên bản & ký nhận
            </h2>

            <div className="grid sm:grid-cols-2 gap-3.5">
              <div>
                <label className="label-field">Người bàn giao (Bên A)</label>
                <input
                  value={form.handoverBy}
                  onChange={(e) => setForm({ ...form, handoverBy: e.target.value })}
                  className="input-field"
                  placeholder="Nhập họ tên người bàn giao"
                />
              </div>
              <div>
                <label className="label-field">Người ký tiếp nhận (Bên B)</label>
                <input
                  value={form.receivedBy}
                  onChange={(e) => setForm({ ...form, receivedBy: e.target.value })}
                  className="input-field"
                  placeholder="Tự điền theo nhân viên tiếp nhận"
                />
              </div>
            </div>

            {(mode === 'TRANSFER' || mode === 'RETURN') && (
              <div className="space-y-2">
                <label className="label-field">
                  Lý do {mode === 'RETURN' ? 'thu hồi' : 'điều chuyển'} <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(mode === 'RETURN' ? QUICK_RETURN_REASONS : QUICK_TRANSFER_REASONS).map((chip) => (
                    <button
                      type="button"
                      key={chip}
                      onClick={() => setForm((p) => ({ ...p, reason: chip }))}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        form.reason === chip
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
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="input-field"
                  placeholder="Nhập lý do thực hiện"
                />
              </div>
            )}

            <div>
              <label className="label-field">Tình trạng thiết bị & Ghi chú biên bản</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="input-field"
                placeholder="Ghi nhận tình trạng thiết bị, phụ kiện đi kèm (sạc, chuột, túi chống sốc...) nếu có"
              />
            </div>
          </div>
        </div>

        {/* Right column: Live Summary & Submit */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-20">
          <div className="rounded-xl border border-indigo-200/80 bg-gradient-to-b from-indigo-50/60 via-white to-slate-50/80 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <h3 className="text-sm font-semibold text-ink-primary">Tóm tắt biên bản</h3>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  mode === 'RETURN'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : mode === 'TRANSFER'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'bg-sky-50 text-brand border border-sky-200'
                }`}
              >
                {mode === 'HANDOVER' ? 'Cấp phát mới' : mode === 'TRANSFER' ? 'Điều chuyển' : 'Thu hồi về kho'}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-ink-muted">Tài sản:</span>
                <span className="font-semibold text-right text-ink-primary">
                  {selectedAsset ? `${selectedAsset.assetCode} — ${selectedAsset.name}` : 'Chưa chọn'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-ink-muted">Từ đơn vị:</span>
                <span className="text-right text-ink-secondary">
                  {selectedAsset?.usingDepartment?.name || 'Kho thiết bị'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-ink-muted">Đến đơn vị:</span>
                <span className="font-semibold text-right text-ink-primary">
                  {mode === 'RETURN' ? 'Kho thiết bị' : selectedDept?.name || 'Chưa chọn'}
                </span>
              </div>
              {mode !== 'RETURN' && (
                <>
                  <div className="flex justify-between gap-2">
                    <span className="text-ink-muted">Nhân viên nhận:</span>
                    <span className="font-medium text-right text-ink-primary">
                      {selectedEmployee ? `${selectedEmployee.code} — ${selectedEmployee.fullName}` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-ink-muted">Vị trí mới:</span>
                    <span className="text-right text-ink-secondary">
                      {[selectedLoc?.name, form.locationDetail.trim()].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between gap-2 pt-2 border-t border-line">
                <span className="text-ink-muted">Trạng thái sau lưu:</span>
                <span className={`font-semibold ${mode === 'RETURN' ? 'text-indigo-700' : 'text-emerald-700'}`}>
                  {mode === 'RETURN' ? 'Chưa phân bổ (Tại kho)' : 'Đang sử dụng'}
                </span>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={saving || !selectedAsset}
                className={`w-full justify-center py-2.5 ${
                  mode === 'RETURN'
                    ? 'btn-primary !bg-red-600 hover:!bg-red-700'
                    : mode === 'HANDOVER'
                      ? 'btn-primary !bg-emerald-600 hover:!bg-emerald-700'
                      : 'btn-primary'
                }`}
              >
                <FileText className="w-4 h-4" />
                {saving
                  ? 'Đang xử lý & tạo biên bản...'
                  : mode === 'HANDOVER'
                    ? 'Xác nhận cấp phát & Xuất biên bản'
                    : mode === 'RETURN'
                      ? 'Xác nhận thu hồi & Xuất biên bản'
                      : 'Xác nhận điều chuyển & Xuất biên bản'}
              </button>
              <p className="text-[11px] text-ink-muted text-center">
                Sau khi xác nhận, hệ thống tự động sinh Biên bản A4 sẵn sàng in ấn và lưu toàn bộ lịch sử.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
